import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '../../shared/contactgegevens'
import { HOUDINGEN } from '../../shared/invloed'
import { LABEL_KLEUREN, LABEL_TINTEN, LABELS, faseDef, klasseDef, labelDef, ordenLabels, scoreDef, type LabelDef } from '../../shared/labels'

// Labelsysteem: register, regels uit de mockup en contrast van elke tint.
const alle = Object.entries(LABELS).flatMap(([soort, reg]) => Object.entries(reg as Record<string, LabelDef | null>).map(([waarde, def]) => ({ soort, waarde, def })))

describe('register', () => {
  it('kent alleen de drie stijlen plus leeg en de zeven tinten', () => {
    for (const { def } of alle) {
      if (!def) continue
      expect(['vol', 'zacht', 'rand', 'leeg']).toContain(def.stijl)
      if (def.tint) expect(LABEL_TINTEN).toContain(def.tint)
    }
  })
  it('geen label is geel, en paars is alleen AI', () => {
    for (const { soort, waarde, def } of alle) {
      if (!def) continue
      expect(def.tint as string, `${soort}.${waarde}`).not.toBe('geel')
      expect(def.tint as string, `${soort}.${waarde}`).not.toBe('zwart')
      if (def.tint === 'paars') expect(def.ai, `${soort}.${waarde} is paars maar geen AI`).toBe(true)
      if (def.ai) expect(def.tint).toBe('paars')
    }
  })
  it('gevuld is alleen rood en alleen voor urgentie, prioriteit urgent en achterstallig', () => {
    const vol = alle.filter((x) => x.def?.stijl === 'vol').map((x) => `${x.soort}.${x.waarde}`)
    expect(vol.sort()).toEqual(['gezondheid.risico', 'melding.kritiek', 'prioriteit.urgent', 'urgentie.achterstallig', 'urgentie.bel-me-niet', 'urgentie.over-tijd', 'urgentie.risico'])
  })
  it('elk zacht label heeft een tint en een icoon', () => {
    for (const { soort, waarde, def } of alle) if (def?.stijl === 'zacht') { expect(def.tint, `${soort}.${waarde}`).toBeTruthy(); expect(def.icoon, `${soort}.${waarde}`).toBeTruthy() }
  })
  it('standaardwaarden krijgen geen label', () => {
    expect(labelDef('prioriteit', 'middel')).toBeNull()
    expect(labelDef('herkomst', 'handmatig')).toBeNull()
    expect(labelDef('status', 'actief')).toBeNull()
    expect(labelDef('rol', null)).toBeNull()
    expect(labelDef('bestaat-niet', 'x')).toBeNull()
  })
  it('elke contactrol heeft een eigen icoon; de term is Champion', () => {
    const iconen = new Set<string>()
    for (const r of ROLLEN_CONTACT) {
      const d = labelDef('rol', r)!
      expect(d, r).toBeTruthy()
      iconen.add(d.icoon!)
    }
    expect(iconen.size).toBe(ROLLEN_CONTACT.length)
    expect(labelDef('rol', 'champion')!.tekst).toBe(CONTACTROL_LABEL.champion)
    expect(labelDef('rol', 'onbekend')!.stijl).toBe('leeg')
  })
  it('houding heeft duim, streep, verbod en gestippeld onbekend', () => {
    expect(HOUDINGEN.map((h) => labelDef('houding', h)!.icoon)).toEqual(['ThumbsUp', 'Minus', 'Ban', 'CircleHelp'])
    expect(labelDef('houding', 'onbekend')!.stijl).toBe('leeg')
  })
  it('een agent als herkomst is AI, uit inzicht niet', () => {
    expect(labelDef('herkomst', 'agent')!.ai).toBe(true)
    expect(labelDef('herkomst', 'inzicht')!.stijl).toBe('rand')
  })
})

