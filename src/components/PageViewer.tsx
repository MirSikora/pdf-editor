import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist'
import { renderPageToCanvas } from '../lib/pdfRender'
import type { RgbColor } from '../lib/pdfEngine'

export type Tool = 'none' | 'text' | 'highlight'

type PendingText = { screenX: number; screenY: number; pdfX: number; pdfY: number }
type DragRect = { x0: number; y0: number; x1: number; y1: number }

export function PageViewer({
  doc,
  pageNumber,
  tool,
  textColor,
  highlightColor,
  onAddText,
  onAddHighlight,
}: {
  doc: PDFDocumentProxy | null
  pageNumber: number
  tool: Tool
  textColor: RgbColor
  highlightColor: RgbColor
  onAddText: (pdfX: number, pdfY: number, text: string, fontSize: number) => void
  onAddHighlight: (pdfX: number, pdfY: number, w: number, h: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<PageViewport | null>(null)
  const [pending, setPending] = useState<PendingText | null>(null)
  const [textValue, setTextValue] = useState('')
  const [fontSize, setFontSize] = useState(16)
  const [dragRect, setDragRect] = useState<DragRect | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!doc || !canvas) return
    renderPageToCanvas(doc, pageNumber, canvas, 1.3).then(({ viewport }) => {
      viewportRef.current = viewport
    })
    setPending(null)
    setDragRect(null)
  }, [doc, pageNumber])

  if (!doc) return null

  const getOffset = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (tool !== 'text') return
    const viewport = viewportRef.current
    if (!viewport) return
    const { x, y } = getOffset(e)
    const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y)
    setPending({ screenX: x, screenY: y, pdfX, pdfY })
    setTextValue('')
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool !== 'highlight') return
    const { x, y } = getOffset(e)
    dragStartRef.current = { x, y }
    setDragRect({ x0: x, y0: y, x1: x, y1: y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tool !== 'highlight' || !dragStartRef.current) return
    const { x, y } = getOffset(e)
    setDragRect({ x0: dragStartRef.current.x, y0: dragStartRef.current.y, x1: x, y1: y })
  }

  const handleMouseUp = () => {
    if (tool !== 'highlight' || !dragStartRef.current || !dragRect) return
    const viewport = viewportRef.current
    dragStartRef.current = null
    if (!viewport) {
      setDragRect(null)
      return
    }
    const [px0, py0] = viewport.convertToPdfPoint(dragRect.x0, dragRect.y0)
    const [px1, py1] = viewport.convertToPdfPoint(dragRect.x1, dragRect.y1)
    const x = Math.min(px0, px1)
    const y = Math.min(py0, py1)
    const w = Math.abs(px1 - px0)
    const h = Math.abs(py1 - py0)
    setDragRect(null)
    if (w > 2 && h > 2) onAddHighlight(x, y, w, h)
  }

  const confirmText = () => {
    if (pending && textValue.trim()) {
      onAddText(pending.pdfX, pending.pdfY, textValue.trim(), fontSize)
    }
    setPending(null)
  }

  return (
    <div className="viewer-wrap">
      <div
        ref={containerRef}
        className={`viewer-canvas-container ${tool !== 'none' ? `tool-${tool}` : ''}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <canvas ref={canvasRef} />
        {dragRect && (
          <div
            className="highlight-preview"
            style={{
              left: Math.min(dragRect.x0, dragRect.x1),
              top: Math.min(dragRect.y0, dragRect.y1),
              width: Math.abs(dragRect.x1 - dragRect.x0),
              height: Math.abs(dragRect.y1 - dragRect.y0),
              background: `rgba(${highlightColor.r * 255}, ${highlightColor.g * 255}, ${highlightColor.b * 255}, 0.4)`,
            }}
          />
        )}
        {pending && (
          <div
            className="text-popover"
            style={{ left: pending.screenX, top: pending.screenY }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              type="text"
              placeholder="Text ke vložení"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmText()
                if (e.key === 'Escape') setPending(null)
              }}
            />
            <div className="text-popover-row">
              <label>
                Velikost
                <input
                  type="number"
                  min={6}
                  max={96}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </label>
              <button className="btn btn-primary btn-sm" onClick={confirmText}>
                Vložit
              </button>
              <button className="btn btn-sm" onClick={() => setPending(null)}>
                Zrušit
              </button>
            </div>
            <div
              className="text-color-preview"
              style={{ color: `rgb(${textColor.r * 255}, ${textColor.g * 255}, ${textColor.b * 255})` }}
            >
              {textValue || 'Náhled textu'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
