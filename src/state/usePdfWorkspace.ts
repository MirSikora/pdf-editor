import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdfJs } from '../lib/pdfRender'
import * as engine from '../lib/pdfEngine'
import type { FormFieldInfo, RgbColor, TextOptions, WatermarkOptions } from '../lib/pdfEngine'

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

export function usePdfWorkspace() {
  const [fileName, setFileName] = useState<string>('dokument.pdf')
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [past, setPast] = useState<Uint8Array[]>([])
  const [future, setFuture] = useState<Uint8Array[]>([])

  const [pdfjsDoc, setPdfjsDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPage, setSelectedPage] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formFields, setFormFields] = useState<FormFieldInfo[]>([])

  const revBytes = useRef(0)

  useEffect(() => {
    let cancelled = false
    if (!bytes) {
      setPdfjsDoc(null)
      setPageCount(0)
      setFormFields([])
      return
    }
    revBytes.current += 1
    setLoading(true)
    setError(null)
    openPdfJs(bytes)
      .then((doc) => {
        if (cancelled) return
        setPdfjsDoc(doc)
        setPageCount(doc.numPages)
        setSelectedPage((p) => Math.min(p, doc.numPages - 1 < 0 ? 0 : doc.numPages - 1))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Nepodařilo se otevřít PDF')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    engine
      .getFormFields(bytes)
      .then((fields) => {
        if (!cancelled) setFormFields(fields)
      })
      .catch(() => {
        if (!cancelled) setFormFields([])
      })
    return () => {
      cancelled = true
    }
  }, [bytes])

  const commit = useCallback(
    (newBytes: Uint8Array) => {
      setBytes((current) => {
        if (current) setPast((p) => [...p, current])
        return newBytes
      })
      setFuture([])
    },
    [],
  )

  const runEdit = useCallback(
    async (fn: () => Promise<Uint8Array>) => {
      setLoading(true)
      setError(null)
      try {
        const result = await fn()
        commit(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Operace se nezdařila')
      } finally {
        setLoading(false)
      }
    },
    [commit],
  )

  const openFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setLoading(true)
      setError(null)
      try {
        const buffers = await Promise.all(files.map(fileToBytes))
        const merged = buffers.length === 1 ? buffers[0] : await engine.mergePdfs(buffers)
        setFileName(files.length === 1 ? files[0].name : 'sloučený-dokument.pdf')
        setPast([])
        setFuture([])
        setBytes(merged)
        setSelectedPage(0)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nepodařilo se načíst PDF')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const appendFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || !bytes) return
      await runEdit(async () => {
        const buffers = await Promise.all(files.map(fileToBytes))
        return engine.mergePdfs([bytes, ...buffers])
      })
    },
    [bytes, runEdit],
  )

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0 || !bytes) return p
      const prev = p[p.length - 1]
      setFuture((f) => [bytes, ...f])
      setBytes(prev)
      return p.slice(0, -1)
    })
  }, [bytes])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0 || !bytes) return f
      const next = f[0]
      setPast((p) => [...p, bytes])
      setBytes(next)
      return f.slice(1)
    })
  }, [bytes])

  const rotateCurrentPage = useCallback(
    (pageIndex: number, delta: number) => {
      if (!bytes) return
      return runEdit(() => engine.rotatePage(bytes, pageIndex, delta))
    },
    [bytes, runEdit],
  )

  const deletePageAt = useCallback(
    (pageIndex: number) => {
      if (!bytes) return
      return runEdit(() => engine.deletePage(bytes, pageIndex))
    },
    [bytes, runEdit],
  )

  const reorder = useCallback(
    (newOrder: number[]) => {
      if (!bytes) return
      return runEdit(() => engine.reorderPages(bytes, newOrder))
    },
    [bytes, runEdit],
  )

  const addTextAt = useCallback(
    (pageIndex: number, pdfX: number, pdfY: number, text: string, opts: TextOptions) => {
      if (!bytes) return
      return runEdit(() => engine.addText(bytes, pageIndex, pdfX, pdfY, text, opts))
    },
    [bytes, runEdit],
  )

  const addHighlightAt = useCallback(
    (
      pageIndex: number,
      pdfX: number,
      pdfY: number,
      w: number,
      h: number,
      color: RgbColor,
      opacity: number,
    ) => {
      if (!bytes) return
      return runEdit(() => engine.addHighlight(bytes, pageIndex, pdfX, pdfY, w, h, color, opacity))
    },
    [bytes, runEdit],
  )

  const addWatermarkAll = useCallback(
    (opts: WatermarkOptions) => {
      if (!bytes) return
      return runEdit(() => engine.addWatermark(bytes, opts))
    },
    [bytes, runEdit],
  )

  const applyFormValues = useCallback(
    (values: Record<string, string | boolean>, flatten: boolean) => {
      if (!bytes) return
      return runEdit(() => engine.fillForm(bytes, values, flatten))
    },
    [bytes, runEdit],
  )

  const exportCurrent = useCallback(() => {
    if (!bytes) return
    engine.triggerDownload(bytes, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
  }, [bytes, fileName])

  const splitRange = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!bytes) return
      setLoading(true)
      setError(null)
      try {
        const indices = []
        for (let i = fromIndex; i <= toIndex; i++) indices.push(i)
        const extracted = await engine.extractPages(bytes, indices)
        engine.triggerDownload(extracted, `${fileName.replace(/\.pdf$/i, '')}-${fromIndex + 1}-${toIndex + 1}.pdf`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Rozdělení se nezdařilo')
      } finally {
        setLoading(false)
      }
    },
    [bytes, fileName],
  )

  const splitEach = useCallback(async () => {
    if (!bytes) return
    setLoading(true)
    setError(null)
    try {
      const parts = await engine.splitEachPage(bytes)
      const base = fileName.replace(/\.pdf$/i, '')
      parts.forEach((part, i) => {
        setTimeout(() => engine.triggerDownload(part, `${base}-strana-${i + 1}.pdf`), i * 150)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rozdělení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [bytes, fileName])

  return {
    fileName,
    bytes,
    pdfjsDoc,
    pageCount,
    selectedPage,
    setSelectedPage,
    loading,
    error,
    setError,
    formFields,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    openFiles,
    appendFiles,
    rotateCurrentPage,
    deletePageAt,
    reorder,
    addTextAt,
    addHighlightAt,
    addWatermarkAll,
    applyFormValues,
    exportCurrent,
    splitRange,
    splitEach,
  }
}

export type PdfWorkspace = ReturnType<typeof usePdfWorkspace>
