import type {
  HandPointer,
  PointerPoint,
  World,
  WorldFrameContext,
  WorldGestureEvent,
  WorldObject,
} from './types'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const isRectLike = (kind: WorldObject['kind']) =>
  kind === 'rect' || kind === 'box3d' || kind === 'model3d'

const isCircleLike = (kind: WorldObject['kind']) => kind === 'circle' || kind === 'sphere3d'

const toNormalizedPointerZ = (z: number) => {
  const normalized = 0.5 - z * 2
  return clamp(normalized, 0, 1)
}

const normalizeHexColor = (value: string) => {
  const hex = value.startsWith('#') ? value.slice(1) : value
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((part) => `${part}${part}`)
      .join('')
      .toLowerCase()}`
  }

  return null
}

const invertHexColor = (value: string) => {
  const normalized = normalizeHexColor(value)
  if (!normalized) return '#22d3ee'

  const r = 255 - Number.parseInt(normalized.slice(1, 3), 16)
  const g = 255 - Number.parseInt(normalized.slice(3, 5), 16)
  const b = 255 - Number.parseInt(normalized.slice(5, 7), 16)

  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

const getPointerByHand = (pointers: HandPointer[]) => {
  const map = new Map<number, PointerPoint>()

  for (const pointer of pointers) {
    if (pointer.indexTip) {
      map.set(pointer.handIndex, pointer.indexTip)
    }
  }

  return map
}

const getObjectSortScore = (world: World, object: WorldObject) => {
  const orderIndex = world.objectOrder.indexOf(object.id)
  return (object.zIndex ?? 0) * 10_000 + orderIndex
}

const getTopInteractableAtPointer = (world: World, pointer: PointerPoint) => {
  let bestMatch: WorldObject | null = null
  let bestScore = -Infinity

  for (const object of world.objects.values()) {
    if (!object.interactable || object.visible === false) continue

    const halfWidth = object.size.width / 2
    const halfHeight = object.size.height / 2
    const dx = pointer.x - object.position.x
    const dy = pointer.y - object.position.y

    let inside = false
    if (isRectLike(object.kind)) {
      inside = Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight
    }

    if (isCircleLike(object.kind)) {
      const radius = Math.min(halfWidth, halfHeight)
      inside = Math.hypot(dx, dy) <= radius
    }

    if (inside && (object.kind === 'box3d' || object.kind === 'sphere3d' || object.kind === 'model3d')) {
      const objectZ = object.position.z ?? 0.5
      const objectDepth = object.size.depth ?? Math.min(object.size.width, object.size.height)
      const pointerZ = toNormalizedPointerZ(pointer.z)
      const zTolerance = objectDepth / 2 + 0.15
      inside = Math.abs(pointerZ - objectZ) <= zTolerance
    }

    if (!inside) continue

    const score = getObjectSortScore(world, object)
    if (score > bestScore) {
      bestScore = score
      bestMatch = object
    }
  }

  return bestMatch
}

const applyPointerSelection = (world: World, pointerMap: Map<number, PointerPoint>) => {
  for (const [handIndex, pointer] of pointerMap.entries()) {
    const hoveredObject = getTopInteractableAtPointer(world, pointer)

    if (hoveredObject) {
      world.interactionState.selectedObjectByHand.set(handIndex, hoveredObject.id)
    } else {
      world.interactionState.selectedObjectByHand.delete(handIndex)
    }
  }

  for (const handIndex of world.interactionState.selectedObjectByHand.keys()) {
    if (!pointerMap.has(handIndex)) {
      world.interactionState.selectedObjectByHand.delete(handIndex)
      world.interactionState.grabbedObjectByHand.delete(handIndex)
    }
  }
}

const applyOneTimeEvents = (
  world: World,
  oneTimeEvents: WorldGestureEvent[],
  _pointerMap: Map<number, PointerPoint>
) => {
  for (const event of oneTimeEvents) {
    if (event.type === 'pinch-start') {
      const selectedObjectId = world.interactionState.selectedObjectByHand.get(event.handIndex)
      if (!selectedObjectId) continue

      const selectedObject = world.objects.get(selectedObjectId)
      if (selectedObject) {
        selectedObject.color = invertHexColor(
          selectedObject.color ?? (selectedObject.interactable ? '#f59e0b' : '#60a5fa')
        )
        selectedObject.zIndex = (selectedObject.zIndex ?? 0) + 1
        world.interactionState.grabbedObjectByHand.set(event.handIndex, selectedObject.id)
      }
    }

    if (event.type === 'pinch-end') {
      world.interactionState.grabbedObjectByHand.delete(event.handIndex)
    }
  }
}

const applyMovementEvents = (world: World, movementEvents: WorldGestureEvent[]) => {
  for (const event of movementEvents) {
    const selectedObjectId = world.interactionState.selectedObjectByHand.get(event.handIndex)
    if (!selectedObjectId) continue

    const selectedObject = world.objects.get(selectedObjectId)
    if (!selectedObject) continue

    if (event.type === 'swipe-right') {
      selectedObject.size.width = clamp(selectedObject.size.width * 1.08, 0.01, 1)
      selectedObject.size.height = clamp(selectedObject.size.height * 1.08, 0.01, 1)
      if (
        selectedObject.kind === 'box3d' ||
        selectedObject.kind === 'sphere3d' ||
        selectedObject.kind === 'model3d'
      ) {
        selectedObject.size.depth = clamp((selectedObject.size.depth ?? selectedObject.size.width) * 1.08, 0.01, 1)
      }
      selectedObject.zIndex = (selectedObject.zIndex ?? 0) + 1
    }

    if (event.type === 'swipe-left') {
      selectedObject.size.width = clamp(selectedObject.size.width * 0.92, 0.01, 1)
      selectedObject.size.height = clamp(selectedObject.size.height * 0.92, 0.01, 1)
      if (
        selectedObject.kind === 'box3d' ||
        selectedObject.kind === 'sphere3d' ||
        selectedObject.kind === 'model3d'
      ) {
        selectedObject.size.depth = clamp((selectedObject.size.depth ?? selectedObject.size.width) * 0.92, 0.01, 1)
      }
      selectedObject.zIndex = (selectedObject.zIndex ?? 0) + 1
    }

    if (event.type === 'movement-active') {
      selectedObject.zIndex = (selectedObject.zIndex ?? 0) + 1
    }
  }
}

const applyPointerTracking = (world: World, pointerMap: Map<number, PointerPoint>) => {
  for (const [handIndex, objectId] of world.interactionState.grabbedObjectByHand.entries()) {
    const pointer = pointerMap.get(handIndex)
    if (!pointer) continue

    const object = world.objects.get(objectId)
    if (!object || !object.interactable) continue

    object.position.x = clamp(pointer.x, 0, 1)
    object.position.y = clamp(pointer.y, 0, 1)

    if (object.kind === 'box3d' || object.kind === 'sphere3d' || object.kind === 'model3d') {
      object.position.z = toNormalizedPointerZ(pointer.z)
    }
  }
}

export const applyWorldInteraction = (world: World, context: WorldFrameContext) => {
  const interaction = context.interaction
  if (!interaction) return

  const pointerMap = getPointerByHand(interaction.handPointers)

  applyPointerSelection(world, pointerMap)
  applyOneTimeEvents(world, interaction.oneTimeEvents, pointerMap)
  applyMovementEvents(world, interaction.movementEvents)
  applyPointerTracking(world, pointerMap)
}
