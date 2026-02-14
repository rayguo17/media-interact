import type { World, WorldFrameContext, WorldObject } from './types'
import { applyWorldInteraction } from './interaction'

export const createWorld = (): World => {
  const world: World = {
    objects: new Map(),
    objectOrder: [],
    interactionState: {
      selectedObjectByHand: new Map(),
      grabbedObjectByHand: new Map(),
    },
  }

  addWorldObject(world, {
    id: 'status-dot',
    kind: 'circle',
    interactable: false,
    position: { x: 0.92, y: 0.08 },
    size: { width: 0.03, height: 0.03 },
    color: '#22c55e',
    visible: true,
    zIndex: 10,
  })

  return world
}

export const addWorldObject = (world: World, object: WorldObject) => {
  world.objects.set(object.id, object)
  if (!world.objectOrder.includes(object.id)) {
    world.objectOrder.push(object.id)
  }
}

export const removeWorldObject = (world: World, objectId: string) => {
  world.objects.delete(objectId)
  world.objectOrder = world.objectOrder.filter((id) => id !== objectId)
}

export const updateWorldObject = (
  world: World,
  objectId: string,
  patch: Partial<Omit<WorldObject, 'id'>>
) => {
  const current = world.objects.get(objectId)
  if (!current) return

  world.objects.set(objectId, { ...current, ...patch })
}

export const getOrderedWorldObjects = (world: World): WorldObject[] => {
  return world.objectOrder
    .map((id) => world.objects.get(id))
    .filter((obj): obj is WorldObject => Boolean(obj))
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
}

export const updateWorldFrame = (world: World, context: WorldFrameContext) => {
  applyWorldInteraction(world, context)
}
