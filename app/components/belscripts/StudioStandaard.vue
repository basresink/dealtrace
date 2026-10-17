<script setup lang="ts">
// Belscript Studio, tabblad Standaardscript: eigenschappen, de opbouw in blokken (volgorde, toevoegen,
// verwijderen, invulling Vaste tekst / AI vult aan / AI schrijft met terugvalzin), variabelen invoegen
// op de cursor, een woordenteller met richtlijn, bezwaren met antwoord en rechts een live voorbeeld
// voor een gekozen prospect met onbekende variabelen gemarkeerd. Opslaan als concept houdt de actieve
// versie in gebruik; Activeer maakt een nieuwe versie (opening, afsluiting en voicemail verplicht).
// De salesmanager en de beheerder bewerken; de rest kijkt mee.
import {
  BLOK_LABEL, CONTACT_ROLLEN, DOEL_LABEL, INVULWIJZE_LABEL, SCRIPT_DOELEN, STUDIO_BLOKKEN, VARIABELE_CHIPS, VARIABELEN,
  lengteMelding, nieuwBlok, onbekendVoor, valideerScript, verplaatsBlok, voegBlokToe, voegVariabeleIn, voorbeeldSegmenten, woordenVan,
  type BlokSoortScript, type Invulwijze,
} from '~~/shared/belscripts'
import { BAND_LETTERS } from '~~/shared/bandKwalificatie'

const props = defineProps<{ scriptId: string | null; lijst: any }>()
const emit = defineEmits<{ kies: [id: string]; ververs: [] }>()
const toast = useToast()
const STATUS: Record<string, string> = { concept: 'Concept', actief: 'Actief', gearchiveerd: 'Gearchiveerd' }

const teamScripts = computed(() => (props.lijst?.scripts ?? []).filter((s: any) => s.status !== 'gearchiveerd'))
const beheer = computed(() => !!props.lijst?.kan?.beheer)
const gekozenId = computed(() => props.scriptId ?? teamScripts.value.find((s: any) => s.status === 'actief' && s.doel === 'koud')?.id ?? teamScripts.value[0]?.id ?? null)

const s = ref<any>(null)
const origineel = ref('')
const kanBewerken = ref(false)
const laadFout = ref('')
watch(gekozenId, async (id) => {
  s.value = null; laadFout.value = ''
  if (!id) return
  try {
    const r = await $fetch<any>(`/api/belscripts/${id}`)
    kanBewerken.value = !!r.kan?.bewerken
    s.value = { ...r, data: JSON.parse(JSON.stringify(r.data)) }
    origineel.value = JSON.stringify({ naam: r.naam, doel: r.doel, data: r.data })
    open.value = new Set(r.data.blokken.slice(0, 3).map((b: any) => b.id))
  } catch (e) { laadFout.value = foutTekst(e) }
}, { immediate: true })
const gewijzigd = computed(() => !!s.value && JSON.stringify({ naam: s.value.naam, doel: s.value.doel, data: s.value.data }) !== origineel.value)

// Voorbeeld voor een prospect (zelfde variabelen als in de belmodus).
const voorbeeld = ref<any>({ accounts: [], waarden: {}, meldingen: [], concurrenten: [] })
const voorbeeldAccount = ref('')
async function laadVoorbeeld() {
  voorbeeld.value = await $fetch<any>('/api/belscripts/voorbeeld', { query: { accountId: voorbeeldAccount.value || undefined } }).catch(() => voorbeeld.value)
  voorbeeldAccount.value ||= voorbeeld.value.accountId ?? ''
}
watch(voorbeeldAccount, laadVoorbeeld)
onMounted(laadVoorbeeld)
const toonCodes = ref(false)
const accountNaam = computed(() => voorbeeld.value.accounts.find((a: any) => a.id === voorbeeldAccount.value)?.naam ?? 'dit prospect')
const onbekend = computed(() => (s.value ? onbekendVoor(s.value.data, voorbeeld.value.waarden) : []))

