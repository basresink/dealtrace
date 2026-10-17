<script setup lang="ts">
// Weekrooster van de agenda in de opzet van DealDrive: een tijd-as links, een kolom per dag, een rij
// voor hele-dag-items (afgeronde belblokken, taken zonder tijd, hele dagen uit de gekoppelde agenda),
// uurlijnen over de hele dag in een kader dat bij openen naar 07:00 scrolt, de rode nu-lijn in de
// kolom van vandaag en afspraken, belblokken en taken op hun eigen tijd. Overlappende items staan
// naast elkaar. Klik op een lege plek plant een afspraak op dat moment.
const props = defineProps<{
  dagen: string[]
  vandaag: string
  afspraken: any[]
  belblokken: any[]
  taken: any[]
  bezet: any[]
  conflicten: string[]
  toonEigenaar?: boolean
  telefoon?: boolean
}>()
const emit = defineEmits<{ afspraak: [id: string]; taak: [id: string]; plan: [voorstel: { datum: string; start: string }] }>()

const UUR = computed(() => (props.telefoon ? 60 : 48))
const HOOGTE = computed(() => 24 * UUR.value)
const TZ = 'Europe/Amsterdam'
const dagVan = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const minuut = (iso: string) => { const [h, m] = tijd(iso).split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0) }
/** Eindminuut op de startdag; over middernacht telt hij door (00:00 is 1440). */
function eindMinuut(start: string, eind: string) {
  const dagen = Math.round((Date.parse(`${dagVan(eind)}T12:00:00Z`) - Date.parse(`${dagVan(start)}T12:00:00Z`)) / 864e5)
  return minuut(eind) + dagen * 1440
}
const KLEUREN = ['geel', 'paars', 'blauw', 'groen', 'oranje', 'grijs', 'rood']
const kleur = (k?: string | null) => (k && KLEUREN.includes(k) ? k : 'grijs')
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const naam = (n?: string | null) => (n ?? '').replace(/^Testgebruiker /, '')

interface Item { id: string; soort: 'afspraak' | 'belblok' | 'taak' | 'bezet'; start: number; eind: number; data: any }
/**
 * Overlappende items naast elkaar: eerst groepen die elkaar raken, dan binnen een groep de eerste vrije
 * kolom. Elk item telt mee met een minimale zichtbare hoogte, zodat korte blokken elkaar niet bedekken.
 */
function verdeel(items: Item[], minDuur: number) {
  const volgorde = [...items].sort((a, b) => a.start - b.start || b.eind - a.eind)
  const uit = new Map<Item, { kolom: number; aantal: number }>()
  let groep: Item[] = []; let groepEind = -Infinity
  const sluit = () => {
    const kolommen: number[] = []
    for (const it of groep) {
      const eind = Math.max(it.eind, it.start + minDuur)
      let k = kolommen.findIndex((e) => e <= it.start)
      if (k === -1) { kolommen.push(eind); k = kolommen.length - 1 } else kolommen[k] = eind
      uit.set(it, { kolom: k, aantal: 0 })
    }
    for (const it of groep) uit.get(it)!.aantal = kolommen.length
    groep = []; groepEind = -Infinity
  }
  for (const it of volgorde) {
    if (groep.length && it.start >= groepEind) sluit()
    groep.push(it); groepEind = Math.max(groepEind, it.start + minDuur, it.eind)
  }
  if (groep.length) sluit()
  return uit
}

