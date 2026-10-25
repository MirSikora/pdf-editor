import { useRef } from 'react'
import type { Tool } from './PageViewer'

export function Toolbar({
  hasDoc,
  fileName,
  canUndo,
  canRedo,
  tool,
  onSetTool,
  onOpenMore,
  onUndo,
  onRedo,
  onSplit,
  onWatermark,
  onFillForm,
  onExport,
  onNewDocument,
}: {
  hasDoc: boolean
  fileName: string
  canUndo: boolean
  canRedo: boolean
  tool: Tool
  onSetTool: (t: Tool) => void
  onOpenMore: (files: File[]) => void
  onUndo: () => void
  onRedo: () => void
  onSplit: () => void
  onWatermark: () => void
  onFillForm: () => void
  onExport: () => void
  onNewDocument: () => void
}) {
  const appendInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="toolbar">
      <div className="toolbar-brand">📄 PDF Editor</div>
      {hasDoc && (
        <>
          <span className="toolbar-filename" title={fileName}>
            {fileName}
          </span>
          <div className="toolbar-group">
            <button className="btn" onClick={onUndo} disabled={!canUndo} title="Zpět">
              ↶ Zpět
            </button>
            <button className="btn" onClick={onRedo} disabled={!canRedo} title="Vpřed">
              ↷ Vpřed
            </button>
          </div>
          <div className="toolbar-group">
            <button
              className={`btn ${tool === 'text' ? 'btn-active' : ''}`}
              onClick={() => onSetTool(tool === 'text' ? 'none' : 'text')}
            >
              🔤 Text
            </button>
            <button
              className={`btn ${tool === 'highlight' ? 'btn-active' : ''}`}
              onClick={() => onSetTool(tool === 'highlight' ? 'none' : 'highlight')}
            >
              🖍 Zvýraznit
            </button>
          </div>
          <div className="toolbar-group">
            <button className="btn" onClick={() => appendInputRef.current?.click()}>
              ➕ Sloučit další PDF
            </button>
            <input
              ref={appendInputRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length) onOpenMore(files)
                e.target.value = ''
              }}
            />
            <button className="btn" onClick={onSplit}>
              ✂ Rozdělit
            </button>
            <button className="btn" onClick={onWatermark}>
              💧 Vodoznak
            </button>
            <button className="btn" onClick={onFillForm}>
              📝 Formulář
            </button>
          </div>
          <div className="toolbar-spacer" />
          <button className="btn" onClick={onNewDocument}>
            Nový dokument
          </button>
          <button className="btn btn-primary" onClick={onExport}>
            ⬇ Stáhnout PDF
          </button>
        </>
      )}
    </div>
  )
}
