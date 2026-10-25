import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToCanvas } from '../lib/pdfRender'

function Thumbnail({ doc, pageNumber }: { doc: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderPageToCanvas(doc, pageNumber, canvas, 0.22).catch(() => {})
  }, [doc, pageNumber])

  return <canvas ref={canvasRef} className="thumb-canvas" />
}

export function PageThumbnails({
  doc,
  pageCount,
  selectedPage,
  onSelect,
  onRotate,
  onDelete,
  onReorder,
}: {
  doc: PDFDocumentProxy | null
  pageCount: number
  selectedPage: number
  onSelect: (index: number) => void
  onRotate: (index: number, delta: number) => void
  onDelete: (index: number) => void
  onReorder: (newOrder: number[]) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  if (!doc || pageCount === 0) return null

  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const order = Array.from({ length: pageCount }, (_, i) => i)
    const [moved] = order.splice(dragIndex, 1)
    order.splice(dropIndex, 0, moved)
    onReorder(order)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="thumb-list">
      {Array.from({ length: pageCount }, (_, i) => i).map((index) => (
        <div
          key={index}
          className={`thumb-item ${index === selectedPage ? 'thumb-selected' : ''} ${
            overIndex === index ? 'thumb-drop-target' : ''
          }`}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => {
            e.preventDefault()
            setOverIndex(index)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
          onDrop={() => handleDrop(index)}
          onClick={() => onSelect(index)}
        >
          <Thumbnail doc={doc} pageNumber={index + 1} />
          <div className="thumb-footer">
            <span>{index + 1}</span>
            <div className="thumb-actions">
              <button
                className="icon-btn-sm"
                title="Otočit o 90°"
                onClick={(e) => {
                  e.stopPropagation()
                  onRotate(index, 90)
                }}
              >
                ⟳
              </button>
              <button
                className="icon-btn-sm icon-btn-danger"
                title="Smazat stránku"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(index)
                }}
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
