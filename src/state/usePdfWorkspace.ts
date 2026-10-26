import { useCallback, useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdfJs } from '../lib/pdfRender'
import * as engine from '../lib/pdfEngine'
import type { FormFieldInfo, RgbColor, WatermarkOptions } from '../lib/pdfEngine'
import type { Annotation } from '../types/annotations'

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

function revokeAnnotationUrls(annotations: Annotation[]) {
  for (const a of annotations) {
    if (a.type === 'image') URL.revokeObjectURL(a.previewUrl)
  }
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

  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!bytes) {
      setPdfjsDoc(null)
      setPageCount(0)
      setFormFields([])
      return
    }
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

  const commit = useCallback((newBytes: Uint8Array) => {
    setBytes((current) => {
      if (current) setPast((p) => [...p, current])
      return newBytes
    })
    setFuture([])
  }, [])

  // Bakes any pending (not-yet-saved) text/image annotations into `base` and
  // clears the pending layer. Every operation that reads from `bytes` must go
  // through this first, otherwise pending annotations would silently vanish
  // (or, worse, end up pointing at the wrong page after a rotate/delete/reorder).
  const bakeAnnotationsIfAny = useCallback(
    async (base: Uint8Array): Promise<Uint8Array> => {
      if (annotations.length === 0) return base
      const result = await engine.applyAnnotations(base, annotations)
      revokeAnnotationUrls(annotations)
      setAnnotations([])
      setSelectedAnnotationId(null)
      return result
    },
    [annotations],
  )

  const runEdit = useCallback(
    async (fn: (base: Uint8Array) => Promise<Uint8Array>) => {
      if (!bytes) return
      setLoading(true)
      setError(null)
      try {
        const baked = await bakeAnnotationsIfAny(bytes)
        const result = await fn(baked)
        commit(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Operace se nezdařila')
      } finally {
        setLoading(false)
      }
    },
    [bytes, bakeAnnotationsIfAny, commit],
  )

  const openFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const buffers = await Promise.all(files.map(fileToBytes))
      const merged = buffers.length === 1 ? buffers[0] : await engine.mergePdfs(buffers)
      setFileName(files.length === 1 ? files[0].name : 'sloučený-dokument.pdf')
      setPast([])
      setFuture([])
      setAnnotations((prev) => {
        revokeAnnotationUrls(prev)
        return []
      })
      setSelectedAnnotationId(null)
      setBytes(merged)
      setSelectedPage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodařilo se načíst PDF')
    } finally {
      setLoading(false)
    }
  }, [])

  const appendFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0 || !bytes) return
      return runEdit(async (base) => {
        const buffers = await Promise.all(files.map(fileToBytes))
        return engine.mergePdfs([base, ...buffers])
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
    (pageIndex: number, delta: number) => runEdit((base) => engine.rotatePage(base, pageIndex, delta)),
    [runEdit],
  )

  const deletePageAt = useCallback(
    (pageIndex: number) => runEdit((base) => engine.deletePage(base, pageIndex)),
    [runEdit],
  )

  const reorder = useCallback(
    (newOrder: number[]) => runEdit((base) => engine.reorderPages(base, newOrder)),
    [runEdit],
  )

  const addHighlightAt = useCallback(
    (pageIndex: number, pdfX: number, pdfY: number, w: number, h: number, color: RgbColor, opacity: number) =>
      runEdit((base) => engine.addHighlight(base, pageIndex, pdfX, pdfY, w, h, color, opacity)),
    [runEdit],
  )

  const addWatermarkAll = useCallback(
    (opts: WatermarkOptions) => runEdit((base) => engine.addWatermark(base, opts)),
    [runEdit],
  )

  const applyFormValues = useCallback(
    (values: Record<string, string | boolean>, flatten: boolean) =>
      runEdit((base) => engine.fillForm(base, values, flatten)),
    [runEdit],
  )

  // --- Editable annotation layer (new/replacement text & images) ---

  const addTextAnnotation = useCallback(
    (
      pageIndex: number,
      x: number,
      y: number,
      text: string,
      fontSize: number,
      color: RgbColor,
      background: boolean,
      cover?: { width: number; height: number },
    ) => {
      const id = crypto.randomUUID()
      setAnnotations((a) => [
        ...a,
        {
          id,
          type: 'text',
          pageIndex,
          x,
          y,
          text,
          fontSize,
          color,
          background,
          coverWidth: cover?.width,
          coverHeight: cover?.height,
        },
      ])
      setSelectedAnnotationId(id)
      return id
    },
    [],
  )

  const addImageAnnotation = useCallback(
    (
      pageIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
      imgBytes: Uint8Array,
      mime: 'image/png' | 'image/jpeg',
      background: boolean,
    ) => {
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(new Blob([imgBytes as BlobPart], { type: mime }))
      setAnnotations((a) => [
        ...a,
        { id, type: 'image', pageIndex, x, y, width, height, bytes: imgBytes, mime, previewUrl, background },
      ])
      setSelectedAnnotationId(id)
      return id
    },
    [],
  )

  const updateAnnotation = useCallback((id: string, patch: Partial<Annotation>) => {
    setAnnotations((list) => list.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)))
  }, [])

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((list) => {
      const found = list.find((a) => a.id === id)
      if (found) revokeAnnotationUrls([found])
      return list.filter((a) => a.id !== id)
    })
    setSelectedAnnotationId((s) => (s === id ? null : s))
  }, [])

  const discardAnnotations = useCallback(() => {
    setAnnotations((list) => {
      revokeAnnotationUrls(list)
      return []
    })
    setSelectedAnnotationId(null)
  }, [])

  const commitAnnotations = useCallback(() => {
    if (!bytes || annotations.length === 0) return
    return runEdit((base) => Promise.resolve(base))
  }, [bytes, annotations.length, runEdit])

  const exportCurrent = useCallback(async () => {
    if (!bytes) return
    setLoading(true)
    setError(null)
    try {
      const baked = await bakeAnnotationsIfAny(bytes)
      if (baked !== bytes) commit(baked)
      engine.triggerDownload(baked, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stažení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [bytes, bakeAnnotationsIfAny, commit, fileName])

  const splitRange = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!bytes) return
      setLoading(true)
      setError(null)
      try {
        const baked = await bakeAnnotationsIfAny(bytes)
        if (baked !== bytes) commit(baked)
        const indices = []
        for (let i = fromIndex; i <= toIndex; i++) indices.push(i)
        const extracted = await engine.extractPages(baked, indices)
        engine.triggerDownload(extracted, `${fileName.replace(/\.pdf$/i, '')}-${fromIndex + 1}-${toIndex + 1}.pdf`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Rozdělení se nezdařilo')
      } finally {
        setLoading(false)
      }
    },
    [bytes, bakeAnnotationsIfAny, commit, fileName],
  )

  const splitEach = useCallback(async () => {
    if (!bytes) return
    setLoading(true)
    setError(null)
    try {
      const baked = await bakeAnnotationsIfAny(bytes)
      if (baked !== bytes) commit(baked)
      const parts = await engine.splitEachPage(baked)
      const base = fileName.replace(/\.pdf$/i, '')
      parts.forEach((part, i) => {
        setTimeout(() => engine.triggerDownload(part, `${base}-strana-${i + 1}.pdf`), i * 150)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rozdělení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [bytes, bakeAnnotationsIfAny, commit, fileName])

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
    addHighlightAt,
    addWatermarkAll,
    applyFormValues,
    exportCurrent,
    splitRange,
    splitEach,
    annotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    addTextAnnotation,
    addImageAnnotation,
    updateAnnotation,
    deleteAnnotation,
    discardAnnotations,
    commitAnnotations,
  }
}

export type PdfWorkspace = ReturnType<typeof usePdfWorkspace>
