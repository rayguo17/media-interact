import type {
  MovementEvent,
  MovementRecognizer,
  OneTimeEvent,
  OneTimeRecognizer,
  RecognitionFrame,
  RecognitionRuntimeState,
} from './types'

export const formatEvent = (event: OneTimeEvent | MovementEvent) => {
  const details = event.details
    ? Object.entries(event.details)
        .map(([key, value]) => `${key}=${typeof value === 'number' ? value.toFixed(3) : value}`)
        .join(', ')
    : 'no details'

  return `${event.type} (hand ${event.handIndex}) · ${details}`
}

export const processHandResult = (
  frame: RecognitionFrame,
  state: RecognitionRuntimeState,
  oneTimeRecognizers: OneTimeRecognizer[],
  movementRecognizers: MovementRecognizer[]
) => {
  const oneTimeEvents = oneTimeRecognizers.flatMap((recognizer) => recognizer(frame, state))
  const movementEvents = movementRecognizers.flatMap((recognizer) => recognizer(frame, state))

  return { oneTimeEvents, movementEvents }
}