// Validatie en lengte.
const concurrentIds = computed(() => voorbeeld.value.concurrenten.map((c: any) => c.id))
const v = computed(() => (s.value ? valideerScript(s.value, { concurrentIds: concurrentIds.value }) : { fouten: [], waarschuwingen: [], woorden: 0, controleren: false }))
const lengte = computed(() => lengteMelding(s.value ? woordenVan(s.value.data) : 0))
const activeerFout = ref('')

// Blokken.
const open = ref<Set<string>>(new Set())
function wisselOpen(id: string) { const n = new Set(open.value); n.has(id) ? n.delete(id) : n.add(id); open.value = n }
function verplaats(i: number, d: -1 | 1) { s.value.data.blokken = verplaatsBlok(s.value.data.blokken, i, d) }
function weg(i: number) { const [b] = s.value.data.blokken.splice(i, 1); toast.toon(`Blok ${BLOK_LABEL[b.soort as BlokSoortScript]} verwijderd.`) }
const nieuwSoort = ref<BlokSoortScript>('toestemming')
function voegToe() {
  const b = nieuwBlok(nieuwSoort.value, `b${Date.now().toString(36)}`)
  s.value.data.blokken = voegBlokToe(s.value.data.blokken, b)
  open.value = new Set([...open.value, b.id])
  toast.toon(`Blok ${BLOK_LABEL[nieuwSoort.value]} toegevoegd voor de afsluiting.`)
}
function zetWijze(b: any, w: Invulwijze) { b.invulwijze = w; if (w !== 'vast' && !b.terugval) b.terugval = '' }

// Variabele invoegen op de cursor van het laatst gekozen tekstveld.
let laatste: { el: HTMLTextAreaElement; blok: any } | null = null
function opFocus(e: FocusEvent, blok: any) { laatste = { el: e.target as HTMLTextAreaElement, blok } }
function voegIn(variabele: string) {
  if (!s.value || !kanBewerken.value) return
  const doel = laatste && document.body.contains(laatste.el) ? laatste : null
  const blok = doel?.blok ?? s.value.data.blokken.find((b: any) => open.value.has(b.id)) ?? s.value.data.blokken[0]
  if (!blok) return
  const el = doel?.el
  const r = voegVariabeleIn(blok.tekst, variabele, el?.selectionStart ?? blok.tekst.length, el?.selectionEnd ?? blok.tekst.length)
  blok.tekst = r.tekst
  open.value = new Set([...open.value, blok.id])
  nextTick(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = r.cursor } })
}
const alleVariabelen = ref(false)
const sluitMetEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') alleVariabelen.value = false }
watch(alleVariabelen, (o) => { if (import.meta.client) (o ? window.addEventListener : window.removeEventListener)('keydown', sluitMetEsc) })
onBeforeUnmount(() => { if (import.meta.client) window.removeEventListener('keydown', sluitMetEsc) })

