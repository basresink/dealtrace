<script setup lang="ts">
// Editor voor een belscript (F08): flyout van 760 px over de volle hoogte. Eigenschappen,
// opbouw (blokken met volgorde, variabelen, invulwijze, veldkoppeling, terugval), bezwaren en
// rechts een voorbeeld voor een echt account. Opslaan als concept of Activeer (nieuwe versie).
import type { KiesAccount } from '~/utils/kiezers'
import { BLOK_LABEL, BLOK_VOLGORDE, CONTACT_ROLLEN, DOEL_LABEL, SCRIPT_DOELEN, VARIABELEN, valideerScript, vulScript, woordenVan, bezwarenMetConcurrent, type ScriptData } from '~~/shared/belscripts'
import { BAND_LETTERS } from '~~/shared/bandKwalificatie'
const props = defineProps<{ scriptId: string | null; teams?: { id: string; naam: string }[]; kanBezwaren?: boolean }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const s = ref<any>(null)
const kan = ref({ bewerken: false })
const voorbeeld = ref<any>({ accounts: [], waarden: {}, meldingen: [], concurrenten: [] })
const voorbeeldAccount = ref('')
const bezig = ref(false)
const archiveerVraag = ref(false)

watch(() => props.scriptId, async (id) => {
  s.value = null
  if (!id) return
  try {
    const r = await $fetch<any>(`/api/belscripts/${id}`)
    kan.value = r.kan
    s.value = { ...r, data: JSON.parse(JSON.stringify(r.data)) }
  } catch (e) { toast.toon(foutTekst(e), 'fout'); emit('sluit') }
}, { immediate: true })
async function laadVoorbeeld() { voorbeeld.value = await $fetch<any>('/api/belscripts/voorbeeld', { query: { accountId: voorbeeldAccount.value || undefined } }).catch(() => voorbeeld.value); voorbeeldAccount.value ||= voorbeeld.value.accountId ?? '' }
watch(voorbeeldAccount, laadVoorbeeld)
// Voorbeeld voor: de gedeelde zoekkiezer (eigen recente prospects eerst) in plaats van een keuzelijst.
const voorbeeldNaam = ref('')
const voorbeeldWissen = ref(false)
const voorbeeldGekozen = computed<KiesAccount | null>(() => (voorbeeldWissen.value || !voorbeeldAccount.value ? null : { id: voorbeeldAccount.value, naam: voorbeeldNaam.value || (voorbeeld.value.accounts ?? []).find((a: any) => a.id === voorbeeldAccount.value)?.naam || 'Prospect' }))
const zoekVoorbeeld = (q: string) => zoekAccounts(q, 'prospect')
function kiesVoorbeeld(a: { id: string; naam: string }) { voorbeeldNaam.value = a.naam; voorbeeldWissen.value = false; voorbeeldAccount.value = a.id }
onMounted(laadVoorbeeld)

