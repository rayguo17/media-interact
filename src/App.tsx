import { useEffect, useRef, useState } from 'react'
import './App.css'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const processingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [frameMs, setFrameMs] = useState<number | null>(null)
  const [avgFrameMs, setAvgFrameMs] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

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
          }else{
            console.log('Webcam stream obtained:', stream)
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
        const width = video.videoWidth
        const height = video.videoHeight

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
          }
        }

        const handLandmarker = handLandmarkerRef.current
        if (handLandmarker && !processingRef.current) {
          processingRef.current = true
          const now = performance.now()
          const result = handLandmarker.detectForVideo(video, now)
          const elapsedMs = performance.now() - now
          console.log('HandLandmarker result:', result)
          setFrameMs(elapsedMs)
          setAvgFrameMs((prev) => (prev === null ? elapsedMs : prev * 0.9 + elapsedMs * 0.1))
          processingRef.current = false
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
          <canvas
            ref={canvasRef}
            style={{ width: '100%', maxWidth: 720 }}
          />
          <div>
            <p>Hand landmarker: {ready ? 'ready' : 'loading'}</p>
            <p>
              Frame time: {frameMs ? `${frameMs.toFixed(2)} ms` : 'n/a'}
            </p>
            <p>
              Avg (EMA): {avgFrameMs ? `${avgFrameMs.toFixed(2)} ms` : 'n/a'}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