// Bezwaren.
const concurrentNaam = (ref?: string | null) => (ref ? voorbeeld.value.concurrenten.find((c: any) => c.id === ref)?.naam ?? 'het verkoopverhaal' : null)
function nieuwBezwaar() { s.value.data.bezwaren.push({ id: `bz${Date.now().toString(36)}`, bezwaar: '', antwoord: '', wedervraag: '' }) }
async function haalBezwaren() {
  try {
    const lijst = await $fetch<any[]>('/api/belscripts/bezwaren')
    if (!lijst.length) { toast.toon('Er zijn de laatste 90 dagen nog geen bezwaren vastgelegd.', 'let-op'); return }
    for (const z of lijst) if (!s.value.data.bezwaren.some((x: any) => x.bezwaar === z.bezwaar)) s.value.data.bezwaren.push({ id: `bz${Date.now().toString(36)}${s.value.data.bezwaren.length}`, bezwaar: z.bezwaar, antwoord: z.antwoordVoorstel ?? '', wedervraag: '', argumentRef: z.argumentRef })
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Bewaren.
const bezig = ref(false)
async function bewaar(activeren: boolean) {
  activeerFout.value = ''
  if (activeren) {
    const f = valideerScript(s.value, { activeren: true, concurrentIds: concurrentIds.value }).fouten
    if (f.length) { activeerFout.value = f.join('. ') + '.'; return }
  }
  bezig.value = true
  try {
    await $fetch(`/api/belscripts/${s.value.id}`, { method: 'PUT', body: { naam: s.value.naam, doel: s.value.doel, data: s.value.data } })
    if (activeren) {
      const r = await $fetch<any>(`/api/belscripts/${s.value.id}/activeer`, { method: 'POST' })
      s.value.status = 'actief'; s.value.versie = r.versie
      toast.toon(`Versie ${r.versie} is actief. Lopende belblokken houden hun versie.`)
    } else toast.toon(s.value.status === 'actief' ? `Concept opgeslagen. Het actieve script versie ${s.value.versie} blijft in gebruik.` : 'Concept opgeslagen.')
    origineel.value = JSON.stringify({ naam: s.value.naam, doel: s.value.doel, data: s.value.data })
    emit('ververs')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const rol = computed({ get: () => s.value?.data.contactRollen?.[0] ?? '', set: (r: string) => { s.value.data.contactRollen = r ? [r] : [] } })
const teamNaam = computed(() => {
  const ids = s.value?.data.teamIds
  if (!ids || ids === 'alle') return 'alle teams'
  return (ids as string[]).map((i) => props.lijst?.teams?.find((t: any) => t.id === i)?.naam ?? i).join(', ') || 'geen team'
})
const ROL_LABEL: Record<string, string> = { beslisser: 'Beslisser', beinvloeder: 'Beïnvloeder', gebruiker: 'Gebruiker', receptie: 'Receptie', onbekend: 'Onbekend' }
const kortVan = (t: string) => (t.length > 90 ? `${t.slice(0, 90)}…` : t)
const code = (v: string) => '{' + v + '}'
</script>

<template>
  <div class="ss">
    <LegeStaat v-if="!teamScripts.length" titel="Er is nog geen standaardscript." tekst="Kies een template als startpunt in het tabblad Templates." />
    <p v-else-if="laadFout" class="kaart kaart--rood">{{ laadFout }}</p>
    <div v-else-if="s" class="ss-raster">
      <div class="ss-links">
        <p v-if="!kanBewerken" class="kaart kaart--geel" data-test="studio-meekijken">Je kijkt mee. Je salesmanager beheert het standaardscript; jij maakt een versie per prospect in het tabblad Per prospect.</p>
        <article class="kaart">
          <div class="kaart-kop">
            <h2 class="kaart-titel">Eigenschappen</h2>
            <span class="pil" :class="s.status === 'actief' && !gewijzigd ? 'pil--groen' : 'pil--leeg'" data-test="studio-status">{{ STATUS[s.status] }} · versie {{ s.versie }}{{ gewijzigd ? ' · niet opgeslagen' : '' }}</span>
          </div>
          <div class="ss-eig">
            <label class="veld"><span class="veld-label">Script</span>
              <select class="invoer" :value="s.id" data-test="studio-script" @change="emit('kies', ($event.target as HTMLSelectElement).value)">
                <option v-for="x in teamScripts" :key="x.id" :value="x.id">{{ x.naam }} ({{ (STATUS[x.status] ?? x.status).toLowerCase() }})</option>
              </select>
            </label>
            <label class="veld"><span class="veld-label">Naam</span><input v-model="s.naam" class="invoer" :disabled="!kanBewerken" data-test="studio-naam"></label>
            <label class="veld"><span class="veld-label">Doel</span><select v-model="s.doel" class="invoer" :disabled="!kanBewerken"><option v-for="d in SCRIPT_DOELEN" :key="d" :value="d">{{ DOEL_LABEL[d] }}</option></select></label>
            <label class="veld"><span class="veld-label">Rol contact</span><select v-model="rol" class="invoer" :disabled="!kanBewerken"><option value="">Alle rollen</option><option v-for="r in CONTACT_ROLLEN" :key="r" :value="r">{{ ROL_LABEL[r] }}</option></select></label>
          </div>
          <p class="meta mt-8">{{ s.data.template ? 'Gestart vanuit een template. ' : '' }}Geldt voor {{ teamNaam }}.<template v-if="s.status === 'actief'"> Wie belt, gebruikt versie {{ s.versie }} tot je een nieuwe versie activeert.</template></p>
        </article>

        <article class="kaart mt-16">
          <div class="kaart-kop"><h2 class="kaart-titel">Opbouw in blokken</h2><span class="meta tnum" data-test="studio-woorden">{{ lengte.tekst }}</span></div>
          <div class="ss-meter" :class="`ss-meter--${lengte.stand}`" aria-hidden="true"><i :style="{ width: `${lengte.procent}%` }" /></div>
          <p class="meta mt-8">Paarse blokken vult de AI per prospect aan; zonder AI geldt de terugvalzin.</p>
          <div v-if="kanBewerken" class="ss-varbalk mt-12" aria-label="Variabelen invoegen">
            <div class="rijtje ss-varbalk-kop"><span class="veld-label">Variabele invoegen op de cursor</span><button type="button" class="dd-act" data-test="alle-variabelen" @click="alleVariabelen = true">{ } Alle variabelen</button></div>
            <div v-for="g in VARIABELE_CHIPS" :key="g.groep" class="ss-vargroep">
              <span class="veld-label">{{ g.groep }}</span>
              <button v-for="x in g.variabelen" :key="x" type="button" class="ss-chip" :data-test="`var-${x}`" @mousedown.prevent @click="voegIn(x)"><code>{{ code(x) }}</code></button>
            </div>
          </div>
          <div class="mt-12" data-test="studio-blokken">
            <div v-for="(b, i) in s.data.blokken" :key="b.id" class="ss-blok" :class="{ 'ss-blok--ai': b.invulwijze !== 'vast' }" :data-test="`studio-blok-${i}`">
              <div class="ss-blok-kop">
                <button type="button" class="ss-mini" :aria-expanded="open.has(b.id)" :aria-label="`${open.has(b.id) ? 'Inklappen' : 'Uitklappen'}: ${BLOK_LABEL[b.soort as BlokSoortScript]}`" @click="wisselOpen(b.id)"><Icoon :naam="open.has(b.id) ? 'ChevronUp' : 'ChevronDown'" :grootte="16" /></button>
                <span class="ss-blok-naam">{{ Number(i) + 1 }}. {{ b.titel || BLOK_LABEL[b.soort as BlokSoortScript] }}</span>
                <span class="pil" :class="b.invulwijze === 'vast' ? 'pil--leeg' : 'pil--paars'">{{ INVULWIJZE_LABEL[b.invulwijze as Invulwijze] }}</span>
                <span v-if="!open.has(b.id)" class="meta ss-blok-kort">{{ kortVan(b.tekst) }}</span>
                <span v-if="kanBewerken" class="ss-blok-acties">
                  <button type="button" class="ss-mini" aria-label="Omhoog" :disabled="i === 0" :data-test="`blok-op-${i}`" @click="verplaats(Number(i), -1)"><Icoon naam="ChevronUp" :grootte="16" /></button>
                  <button type="button" class="ss-mini" aria-label="Omlaag" :disabled="i === s.data.blokken.length - 1" :data-test="`blok-neer-${i}`" @click="verplaats(Number(i), 1)"><Icoon naam="ChevronDown" :grootte="16" /></button>
                  <button type="button" class="ss-mini" aria-label="Blok verwijderen" :data-test="`blok-weg-${i}`" @click="weg(Number(i))"><Icoon naam="Trash2" :grootte="16" /></button>
                </span>
              </div>
              <div v-if="open.has(b.id)" class="ss-blok-body">
                <textarea v-model="b.tekst" class="invoer" rows="3" :disabled="!kanBewerken" :aria-label="`Tekst van ${BLOK_LABEL[b.soort as BlokSoortScript]}`" :data-test="`studio-tekst-${i}`" @focus="opFocus($event, b)" />
                <div class="ss-blok-velden">
                  <label class="veld"><span class="veld-label">Invulling</span>
                    <select class="invoer" :value="b.invulwijze" :disabled="!kanBewerken" :data-test="`studio-wijze-${i}`" @change="zetWijze(b, ($event.target as HTMLSelectElement).value as Invulwijze)">
                      <option v-for="(l, k) in INVULWIJZE_LABEL" :key="k" :value="k">{{ l }}</option>
                    </select>
                  </label>
                  <label v-if="b.soort === 'vragen'" class="veld"><span class="veld-label">Antwoord naar veld</span>
                    <select class="invoer" :disabled="!kanBewerken" :value="b.veldKoppeling ? b.veldKoppeling.sleutel : ''" @change="b.veldKoppeling = ($event.target as HTMLSelectElement).value ? { bron: 'band', sleutel: ($event.target as HTMLSelectElement).value } : null">
                      <option value="">Geen veld</option><option v-for="l in BAND_LETTERS" :key="l" :value="l">BAND: {{ l }}</option>
                    </select>
                  </label>
                  <label v-if="b.invulwijze !== 'vast'" class="veld ss-terugval"><span class="veld-label">Terugvalzin zonder AI</span><input v-model="b.terugval" class="invoer" :disabled="!kanBewerken" placeholder="Wat de accountmanager zegt als de AI niets levert" :data-test="`studio-terugval-${i}`"></label>
                </div>
              </div>
            </div>
          </div>
          <div v-if="kanBewerken" class="rijtje mt-12 ss-toevoegen">
            <label class="veld"><span class="veld-label">Blok toevoegen</span>
              <select v-model="nieuwSoort" class="invoer" data-test="nieuw-blok-soort"><option v-for="x in STUDIO_BLOKKEN" :key="x" :value="x">{{ BLOK_LABEL[x] }}</option></select>
            </label>
            <button type="button" class="dd-act" data-test="nieuw-blok" @click="voegToe"><Icoon naam="Plus" :grootte="14" />Blok</button>
          </div>
        </article>

        <article class="kaart mt-16">
          <div class="kaart-kop"><h2 class="kaart-titel">Bezwaren</h2><span class="meta">uit het verkoopverhaal en eigen</span></div>
          <p class="meta">Tijdens het bellen klapt de accountmanager een bezwaar open voor het antwoord. Een bezwaar met een koppeling volgt het verkoopverhaal.</p>
          <div v-for="(z, i) in s.data.bezwaren" :key="z.id" class="ss-bezwaar" :data-test="`studio-bezwaar-${i}`">
            <label class="veld"><span class="veld-label">Als de prospect zegt</span><input v-model="z.bezwaar" class="invoer" :disabled="!kanBewerken"></label>
            <label class="veld"><span class="veld-label">Antwoord</span><textarea v-model="z.antwoord" class="invoer" rows="2" :disabled="!kanBewerken" /></label>
            <label class="veld"><span class="veld-label">Wedervraag</span><input v-model="z.wedervraag" class="invoer" :disabled="!kanBewerken"></label>
            <div class="rijtje">
              <span v-if="z.argumentRef" class="meta"><Icoon naam="BookOpen" :grootte="14" /> Gekoppeld aan {{ concurrentNaam(z.argumentRef) }}</span>
              <button v-if="kanBewerken" type="button" class="dd-act dd-act--gevaar ss-rechts" :aria-label="`Bezwaar ${Number(i) + 1} verwijderen`" @click="s.data.bezwaren.splice(Number(i), 1)"><Icoon naam="Trash2" :grootte="14" />Verwijder</button>
            </div>
          </div>
          <p v-if="!s.data.bezwaren.length" class="meta mt-8">Nog geen bezwaren in dit script. Voeg er een toe of haal ze uit de gesprekken.</p>
          <div v-if="kanBewerken" class="rijtje mt-12">
            <button type="button" class="dd-act" data-test="studio-bezwaar-plus" @click="nieuwBezwaar"><Icoon naam="Plus" :grootte="14" />Bezwaar</button>
            <button v-if="lijst?.kan?.vergelijken || beheer" type="button" class="dd-act" @click="haalBezwaren">Haal de top 5 uit de gesprekken</button>
          </div>
        </article>

        <p v-for="f in v.fouten" :key="f" class="kaart kaart--rood mt-16" data-test="studio-fout">{{ f }}</p>
        <p v-for="w in v.waarschuwingen" :key="w" class="kaart kaart--geel mt-16">{{ w }}</p>
        <div v-if="kanBewerken" class="rijtje mt-16 ss-bewaar">
          <button type="button" class="dd-actie dd-actie--secundair" :disabled="bezig || !!v.fouten.length" data-test="studio-concept" @click="bewaar(false)"><Icoon naam="Save" class="dd-actie-icoon" />Opslaan als concept</button>
          <button type="button" class="dd-actie dd-actie--zwart" :disabled="bezig || !!v.fouten.length" data-test="studio-activeer" @click="bewaar(true)">Activeer versie {{ s.versie + 1 }}</button>
          <span v-if="activeerFout" class="ss-validatie" role="alert" data-test="studio-validatie">{{ activeerFout }}</span>
        </div>
      </div>

      <aside class="ss-rechts-kolom" aria-label="Voorbeeld">
        <div class="ss-voorbeeld" :class="{ 'toon-codes': toonCodes }" data-test="studio-voorbeeld">
          <div class="ss-voorbeeld-kop">
            <label class="veld"><span class="veld-label">Voorbeeld voor</span>
              <select v-model="voorbeeldAccount" class="invoer" data-test="voorbeeld-prospect"><option v-for="a in voorbeeld.accounts" :key="a.id" :value="a.id">{{ a.naam }}</option></select>
            </label>
            <button type="button" class="dd-act" :aria-pressed="toonCodes" @click="toonCodes = !toonCodes">{ } {{ toonCodes ? 'Toon tekst' : 'Toon variabelen' }}</button>
          </div>
          <p v-if="onbekend.length" class="ss-onbekend" data-test="voorbeeld-onbekend"><Icoon naam="TriangleAlert" :grootte="14" /> {{ onbekend.length === 1 ? 'Eén variabele is' : `${onbekend.length} variabelen zijn` }} onbekend voor {{ accountNaam }}: <code v-for="x in onbekend" :key="x">{{ code(x) }} </code>. De accountmanager ziet de terugvalzin.</p>
          <p v-for="m in voorbeeld.meldingen" :key="m" class="meta mt-8">{{ m }}</p>
          <div v-for="b in s.data.blokken.filter((x: any) => x.soort !== 'opvolgmail')" :key="b.id" class="ss-vb-blok">
            <div class="ss-vb-label"><span class="bloklabel">{{ b.titel || BLOK_LABEL[b.soort as BlokSoortScript] }}</span><span class="meta">{{ b.invulwijze === 'vast' ? 'vaste tekst' : 'AI vult hier aan per prospect' }}</span></div>
            <p :class="{ 'ss-vb-ai': b.invulwijze !== 'vast' }">
              <template v-for="(seg, j) in voorbeeldSegmenten(b.tekst, voorbeeld.waarden)" :key="j">
                <span v-if="seg.variabele" class="var" :class="{ 'var--onbekend': seg.onbekend }" :data-test="seg.onbekend ? 'vb-onbekend' : 'vb-var'"><span class="var-tekst">{{ seg.tekst || '…' }}</span><span class="var-code">{{ code(seg.variabele) }}</span></span>
                <template v-else>{{ seg.tekst }}</template>
              </template>
            </p>
          </div>
          <div v-if="s.data.bezwaren.length" class="ss-vb-blok">
            <div class="ss-vb-label"><span class="bloklabel">Bezwaren</span><span class="meta">{{ s.data.bezwaren.length }} klaar om open te klappen</span></div>
            <div class="rijtje"><span v-for="z in s.data.bezwaren" :key="z.id" class="pil pil--leeg">"{{ z.bezwaar }}"</span></div>
          </div>
        </div>
        <p class="meta mt-8"><span class="var">geel</span> ingevuld uit Dealtrace · <span class="var var--onbekend">onbekend</span> terugvalzin · <span class="ss-vb-ai">paars</span> vult de AI per prospect aan</p>
      </aside>
    </div>
    <p v-else class="meta">Laden…</p>

    <Teleport to="body">
      <div v-if="alleVariabelen" class="fo-overlay" @click.self="alleVariabelen = false">
        <aside class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-labelledby="ss-var-titel" data-test="variabelen-flyout">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Hulp</span><h2 id="ss-var-titel" class="fo-titel">Variabelen</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="alleVariabelen = false"><Icoon naam="X" /></button></header>
          <div class="fo-body">
            <p class="fo-tekst">Een variabele tussen accolades wordt bij het bellen vervangen door het gegeven uit Dealtrace. Is het onbekend, dan hoort de prospect de terugvalzin. Klik om in te voegen.</p>
            <div class="tabel-schuif mt-12">
              <table class="tabel">
                <thead><tr><th>Variabele</th><th>Terugvalzin</th></tr></thead>
                <tbody><tr v-for="(x, k) in VARIABELEN" :key="k"><td><button v-if="kanBewerken" type="button" class="ss-chip" @click="voegIn(String(k)); alleVariabelen = false"><code>{{ code(k) }}</code></button><code v-else>{{ code(k) }}</code></td><td>{{ x.terugval || 'weggelaten' }}</td></tr></tbody>
              </table>
            </div>
          </div>
          <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="alleVariabelen = false">Sluiten</button></footer>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ss-raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
@media (min-width: 1100px) { .ss-raster { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); } .ss-rechts-kolom { position: sticky; top: 16px; } }
.ss-eig { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.ss-meter { height: 6px; background: var(--surface); margin-top: 4px; }
.ss-meter i { display: block; height: 100%; background: var(--green); }
.ss-meter--lang i { background: var(--orange); }
.ss-meter--te_lang i { background: var(--red); }
.ss-varbalk { padding: 12px; background: var(--surface); border: 1px solid var(--border); }
.ss-varbalk-kop { justify-content: space-between; }
.ss-vargroep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.ss-vargroep .veld-label { min-width: 72px; }
.ss-chip { display: inline-flex; align-items: center; min-height: 36px; padding: 4px 8px; background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); font: inherit; font-size: var(--fs-meta); cursor: pointer; color: var(--ink); }
.ss-chip:hover { border-color: var(--ink); }
.ss-chip code { font-family: var(--font-mono); }
.ss-blok { border: 1px solid var(--border); border-left: 3px solid var(--border-strong); background: var(--wit); margin-top: 8px; }
.ss-blok--ai { border-left-color: var(--purple); }
.ss-blok-kop { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; padding: 4px 8px; }
.ss-blok-naam { font-weight: 700; font-size: var(--fs-body); white-space: nowrap; }
@media (max-width: 719px) { .ss-blok-kop { flex-wrap: wrap; } .ss-blok-kort { display: none; } }
.ss-blok-kort { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-blok-acties { display: inline-flex; gap: 2px; margin-left: auto; }
.ss-mini { display: inline-grid; place-items: center; width: 36px; height: 36px; background: transparent; border: 1px solid transparent; border-radius: var(--radius); color: var(--ink); cursor: pointer; }
.ss-mini:hover:not(:disabled) { border-color: var(--border-strong); }
.ss-mini:disabled { color: var(--muted-light); cursor: not-allowed; }
.ss-mini:focus-visible { outline: 2px solid var(--ink); }
.ss-blok-body { padding: 0 12px 12px; }
.ss-blok-velden { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-top: 8px; }
.ss-terugval { grid-column: 1 / -1; }
.ss-toevoegen { align-items: flex-end; }
.ss-toevoegen .veld { flex: 1 1 200px; }
.ss-bezwaar { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.ss-rechts { margin-left: auto; }
.ss-bewaar { align-items: center; }
.ss-validatie { color: var(--red); font-weight: 600; font-size: var(--fs-klein); }
.ss-voorbeeld { background: var(--wit); border: 1px solid var(--border); padding: 16px; }
.ss-voorbeeld-kop { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.ss-voorbeeld-kop .veld { flex: 1 1 200px; }
.ss-onbekend { margin-top: 12px; padding: 10px 12px; background: var(--orange-zacht); font-size: var(--fs-klein); }
.ss-onbekend code { font-family: var(--font-mono); }
.ss-vb-blok { padding: 12px 0; border-bottom: 1px solid var(--border); }
.ss-vb-blok:last-child { border-bottom: 0; }
.ss-vb-label { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.ss-vb-blok p { margin: 0; font-size: var(--fs-body); line-height: 1.6; }
.ss-vb-ai { background: var(--purple-zacht); padding: 0 3px; }
@media (max-width: 719px) {
  .ss-mini { width: 44px; height: 44px; }
  .ss-chip { min-height: 44px; }
}
</style>
