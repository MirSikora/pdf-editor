import { useRef } from 'react'
import type { Annotation } from '../types/annotations'

type Props = {
  annotations: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onChange: (id: string, patch: Partial<Annotation>) => void
  onDelete: (id: string) => void
  screenToPdf: (clientX: number, clientY: number) => [number, number]
  pdfToScreen: (x: number, y: number) => [number, number]
}

function boxStyle(ann: Annotation, pdfToScreen: Props['pdfToScreen']): React.CSSProperties {
  const height =
    ann.type === 'text' ? (ann.coverHeight ?? ann.fontSize * 1.2) : ann.height
  const width =
    ann.type === 'text'
      ? (ann.coverWidth ?? Math.max(ann.text.length * ann.fontSize * 0.55, 24))
      : ann.width
  const [x1, y1] = pdfToScreen(ann.x, ann.y)
  const [x2, y2] = pdfToScreen(ann.x + width, ann.y - height)
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function AnnotationLayer({
  annotations,
  selectedId,
  onSelect,
  onChange,
  onDelete,
  screenToPdf,
  pdfToScreen,
}: Props) {
  const dragState = useRef<{ id: string; originPdf: [number, number]; startX: number; startY: number } | null>(null)
  const resizeState = useRef<{ id: string } | null>(null)

  const handleBodyMouseDown = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation()
    onSelect(ann.id)
    const originPdf = screenToPdf(e.clientX, e.clientY)
    dragState.current = { id: ann.id, originPdf, startX: ann.x, startY: ann.y }

    const handleMove = (ev: MouseEvent) => {
      if (!dragState.current) return
      const [px, py] = screenToPdf(ev.clientX, ev.clientY)
      const dx = px - dragState.current.originPdf[0]
      const dy = py - dragState.current.originPdf[1]
      onChange(dragState.current.id, { x: dragState.current.startX + dx, y: dragState.current.startY + dy })
    }
    const handleUp = () => {
      dragState.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const handleResizeMouseDown = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation()
    e.preventDefault()
    if (ann.type !== 'image') return
    resizeState.current = { id: ann.id }

    const handleMove = (ev: MouseEvent) => {
      if (!resizeState.current) return
      const [px, py] = screenToPdf(ev.clientX, ev.clientY)
      const newWidth = Math.max(12, px - ann.x)
      const newHeight = Math.max(12, ann.y - py)
      onChange(resizeState.current.id, { width: newWidth, height: newHeight })
    }
    const handleUp = () => {
      resizeState.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const [, originY] = pdfToScreen(0, 0)
  const [, unitY] = pdfToScreen(0, 1)
  const pxPerPdfUnit = Math.abs(unitY - originY)

  return (
    <>
      {annotations.map((ann) => {
        const selected = ann.id === selectedId
        const style = boxStyle(ann, pdfToScreen)
        const fontSizePx = ann.type === 'text' ? ann.fontSize * pxPerPdfUnit : 0
        return (
          <div
            key={ann.id}
            className={`annotation-box ${selected ? 'annotation-selected' : ''}`}
            style={style}
            onMouseDown={(e) => handleBodyMouseDown(e, ann)}
            onClick={(e) => e.stopPropagation()}
          >
            {ann.type === 'text' ? (
              selected ? (
                <input
                  className="annotation-text-input"
                  autoFocus
                  value={ann.text}
                  style={{
                    fontSize: `${fontSizePx}px`,
                    color: `rgb(${ann.color.r * 255}, ${ann.color.g * 255}, ${ann.color.b * 255})`,
                  }}
                  onChange={(e) => onChange(ann.id, { text: e.target.value })}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="annotation-text-label"
                  style={{
                    fontSize: `${fontSizePx}px`,
                    color: `rgb(${ann.color.r * 255}, ${ann.color.g * 255}, ${ann.color.b * 255})`,
                  }}
                >
                  {ann.text}
                </span>
              )
            ) : (
              <img src={ann.previewUrl} alt="" className="annotation-image" draggable={false} />
            )}
            {selected && (
              <>
                {ann.type === 'text' && (
                  <div
                    className="annotation-drag-handle"
                    title="Táhněte pro přesun"
                    onMouseDown={(e) => handleBodyMouseDown(e, ann)}
                  >
                    ⠿
                  </div>
                )}
                <button
                  className="annotation-delete"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onDelete(ann.id)}
                  title="Smazat"
                >
                  ✕
                </button>
                {ann.type === 'text' && (
                  <div className="annotation-mini-toolbar" onMouseDown={(e) => e.stopPropagation()}>
                    <button onClick={() => onChange(ann.id, { fontSize: Math.max(6, ann.fontSize - 2) })}>A-</button>
                    <button onClick={() => onChange(ann.id, { fontSize: ann.fontSize + 2 })}>A+</button>
                    <label className="annotation-bg-toggle">
                      <input
                        type="checkbox"
                        checked={ann.background}
                        onChange={(e) => onChange(ann.id, { background: e.target.checked })}
                      />
                      podklad
                    </label>
                  </div>
                )}
                {ann.type === 'image' && (
                  <>
                    <div className="annotation-mini-toolbar" onMouseDown={(e) => e.stopPropagation()}>
                      <label className="annotation-bg-toggle">
                        <input
                          type="checkbox"
                          checked={ann.background}
                          onChange={(e) => onChange(ann.id, { background: e.target.checked })}
                        />
                        podklad
                      </label>
                    </div>
                    <div
                      className="annotation-resize-handle"
                      onMouseDown={(e) => handleResizeMouseDown(e, ann)}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
