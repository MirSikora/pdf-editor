import type { RgbColor } from '../lib/pdfEngine'

type AnnotationBase = {
  id: string
  pageIndex: number
  /** top-left corner in PDF user-space units (y grows upward, like pdf-lib) */
  x: number
  y: number
  background: boolean
}

export type TextAnnotation = AnnotationBase & {
  type: 'text'
  text: string
  fontSize: number
  color: RgbColor
  /** Explicit cover-rectangle size (PDF units), used instead of auto-sizing
   *  from text width when replacing existing text — the cover must hide the
   *  full original text, not just whatever the replacement text measures. */
  coverWidth?: number
  coverHeight?: number
}

export type ImageAnnotation = AnnotationBase & {
  type: 'image'
  width: number
  height: number
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg'
  previewUrl: string
}

export type Annotation = TextAnnotation | ImageAnnotation
