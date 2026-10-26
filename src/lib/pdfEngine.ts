import { PDFDocument, rgb, degrees } from 'pdf-lib'
import type { PDFFont, PDFImage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Annotation } from '../types/annotations'

export type RgbColor = { r: number; g: number; b: number }

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  return { r, g, b }
}

const fontBytesCache = new Map<string, Promise<ArrayBuffer>>()

function fetchFontBytes(url: string): Promise<ArrayBuffer> {
  let cached = fontBytesCache.get(url)
  if (!cached) {
    cached = fetch(url).then((r) => r.arrayBuffer())
    fontBytesCache.set(url, cached)
  }
  return cached
}

// Standard14 fonts only support WinAnsi encoding, which is missing Czech
// diacritics (ů, ě, š, č, ř, ž, ď, ť, ň). Embed a static Unicode TTF instead
// (DejaVu Sans) so typed/watermark text with Czech characters renders
// correctly — pdf-lib/fontkit cannot subset variable-font outlines.
async function embedUnicodeFont(doc: PDFDocument, bold = false): Promise<PDFFont> {
  doc.registerFontkit(fontkit)
  const url = bold ? '/fonts/DejaVuSans-Bold.ttf' : '/fonts/DejaVuSans.ttf'
  const fontBytes = await fetchFontBytes(url)
  return doc.embedFont(fontBytes, { subset: true })
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true })
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save()
}

export async function getPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await load(bytes)
  return doc.getPageCount()
}

export async function createBlankPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage()
  return save(doc)
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const fileBytes of files) {
    const src = await load(fileBytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return save(out)
}

export async function rotatePage(
  bytes: Uint8Array,
  pageIndex: number,
  deltaDegrees: number,
): Promise<Uint8Array> {
  const doc = await load(bytes)
  const page = doc.getPage(pageIndex)
  const current = page.getRotation().angle
  page.setRotation(degrees(current + deltaDegrees))
  return save(doc)
}

export async function deletePage(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const doc = await load(bytes)
  doc.removePage(pageIndex)
  return save(doc)
}

export async function reorderPages(bytes: Uint8Array, newOrder: number[]): Promise<Uint8Array> {
  const src = await load(bytes)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, newOrder)
  pages.forEach((p) => out.addPage(p))
  return save(out)
}

export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await load(bytes)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, indices)
  pages.forEach((p) => out.addPage(p))
  return save(out)
}

export async function splitEachPage(bytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await load(bytes)
  const count = src.getPageCount()
  const results: Uint8Array[] = []
  for (let i = 0; i < count; i++) {
    const out = await PDFDocument.create()
    const [page] = await out.copyPages(src, [i])
    out.addPage(page)
    results.push(await save(out))
  }
  return results
}

export type TextOptions = {
  fontSize: number
  color: RgbColor
}

export async function addText(
  bytes: Uint8Array,
  pageIndex: number,
  pdfX: number,
  pdfY: number,
  text: string,
  opts: TextOptions,
): Promise<Uint8Array> {
  const doc = await load(bytes)
  const page = doc.getPage(pageIndex)
  const font: PDFFont = await embedUnicodeFont(doc)
  page.drawText(text, {
    x: pdfX,
    y: pdfY,
    size: opts.fontSize,
    font,
    color: rgb(opts.color.r, opts.color.g, opts.color.b),
  })
  return save(doc)
}

export async function addHighlight(
  bytes: Uint8Array,
  pageIndex: number,
  pdfX: number,
  pdfY: number,
  width: number,
  height: number,
  color: RgbColor,
  opacity: number,
): Promise<Uint8Array> {
  const doc = await load(bytes)
  const page = doc.getPage(pageIndex)
  page.drawRectangle({
    x: pdfX,
    y: pdfY,
    width,
    height,
    color: rgb(color.r, color.g, color.b),
    opacity,
  })
  return save(doc)
}

