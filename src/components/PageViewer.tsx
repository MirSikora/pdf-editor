import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist'
import { renderPageToCanvas } from '../lib/pdfRender'
import type { RgbColor } from '../lib/pdfEngine'
import type { Annotation } from '../types/annotations'
import { AnnotationLayer } from './AnnotationLayer'

export type Tool = 'none' | 'text' | 'highlight' | 'edit-text' | 'image'

type PendingText = { screenX: number; screenY: number; pdfX: number; pdfY: number }
type DragRect = { x0: number; y0: number; x1: number; y1: number }

type TextRegionResult = {
  text: string
  fontSize: number | null
  /** Tight bbox around the matched glyphs (pdf.js item.height spans baseline
   *  upward only, so this still needs a descender margin added by the caller). */
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null
}

async function detectTextInRegion(
  doc: PDFDocumentProxy,
  pageNumber: number,
  rectMinX: number,
  rectMinY: number,
  rectMaxX: number,
  rectMaxY: number,
): Promise<TextRegionResult> {
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  let text = ''
  let maxHeight = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const raw of content.items) {
    const item = raw as { str?: string; transform?: number[]; width?: number; height?: number }
    if (!item.str || !item.transform || item.width == null || item.height == null) continue
    const x0 = item.transform[4]
    const y0 = item.transform[5]
    const x1 = x0 + item.width
    const y1 = y0 + item.height
    const overlaps = x0 < rectMaxX && x1 > rectMinX && y0 < rectMaxY && y1 > rectMinY
    if (overlaps) {
      text += item.str
      if (item.height > maxHeight) maxHeight = item.height
      minX = Math.min(minX, x0)
      minY = Math.min(minY, y0)
      maxX = Math.max(maxX, x1)
      maxY = Math.max(maxY, y1)
    }
  }
  const bbox = maxHeight > 0 ? { minX, minY, maxX, maxY } : null
  return { text: text.trim(), fontSize: maxHeight > 0 ? Math.round(maxHeight) : null, bbox }
}

