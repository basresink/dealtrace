// Typen voor word-extractor (oude Word-bestanden en de OLE-lezer), alleen wat server/utils/documentTekst.ts gebruikt.
declare module 'word-extractor' {
  interface WordDocument {
    getBody(): string
    getFootnotes(): string
    getTextboxes?(opties?: { includeHeadersAndFooters?: boolean; includeBody?: boolean }): string
  }
  export default class WordExtractor {
    extract(bron: Buffer | string): Promise<WordDocument>
  }
}
declare module 'word-extractor/lib/buffer-reader.js' {
  export default class BufferReader { constructor(buf: Buffer) }
}
declare module 'word-extractor/lib/ole-compound-doc.js' {
  import type { Readable } from 'node:stream'
  export default class OleCompoundDoc {
    constructor(lezer: unknown)
    read(): Promise<OleCompoundDoc>
    stream(naam: string): Readable
  }
}