// Bakes a batch of editable text/image annotations (see src/types/annotations.ts)
// into the actual PDF content: a white rectangle behind each annotation that
// opted in (used to "white out" existing text/images before replacing them),
// then the text or image itself. This is the only way to change PDF content —
// there's no way to edit the original content stream in place, so "editing"
// existing text/images means covering them and drawing new content on top.
export async function applyAnnotations(bytes: Uint8Array, annotations: Annotation[]): Promise<Uint8Array> {
  if (annotations.length === 0) return bytes
  const doc = await load(bytes)
  const font = await embedUnicodeFont(doc)
  const imageCache = new Map<string, PDFImage>()

  for (const ann of annotations) {
    const page = doc.getPage(ann.pageIndex)

    if (ann.type === 'text') {
      const textHeight = ann.fontSize * 1.2
      if (ann.background) {
        const autoWidth = font.widthOfTextAtSize(ann.text || ' ', ann.fontSize) + 4
        page.drawRectangle({
          x: ann.x - (ann.coverWidth ? 0 : 2),
          y: ann.y - (ann.coverHeight ?? textHeight),
          width: ann.coverWidth ?? autoWidth,
          height: ann.coverHeight ?? textHeight,
          color: rgb(1, 1, 1),
        })
      }
      page.drawText(ann.text, {
        x: ann.x,
        y: ann.y - ann.fontSize * 0.8,
        size: ann.fontSize,
        font,
        color: rgb(ann.color.r, ann.color.g, ann.color.b),
      })
    } else {
      if (ann.background) {
        page.drawRectangle({
          x: ann.x,
          y: ann.y - ann.height,
          width: ann.width,
          height: ann.height,
          color: rgb(1, 1, 1),
        })
      }
      let embedded = imageCache.get(ann.id)
      if (!embedded) {
        embedded = ann.mime === 'image/png' ? await doc.embedPng(ann.bytes) : await doc.embedJpg(ann.bytes)
        imageCache.set(ann.id, embedded)
      }
      page.drawImage(embedded, {
        x: ann.x,
        y: ann.y - ann.height,
        width: ann.width,
        height: ann.height,
      })
    }
  }

  return save(doc)
}

export type WatermarkOptions = {
  text: string
  fontSize: number
  color: RgbColor
  opacity: number
  rotationDeg: number
}

export async function addWatermark(bytes: Uint8Array, opts: WatermarkOptions): Promise<Uint8Array> {
  const doc = await load(bytes)
  const font = await embedUnicodeFont(doc, true)
  const pages = doc.getPages()
  for (const page of pages) {
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(opts.text, opts.fontSize)
    page.drawText(opts.text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: opts.fontSize,
      font,
      color: rgb(opts.color.r, opts.color.g, opts.color.b),
      opacity: opts.opacity,
      rotate: degrees(opts.rotationDeg),
    })
  }
  return save(doc)
}

export type FormFieldInfo = {
  name: string
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'optionlist' | 'unknown'
  value: string | boolean
  options?: string[]
}

export async function getFormFields(bytes: Uint8Array): Promise<FormFieldInfo[]> {
  const doc = await load(bytes)
  const form = doc.getForm()
  const fields = form.getFields()
  const infos: FormFieldInfo[] = []
  for (const field of fields) {
    const name = field.getName()
    const ctor = field.constructor.name
    if (ctor === 'PDFTextField') {
      const f = form.getTextField(name)
      infos.push({ name, type: 'text', value: f.getText() ?? '' })
    } else if (ctor === 'PDFCheckBox') {
      const f = form.getCheckBox(name)
      infos.push({ name, type: 'checkbox', value: f.isChecked() })
    } else if (ctor === 'PDFDropdown') {
      const f = form.getDropdown(name)
      infos.push({ name, type: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions() })
    } else if (ctor === 'PDFRadioGroup') {
      const f = form.getRadioGroup(name)
      infos.push({ name, type: 'radio', value: f.getSelected() ?? '', options: f.getOptions() })
    } else if (ctor === 'PDFOptionList') {
      const f = form.getOptionList(name)
      infos.push({ name, type: 'optionlist', value: f.getSelected()[0] ?? '', options: f.getOptions() })
    } else {
      infos.push({ name, type: 'unknown', value: '' })
    }
  }
  return infos
}

export async function fillForm(
  bytes: Uint8Array,
  values: Record<string, string | boolean>,
  flatten: boolean,
): Promise<Uint8Array> {
  const doc = await load(bytes)
  const form = doc.getForm()
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFields().find((f) => f.getName() === name)
    if (!field) continue
    const ctor = field.constructor.name
    try {
      if (ctor === 'PDFTextField') {
        form.getTextField(name).setText(String(value))
      } else if (ctor === 'PDFCheckBox') {
        const cb = form.getCheckBox(name)
        if (value) cb.check()
        else cb.uncheck()
      } else if (ctor === 'PDFDropdown') {
        form.getDropdown(name).select(String(value))
      } else if (ctor === 'PDFRadioGroup') {
        form.getRadioGroup(name).select(String(value))
      } else if (ctor === 'PDFOptionList') {
        form.getOptionList(name).select(String(value))
      }
    } catch {
      // ignore fields that reject the given value (e.g. invalid option)
    }
  }
  if (flatten) form.flatten()
  return save(doc)
}

export function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
