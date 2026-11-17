export type TourRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Viewport = { left: number; top: number; right: number; bottom: number };
const margin = 12, gap = 16;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)));

export function placeTour(target: TourRect, viewport: Viewport, width: number, desiredHeight: number) {
  const lowX = viewport.left + margin, highX = viewport.right - margin - width;
  const lowY = viewport.top + margin, highY = viewport.bottom - margin;
  const below = Math.max(0, highY - target.bottom - gap);
  const above = Math.max(0, target.top - gap - lowY);
  const alignX = clamp(target.left, lowX, highX);
  if (viewport.right - margin - target.right >= width + gap) {
    return { x: target.right + gap, y: clamp(target.top, lowY, highY - desiredHeight), limit: highY - lowY, side: 'right' as const };
  }
  if (below >= desiredHeight) {
    return { x: alignX, y: target.bottom + gap, limit: below, side: 'bottom' as const };
  }
  if (above >= desiredHeight) {
    return { x: alignX, y: target.top - gap - desiredHeight, limit: above, side: 'top' as const };
  }
  if (target.left - gap - width >= lowX) {
    return { x: target.left - gap - width, y: clamp(target.top, lowY, highY - desiredHeight), limit: highY - lowY, side: 'left' as const };
  }
  // In a short viewport keep the actions usable and scroll only the panel body.
  return below >= above
    ? { x: alignX, y: target.bottom + gap, limit: below, side: 'bottom' as const }
    : { x: alignX, y: lowY, limit: above, side: 'top' as const };
}