const kolommen = computed(() => {
  const minPx = props.telefoon ? 44 : 22
  const minDuur = (minPx / UUR.value) * 60
  return props.dagen.map((d) => {
    const items: Item[] = []
    for (const a of props.afspraken) if (dagVan(a.start) === d) items.push({ id: a.id, soort: 'afspraak', start: minuut(a.start), eind: Math.min(1440, Math.max(minuut(a.start) + 15, eindMinuut(a.start, a.eind))), data: a })
    for (const b of props.belblokken) if (b.status !== 'klaar' && dagVan(b.start) === d) items.push({ id: b.id, soort: 'belblok', start: minuut(b.start), eind: Math.min(1440, Math.max(minuut(b.start) + 15, eindMinuut(b.start, b.eind))), data: b })
    for (const b of props.bezet) if (dagVan(b.start) === d && Date.parse(b.eind) - Date.parse(b.start) < 20 * 3600_000) items.push({ id: `bezet-${b.start}`, soort: 'bezet', start: minuut(b.start), eind: Math.min(1440, Math.max(minuut(b.start) + 15, eindMinuut(b.start, b.eind))), data: b })
    // Taken met een tijd: per tijdstip een blok (op een drukke dag staan er tientallen op hetzelfde uur).
    const perTijd = new Map<number, any[]>()
    for (const t of props.taken) {
      if (dagVan(t.due) !== d) continue
      const m = minuut(t.due)
      if (m === 0) continue
      perTijd.set(m, [...(perTijd.get(m) ?? []), t])
    }
    for (const [m, lijst] of perTijd) items.push({ id: `taak-${d}-${m}`, soort: 'taak', start: m, eind: m + 30, data: lijst })
    const plek = verdeel(items, minDuur)
    const blokken = items.map((it) => {
      const p = plek.get(it)!
      const duur = it.eind - it.start
      return {
        ...it, kort: duur < 40, krap: duur < 75,
        stijl: { top: `${(it.start / 60) * UUR.value}px`, height: `${Math.max(minPx, (duur / 60) * UUR.value - 2)}px`, left: `calc(${(p.kolom / p.aantal) * 100}% + 2px)`, width: `calc(${100 / p.aantal}% - 4px)` },
      }
    })
    // Hele dag: afgeronde belblokken, taken zonder tijd en hele dagen uit de gekoppelde agenda.
    const heleDag: { id: string; soort: 'belblok' | 'taak' | 'bezet'; tekst: string; titel: string; link?: string; taakId?: string }[] = []
    for (const b of props.belblokken) if (b.status === 'klaar' && dagVan(b.start) === d) heleDag.push({ id: b.id, soort: 'belblok', tekst: `Belblok: afgerond, ${b.gesprekken} ${b.gesprekken === 1 ? 'gesprek' : 'gesprekken'}`, titel: `${tijd(b.start)} tot ${tijd(b.eind)}`, link: `/belblokken/${b.id}` })
    const zonderTijd = props.taken.filter((t) => dagVan(t.due) === d && minuut(t.due) === 0)
    if (zonderTijd.length === 1) heleDag.push({ id: zonderTijd[0].id, soort: 'taak', tekst: `Taak: ${zonderTijd[0].titel}`, titel: zonderTijd[0].accountNaam ?? '', taakId: zonderTijd[0].id })
    else if (zonderTijd.length > 1) heleDag.push({ id: `taken-${d}`, soort: 'taak', tekst: `${zonderTijd.length} taken`, titel: 'Taken zonder tijd', link: '/taken' })
    for (const b of props.bezet) if (dagVan(b.start) === d && Date.parse(b.eind) - Date.parse(b.start) >= 20 * 3600_000) heleDag.push({ id: `hd-${b.start}`, soort: 'bezet', tekst: b.titel ?? 'Bezet', titel: 'Uit je gekoppelde agenda' })
    const datum = new Date(`${d}T12:00:00Z`)
    return {
      iso: d, vandaag: d === props.vandaag, weekend: [0, 6].includes(datum.getUTCDay()), blokken, heleDag,
      weekdag: new Intl.DateTimeFormat('nl-NL', { weekday: props.telefoon || props.dagen.length === 1 ? 'long' : 'short', timeZone: 'UTC' }).format(datum).replace('.', ''),
      nummer: datum.getUTCDate(),
    }
  })
})
const heeftHeleDag = computed(() => kolommen.value.some((k) => k.heleDag.length))
const conflict = computed(() => new Set(props.conflicten))

// Klik op een lege plek: plan een afspraak op dat moment (op het halfuur afgerond).
function planOp(d: string, e: MouseEvent) {
  const kolom = e.currentTarget as HTMLElement
  const rect = kolom.getBoundingClientRect()
  const m = Math.min(23 * 60 + 30, Math.max(0, Math.floor((((e.clientY - rect.top) / rect.height) * 1440) / 30) * 30))
  emit('plan', { datum: d, start: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })
}

// Nu-lijn: pas na het laden, zodat server en browser hetzelfde tekenen.
const nu = ref<number | null>(null)
let klok: ReturnType<typeof setInterval> | null = null
const kader = ref<HTMLElement | null>(null)
function naarWerkdag() { nextTick(() => { if (kader.value) kader.value.scrollTop = 7 * UUR.value - 6 }) }
onMounted(() => {
  const zet = () => { nu.value = minuut(new Date().toISOString()) }
  zet(); klok = setInterval(zet, 60_000)
  naarWerkdag()
})
onUnmounted(() => { if (klok) clearInterval(klok) })
watch(() => props.dagen.length, naarWerkdag)
defineExpose({ naarWerkdag })
const uren = Array.from({ length: 25 }, (_, i) => i)
</script>

