<script setup lang="ts">
// Belscript Studio, tabblad Per prospect: kies een prospect uit je belblok of met de zoekkiezer, zie
// welke gegevens de AI krijgt (met bron) en wat ontbreekt, en laat de AI de AI-blokken van het
// standaardscript vullen (AI-schil, credits). Elk AI-blok bevestig je, pas je aan of verwerp je (dan
// de terugvalzin), met "Gebaseerd op"-chips. Pas als alles beoordeeld is bewaar je een versie bij het
// prospect; de versiegeschiedenis staat eronder. Niets gaat zonder jouw besluit in het script.
import { AI_HERKOMST, BLOK_LABEL, teBeoordelen, voorbeeldSegmenten, type BlokSoortScript, type ProspectBlok, type ProspectGegeven } from '~~/shared/belscripts'

const props = defineProps<{ accountId: string | null; keuze: { prospecten: any[]; bron: string } }>()
const emit = defineEmits<{ kies: [id: string]; belmodus: [id: string] }>()
const toast = useToast()

const p = ref<any>(null)
const laadt = ref(false)
const fase = ref<'start' | 'laden' | 'beoordelen' | 'versie'>('start')
const concept = ref<{ conceptId: string } | null>(null)
const blokken = ref<(ProspectBlok & { bewerkt?: boolean })[]>([])
const versieOpen = ref<any>(null)
const gezocht = ref<{ id: string; naam: string; plaats?: string | null } | null>(null)

async function laad(id: string | null) {
  p.value = null; fase.value = 'start'; concept.value = null; blokken.value = []; versieOpen.value = null
  if (!id) return
  laadt.value = true
  try { p.value = await $fetch<any>('/api/belscripts/prospect', { query: { accountId: id } }) } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { laadt.value = false }
}
watch(() => props.accountId, laad, { immediate: true })
const lijst = computed(() => {
  const l = [...props.keuze.prospecten]
  if (props.accountId && !l.some((x) => x.accountId === props.accountId) && p.value?.account) l.unshift({ accountId: p.value.account.id, accountNaam: p.value.account.naam, plaats: gezocht.value?.plaats ?? null, versies: p.value.versies.length, gezocht: true })
  return l
})
function kiesGezocht(a: { id: string; naam: string; plaats?: string | null }) { gezocht.value = a; emit('kies', a.id) }

const stap = computed(() => (fase.value === 'start' ? 1 : fase.value === 'laden' ? 2 : 3))
const versieKlaar = ref(false)
const kaart = computed(() => p.value?.item?.kaart ?? null)

async function vul() {
  if (!p.value) return
  fase.value = 'laden'; versieKlaar.value = false
  try {
    const r = await $fetch<any>('/api/belscripts/prospect/vul', { method: 'POST', body: { accountId: p.value.account.id, contactId: p.value.contactId, scriptId: p.value.script?.id } })
    concept.value = { conceptId: r.conceptId }
    blokken.value = r.data.blokken.map((b: ProspectBlok) => ({ ...b }))
    fase.value = 'beoordelen'
  } catch (e) { fase.value = 'start'; toast.toon(foutTekst(e), 'fout') }
}
const open = computed(() => teBeoordelen(blokken.value))
const aiTotaal = computed(() => blokken.value.filter((b) => b.voorstel).length)
function bevestig(b: ProspectBlok & { bewerkt?: boolean }) { b.status = b.tekst.trim() !== (b.voorstel ?? '').trim() ? 'bewerkt' : 'bevestigd' }
function verwerp(b: ProspectBlok) { b.status = 'verworpen' }
function herstel(b: ProspectBlok) { b.status = 'voorgesteld'; b.tekst = b.voorstel ?? b.tekst }
function opInvoer(b: ProspectBlok & { bewerkt?: boolean }) { b.bewerkt = true; if (b.status === 'bevestigd') b.status = 'bewerkt'; if (b.status === 'bewerkt' && b.tekst.trim() === (b.voorstel ?? '').trim()) b.status = 'bevestigd' }
const bezig = ref(false)
async function bewaar() {
  if (!concept.value || open.value) return
  bezig.value = true
  try {
    const body = { blokken: blokken.value.filter((b) => b.voorstel).map((b) => ({ id: b.id, status: b.status === 'verworpen' ? 'verworpen' : 'bevestigd', tekst: b.status === 'verworpen' ? null : b.tekst })) }
    const r = await $fetch<any>(`/api/belscripts/prospect/${concept.value.conceptId}/bewaar`, { method: 'POST', body })
    toast.toon(`Versie ${r.versie} bewaard voor ${p.value.account.naam}. Het standaardscript blijft ongewijzigd.`)
    const naam = p.value.account.id
    await laad(naam)
    versieKlaar.value = true
    versieOpen.value = p.value?.versies.find((v: any) => v.id === r.id) ?? null
    fase.value = versieOpen.value ? 'versie' : 'start'
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
function bekijkVersie(v: any) { versieOpen.value = v; fase.value = 'versie' }

// Flyouts: bron van een gegeven en "Waarom dit script".
const bron = ref<ProspectGegeven | null>(null)
const waarom = ref(false)
function toonBron(sleutel: string) { bron.value = p.value?.gegevens.find((g: ProspectGegeven) => g.sleutel === sleutel) ?? null }
const gebruiktIn = (sleutel: string) => Object.entries(AI_HERKOMST).filter(([, l]) => (l ?? []).includes(sleutel as any)).map(([s]) => BLOK_LABEL[s as BlokSoortScript]).join(', ')
const sluitMetEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { bron.value = null; waarom.value = false } }
onMounted(() => window.addEventListener('keydown', sluitMetEsc))
onBeforeUnmount(() => window.removeEventListener('keydown', sluitMetEsc))

const STATUS: Record<string, { label: string; klas: string }> = {
  bevestigd: { label: 'Bevestigd', klas: 'pil--groen' }, bewerkt: { label: 'Aangepast', klas: 'pil--groen' }, verworpen: { label: 'Terugvalzin', klas: 'pil--oranje' },
  geen_voorstel: { label: 'Geen voorstel, terugvalzin', klas: 'pil--leeg' },
}
const datum = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)) : '')
const zoek = (q: string) => zoekAccounts(q)
const rolTekst = (k: any) => [k.contactNaam, k.contactRol].filter(Boolean).join(' · ')
</script>

