export type WorldObjectKind = 'circle' | 'rect' | 'box3d' | 'sphere3d' | 'model3d'

export type WorldPosition = {
  x: number
  y: number
  z?: number
}

export type WorldSize = {
  width: number
  height: number
  depth?: number
}

export type WorldObjectAnimation = {
  enabled?: boolean
  spinSpeed?: number
}

export type WorldObjectBase = {
  id: string
  kind: WorldObjectKind
  interactable: boolean
  position: WorldPosition
  size: WorldSize
  rotation?: number
  animation?: WorldObjectAnimation
  modelUrl?: string
  visible?: boolean
  zIndex?: number
  color?: string
}

export type WorldObject = WorldObjectBase

export type PointerPoint = {
  x: number
  y: number
  z: number
}

export type HandPointer = {
  handIndex: number
  indexTip: PointerPoint | null
}

export type WorldGestureEvent = {
  type: string
  handIndex: number
  timestamp: number
  details?: Record<string, number | string>
}

export type WorldInteractionInput = {
  oneTimeEvents: WorldGestureEvent[]
  movementEvents: WorldGestureEvent[]
  handPointers: HandPointer[]
  rawHandResult?: unknown
}

export type WorldInteractionState = {
  selectedObjectByHand: Map<number, string>
  grabbedObjectByHand: Map<number, string>
  lastFrameTimestamp?: number
}

export type World = {
  objects: Map<string, WorldObject>
  objectOrder: string[]
  interactionState: WorldInteractionState
}

export type WorldFrameContext = {
  timestamp: number
  canvasSize: {
    width: number
    height: number
  }
  interaction?: WorldInteractionInput
}
