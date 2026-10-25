import { useState } from 'react'
import { Modal } from './Modal'
import { hexToRgb } from '../lib/pdfEngine'
import type { WatermarkOptions } from '../lib/pdfEngine'

export function WatermarkDialog({
  onClose,
  onApply,
}: {
  onClose: () => void
  onApply: (opts: WatermarkOptions) => void
}) {
  const [text, setText] = useState('DŮVĖRNÉ')
  const [fontSize, setFontSize] = useState(48)
  const [color, setColor] = useState('#ff0000')
  const [opacity, setOpacity] = useState(0.3)
  const [rotation, setRotation] = useState(45)

  return (
    <Modal title="Vodoznak" onClose={onClose}>
      <div className="form-section">
        <label className="form-field">
          Text vodoznaku
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="form-row">
          <label className="form-field">
            Velikost písma
            <input
              type="number"
              min={8}
              max={200}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </label>
          <label className="form-field">
            Barva
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label className="form-field">
            Průhlednost ({Math.round(opacity * 100)} %)
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
          <label className="form-field">
            Natočení (°)
            <input
              type="number"
              min={-90}
              max={90}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
            />
          </label>
        </div>
        <button
          className="btn btn-primary"
          disabled={!text.trim()}
          onClick={() => {
            onApply({ text, fontSize, color: hexToRgb(color), opacity, rotationDeg: rotation })
            onClose()
          }}
        >
          Přidat vodoznak na všechny stránky
        </button>
      </div>
    </Modal>
  )
}
