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

function App() {
  const ws = usePdfWorkspace()
  const [tool, setTool] = useState<Tool>('none')
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [textColorHex] = useState('#1a1a1a')
  const [highlightColorHex] = useState('#ffe066')

  const textColor = hexToRgb(textColorHex)
  const highlightColor = hexToRgb(highlightColorHex)

  const hasDoc = ws.bytes !== null

  return (
    <div className="app-shell">
      <Toolbar
        hasDoc={hasDoc}
        fileName={ws.fileName}
        canUndo={ws.canUndo}
        canRedo={ws.canRedo}
        tool={tool}
        onSetTool={setTool}
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
            {tool !== 'none' && (
              <div className="tool-hint">
                {tool === 'text' ? 'Klikněte na stránku a vložte text.' : 'Tažením vyberte oblast ke zvýraznění.'}
              </div>
            )}
            <PageViewer
              doc={ws.pdfjsDoc}
              pageNumber={ws.selectedPage + 1}
              tool={tool}
              textColor={textColor}
              highlightColor={highlightColor}
              onAddText={(pdfX, pdfY, text, fontSize) =>
                ws.addTextAt(ws.selectedPage, pdfX, pdfY, text, { fontSize, color: textColor })
              }
              onAddHighlight={(pdfX, pdfY, w, h) =>
                ws.addHighlightAt(ws.selectedPage, pdfX, pdfY, w, h, highlightColor, 0.4)
              }
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