<template>
  <div ref="kader" class="ar" :class="{ 'ar--telefoon': telefoon }" :style="{ '--ar-kolommen': dagen.length, '--ar-uur': `${UUR}px` }" data-test="agenda-raster">
    <div class="ar-kop">
      <div class="ar-hoek" />
      <div v-for="k in kolommen" :key="`kop-${k.iso}`" class="ar-dagkop" :class="{ 'ar-dagkop--vandaag': k.vandaag }" :data-test="`dagkop-${k.iso}`">
        <span class="ar-dagnaam">{{ k.weekdag }}</span>
        <span class="ar-dagnr tnum">{{ k.nummer }}</span>
      </div>
    </div>
    <div v-if="heeftHeleDag" class="ar-heledag" data-test="agenda-heledag">
      <div class="ar-hoek ar-hoek--label">hele dag</div>
      <div v-for="k in kolommen" :key="`hd-${k.iso}`" class="ar-heledag-cel" :class="{ 'ar-heledag-cel--vandaag': k.vandaag }">
        <template v-for="h in k.heleDag" :key="h.id">
          <FunctieLink als-tekst v-if="h.link" :to="h.link" class="ar-chip" :class="`ar-chip--${h.soort}`" :title="h.titel" :data-test="`heledag-${h.id}`">{{ h.tekst }}</FunctieLink>
          <button v-else-if="h.taakId" type="button" class="ar-chip" :class="`ar-chip--${h.soort}`" :title="h.titel" :data-test="`heledag-${h.id}`" @click="emit('taak', h.taakId)">{{ h.tekst }}</button>
          <span v-else class="ar-chip" :class="`ar-chip--${h.soort}`" :title="h.titel">{{ h.tekst }}</span>
        </template>
      </div>
    </div>
    <div class="ar-body" :style="{ height: `${HOOGTE}px` }">
      <div class="ar-as">
        <span v-for="u in uren" :key="u" class="ar-uur tnum" :class="{ 'ar-uur--eerste': u === 0, 'ar-uur--laatste': u === 24 }" :style="{ top: `${u * UUR}px` }">{{ String(u % 24).padStart(2, '0') }}:00</span>
      </div>
      <div v-for="k in kolommen" :key="k.iso" class="ar-kolom" :class="{ 'ar-kolom--vandaag': k.vandaag, 'ar-kolom--weekend': k.weekend }" :data-test="`kolom-${k.iso}`" @click="planOp(k.iso, $event)">
        <template v-for="b in k.blokken" :key="b.id">
          <button
            v-if="b.soort === 'afspraak'" type="button" class="ar-blok ar-blok--afspraak"
            :class="[`ar-kleur--${kleur(b.data.soort.kleur)}`, { 'ar-blok--klaar': b.data.status !== 'gepland', 'ar-blok--conflict': conflict.has(b.id), 'ar-blok--kort': b.kort, 'ar-blok--krap': b.krap }]"
            :style="b.stijl" :data-test="`afspraak-${b.id}`" :title="`${tijd(b.data.start)} tot ${tijd(b.data.eind)} · ${b.data.accountNaam ?? b.data.soort.naam} · ${b.data.soort.naam}`"
            @click.stop="emit('afspraak', b.id)"
          >
            <span class="ar-tijd tnum">{{ tijd(b.data.start) }}<template v-if="!b.kort">-{{ tijd(b.data.eind) }}</template></span>
            <span class="ar-titel">{{ b.data.accountNaam ?? b.data.soort.naam }}</span>
            <span v-if="!b.krap" class="ar-sub">{{ b.data.soort.naam }} · {{ VORM[b.data.vorm] ?? b.data.vorm }}<template v-if="toonEigenaar"> · {{ naam(b.data.ownerNaam) }}</template></span>
            <span v-if="b.data.geplandDoor && !b.krap" class="ar-sub ar-door">Gepland door {{ naam(b.data.geplandDoor) }}</span>
            <span v-if="conflict.has(b.id) && !b.kort" class="ar-merk">Conflict</span>
          </button>
          <FunctieLink als-tekst v-else-if="b.soort === 'belblok'" :to="`/belblokken/${b.id}`" class="ar-blok ar-blok--belblok" :class="{ 'ar-blok--kort': b.kort, 'ar-blok--krap': b.krap }" :style="b.stijl" :data-test="`belblok-${b.id}`" :title="`${tijd(b.data.start)} tot ${tijd(b.data.eind)} · Belblok${b.data.herkomst ? ` · ${b.data.herkomst}` : ''}`" @click.stop>
            <span class="ar-tijd tnum">{{ tijd(b.data.start) }}<template v-if="!b.kort">-{{ tijd(b.data.eind) }}</template></span>
            <span class="ar-titel">Belblok<template v-if="b.data.gesprekken"> · {{ b.data.gesprekken }} {{ b.data.gesprekken === 1 ? 'gesprek' : 'gesprekken' }}</template><template v-if="b.data.status === 'bezig'"> · loopt</template><template v-if="b.data.herkomst"> · {{ b.data.herkomst }}</template></span>
          </FunctieLink>
          <button v-else-if="b.soort === 'taak' && b.data.length === 1" type="button" class="ar-blok ar-blok--taak ar-blok--kort" :style="b.stijl" :data-test="`taak-${b.data[0].id}`" :title="`${tijd(b.data[0].due)} · ${b.data[0].titel}${b.data[0].accountNaam ? ` · ${b.data[0].accountNaam}` : ''}`" @click.stop="emit('taak', b.data[0].id)">
            <span class="ar-tijd tnum">{{ tijd(b.data[0].due) }}</span>
            <span class="ar-titel">{{ b.data[0].titel }}</span>
          </button>
          <FunctieLink als-tekst v-else-if="b.soort === 'taak'" to="/taken" class="ar-blok ar-blok--taak ar-blok--kort" :style="b.stijl" :data-test="`taken-${b.id}`" :title="`${b.data.length} taken om ${tijd(b.data[0].due)}`" @click.stop>
            <span class="ar-tijd tnum">{{ tijd(b.data[0].due) }}</span>
            <span class="ar-titel">{{ b.data.length }} taken</span>
          </FunctieLink>
          <span v-else class="ar-blok ar-blok--bezet" :style="b.stijl" :title="`${tijd(b.data.start)} tot ${tijd(b.data.eind)} · ${b.data.titel ?? 'Bezet'} · uit je gekoppelde agenda`" @click.stop>
            <span class="ar-titel">{{ b.data.titel ?? 'Bezet' }}</span>
          </span>
        </template>
        <div v-if="k.vandaag && nu !== null" class="ar-nu" :style="{ top: `${(nu / 60) * UUR}px` }" data-test="nu-lijn"><span class="ar-nu-stip" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ar {
  --ar-as: 52px;
  position: relative;
  border: 1px solid var(--border);
  background: var(--wit);
  /* Twaalf uur (07:00 tot 19:00) in beeld; de rest van de dag scrolt binnen het kader. */
  max-height: min(calc(100vh - 230px), calc(12 * var(--ar-uur) + 110px));
  min-height: 360px;
  overflow: hidden auto;
  overscroll-behavior: contain;
}
.ar-kop, .ar-heledag, .ar-body { display: grid; grid-template-columns: var(--ar-as) repeat(var(--ar-kolommen), minmax(0, 1fr)); }
.ar-kop { position: sticky; top: 0; z-index: 6; background: var(--surface); border-bottom: 1px solid var(--border-strong); }
.ar-heledag { position: sticky; top: 45px; z-index: 5; background: var(--wit); border-bottom: 1px solid var(--border-strong); }
.ar--telefoon .ar-heledag { top: 45px; }
.ar-hoek { border-right: 1px solid var(--border); }
.ar-hoek--label { display: flex; align-items: center; justify-content: flex-end; padding: 0 6px; font-size: var(--fs-label); font-weight: 600; line-height: 1.1; text-align: right; color: var(--muted); }
.ar-dagkop { display: flex; align-items: baseline; justify-content: center; gap: 6px; height: 44px; padding: 10px 4px 0; border-left: 1px solid var(--border); min-width: 0; }
.ar-dagnaam { font-size: var(--fs-label); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.ar-dagnr { font-family: var(--font-serif, 'Source Serif 4', Georgia, serif); font-size: 17px; font-weight: 700; }
.ar-dagkop--vandaag { background: var(--ink); }
.ar-dagkop--vandaag .ar-dagnaam, .ar-dagkop--vandaag .ar-dagnr { color: var(--yellow); }
.ar-heledag-cel { display: flex; flex-direction: column; gap: 3px; padding: 4px; border-left: 1px solid var(--border); min-width: 0; min-height: 30px; }
.ar-heledag-cel--vandaag { background: var(--yellow-licht); }
.ar-chip {
  display: block; padding: 2px 6px; font: inherit; font-size: var(--fs-label); font-weight: 600; line-height: 1.5; text-align: left;
  color: var(--ink-soft); border: 1px solid var(--border); border-radius: var(--radius, 2px); overflow: hidden; overflow-wrap: anywhere; text-decoration: none; background: var(--wit); cursor: pointer;
}
.ar-chip:hover { border-color: var(--ink); color: var(--ink); }
/* Afgerond belblok en bezet uit de koppeling: gestreept grijs. */
.ar-chip--belblok, .ar-chip--bezet { color: var(--muted); background: repeating-linear-gradient(-45deg, var(--surface), var(--surface) 6px, var(--border) 6px, var(--border) 7px); }
.ar-chip--bezet { cursor: default; }
.ar-chip--taak { border-left: 3px solid var(--blue); }

.ar-body { position: relative; }
.ar-as { position: relative; border-right: 1px solid var(--border); }
.ar-uur { position: absolute; right: 6px; transform: translateY(-50%); font-size: var(--fs-label); font-weight: 600; color: var(--muted); }
.ar-uur--eerste { transform: translateY(2px); }
.ar-uur--laatste { transform: translateY(-100%); }
.ar-kolom {
  position: relative; border-left: 1px solid var(--border); min-width: 0; cursor: cell;
  background-image: repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px var(--ar-uur));
}
.ar-kolom--weekend { background-color: var(--surface); }
.ar-kolom--vandaag { background-color: var(--yellow-licht); }

