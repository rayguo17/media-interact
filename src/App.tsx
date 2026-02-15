import { useEffect, useRef, useState, type FormEvent } from 'react'
import './App.css'
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'
import {
  clearRecognitionRuntimeState,
  createRecognitionRuntimeState,
  formatEvent,
  pinchTransitionRecognizer,
  processHandResult,
  wristMovementRecognizer,
  type MovementRecognizer,
  type MovementEvent,
  type OneTimeRecognizer,
  type OneTimeEvent,
  type HandPointer,
} from './recognizers'
import {
  addWorldObject,
  createThreeWorldRenderer,
  createWorld,
  renderCanvasAxes,
  renderWorld,
  updateWorldFrame,
  type WorldObjectKind,
} from './world'

type InteractableDraft = {
  kind: WorldObjectKind
  color: string
  positionX: number
  positionY: number
  positionZ: number
  sizeWidth: number
  sizeHeight: number
  sizeDepth: number
  modelUrl: string | null
  modelName: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const threeRendererRef = useRef<ReturnType<typeof createThreeWorldRenderer> | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const processingRef = useRef(false)
  const uploadedModelUrlsRef = useRef<string[]>([])
  const interactableIdRef = useRef(1)
  const recognitionStateRef = useRef(createRecognitionRuntimeState())
  const worldRef = useRef(createWorld())
  const oneTimeRecognizersRef = useRef<OneTimeRecognizer[]>([pinchTransitionRecognizer])
  const movementRecognizersRef = useRef<MovementRecognizer[]>([wristMovementRecognizer])
  const [error, setError] = useState<string | null>(null)
  const [frameMs, setFrameMs] = useState<number | null>(null)
  const [avgFrameMs, setAvgFrameMs] = useState<number | null>(null)
  const [lastOneTimeEvent, setLastOneTimeEvent] = useState<string>('n/a')
  const [lastMovementEvent, setLastMovementEvent] = useState<string>('n/a')
  const [interactableDraft, setInteractableDraft] = useState<InteractableDraft>({
    kind: 'rect',
    color: '#f59e0b',
    positionX: 160,
    positionY: 120,
    positionZ: 0.5,
    sizeWidth: 120,
    sizeHeight: 80,
    sizeDepth: 120,
    modelUrl: null,
    modelName: '',
  })
  const [ready, setReady] = useState(false)

  const canvasWidth = canvasRef.current?.width ?? 0
  const canvasHeight = canvasRef.current?.height ?? 0

  const onAddInteractable = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const width = canvasRef.current?.width ?? 1
    const height = canvasRef.current?.height ?? 1

    const normalizedX = clamp(interactableDraft.positionX / width, 0, 1)
    const normalizedY = clamp(interactableDraft.positionY / height, 0, 1)
    const normalizedWidth = clamp(interactableDraft.sizeWidth / width, 0.01, 1)
    const normalizedHeight = clamp(interactableDraft.sizeHeight / height, 0.01, 1)
    const normalizedDepth = clamp(interactableDraft.sizeDepth / Math.max(width, height), 0.01, 1)
    const normalizedZ = clamp(interactableDraft.positionZ, 0, 1)
    const isThreeDimensional =
      interactableDraft.kind === 'box3d' ||
      interactableDraft.kind === 'sphere3d' ||
      interactableDraft.kind === 'model3d'

    if (interactableDraft.kind === 'model3d' && !interactableDraft.modelUrl) {
      setError('Please upload a .glb or .gltf file before adding a 3D model object.')
      return
    }

    setError(null)

    addWorldObject(worldRef.current, {
      id: `interactable-${interactableIdRef.current}`,
      kind: interactableDraft.kind,
      interactable: true,
      position: {
        x: normalizedX,
        y: normalizedY,
        ...(isThreeDimensional ? { z: normalizedZ } : {}),
      },
      size: {
        width: normalizedWidth,
        height: normalizedHeight,
        ...(isThreeDimensional ? { depth: normalizedDepth } : {}),
      },
      ...(interactableDraft.kind === 'model3d' ? { modelUrl: interactableDraft.modelUrl ?? undefined } : {}),
      color: interactableDraft.color,
      visible: true,
      zIndex: 20,
    })

    interactableIdRef.current += 1
  }

  useEffect(() => {
    let cancelled = false

    const initHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        })

        if (!cancelled) {
          handLandmarkerRef.current = handLandmarker
          setReady(true)
        } else {
          handLandmarker.close()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load hand landmarker.')
        }
      }
    }

    initHandLandmarker()

    return () => {
      cancelled = true
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close()
        handLandmarkerRef.current = null
      }
      clearRecognitionRuntimeState(recognitionStateRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const url of uploadedModelUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      uploadedModelUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    const threeCanvas = threeCanvasRef.current
    if (!threeCanvas) return

    const renderer = createThreeWorldRenderer(threeCanvas)
    threeRendererRef.current = renderer

    return () => {
      renderer.dispose()
      threeRendererRef.current = null
    }
  }, [])

  useEffect(() => {
    let stream: MediaStream | null = null

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })

        if (videoRef.current) {
          if (videoRef.current.srcObject) {
            console.warn('Video element already has a source object. Overwriting it.')
          } else {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to access webcam.')
      }
    }

    startWebcam()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    const renderFrame = () => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (video && canvas && video.readyState >= 2) {
        const frameTimestamp = performance.now()
        const width = video.videoWidth
        const height = video.videoHeight
        let oneTimeEvents: OneTimeEvent[] = []
        let movementEvents: MovementEvent[] = []
        let handPointers: HandPointer[] = []
        let rawHandResult: HandLandmarkerResult | undefined

        const handLandmarker = handLandmarkerRef.current
        if (handLandmarker && !processingRef.current) {
          processingRef.current = true
          const now = frameTimestamp
          const result = handLandmarker.detectForVideo(video, now)
          rawHandResult = result
          const elapsedMs = performance.now() - now

          const events = processHandResult(
            { timestamp: now, result },
            recognitionStateRef.current,
            oneTimeRecognizersRef.current,
            movementRecognizersRef.current
          )

          oneTimeEvents = events.oneTimeEvents
          movementEvents = events.movementEvents
          handPointers = events.handPointers

          if (events.oneTimeEvents.length > 0) {
            setLastOneTimeEvent(formatEvent(events.oneTimeEvents[events.oneTimeEvents.length - 1]))
          }

          if (events.movementEvents.length > 0) {
            setLastMovementEvent(formatEvent(events.movementEvents[events.movementEvents.length - 1]))
          }

          setFrameMs(elapsedMs)
          setAvgFrameMs((prev) => (prev === null ? elapsedMs : prev * 0.9 + elapsedMs * 0.1))
          processingRef.current = false
        }

        if (width > 0 && height > 0) {
          if (canvas.width !== width) {
            canvas.width = width
          }
          if (canvas.height !== height) {
            canvas.height = height
          }

          const ctx = canvas.getContext('2d')
          if (ctx) {
            // obtain the current video frame and draw it on the canvas
            ctx.drawImage(video, 0, 0, width, height)
            const imageData = ctx.getImageData(0, 0, width, height)
            // modification: invert the colors of the image
            const data = imageData.data

            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i]
              data[i + 1] = 255 - data[i + 1]
              data[i + 2] = 255 - data[i + 2]
            }

            // draw the modified image back to the canvas
            ctx.putImageData(imageData, 0, 0)

            updateWorldFrame(worldRef.current, {
              timestamp: frameTimestamp,
              canvasSize: { width, height },
              interaction: {
                oneTimeEvents,
                movementEvents,
                handPointers,
                rawHandResult,
              },
            })
            renderWorld(worldRef.current, ctx)
            renderCanvasAxes(ctx)

            if (threeCanvasRef.current) {
              if (threeCanvasRef.current.width !== width) {
                threeCanvasRef.current.width = width
              }
              if (threeCanvasRef.current.height !== height) {
                threeCanvasRef.current.height = height
              }
            }

            if (threeRendererRef.current) {
              threeRendererRef.current.resize(width, height)
              threeRendererRef.current.render(worldRef.current)
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(renderFrame)
    }

    rafIdRef.current = requestAnimationFrame(renderFrame)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  return (
    <main>
      <h1>Webcam Preview</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', maxWidth: 720 }}
          />
          <div className="canvas-stack" style={{ width: '100%', maxWidth: 720 }}>
            <canvas ref={canvasRef} className="base-world-canvas" />
            <canvas ref={threeCanvasRef} className="three-overlay-canvas" />
          </div>
          <div>
            <form className="add-interactable-panel" onSubmit={onAddInteractable}>
              <h2>Add Interactable</h2>
              <p className="panel-note">
                Canvas size: {canvasWidth || 'n/a'} × {canvasHeight || 'n/a'} (px)
              </p>

              <label>
                Shape
                <select
                  value={interactableDraft.kind}
                  onChange={(e) =>
                    setInteractableDraft((prev) => ({
                      ...prev,
                      kind: e.target.value as WorldObjectKind,
                    }))
                  }
                >
                  <option value="rect">Rectangle</option>
                  <option value="circle">Circle</option>
                  <option value="box3d">3D Box</option>
                  <option value="sphere3d">3D Sphere</option>
                  <option value="model3d">3D Model (Upload)</option>
                </select>
              </label>

              {interactableDraft.kind === 'model3d' && (
                <label>
                  Model File (.glb/.gltf)
                  <input
                    type="file"
                    accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      if (!/\.(glb|gltf)$/i.test(file.name)) {
                        setError('Unsupported 3D file type. Please upload .glb or .gltf.')
                        return
                      }

                      const modelUrl = URL.createObjectURL(file)
                      uploadedModelUrlsRef.current.push(modelUrl)

                      setInteractableDraft((prev) => ({
                        ...prev,
                        modelUrl,
                        modelName: file.name,
                      }))
                      setError(null)
                    }}
                  />
                  <span className="panel-note">
                    {interactableDraft.modelName ? `Selected: ${interactableDraft.modelName}` : 'No file selected'}
                  </span>
                </label>
              )}

              <label>
                Color
                <input
                  type="color"
                  value={interactableDraft.color}
                  onChange={(e) =>
                    setInteractableDraft((prev) => ({
                      ...prev,
                      color: e.target.value,
                    }))
                  }
                />
              </label>

              <div className="field-row">
                <label>
                  X
                  <input
                    type="number"
                    min={0}
                    max={canvasWidth || undefined}
                    value={interactableDraft.positionX}
                    onChange={(e) =>
                      setInteractableDraft((prev) => ({
                        ...prev,
                        positionX: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Y
                  <input
                    type="number"
                    min={0}
                    max={canvasHeight || undefined}
                    value={interactableDraft.positionY}
                    onChange={(e) =>
                      setInteractableDraft((prev) => ({
                        ...prev,
                        positionY: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              {(interactableDraft.kind === 'box3d' ||
                interactableDraft.kind === 'sphere3d' ||
                interactableDraft.kind === 'model3d') && (
                <label>
                  Z (0-1)
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={interactableDraft.positionZ}
                    onChange={(e) =>
                      setInteractableDraft((prev) => ({
                        ...prev,
                        positionZ: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              )}

              <div className="field-row">
                <label>
                  Width
                  <input
                    type="number"
                    min={1}
                    max={canvasWidth || undefined}
                    value={interactableDraft.sizeWidth}
                    onChange={(e) =>
                      setInteractableDraft((prev) => ({
                        ...prev,
                        sizeWidth: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Height
                  <input
                    type="number"
                    min={1}
                    max={canvasHeight || undefined}
                    value={interactableDraft.sizeHeight}
                    onChange={(e) =>
                      setInteractableDraft((prev) => ({
                        ...prev,
                        sizeHeight: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              {(interactableDraft.kind === 'box3d' ||
                interactableDraft.kind === 'sphere3d' ||
                interactableDraft.kind === 'model3d') && (
                <label>
                  Depth
                  <input
                    type="number"
                    min={1}
                    max={Math.max(canvasWidth, canvasHeight) || undefined}
                    value={interactableDraft.sizeDepth}
                    onChange={(e) =>
                      setInteractableDraft((prev) => ({
                        ...prev,
                        sizeDepth: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              )}

              <button type="submit" disabled={!canvasWidth || !canvasHeight}>
                Add to world
              </button>
            </form>

            <p>Hand landmarker: {ready ? 'ready' : 'loading'}</p>
            <p>
              Frame time: {frameMs ? `${frameMs.toFixed(2)} ms` : 'n/a'}
            </p>
            <p>
              Avg (EMA): {avgFrameMs ? `${avgFrameMs.toFixed(2)} ms` : 'n/a'}
            </p>
            <p>Last one-time event: {lastOneTimeEvent}</p>
            <p>Last movement event: {lastMovementEvent}</p>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
