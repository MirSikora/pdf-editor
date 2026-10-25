import { useState } from 'react'
import { Modal } from './Modal'
import type { FormFieldInfo } from '../lib/pdfEngine'

export function FormPanel({
  fields,
  onClose,
  onApply,
}: {
  fields: FormFieldInfo[]
  onClose: () => void
  onApply: (values: Record<string, string | boolean>, flatten: boolean) => void
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {}
    for (const f of fields) initial[f.name] = f.value
    return initial
  })
  const [flatten, setFlatten] = useState(true)

  return (
    <Modal title="Vyplnit formulář" onClose={onClose}>
      {fields.length === 0 ? (
        <p className="hint">Tento PDF dokument neobsahuje žádná formulářová pole.</p>
      ) : (
        <>
          <div className="form-section form-fields-list">
            {fields.map((field) => (
              <label key={field.name} className="form-field">
                {field.name}
                {field.type === 'text' && (
                  <input
                    type="text"
                    value={String(values[field.name] ?? '')}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  />
                )}
                {field.type === 'checkbox' && (
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))}
                  />
                )}
                {(field.type === 'dropdown' || field.type === 'radio' || field.type === 'optionlist') && (
                  <select
                    value={String(values[field.name] ?? '')}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  >
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
            Po vyplnění pole "zamknout" (sloučit do obsahu stránky)
          </label>
          <button
            className="btn btn-primary"
            onClick={() => {
              onApply(values, flatten)
              onClose()
            }}
          >
            Uložit do dokumentu
          </button>
        </>
      )}
    </Modal>
  )
}
