import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { World, WorldObject } from './types'

type ThreeWorldRenderer = {
  resize: (width: number, height: number) => void
  render: (world: World) => void
  dispose: () => void
}

type RenderNode = {
  root: THREE.Object3D
  kind: 'primitive' | 'model'
  modelUrl?: string
  baseSize?: THREE.Vector3
  placeholder?: THREE.Mesh
  loading?: boolean
}

const isThreeObject = (object: WorldObject) =>
  object.kind === 'box3d' || object.kind === 'sphere3d' || object.kind === 'model3d'

const isModelObject = (object: WorldObject) => object.kind === 'model3d'

const toViewportPosition = (object: WorldObject, aspect: number) => {
  const z = object.position.z ?? 0.5
  return {
    x: (object.position.x - 0.5) * 2 * aspect,
    y: (0.5 - object.position.y) * 2,
    z: (z - 0.5) * 2,
  }
}

const toViewportSize = (object: WorldObject, aspect: number) => {
  const depth = object.size.depth ?? Math.min(object.size.width, object.size.height)
  return {
    width: object.size.width * 2 * aspect,
    height: object.size.height * 2,
    depth: depth * 2,
  }
}

const createGeometry = (object: WorldObject, aspect: number) => {
  const size = toViewportSize(object, aspect)

  if (object.kind === 'sphere3d') {
    return new THREE.SphereGeometry(Math.min(size.width, size.height) / 2, 24, 16)
  }

  return new THREE.BoxGeometry(size.width, size.height, size.depth)
}

const createMaterial = (color: string | undefined) => {
  return new THREE.MeshStandardMaterial({
    color: color ?? '#f59e0b',
    roughness: 0.45,
    metalness: 0.15,
    transparent: true,
    opacity: 0.95,
  })
}

const createPlaceholderMesh = (color: string | undefined) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createMaterial(color))
  return mesh
}

