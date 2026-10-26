import { useState } from 'react'
import { usePdfWorkspace } from './state/usePdfWorkspace'
import { Dropzone } from './components/Dropzone'
import { Toolbar } from './components/Toolbar'
import { PageThumbnails } from './components/PageThumbnails'
import { PageViewer } from './components/PageViewer'
import type { Tool } from './components/PageViewer'
import { SplitDialog } from './components/SplitDialog'
import { WatermarkDialog } from './components/WatermarkDialog'
import { FormPanel } from './components/FormPanel'
import { hexToRgb } from './lib/pdfEngine'
import './App.css'

type DialogKind = 'split' | 'watermark' | 'form' | null

const TOOL_HINTS: Record<Tool, string> = {
  none: '',
  text: 'Klikněte na stránku a vložte text.',
  highlight: 'Tažením vyberte oblast ke zvýraznění.',
  'edit-text': 'Tažením označte existující text, který chcete nahradit.',
  image: 'Tažením vyberte, kam a jak velký obrázek vložit.',
}

function App() {
  const ws = usePdfWorkspace()
  const [tool, setTool] = useState<Tool>('none')
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [textColorHex] = useState('#1a1a1a')
  const [highlightColorHex] = useState('#ffe066')

  const textColor = hexToRgb(textColorHex)
  const highlightColor = hexToRgb(highlightColorHex)

  const hasDoc = ws.bytes !== null
  const pageAnnotations = ws.annotations.filter((a) => a.pageIndex === ws.selectedPage)

  return (
    <div className="app-shell">
      <Toolbar
        hasDoc={hasDoc}
        fileName={ws.fileName}
        canUndo={ws.canUndo}
        canRedo={ws.canRedo}
        tool={tool}
        onSetTool={(t) => {
          setTool(t)
          ws.setSelectedAnnotationId(null)
        }}
        onOpenMore={(files) => ws.appendFiles(files)}
        onUndo={ws.undo}
        onRedo={ws.redo}
        onSplit={() => setDialog('split')}
        onWatermark={() => setDialog('watermark')}
        onFillForm={() => setDialog('form')}
        onExport={ws.exportCurrent}
        onNewDocument={() => window.location.reload()}
      />

      {ws.error && (
        <div className="error-banner" onClick={() => ws.setError(null)}>
          {ws.error}
        </div>
      )}

      {ws.annotations.length > 0 && (
        <div className="pending-banner">
          <span>
            {ws.annotations.length} {ws.annotations.length === 1 ? 'neuložená úprava' : 'neuložených úprav'} v
            dokumentu
          </span>
          <div className="pending-banner-actions">
            <button className="btn btn-sm" onClick={ws.discardAnnotations}>
              Zahodit
            </button>
            <button className="btn btn-primary btn-sm" onClick={ws.commitAnnotations}>
              Použít do PDF
            </button>
          </div>
        </div>
      )}

      {!hasDoc ? (
        <div className="empty-state">
          <Dropzone onFiles={(files) => ws.openFiles(files)} />
        </div>
      ) : (
        <div className="editor-layout">
          <aside className="sidebar">
            <PageThumbnails
              doc={ws.pdfjsDoc}
              pageCount={ws.pageCount}
              selectedPage={ws.selectedPage}
              onSelect={ws.setSelectedPage}
              onRotate={(index, delta) => ws.rotateCurrentPage(index, delta)}
              onDelete={(index) => ws.deletePageAt(index)}
              onReorder={(order) => ws.reorder(order)}
            />
          </aside>
          <main className="viewer-area">
            {tool !== 'none' && <div className="tool-hint">{TOOL_HINTS[tool]}</div>}
            <PageViewer
              doc={ws.pdfjsDoc}
              pageNumber={ws.selectedPage + 1}
              tool={tool}
              textColor={textColor}
              highlightColor={highlightColor}
              annotations={pageAnnotations}
              selectedAnnotationId={ws.selectedAnnotationId}
              onSelectAnnotation={ws.setSelectedAnnotationId}
              onChangeAnnotation={ws.updateAnnotation}
              onDeleteAnnotation={ws.deleteAnnotation}
              onCreateText={(pdfX, pdfY, text, fontSize) =>
                ws.addTextAnnotation(ws.selectedPage, pdfX, pdfY, text, fontSize, textColor, false)
              }
              onAddHighlight={(pdfX, pdfY, w, h) =>
                ws.addHighlightAt(ws.selectedPage, pdfX, pdfY, w, h, highlightColor, 0.4)
              }
              onEditTextRegion={(pdfX, pdfY, w, h, prefillText, fontSize) =>
                ws.addTextAnnotation(ws.selectedPage, pdfX, pdfY, prefillText, fontSize, textColor, true, {
                  width: w,
                  height: h,
                })
              }
              onInsertImage={async (pdfX, pdfY, w, h, file) => {
                const buf = await file.arrayBuffer()
                const mime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
                ws.addImageAnnotation(ws.selectedPage, pdfX, pdfY, w, h, new Uint8Array(buf), mime, true)
              }}
            />
          </main>
        </div>
      )}

      {ws.loading && <div className="loading-overlay">Zpracovávám…</div>}

      {dialog === 'split' && (
        <SplitDialog
          pageCount={ws.pageCount}
          onClose={() => setDialog(null)}
          onExtractRange={(from, to) => ws.splitRange(from, to)}
          onSplitEach={() => ws.splitEach()}
        />
      )}
      {dialog === 'watermark' && (
        <WatermarkDialog onClose={() => setDialog(null)} onApply={(opts) => ws.addWatermarkAll(opts)} />
      )}
      {dialog === 'form' && (
        <FormPanel
          fields={ws.formFields}
          onClose={() => setDialog(null)}
          onApply={(values, flatten) => ws.applyFormValues(values, flatten)}
        />
      )}
    </div>
  )
}

export default App
