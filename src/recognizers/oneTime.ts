import { getOrCreateHandState } from './runtime'
import type { LandmarkPoint, OneTimeEvent, OneTimeRecognizer } from './types'

const distance2D = (a: LandmarkPoint, b: LandmarkPoint) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export const pinchTransitionRecognizer: OneTimeRecognizer = (frame, state) => {
  const events: OneTimeEvent[] = []

  frame.result.landmarks.forEach((landmarks, handIndex) => {
    const handState = getOrCreateHandState(state, handIndex)
    const thumbTip = landmarks[4] as LandmarkPoint | undefined
    const indexTip = landmarks[8] as LandmarkPoint | undefined

    if (!thumbTip || !indexTip) return

    const pinchDistance = distance2D(thumbTip, indexTip)
    const isPinching = pinchDistance < 0.06

    if (isPinching && !handState.lastPinch) {
      events.push({
        type: 'pinch-start',
        handIndex,
        timestamp: frame.timestamp,
        details: { pinchDistance },
      })
    }

    if (!isPinching && handState.lastPinch) {
      events.push({
        type: 'pinch-end',
        handIndex,
        timestamp: frame.timestamp,
        details: { pinchDistance },
      })
    }

    handState.lastPinch = isPinching
  })

  return events
}
