import { useState } from 'react'
import { Modal } from './Modal'

export function SplitDialog({
  pageCount,
  onClose,
  onExtractRange,
  onSplitEach,
}: {
  pageCount: number
  onClose: () => void
  onExtractRange: (from: number, to: number) => void
  onSplitEach: () => void
}) {
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(pageCount)

  return (
    <Modal title="Rozdělit PDF" onClose={onClose}>
      <div className="form-section">
        <h3>Exportovat rozsah stránek</h3>
        <div className="form-row">
          <label>
            Od
            <input
              type="number"
              min={1}
              max={pageCount}
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
            />
          </label>
          <label>
            Do
            <input
              type="number"
              min={1}
              max={pageCount}
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
            />
          </label>
        </div>
        <button
          className="btn btn-primary"
          disabled={from < 1 || to > pageCount || from > to}
          onClick={() => {
            onExtractRange(from - 1, to - 1)
            onClose()
          }}
        >
          Stáhnout rozsah jako nové PDF
        </button>
      </div>
      <div className="form-section">
        <h3>Rozdělit na jednotlivé stránky</h3>
        <p className="hint">Každá stránka se stáhne jako samostatný PDF soubor ({pageCount} souborů).</p>
        <button
          className="btn"
          onClick={() => {
            onSplitEach()
            onClose()
          }}
        >
          Stáhnout všechny stránky zvlášť
        </button>
      </div>
    </Modal>
  )
}