export function PageViewer({
  doc,
  pageNumber,
  tool,
  textColor,
  highlightColor,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onChangeAnnotation,
  onDeleteAnnotation,
  onCreateText,
  onAddHighlight,
  onEditTextRegion,
  onInsertImage,
}: {
  doc: PDFDocumentProxy | null
  pageNumber: number
  tool: Tool
  textColor: RgbColor
  highlightColor: RgbColor
  annotations: Annotation[]
  selectedAnnotationId: string | null
  onSelectAnnotation: (id: string) => void
  onChangeAnnotation: (id: string, patch: Partial<Annotation>) => void
  onDeleteAnnotation: (id: string) => void
  onCreateText: (pdfX: number, pdfY: number, text: string, fontSize: number) => void
  onAddHighlight: (pdfX: number, pdfY: number, w: number, h: number) => void
  onEditTextRegion: (pdfX: number, pdfY: number, w: number, h: number, prefillText: string, fontSize: number) => void
  onInsertImage: (pdfX: number, pdfY: number, w: number, h: number, file: File) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<PageViewport | null>(null)
  const [pending, setPending] = useState<PendingText | null>(null)
  const [textValue, setTextValue] = useState('')
  const [fontSize, setFontSize] = useState(16)
  const [dragRect, setDragRect] = useState<DragRect | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pendingImageRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!doc || !canvas) return
    renderPageToCanvas(doc, pageNumber, canvas, 1.3).then(({ viewport: vp }) => {
      setViewport(vp)
    })
    setPending(null)
    setDragRect(null)
  }, [doc, pageNumber])

  if (!doc) return null

  const getOffset = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const screenToPdf = (clientX: number, clientY: number): [number, number] => {
    if (!viewport || !canvasRef.current) return [0, 0]
    const { x, y } = getOffset({ clientX, clientY })
    return viewport.convertToPdfPoint(x, y) as [number, number]
  }

  const pdfToScreen = (x: number, y: number): [number, number] => {
    if (!viewport) return [0, 0]
    return viewport.convertToViewportPoint(x, y) as [number, number]
  }

  const isDragTool = tool === 'highlight' || tool === 'edit-text' || tool === 'image'

  const handleClick = (e: React.MouseEvent) => {
    if (tool !== 'text' || !viewport) return
    const { x, y } = getOffset(e)
    const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y)
    setPending({ screenX: x, screenY: y, pdfX, pdfY })
    setTextValue('')
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDragTool) return
    const { x, y } = getOffset(e)
    dragStartRef.current = { x, y }
    setDragRect({ x0: x, y0: y, x1: x, y1: y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragTool || !dragStartRef.current) return
    const { x, y } = getOffset(e)
    setDragRect({ x0: dragStartRef.current.x, y0: dragStartRef.current.y, x1: x, y1: y })
  }

  const handleMouseUp = async () => {
    if (!isDragTool || !dragStartRef.current || !dragRect || !viewport) {
      dragStartRef.current = null
      setDragRect(null)
      return
    }
    dragStartRef.current = null
    const [px0, py0] = viewport.convertToPdfPoint(dragRect.x0, dragRect.y0)
    const [px1, py1] = viewport.convertToPdfPoint(dragRect.x1, dragRect.y1)
    const x = Math.min(px0, px1)
    const y = Math.max(py0, py1)
    const w = Math.abs(px1 - px0)
    const h = Math.abs(py1 - py0)
    setDragRect(null)
    if (w <= 3 || h <= 3) return

    if (tool === 'highlight') {
      onAddHighlight(x, y - h, w, h)
    } else if (tool === 'edit-text') {
      const { text, fontSize: detected, bbox } = await detectTextInRegion(doc, pageNumber, x, y - h, x + w, y)
      if (bbox && detected) {
        // Snap the cover rect to the actual detected glyphs (padded for
        // descenders pdf.js doesn't include in item.height) instead of the
        // user's rough drag box, so the original text is fully hidden.
        const pad = detected * 0.3
        const coverX = bbox.minX - pad * 0.3
        const coverTop = bbox.maxY + pad * 0.2
        const coverW = bbox.maxX - bbox.minX + pad * 0.6
        const coverH = bbox.maxY - bbox.minY + pad
        onEditTextRegion(coverX, coverTop, coverW, coverH, text, detected)
      } else {
        onEditTextRegion(x, y, w, h, text, Math.round(h * 0.8))
      }
    } else if (tool === 'image') {
      pendingImageRectRef.current = { x, y, w, h }
      imageInputRef.current?.click()
    }
  }

  const confirmText = () => {
    if (pending && textValue.trim()) {
      onCreateText(pending.pdfX, pending.pdfY, textValue.trim(), fontSize)
    }
    setPending(null)
  }

  const pageAnnotations = annotations

  return (
    <div className="viewer-wrap">
      <div
        className={`viewer-canvas-container ${tool !== 'none' ? `tool-${tool}` : ''}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <canvas ref={canvasRef} />
        {viewport && (
          <AnnotationLayer
            annotations={pageAnnotations}
            selectedId={selectedAnnotationId}
            onSelect={onSelectAnnotation}
            onChange={onChangeAnnotation}
            onDelete={onDeleteAnnotation}
            screenToPdf={screenToPdf}
            pdfToScreen={pdfToScreen}
          />
        )}
        {dragRect && (
          <div
            className="highlight-preview"
            style={{
              left: Math.min(dragRect.x0, dragRect.x1),
              top: Math.min(dragRect.y0, dragRect.y1),
              width: Math.abs(dragRect.x1 - dragRect.x0),
              height: Math.abs(dragRect.y1 - dragRect.y0),
              background:
                tool === 'highlight'
                  ? `rgba(${highlightColor.r * 255}, ${highlightColor.g * 255}, ${highlightColor.b * 255}, 0.4)`
                  : 'rgba(109, 40, 217, 0.15)',
              border: tool === 'highlight' ? undefined : '1px dashed rgba(109, 40, 217, 0.8)',
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
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            const rect = pendingImageRectRef.current
            pendingImageRectRef.current = null
            e.target.value = ''
            if (file && rect) onInsertImage(rect.x, rect.y, rect.w, rect.h, file)
          }}
        />
      </div>
    </div>
  )
}
