import { getOrCreateHandState } from './runtime'
import type { LandmarkPoint, MovementEvent, MovementRecognizer } from './types'

export const wristMovementRecognizer: MovementRecognizer = (frame, state) => {
  const events: MovementEvent[] = []
  const historyWindowMs = 700
  const maxHistorySamples = 60

  frame.result.landmarks.forEach((landmarks, handIndex) => {
    const handState = getOrCreateHandState(state, handIndex)
    const wrist = landmarks[0] as LandmarkPoint | undefined
    if (!wrist) return

    handState.wristHistory.push({
      timestamp: frame.timestamp,
      x: wrist.x,
      y: wrist.y,
      z: wrist.z,
    })

    handState.wristHistory = handState.wristHistory.filter(
      (sample) => frame.timestamp - sample.timestamp <= historyWindowMs
    )

    if (handState.wristHistory.length > maxHistorySamples) {
      handState.wristHistory = handState.wristHistory.slice(
        handState.wristHistory.length - maxHistorySamples
      )
    }

    const history = handState.wristHistory
    if (history.length < 2) return

    const previous = history[history.length - 2]
    const current = history[history.length - 1]
    const dt = Math.max(1, current.timestamp - previous.timestamp)
    const vx = (current.x - previous.x) / dt
    const vy = (current.y - previous.y) / dt
    const speed = Math.hypot(vx, vy)

    if (speed > 0.00045 && frame.timestamp - handState.lastMovementEmitTimestamp > 150) {
      handState.lastMovementEmitTimestamp = frame.timestamp
      events.push({
        type: 'movement-active',
        handIndex,
        timestamp: frame.timestamp,
        details: { vx, vy, speed },
      })
    }

    const start = history[0]
    const durationMs = current.timestamp - start.timestamp
    const dx = current.x - start.x
    const dy = current.y - start.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const horizontalDominant = absDx > absDy * 1.5

    if (
      durationMs >= 150 &&
      durationMs <= 700 &&
      horizontalDominant &&
      absDx > 0.18 &&
      absDy < 0.12 &&
      frame.timestamp - handState.lastSwipeTimestamp > 450
    ) {
      handState.lastSwipeTimestamp = frame.timestamp
      events.push({
        type: dx > 0 ? 'swipe-right' : 'swipe-left',
        handIndex,
        timestamp: frame.timestamp,
        details: { dx, dy, durationMs },
      })

      handState.wristHistory = [current]
    }
  })

  return events
}