describe('klasse, fase en score', () => {
  it('klasse: letter, naam en trap', () => {
    expect(klasseDef('A · Corporate (250 of meer)')).toEqual({ letter: 'A', tekst: 'Corporate', trap: 4 })
    expect(klasseDef('D · Slapend')).toEqual({ letter: 'D', tekst: 'Slapend', trap: 1 })
    expect(klasseDef('B')).toEqual({ letter: 'B', tekst: '', trap: 3 })
    expect(klasseDef('Strategisch')).toEqual({ letter: 'S', tekst: 'Strategisch', trap: 0 })
    expect(klasseDef(null)).toBeNull()
  })
  it('fase: vier stappen, verloren buiten de reis', () => {
    expect(['vinden', 'bewerken', 'verbinden', 'overgedragen'].map((h) => faseDef(h).stap)).toEqual([1, 2, 3, 4])
    expect(faseDef('verloren')).toEqual({ stap: 0, uit: true })
  })
  it('score: rand, vanaf 75 oranje met vlam', () => {
    expect(scoreDef(70)).toEqual({ tekst: '70', stijl: 'rand' })
    expect(scoreDef(82)).toMatchObject({ tekst: '82', stijl: 'zacht', tint: 'oranje', icoon: 'Flame' })
    expect(scoreDef(null)).toBeNull()
  })
})

describe('volgorde in een rij', () => {
  it('vaste volgorde, één gevuld label, hoogstens vier', () => {
    const rij = ordenLabels([
      { soort: 'herkomst', waarde: 'inzicht' },
      { soort: 'ai', waarde: 'agent' },
      { soort: 'actie', waarde: 'bellen' },
      { soort: 'prioriteit', waarde: 'urgent' },
      { soort: 'fase', waarde: 'bewerken', tekst: 'Benaderd' },
      { soort: 'fase', waarde: 'vinden' },
      { soort: 'urgentie', waarde: 'over-tijd' },
      { soort: 'herkomst', waarde: 'handmatig' },
    ])
    expect(rij.map((l) => `${l.soort}.${l.waarde}`)).toEqual(['urgentie.over-tijd', 'fase.bewerken', 'actie.bellen', 'herkomst.inzicht'])
  })
})

// Contrast (WCAG): elke tint haalt 4,5:1, op het eigen vlak en (rand) op wit.
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
const contrast = (a: string, b: string) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

describe('contrast en tokens', () => {
  const css = readFileSync(join(process.cwd(), 'app/assets/css/ui-standaard.css'), 'utf8')
  const token = (naam: string) => new RegExp(`--${naam}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1]?.toLowerCase()
  it('de tokens in ui-standaard.css zijn gelijk aan het register', () => {
    for (const t of LABEL_TINTEN) for (const deel of ['tekst', 'vlak', 'rand'] as const) expect(token(`lbl-${t}-${deel}`), `${t}-${deel}`).toBe(LABEL_KLEUREN[t][deel])
    expect(token('lbl-vol-vlak')).toBe(LABEL_KLEUREN.vol.vlak)
    expect(token('lbl-rand-tekst')).toBe(LABEL_KLEUREN.rand.tekst)
    expect(token('lbl-rand-zacht')).toBe(LABEL_KLEUREN.rand.zacht)
  })
  it('alleen het lichte thema: geen donkere labeltokens', () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/)
    expect(css).not.toMatch(/data-theme="dark"/)
  })
  it.each(LABEL_TINTEN)('zacht %s haalt 4,5:1', (t) => {
    expect(contrast(LABEL_KLEUREN[t].tekst, LABEL_KLEUREN[t].vlak)).toBeGreaterThanOrEqual(4.5)
  })
  it('gevuld, rand en leeg halen 4,5:1', () => {
    expect(contrast(LABEL_KLEUREN.vol.tekst, LABEL_KLEUREN.vol.vlak)).toBeGreaterThanOrEqual(4.5)
    for (const vlak of ['#ffffff', '#f1f1ee']) {
      expect(contrast(LABEL_KLEUREN.rand.tekst, vlak)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(LABEL_KLEUREN.rand.zacht, vlak)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
