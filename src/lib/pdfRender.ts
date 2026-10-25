import { pdfjsLib } from './pdfjsSetup'
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist'

export async function openPdfJs(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  // pdf.js detaches/transfers the buffer it is given, so hand it a copy.
  const copy = bytes.slice()
  const task = pdfjsLib.getDocument({ data: copy })
  return task.promise
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ page: PDFPageProxy; viewport: PageViewport }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')

  const outputScale = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`

  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined

  await page.render({ canvas, canvasContext: context, viewport, transform }).promise
  return { page, viewport }
}
