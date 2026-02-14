import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

export type LandmarkPoint = { x: number; y: number; z: number }

export type OneTimeEvent = {
  type: string
  handIndex: number
  timestamp: number
  details?: Record<string, number | string>
}

export type MovementEvent = {
  type: string
  handIndex: number
  timestamp: number
  details?: Record<string, number | string>
}

export type RecognitionFrame = {
  timestamp: number
  result: HandLandmarkerResult
}

export type OneTimeRecognizer = (
  frame: RecognitionFrame,
  state: RecognitionRuntimeState
) => OneTimeEvent[]

export type MovementRecognizer = (
  frame: RecognitionFrame,
  state: RecognitionRuntimeState
) => MovementEvent[]

export type WristSample = {
  timestamp: number
  x: number
  y: number
  z: number
}

export type HandRuntimeState = {
  lastPinch: boolean
  lastSwipeTimestamp: number
  lastMovementEmitTimestamp: number
  wristHistory: WristSample[]
}

export type RecognitionRuntimeState = {
  perHand: Map<number, HandRuntimeState>
}