const v = computed(() => (s.value ? valideerScript(s.value, { concurrentIds: voorbeeld.value.concurrenten.map((c: any) => c.id) }) : { fouten: [], waarschuwingen: [], woorden: 0 }))
const ingevuld = computed(() => (s.value ? vulScript(s.value, { waarden: voorbeeld.value.waarden }) : null))
const extra = computed(() => (s.value ? bezwarenMetConcurrent(s.value, { concurrenten: voorbeeld.value.concurrenten, terugkomregels: [], redenmapping: [] } as any, voorbeeld.value.concurrentId).filter((z) => z.argumentRef === voorbeeld.value.concurrentId && voorbeeld.value.concurrentId) : []))
const VARS = Object.keys(VARIABELEN)
const variabeleKeuze = reactive<Record<string, string>>({})
function voegVariabeleToe(b: any) { const x = variabeleKeuze[b.id]; if (x) { b.tekst = `${b.tekst}${b.tekst.endsWith(' ') || !b.tekst ? '' : ' '}{${x}}`; variabeleKeuze[b.id] = '' } }
function verplaats(i: number, d: number) { const l = s.value.data.blokken; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]] }
function nieuwBlok() { s.value.data.blokken.push({ id: `b${Date.now()}`, soort: 'vrij', tekst: '', invulwijze: 'vast', veldKoppeling: null, terugval: null }) }
function nieuwBezwaar() { s.value.data.bezwaren.push({ id: `bz${Date.now()}`, bezwaar: '', antwoord: '', wedervraag: '' }) }
async function haalBezwaren() {
  try {
    const lijst = await $fetch<any[]>('/api/belscripts/bezwaren')
    if (!lijst.length) { toast.toon('Er zijn de laatste 90 dagen nog geen bezwaren vastgelegd.', 'let-op'); return }
    for (const z of lijst) if (!s.value.data.bezwaren.some((x: any) => x.bezwaar === z.bezwaar)) s.value.data.bezwaren.push({ id: `bz${Date.now()}${Math.random()}`, bezwaar: z.bezwaar, antwoord: z.antwoordVoorstel ?? 'geen bron in de waarde', wedervraag: '', argumentRef: z.argumentRef })
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const teamsAlle = computed({ get: () => s.value?.data.teamIds === 'alle', set: (a: boolean) => { s.value.data.teamIds = a ? 'alle' : [] } })
function wisselLijst(veld: 'teamIds' | 'contactRollen', w: string) { const l = s.value.data[veld] as string[]; s.value.data[veld] = l.includes(w) ? l.filter((x) => x !== w) : [...l, w] }
async function bewaar(activeren: boolean) {
  bezig.value = true
  try {
    await $fetch(`/api/belscripts/${s.value.id}`, { method: 'PUT', body: { naam: s.value.naam, doel: s.value.doel, data: s.value.data } })
    if (activeren) { const r = await $fetch<any>(`/api/belscripts/${s.value.id}/activeer`, { method: 'POST' }); toast.toon(`Versie ${r.versie} is actief.`) } else toast.toon('Opgeslagen als concept.')
    emit('gewijzigd'); emit('sluit')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function archiveer() { archiveerVraag.value = false; try { await $fetch(`/api/belscripts/${s.value.id}/archiveer`, { method: 'POST' }); toast.toon('Script gearchiveerd.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function neemOver() { try { await $fetch(`/api/belscripts/${s.value.id}/neem-over`, { method: 'POST' }); toast.toon('Je variant volgt weer het origineel.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const STATUS: Record<string, string> = { concept: 'Concept', actief: 'Actief', gearchiveerd: 'Gearchiveerd' }
</script>

<template>
  <Teleport to="body">
    <FlyoutShell v-if="scriptId" open titel-id="se-titel" breedte="editor" data-test="script-editor" @sluit="emit('sluit')">
      <template #kop>
              <h2 id="se-titel" class="visueel-verborgen">Belscript bewerken</h2>
              <template v-if="s">
              <span class="fo-kicker">Belscript · <span class="pil pil--leeg">{{ STATUS[s.status] }} · versie {{ s.versie }}</span><template v-if="s.controleren"> · <span class="pil pil--geel">Controleren</span></template></span>
              <input v-model="s.naam" class="invoer fo-titel-invoer" aria-label="Naam" :disabled="!kan.bewerken" data-test="script-naam">
              </template>
      </template>
          <div v-if="s" class="fo-body editor-raster">
            <div>
              <p v-if="s.isPersoonlijk && s.origineel && (s.data.basisVersie ?? 0) < s.origineel.versie" class="kaart kaart--geel" data-test="origineel-gewijzigd">Het origineel is gewijzigd (versie {{ s.origineel.versie }}). <button type="button" class="tekst-link" @click="neemOver">Neem over</button></p>
              <article class="fo-blok">
                <header class="fo-blok-kop"><h3 class="fo-blok-titel">Eigenschappen</h3></header>
                <div class="formulier-raster">
                  <label class="veld"><span class="veld-label">Doel</span><select v-model="s.doel" class="invoer" :disabled="!kan.bewerken || s.isPersoonlijk"><option v-for="d in SCRIPT_DOELEN" :key="d" :value="d">{{ DOEL_LABEL[d] }}</option></select></label>
                  <label class="veld"><span class="veld-label">Kanaal</span><select v-model="s.data.kanaal" class="invoer" :disabled="!kan.bewerken || s.isPersoonlijk"><option value="beide">Vast en mobiel</option><option value="vast">Telefoon vast</option><option value="mobiel">Mobiel</option></select></label>
                </div>
                <template v-if="!s.isPersoonlijk">
                  <p class="veld-label mt-8">Teams</p>
                  <div class="rijtje"><label class="vink"><input v-model="teamsAlle" type="checkbox" :disabled="!kan.bewerken"> Alle teams</label><label v-for="t in teams ?? []" v-show="!teamsAlle" :key="t.id" class="vink"><input type="checkbox" :checked="Array.isArray(s.data.teamIds) && s.data.teamIds.includes(t.id)" :disabled="!kan.bewerken" @change="wisselLijst('teamIds', t.id)"> {{ t.naam }}</label></div>
                  <p class="veld-label mt-8">Rol van het contact</p>
                  <div class="rijtje"><label v-for="r in CONTACT_ROLLEN" :key="r" class="vink"><input type="checkbox" :checked="s.data.contactRollen.includes(r)" :disabled="!kan.bewerken" @change="wisselLijst('contactRollen', r)"> {{ r }}</label></div>
                </template>
              </article>
              <article class="fo-blok">
                <header class="fo-blok-kop"><h3 class="fo-blok-titel">Opbouw</h3><span class="meta" :class="{ 'tekst-rood': v.woorden > 200 }" data-test="woorden">{{ v.woorden }} woorden (richtlijn 150)</span></header>
                <div v-for="(b, i) in s.data.blokken" :key="b.id" class="scriptblok editor-blok">
                  <div class="rijtje">
                    <button type="button" class="dd-act" :disabled="!kan.bewerken" aria-label="Omhoog" @click="verplaats(Number(i), -1)">↑</button>
                    <button type="button" class="dd-act" :disabled="!kan.bewerken" aria-label="Omlaag" @click="verplaats(Number(i), 1)">↓</button>
                    <select v-model="b.soort" class="invoer" :disabled="!kan.bewerken" aria-label="Soort blok"><option v-for="x in BLOK_VOLGORDE" :key="x" :value="x">{{ BLOK_LABEL[x] }}</option></select>
                    <select v-model="b.invulwijze" class="invoer" :disabled="!kan.bewerken" aria-label="Invulwijze"><option value="vast">Vast</option><option value="ai_aanvullen">AI vult aan</option><option value="ai_schrijven">AI schrijft</option></select>
                    <button type="button" class="dd-act dd-act--gevaar" :disabled="!kan.bewerken" aria-label="Blok weg" @click="s.data.blokken.splice(Number(i), 1)">Weg</button>
                  </div>
                  <textarea v-model="b.tekst" class="invoer mt-4" rows="3" :disabled="!kan.bewerken" :aria-label="`Tekst ${BLOK_LABEL[b.soort as 'opening']}`" :data-test="`blok-tekst-${Number(i)}`" />
                  <div class="rijtje mt-4">
                    <select class="invoer" :disabled="!kan.bewerken" aria-label="Variabele" :value="''" @change="variabeleKeuze[b.id] = ($event.target as HTMLSelectElement).value; voegVariabeleToe(b); ($event.target as HTMLSelectElement).value = ''"><option value="">{ } Variabele invoegen</option><option v-for="x in VARS" :key="x" :value="x">{{ x }}</option></select>
                    <select v-if="b.soort === 'vragen'" class="invoer" :disabled="!kan.bewerken" aria-label="Veld voor het antwoord" :value="b.veldKoppeling ? `${b.veldKoppeling.bron}.${b.veldKoppeling.sleutel}` : ''" @change="b.veldKoppeling = ($event.target as HTMLSelectElement).value ? { bron: 'band', sleutel: ($event.target as HTMLSelectElement).value.split('.')[1] } : null">
                      <option value="">Geen veld</option><option v-for="l in BAND_LETTERS" :key="l" :value="`band.${l}`">BAND: {{ l }}</option>
                    </select>
                    <input v-if="b.invulwijze !== 'vast'" v-model="b.terugval" class="invoer" placeholder="Terugvalzin zonder AI" :disabled="!kan.bewerken" aria-label="Terugvalzin">
                  </div>
                </div>
                <button v-if="kan.bewerken" type="button" class="dd-act mt-8" @click="nieuwBlok">+ Blok</button>
              </article>
              <article class="fo-blok">
                <header class="fo-blok-kop"><h3 class="fo-blok-titel">Bezwaren</h3></header>
                <div v-for="(z, i) in s.data.bezwaren" :key="z.id" class="scriptblok">
                  <input v-model="z.bezwaar" class="invoer" placeholder="Als de prospect zegt" :disabled="!kan.bewerken" aria-label="Bezwaar">
                  <textarea v-model="z.antwoord" class="invoer mt-4" rows="2" placeholder="Antwoord" :disabled="!kan.bewerken" aria-label="Antwoord" />
                  <div class="rijtje mt-4"><input v-model="z.wedervraag" class="invoer" placeholder="Wedervraag" :disabled="!kan.bewerken" aria-label="Wedervraag"><button v-if="kan.bewerken" type="button" class="dd-act dd-act--gevaar" @click="s.data.bezwaren.splice(Number(i), 1)">Weg</button></div>
                </div>
                <div class="rijtje mt-8"><button v-if="kan.bewerken" type="button" class="dd-act" @click="nieuwBezwaar">+ Bezwaar</button><button v-if="kan.bewerken && kanBezwaren" type="button" class="dd-act" data-test="haal-bezwaren" @click="haalBezwaren">Haal de top 5 bezwaren uit de verslagen</button></div>
              </article>
              <p v-for="f in v.fouten" :key="f" class="kaart kaart--rood mt-8" data-test="script-fout">{{ f }}</p>
              <p v-for="w in v.waarschuwingen" :key="w" class="kaart kaart--geel mt-8">{{ w }}</p>
            </div>
            <div class="editor-voorbeeld" data-test="script-voorbeeld">
              <div class="veld"><ZoekKiezer :zoek="zoekVoorbeeld" kop="Voorbeeld voor" :gekozen="voorbeeldGekozen" wis-label="Kies een andere prospect voor het voorbeeld" placeholder="Zoek een prospect op naam" data-test="voorbeeld-prospect" :sub="accountSub" leeg="Geen prospect gevonden." @kies="kiesVoorbeeld" @wis="voorbeeldWissen = true" /></div>
              <p v-for="m in voorbeeld.meldingen" :key="m" class="meta mt-8">{{ m }}</p>
              <div v-if="ingevuld">
                <div v-for="b in ingevuld.blokken.filter((x) => x.soort !== 'opvolgmail')" :key="b.id" class="scriptblok">
                  <div class="scriptblok-kop"><span class="bloklabel">{{ BLOK_LABEL[b.soort] }}</span><span v-if="b.invulwijze !== 'vast'" class="meta">AI vult hier aan</span></div>
                  <p><template v-for="(seg, j) in b.segmenten" :key="j"><span v-if="seg.onbekend" class="var var--onbekend">{{ seg.tekst || '…' }}</span><template v-else>{{ seg.tekst }}</template></template></p>
                </div>
                <div v-for="z in [...extra, ...ingevuld.bezwaren]" :key="z.id" class="scriptblok"><span class="bloklabel">Bezwaar</span><p>"{{ z.bezwaar }}" {{ z.antwoord }}</p></div>
              </div>
            </div>
          </div>
          <div v-else class="fo-body"><p>Laden…</p></div>
      <template #voet>
          <footer v-if="s" class="fo-foot fs-voet">
            <button v-if="kan.bewerken" type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !!v.fouten.length" data-test="activeer" @click="bewaar(true)"><Icoon naam="Check" :grootte="16" />Activeer</button>
            <span class="fo-foot-vul" />
            <button v-if="kan.bewerken" type="button" class="dd-act" :disabled="bezig || !!v.fouten.length" data-test="opslaan-concept" @click="bewaar(false)">Opslaan als concept</button>
            <button v-if="kan.bewerken && !s.isPersoonlijk && s.status !== 'gearchiveerd'" type="button" class="fs-ibtn fs-ibtn--rood" title="Archiveren" aria-label="Archiveren" @click="archiveerVraag = true"><Icoon naam="Archive" :grootte="18" /></button>
          </footer>
      </template>
    </FlyoutShell>
    <BevestigVenster :open="archiveerVraag" titel="Script archiveren?" tekst="Het script verdwijnt uit de keuze in het belpaneel. Het blijft in de rapportage." bevestig="Archiveren" gevaar @geannuleerd="archiveerVraag = false" @bevestigd="archiveer" />
  </Teleport>
</template>