<template>
  <div class="sp-raster">
    <div class="sp-kies">
      <div class="kaart-kop"><h2 class="kaart-titel">Kies een prospect</h2><span class="meta">{{ keuze.bron === 'belblok' ? 'uit je belblok van vandaag' : 'uit je bellijst' }}</span></div>
      <ZoekKiezer :zoek="zoek" kop="Prospect" placeholder="Zoek een prospect op naam" data-test="sp-zoek" :optie-test="(t) => `sp-kies-${t.id}`" :sub="accountSub" leeg="Geen prospect gevonden." @kies="kiesGezocht" />
      <div class="sp-lijst mt-12" data-test="sp-prospecten">
        <button v-for="k in lijst" :key="k.accountId" type="button" class="sp-prospect" :aria-pressed="k.accountId === accountId" :data-test="`sp-prospect-${k.accountId}`" @click="emit('kies', k.accountId)">
          <Icoon naam="Building2" :grootte="18" />
          <span class="sp-prospect-tekst">
            <strong>{{ k.accountNaam }}</strong>
            <span v-if="rolTekst(k)" class="meta">{{ rolTekst(k) }}</span>
            <span class="meta">{{ k.plaats ?? '' }}</span>
            <span class="rijtje"><span v-if="k.gezocht" class="pil pil--leeg">Gezocht</span><span v-if="k.versies" class="pil pil--leeg">{{ k.versies }} {{ k.versies === 1 ? 'versie' : 'versies' }}</span></span>
          </span>
        </button>
        <p v-if="!lijst.length" class="meta">Er staat vandaag niemand in je belblok. Zoek een prospect op naam.</p>
      </div>
    </div>

    <div class="sp-werk">
      <ol class="stappen" aria-label="Voortgang">
        <li :class="{ 'stap--actief': stap === 1, 'stap--klaar': stap > 1 }"><span class="stap-nr">1</span>Prospect gekozen</li>
        <li :class="{ 'stap--actief': stap === 2, 'stap--klaar': stap > 2 }"><span class="stap-nr">2</span>AI vult het script</li>
        <li :class="{ 'stap--actief': stap === 3 && !versieKlaar, 'stap--klaar': versieKlaar }"><span class="stap-nr">3</span>Jij past aan en bewaart</li>
      </ol>
      <LegeStaat v-if="!accountId" class="mt-16" titel="Kies een prospect." tekst="Links staan de prospects uit je belblok van vandaag; met het zoekveld vind je elk ander prospect." />
      <p v-else-if="laadt || !p" class="meta mt-16">Laden…</p>
      <article v-else class="kaart mt-16" data-test="sp-kaart">
        <div class="kaart-kop">
          <div class="sp-kop">
            <span class="veld-label">Basis: {{ p.script ? `${p.script.naam}, versie ${p.script.versie}` : 'geen actief script' }}</span>
            <h2 class="kaart-titel mt-4">{{ p.account.naam }}</h2>
            <p v-if="kaart?.contact" class="meta">{{ kaart.contact.naam }}{{ kaart.contact.functie ? `, ${kaart.contact.functie}` : '' }}{{ kaart.account.plaats ? ` · ${kaart.account.plaats}` : '' }}</p>
          </div>
          <button type="button" class="dd-act" data-test="sp-waarom" @click="waarom = true">Waarom dit script</button>
        </div>

        <template v-if="fase === 'start'">
          <p v-if="kaart?.account.aanleiding?.tekst" class="kaart kaart--vlak"><strong>Aanleiding:</strong> {{ kaart.account.aanleiding.tekst }}</p>
          <p class="mt-12">De AI vult de paarse blokken van het standaardscript voor dit prospect. Hij gebruikt alleen de gegevens hieronder en verzint niets; wat ontbreekt blijft een terugvalzin.</p>
          <StudioGegevens class="mt-12" :gegevens="p.gegevens" @bron="toonBron" />
          <p class="meta mt-8">Niet meegestuurd naar de AI: {{ ['namen van andere contacten', 'notities', 'mails en gespreksverslagen'].join(', ') }}. De herkomst wordt bevroren op het moment van invullen.</p>
          <div class="rijtje mt-16">
            <button type="button" class="dd-actie dd-actie--primair" :disabled="!p.ai.aan || !p.script || !p.aiBlokken" data-test="sp-vul" @click="vul"><Icoon naam="Sparkles" class="dd-actie-icoon" />Vul met AI</button>
            <span class="meta">{{ p.aiBlokken }} {{ p.aiBlokken === 1 ? 'blok' : 'blokken' }} · {{ p.ai.credits }} {{ p.ai.credits === 1 ? 'credit' : 'credits' }}</span>
            <button v-if="p.versies.length" type="button" class="dd-act" data-test="sp-open-laatste" @click="bekijkVersie(p.versies[0])">Open versie {{ p.versies[0].versie }}</button>
          </div>
          <p v-if="!p.ai.aan" class="kaart kaart--geel mt-12" data-test="sp-ai-uit">{{ p.ai.reden }}</p>
          <p v-else-if="p.script && !p.aiBlokken" class="meta mt-12">Dit script heeft geen AI-blokken. Zet in Standaardscript een blok op "AI vult aan".</p>
        </template>

        <div v-else-if="fase === 'laden'" class="sp-laden" role="status"><Icoon naam="Sparkles" /> De AI vult de AI-blokken voor {{ p.account.naam }}…</div>

        <template v-else-if="fase === 'beoordelen'">
          <div class="rijtje"><Label soort="ai" waarde="concept" /><span class="meta" data-test="sp-teller"><strong>{{ aiTotaal - open }} van {{ aiTotaal }}</strong> AI-blokken beoordeeld. Bevestig, pas aan of verwerp elk blok.</span></div>
          <div v-for="b in blokken" :key="b.id" class="sp-blok" :class="{ 'sp-blok--ai': b.voorstel, 'sp-blok--ok': b.status === 'bevestigd' || b.status === 'bewerkt', 'sp-blok--weg': b.status === 'verworpen' }" :data-test="`sp-blok-${b.id}`">
            <div class="sp-blok-kop">
              <span class="bloklabel">{{ b.titel || BLOK_LABEL[b.soort] }}</span>
              <Label v-if="b.voorstel" soort="ai" waarde="voorstel" /><span v-else-if="b.status === 'vast'" class="meta">vast uit het standaardscript</span>
              <span v-if="STATUS[b.status]" class="pil" :class="STATUS[b.status]!.klas" :data-test="`sp-status-${b.id}`">{{ STATUS[b.status]!.label }}</span>
              <span class="sp-blok-acties">
                <template v-if="b.status === 'voorgesteld'">
                  <button type="button" class="dd-act" :data-test="`sp-verwerp-${b.id}`" @click="verwerp(b)">Verwerp</button>
                  <button type="button" class="dd-act dd-act--geel" :data-test="`sp-bevestig-${b.id}`" @click="bevestig(b)"><Icoon naam="Check" :grootte="14" />Bevestig</button>
                </template>
                <button v-else-if="b.status === 'verworpen'" type="button" class="dd-act" :data-test="`sp-herstel-${b.id}`" @click="herstel(b)">Herstel voorstel</button>
              </span>
            </div>
            <textarea v-if="b.voorstel && b.status !== 'verworpen'" v-model="b.tekst" class="invoer" rows="3" :aria-label="`Tekst ${BLOK_LABEL[b.soort]}`" :data-test="`sp-tekst-${b.id}`" @input="opInvoer(b)" />
            <p v-else class="sp-vast"><template v-for="(seg, j) in voorbeeldSegmenten(b.status === 'verworpen' ? (b.terugval ?? '') : b.tekst, p.waarden)" :key="j"><span v-if="seg.variabele" class="var" :class="{ 'var--onbekend': seg.onbekend }">{{ seg.tekst || '…' }}</span><template v-else>{{ seg.tekst }}</template></template></p>
            <div v-if="b.voorstel" class="sp-herkomst"><span class="veld-label">Gebaseerd op</span>
              <button v-for="h in b.herkomst" :key="h.label" type="button" class="sp-chip" :disabled="h.sleutel === 'script'" @click="toonBron(h.sleutel)">{{ h.label }}</button>
            </div>
          </div>
          <div class="rijtje mt-16">
            <button type="button" class="dd-actie dd-actie--zwart" :disabled="!!open || bezig" data-test="sp-bewaar" @click="bewaar"><Icoon naam="Save" class="dd-actie-icoon" />Bewaar als versie {{ (p.versies[0]?.versie ?? 0) + 1 }}</button>
            <span class="meta" data-test="sp-nog">{{ open ? `Nog ${open} AI-${open === 1 ? 'blok' : 'blokken'} te beoordelen voor je bewaart.` : 'Alles beoordeeld.' }}</span>
          </div>
          <details class="mt-16"><summary class="sp-summary">Gebruikte gegevens</summary><StudioGegevens class="mt-8" :gegevens="p.gegevens" @bron="toonBron" /></details>
        </template>

        <template v-else-if="fase === 'versie' && versieOpen">
          <div class="rijtje"><span class="pil pil--groen">Versie {{ versieOpen.versie }}</span><span class="meta">{{ datum(versieOpen.op) }} · {{ versieOpen.door }} · {{ versieOpen.samenvatting }}</span></div>
          <div v-for="b in versieOpen.data.blokken" :key="b.id" class="sp-blok" :class="{ 'sp-blok--ai': b.voorstel }" :data-test="`sp-versie-blok-${b.id}`">
            <div class="sp-blok-kop"><span class="bloklabel">{{ b.titel || BLOK_LABEL[b.soort as BlokSoortScript] }}</span><Label v-if="b.vanAi" soort="ai" waarde="ai" /><span v-if="STATUS[b.status]" class="pil" :class="STATUS[b.status]!.klas">{{ STATUS[b.status]!.label }}</span></div>
            <p class="sp-vast"><template v-for="(seg, j) in voorbeeldSegmenten(b.tekst, p.waarden)" :key="j"><span v-if="seg.variabele" class="var" :class="{ 'var--onbekend': seg.onbekend }">{{ seg.tekst || '…' }}</span><template v-else>{{ seg.tekst }}</template></template></p>
            <div v-if="b.vanAi" class="sp-herkomst"><span class="veld-label">Gebaseerd op</span><span v-for="h in b.herkomst" :key="h.label" class="sp-chip sp-chip--vast">{{ h.label }}</span></div>
          </div>
          <div class="rijtje mt-16">
            <button type="button" class="dd-actie dd-actie--zwart" data-test="sp-belmodus" @click="emit('belmodus', p.account.id)"><Icoon naam="Phone" class="dd-actie-icoon" />Gebruik in de belmodus</button>
            <button type="button" class="dd-act" data-test="sp-opnieuw" :disabled="!p.ai.aan" @click="fase = 'start'; versieOpen = null">Nieuwe versie maken</button>
          </div>
        </template>

        <div class="mt-24" data-test="sp-versies">
          <span class="veld-label"><Icoon naam="Clock" :grootte="14" /> Versies voor dit prospect</span>
          <div v-for="v in p.versies" :key="v.id" class="sp-versie">
            <strong>Versie {{ v.versie }}</strong><span class="meta">{{ datum(v.op) }} · {{ v.door }}</span><span class="sp-versie-wat">{{ v.samenvatting }}</span>
            <button type="button" class="dd-act" :data-test="`sp-versie-${v.versie}`" @click="bekijkVersie(v)">Bekijk</button>
          </div>
          <p v-if="!p.versies.length" class="meta mt-8">Nog geen versies bewaard.</p>
        </div>
      </article>
    </div>

    <FlyoutShell v-if="bron" open titel-id="sp-bron-titel" breedte="smal" data-test="sp-bron-flyout" @sluit="bron = null">
        <template #kop><span class="fo-kicker">Gebruikt gegeven</span><h2 id="sp-bron-titel" class="fo-titel">{{ bron.label }}</h2></template>
          <div class="fo-body">
            <p class="fo-tekst"><strong>{{ bron.waarde ?? 'Onbekend' }}</strong></p>
            <p v-if="bron.toelichting" class="kaart kaart--vlak mt-8">{{ bron.toelichting }}</p>
            <dl class="defs mt-12">
              <div class="def-rij"><dt>Bron</dt><dd>{{ bron.bron }}</dd></div>
              <div class="def-rij"><dt>Gebruikt in</dt><dd>{{ gebruiktIn(bron.sleutel) || 'geen blok' }}</dd></div>
              <div class="def-rij"><dt>Status</dt><dd>{{ bron.gebruikt ? 'meegestuurd naar de AI' : 'ontbreekt, de terugvalzin geldt' }}</dd></div>
            </dl>
          </div>
        <template #voet>
          <footer class="fo-foot fs-voet"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="bron = null">Sluiten</button></footer>
        </template>
      </FlyoutShell>
      <FlyoutShell v-if="waarom && p" open titel-id="sp-waarom-titel" breedte="smal" data-test="sp-waarom-flyout" @sluit="waarom = false">
        <template #kop><span class="fo-kicker">Voorselectie</span><h2 id="sp-waarom-titel" class="fo-titel">Waarom dit script</h2></template>
          <div class="fo-body">
            <p class="fo-tekst">Dealtrace kiest het script in deze volgorde: het script van de campagne, van het belblok, en anders het best passende op doel, reisfase, doelgroep en rol.</p>
            <dl class="defs mt-12">
              <div class="def-rij"><dt>Gekozen</dt><dd>{{ p.script ? `${p.script.naam}, versie ${p.script.versie}` : 'geen' }}</dd></div>
              <div class="def-rij"><dt>Reden</dt><dd>{{ p.voorstel?.reden ?? 'Startscript van de organisatie' }}</dd></div>
              <div class="def-rij"><dt>AI-blokken</dt><dd>{{ p.aiBlokken }}</dd></div>
            </dl>
          </div>
        <template #voet>
          <footer class="fo-foot fs-voet"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="waarom = false">Sluiten</button></footer>
        </template>
      </FlyoutShell>
  </div>
