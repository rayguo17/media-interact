import type { HandRuntimeState, RecognitionRuntimeState } from './types'

export const createRecognitionRuntimeState = (): RecognitionRuntimeState => ({
  perHand: new Map(),
})

export const clearRecognitionRuntimeState = (state: RecognitionRuntimeState) => {
  state.perHand.clear()
}

export const getOrCreateHandState = (
  state: RecognitionRuntimeState,
  handIndex: number
): HandRuntimeState => {
  const existing = state.perHand.get(handIndex)
  if (existing) return existing

  const next: HandRuntimeState = {
    lastPinch: false,
    lastSwipeTimestamp: -Infinity,
    lastMovementEmitTimestamp: -Infinity,
    wristHistory: [],
  }

  state.perHand.set(handIndex, next)
  return next
}