.ar-blok {
  position: absolute; z-index: 2; display: flex; flex-direction: column; gap: 1px; overflow: hidden; min-width: 0;
  padding: 3px 6px; border: 1px solid var(--border-strong); border-left: 3px solid var(--ink); border-radius: var(--radius, 2px);
  background: var(--wit); color: var(--ink); font: inherit; text-align: left; text-decoration: none; cursor: pointer;
}
.ar-blok:hover { filter: brightness(.97); }
.ar-blok:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
.ar-tijd { font-size: var(--fs-label); font-weight: 700; color: var(--ink-soft); white-space: nowrap; }
.ar-titel { font-size: 12px; font-weight: 600; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; }
.ar-sub { font-size: var(--fs-label); color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ar-door { font-weight: 600; }
.ar-merk { font-size: var(--fs-label); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--red); }
.ar-blok--krap .ar-titel { white-space: nowrap; }
.ar-blok--kort { flex-direction: row; align-items: center; gap: 5px; padding-top: 0; padding-bottom: 0; }
.ar-blok--kort .ar-titel { white-space: nowrap; }

/* Afspraak in de kleur van de meetingsoort: rand links en een licht vlak. */
.ar-kleur--geel { border-left-color: var(--yellow-dark, #e0bf00); background: color-mix(in srgb, var(--yellow) 22%, var(--wit)); }
.ar-kleur--paars { border-left-color: var(--purple); background: color-mix(in srgb, var(--purple) 10%, var(--wit)); }
.ar-kleur--blauw { border-left-color: var(--blue); background: color-mix(in srgb, var(--blue) 10%, var(--wit)); }
.ar-kleur--groen { border-left-color: var(--green); background: color-mix(in srgb, var(--green) 11%, var(--wit)); }
.ar-kleur--oranje { border-left-color: var(--orange); background: color-mix(in srgb, var(--orange) 12%, var(--wit)); }
.ar-kleur--rood { border-left-color: var(--red); background: color-mix(in srgb, var(--red) 9%, var(--wit)); }
.ar-kleur--grijs { border-left-color: var(--muted); background: var(--surface); }
.ar-blok--klaar { opacity: .6; }
.ar-blok--klaar .ar-titel { text-decoration: line-through; }
.ar-blok--conflict { border-color: var(--red); box-shadow: inset 0 0 0 1px var(--red); }
/* Belblok: geel zoals de planknop op Belblokken. */
.ar-blok--belblok { background: var(--yellow); border-color: var(--yellow-dark, #e0bf00); border-left-color: var(--ink); }
.ar-blok--belblok .ar-tijd { color: var(--ink); }
.ar-blok--taak { background: var(--wit); border-style: dashed; border-left: 3px solid var(--blue); }
.ar-blok--bezet { z-index: 1; cursor: default; color: var(--muted); border-color: var(--border); border-left-color: var(--border); background: repeating-linear-gradient(-45deg, var(--surface), var(--surface) 6px, var(--border) 6px, var(--border) 7px); }
.ar-blok--bezet .ar-titel { font-size: var(--fs-label); white-space: nowrap; }

.ar-nu { position: absolute; left: 0; right: 0; z-index: 4; border-top: 2px solid var(--red); pointer-events: none; }
/* Vierkant blokje: ronde vormen horen niet bij de huisstijl. */
.ar-nu-stip { position: absolute; left: -1px; top: -5px; width: 8px; height: 8px; background: var(--red); }

.ar--telefoon { --ar-as: 46px; max-height: calc(100vh - 220px); }
</style>