</template>

<style scoped>
.sp-raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
@media (min-width: 960px) { .sp-raster { grid-template-columns: minmax(0, 300px) minmax(0, 1fr); } }
.sp-lijst { display: flex; flex-direction: column; gap: 8px; }
.sp-prospect { display: flex; gap: 10px; align-items: flex-start; width: 100%; min-height: var(--touch-target-min); padding: 10px 12px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); font: inherit; text-align: left; color: var(--ink); cursor: pointer; }
.sp-prospect:hover { border-color: var(--ink); }
.sp-prospect[aria-pressed='true'] { border-color: var(--ink); border-left: 3px solid var(--yellow); background: var(--yellow-licht); }
.sp-prospect:focus-visible { outline: 2px solid var(--ink); }
.sp-prospect-tekst { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sp-kop { min-width: 0; }
.sp-laden { display: flex; gap: 8px; align-items: center; padding: 24px 0; color: var(--purple); font-weight: 600; }
.sp-blok { padding: 12px; margin-top: 10px; border: 1px solid var(--border); border-left: 3px solid var(--border-strong); background: var(--wit); }
.sp-blok--ai { border-left-color: var(--purple); }
.sp-blok--ok { border-left-color: var(--green); }
.sp-blok--weg { border-left-color: var(--orange); }
.sp-blok-kop { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.sp-blok-acties { display: inline-flex; gap: 6px; margin-left: auto; }
.sp-vast { margin: 0; font-size: var(--fs-body); line-height: 1.6; }
.sp-herkomst { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.sp-chip { display: inline-flex; align-items: center; min-height: 32px; padding: 2px 10px; background: var(--purple-zacht); color: var(--purple); border: 1px solid transparent; border-radius: var(--radius); font: inherit; font-size: var(--fs-meta); font-weight: 600; cursor: pointer; }
.sp-chip:hover:not(:disabled) { border-color: var(--purple); }
.sp-chip:disabled, .sp-chip--vast { cursor: default; }
.sp-summary { cursor: pointer; font-weight: 700; min-height: var(--touch-target-min); display: flex; align-items: center; }
.sp-versie { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.sp-versie-wat { flex: 1 1 200px; font-size: var(--fs-klein); }
.mt-24 { margin-top: 24px; }
@media (max-width: 719px) { .sp-chip { min-height: 44px; } .sp-blok-acties { margin-left: 0; width: 100%; } .sp-blok-acties .dd-act { flex: 1; min-height: 44px; } }
</style>