export const createThreeWorldRenderer = (canvas: HTMLCanvasElement): ThreeWorldRenderer => {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65)
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
  keyLight.position.set(2, 3, 4)
  scene.add(ambientLight)
  scene.add(keyLight)

  let aspect = 1
  const nodeById = new Map<string, RenderNode>()
  const gltfLoader = new GLTFLoader()

  const resize = (width: number, height: number) => {
    if (width <= 0 || height <= 0) return

    aspect = width / height
    camera.left = -aspect
    camera.right = aspect
    camera.top = 1
    camera.bottom = -1
    camera.updateProjectionMatrix()

    renderer.setSize(width, height, false)
  }

  const updateSelectionVisual = (objectRoot: THREE.Object3D, selected: boolean) => {
    objectRoot.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return

      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materialList) {
        const standard = material as THREE.MeshStandardMaterial
        if (!('emissive' in standard)) continue
        standard.emissive = selected ? new THREE.Color('#ffffff') : new THREE.Color('#000000')
        standard.emissiveIntensity = selected ? 0.25 : 0
      }
    })
  }

  const disposeObject = (objectRoot: THREE.Object3D) => {
    objectRoot.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return

      mesh.geometry.dispose()
      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materialList) {
        material.dispose()
      }
    })
  }

  const updateModelScale = (node: RenderNode, object: WorldObject) => {
    const nextSize = toViewportSize(object, aspect)

    if (node.baseSize) {
      node.root.scale.set(
        nextSize.width / Math.max(node.baseSize.x, 0.0001),
        nextSize.height / Math.max(node.baseSize.y, 0.0001),
        nextSize.depth / Math.max(node.baseSize.z, 0.0001)
      )
      return
    }

    node.root.scale.set(nextSize.width, nextSize.height, nextSize.depth)
  }

  const loadModelIntoNode = (node: RenderNode, object: WorldObject) => {
    if (!object.modelUrl) return
    if (node.loading && node.modelUrl === object.modelUrl) return
    if (node.modelUrl === object.modelUrl && node.baseSize) return

    node.loading = true
    node.modelUrl = object.modelUrl

    if (node.placeholder) {
      const material = node.placeholder.material as THREE.MeshStandardMaterial
      material.color = new THREE.Color('#f59e0b')
      material.opacity = 0.55
    }

    const expectedUrl = object.modelUrl
    gltfLoader.load(
      expectedUrl,
      (gltf) => {
        if (node.modelUrl !== expectedUrl) return

        node.root.clear()
        const modelRoot = gltf.scene

        const modelBounds = new THREE.Box3().setFromObject(modelRoot)
        const modelCenter = new THREE.Vector3()
        modelBounds.getCenter(modelCenter)
        modelRoot.position.sub(modelCenter)

        modelRoot.updateMatrixWorld(true)
        node.root.add(modelRoot)

        const box = new THREE.Box3().setFromObject(modelRoot)
        const size = new THREE.Vector3()
        box.getSize(size)
        node.baseSize = size
        node.placeholder = undefined
        node.loading = false
      },
      undefined,
      (error) => {
        console.error('Failed to load 3D model', expectedUrl, error)
        if (node.placeholder) {
          const material = node.placeholder.material as THREE.MeshStandardMaterial
          material.color = new THREE.Color('#ef4444')
          material.opacity = 0.7
        }
        node.loading = false
      }
    )
  }

  const upsertMesh = (object: WorldObject) => {
    if (!nodeById.has(object.id)) {
      if (isModelObject(object)) {
        const root = new THREE.Group()
        root.name = object.id
        const placeholder = createPlaceholderMesh(object.color)
        root.add(placeholder)
        scene.add(root)

        const modelNode: RenderNode = {
          root,
          kind: 'model',
          modelUrl: undefined,
          baseSize: undefined,
          placeholder,
          loading: false,
        }
        nodeById.set(object.id, modelNode)
      } else {
        const mesh = new THREE.Mesh(createGeometry(object, aspect), createMaterial(object.color))
        mesh.name = object.id
        scene.add(mesh)
        nodeById.set(object.id, { root: mesh, kind: 'primitive' })
      }
    }

    const node = nodeById.get(object.id)
    if (!node) return

    const position = toViewportPosition(object, aspect)
    node.root.position.set(position.x, position.y, position.z)
    node.root.rotation.y = object.rotation ?? 0

    if (node.kind === 'model') {
      loadModelIntoNode(node, object)
      updateModelScale(node, object)
      return
    }

    const mesh = node.root as THREE.Mesh
    const material = mesh.material as THREE.MeshStandardMaterial
    if (material.color.getHexString() !== (object.color ?? '#f59e0b').replace('#', '').toLowerCase()) {
      material.color = new THREE.Color(object.color ?? '#f59e0b')
    }

    const nextSize = toViewportSize(object, aspect)
    if (object.kind === 'sphere3d') {
      const radius = Math.min(nextSize.width, nextSize.height) / 2
      const geometry = mesh.geometry as THREE.SphereGeometry
      const currentRadius = geometry.parameters.radius as number
      if (Math.abs(currentRadius - radius) > 0.0001) {
        mesh.geometry.dispose()
        mesh.geometry = new THREE.SphereGeometry(radius, 24, 16)
      }
    } else {
      const geometry = mesh.geometry as THREE.BoxGeometry
      const p = geometry.parameters
      if (
        Math.abs((p.width as number) - nextSize.width) > 0.0001 ||
        Math.abs((p.height as number) - nextSize.height) > 0.0001 ||
        Math.abs((p.depth as number) - nextSize.depth) > 0.0001
      ) {
        mesh.geometry.dispose()
        mesh.geometry = new THREE.BoxGeometry(nextSize.width, nextSize.height, nextSize.depth)
      }
    }
  }

  const render = (world: World) => {
    const selectedObjectIds = new Set(world.interactionState.selectedObjectByHand.values())
    const visibleIds = new Set<string>()

    for (const object of world.objects.values()) {
      if (!isThreeObject(object) || object.visible === false) continue
      visibleIds.add(object.id)
      upsertMesh(object)

      const node = nodeById.get(object.id)
      if (node) {
        updateSelectionVisual(node.root, selectedObjectIds.has(object.id))
      }
    }

    for (const [id, node] of nodeById.entries()) {
      if (!visibleIds.has(id)) {
        scene.remove(node.root)
        disposeObject(node.root)
        nodeById.delete(id)
      }
    }

    renderer.render(scene, camera)
  }

  const dispose = () => {
    for (const node of nodeById.values()) {
      scene.remove(node.root)
      disposeObject(node.root)
    }

    nodeById.clear()
    renderer.dispose()
  }

  return {
    resize,
    render,
    dispose,
  }
}
