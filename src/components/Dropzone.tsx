import { useRef, useState } from 'react'

export function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf')
        if (files.length) onFiles(files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
      <div className="dropzone-icon">📄</div>
      <p>
        <strong>Klikněte pro výběr PDF</strong> nebo soubor přetáhněte sem
      </p>
      <p className="dropzone-hint">Více souborů najednou = automaticky se sloučí do jednoho dokumentu</p>
    </div>
  )
}
