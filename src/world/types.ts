export type WorldObjectKind = 'circle' | 'rect'

export type WorldObjectBase = {
  id: string
  kind: WorldObjectKind
  interactable: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
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
