import type { CourtElement } from './geometry'
import { courtElements } from './geometry'

export function CourtElementShape({ el }: { el: CourtElement }) {
  switch (el.kind) {
    case 'rect':
      return <rect x={el.x} y={el.y} width={el.width} height={el.height} />
    case 'circle':
      return <circle cx={el.cx} cy={el.cy} r={el.r} />
    case 'line':
      return <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} />
    case 'path':
      return <path d={el.d} />
  }
}

/** The court line-work, shared by the Shots and Zones views. */
export function CourtLines() {
  return (
    <g className="court-lines">
      {courtElements().map((el) => (
        <CourtElementShape key={el.id} el={el} />
      ))}
    </g>
  )
}
