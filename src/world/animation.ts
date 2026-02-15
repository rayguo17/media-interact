import type { World, WorldObject } from './types'

const DEFAULT_2D_SPIN_SPEED = Math.PI / 3
const DEFAULT_3D_SPIN_SPEED = Math.PI / 2
const TWO_PI = Math.PI * 2

const isThreeObject = (object: WorldObject) =>
  object.kind === 'box3d' || object.kind === 'sphere3d' || object.kind === 'model3d'

const isObjectInteracted = (world: World, objectId: string) => {
  for (const selectedObjectId of world.interactionState.selectedObjectByHand.values()) {
    if (selectedObjectId === objectId) return true
  }

  for (const grabbedObjectId of world.interactionState.grabbedObjectByHand.values()) {
    if (grabbedObjectId === objectId) return true
  }

  return false
}

const getSpinSpeed = (object: WorldObject) => {
  if (typeof object.animation?.spinSpeed === 'number') {
    return object.animation.spinSpeed
  }

  return isThreeObject(object) ? DEFAULT_3D_SPIN_SPEED : DEFAULT_2D_SPIN_SPEED
}

const normalizeAngle = (angle: number) => {
  const wrapped = angle % TWO_PI
  return wrapped < 0 ? wrapped + TWO_PI : wrapped
}

export const applyWorldAnimation = (
  world: World,
  deltaSeconds: number
) => {
  if (deltaSeconds <= 0) return

  for (const object of world.objects.values()) {
    if (object.visible === false) continue
    if (object.animation?.enabled === false) continue
    if (isObjectInteracted(world, object.id)) continue

    const spinSpeed = getSpinSpeed(object)
    object.rotation = normalizeAngle((object.rotation ?? 0) + spinSpeed * deltaSeconds)
  }
}
