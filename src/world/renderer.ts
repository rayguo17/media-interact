import type { World } from './types'
import { getOrderedWorldObjects } from './world'

const drawLabel = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign = 'left'
) => {
  ctx.save()
  ctx.font = '12px sans-serif'
  ctx.textAlign = align
  ctx.textBaseline = 'middle'

  const metrics = ctx.measureText(text)
  const width = metrics.width + 8
  const height = 18
  const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
  const top = y - height / 2

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(left, top, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, align === 'right' ? x - 4 : align === 'center' ? x : x + 4, y)
  ctx.restore()
}

const toCanvasPosition = (
  normalized: { x: number; y: number },
  canvas: { width: number; height: number }
) => {
  return {
    x: normalized.x * canvas.width,
    y: normalized.y * canvas.height,
  }
}

const toCanvasSize = (
  normalized: { width: number; height: number },
  canvas: { width: number; height: number }
) => {
  return {
    width: normalized.width * canvas.width,
    height: normalized.height * canvas.height,
  }
}

export const renderWorld = (world: World, ctx: CanvasRenderingContext2D) => {
  const canvas = { width: ctx.canvas.width, height: ctx.canvas.height }
  const selectedObjectIds = new Set(world.interactionState.selectedObjectByHand.values())

  for (const object of getOrderedWorldObjects(world)) {
    if (object.visible === false) continue

    const position = toCanvasPosition(object.position, canvas)
    const size = toCanvasSize(object.size, canvas)

    ctx.save()
    ctx.fillStyle = object.color ?? (object.interactable ? '#f59e0b' : '#60a5fa')

    if (object.kind === 'circle') {
      const radius = Math.min(size.width, size.height) / 2
      ctx.beginPath()
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2)
      ctx.fill()

      if (selectedObjectIds.has(object.id)) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(position.x, position.y, radius + 3, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    if (object.kind === 'rect') {
      ctx.fillRect(position.x - size.width / 2, position.y - size.height / 2, size.width, size.height)

      if (selectedObjectIds.has(object.id)) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.strokeRect(
          position.x - size.width / 2 - 3,
          position.y - size.height / 2 - 3,
          size.width + 6,
          size.height + 6
        )
      }
    }

    ctx.restore()
  }
}

export const renderCanvasAxes = (ctx: CanvasRenderingContext2D) => {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const axisInset = 16
  const tickCount = 4

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(axisInset, axisInset)
  ctx.lineTo(width - axisInset, axisInset)
  ctx.moveTo(axisInset, axisInset)
  ctx.lineTo(axisInset, height - axisInset)
  ctx.stroke()

  for (let i = 0; i <= tickCount; i += 1) {
    const x = axisInset + ((width - axisInset * 2) * i) / tickCount
    const y = axisInset + ((height - axisInset * 2) * i) / tickCount

    ctx.beginPath()
    ctx.moveTo(x, axisInset - 4)
    ctx.lineTo(x, axisInset + 4)
    ctx.moveTo(axisInset - 4, y)
    ctx.lineTo(axisInset + 4, y)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(axisInset, axisInset, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  drawLabel(ctx, '(0, 0)', axisInset + 6, axisInset + 14)
  drawLabel(ctx, `(${width}, 0)`, width - axisInset - 6, axisInset + 14, 'right')
  drawLabel(ctx, `(0, ${height})`, axisInset + 6, height - axisInset - 10)
  drawLabel(ctx, `(${width}, ${height})`, width - axisInset - 6, height - axisInset - 10, 'right')
  drawLabel(ctx, `X: 0 → ${width}`, width / 2, axisInset + 28, 'center')
  drawLabel(ctx, `Y: 0 ↓ ${height}`, axisInset + 52, height / 2, 'left')
}
