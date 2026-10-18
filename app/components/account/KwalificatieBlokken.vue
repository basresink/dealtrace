<script setup lang="ts">
// Kwalificatie van een account (venster Kwalificatie onder Meer, op de accountkaart en de contactkaart):
// BAND met Kwalificeer, het buying committee met "Stel voor met AI" (Profielbouwer, 3 credits) en de
// contactpersonen met hun rol (zoeken via Datacollectief staat hier niet meer). Op de contactkaart staat
// bovenaan de rol van dat contact in het committee.
// BAND vul je zelf in (vinkjes) of laat je invullen met "Vul in met AI" (soort bandInvulling, prijs op de knop): de
// AI leest alle gespreksverslagen en zet per onderdeel een voorstel met citaat en bron klaar. Zonder verslagen staat
// de knop uit met "Nog geen gespreksverslagen".
// BAND uit de gespreksverslagen: de analyses van de Notulist leveren per letter een voorstel met citaat en
// herkomst (welk verslag, welke datum); de gebruiker bevestigt, bewerkt of verwerpt per letter. Een letter die al
// is ingevuld krijgt geen voorstel; met de hand ingevuld blijft leidend.
import { CONTACTROL_LABEL, type ContactRol } from '~~/shared/contactgegevens'
import { BAND_UITLEG, type BandVoorstel } from '~~/shared/bandUitVerslag'
const props = defineProps<{ account: any; contact?: { naam: string; roepnaam?: string; rol: string; functie?: string | null } | null }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const { functie } = useMe()
const a = computed(() => props.account)
const BAND = ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak'] as const
const bandJa = computed(() => BAND.filter((k) => a.value.band?.[k]?.ja).length)
// BAND bewerken (zelf of via het AI-voorstel) staat los van Kwalificeer: de eigenaar, zijn salesmanager en de beheerder
// werken BAND ook bij als de prospect al voorbij status nieuw is. Dat bijwerken is dan geen gebeurtenis in de reis.
const magBand = computed(() => !!a.value.kan?.band)
const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1)
async function zetBand(letter: string, ja: boolean) {
  try {
    const r = await $fetch<any>(`/api/accounts/${a.value.id}/band`, { method: 'PUT', body: { letter, ja } })
    if (r.gemeld?.gewisseld) toast.toon('BAND 3 van 4: gekwalificeerd.')
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Voorstellen uit de gespreksverslagen (GET /api/accounts/:id/band-voorstel).
const magVoorstel = computed(() => !!functie('reis.kwalificeer')?.beschikbaar)
const voorstellen = ref<BandVoorstel[]>([])
const verslagen = ref(0)
const ai = ref<{ verslagen: number; credits: number; op: string | null } | null>(null)
async function laadVoorstellen() {
  try { const r = await $fetch<any>(`/api/accounts/${a.value.id}/band-voorstel`); voorstellen.value = r.voorstellen; verslagen.value = r.verslagen; ai.value = r.ai ?? null } catch { voorstellen.value = [] }
}
// Vul in met AI: alleen voorstellen, nooit stil ingevuld.
const aiBezig = ref(false)
const aiCredits = computed(() => ai.value?.credits ?? 1)
const aiUit = computed(() => (!ai.value?.verslagen ? 'Nog geen gespreksverslagen' : bandJa.value === 4 || BAND.every((k) => a.value.band?.[k]) ? 'Alle vier onderdelen zijn ingevuld' : null))
async function vulMetAi() {
  aiBezig.value = true
  try {
    const r = await $fetch<any>(`/api/accounts/${a.value.id}/band-ai`, { method: 'POST' })
    toast.toon(r.voorstellen ? `${r.voorstellen} ${r.voorstellen === 1 ? 'voorstel' : 'voorstellen'} uit ${r.verslagen} ${r.verslagen === 1 ? 'verslag' : 'verslagen'}. Beslis per onderdeel.` : 'De verslagen zeggen nog niets over de open onderdelen.')
    await laadVoorstellen()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { aiBezig.value = false }
}
const aantalAi = computed(() => voorstellen.value.filter((v) => v.ai).length)
onMounted(laadVoorstellen)
watch(() => JSON.stringify(a.value.band ?? {}), laadVoorstellen)
const bewerkt = ref<string | null>(null)
const concept = reactive({ ja: true, toelichting: '' })
const besluitBezig = ref(false)
function startBewerk(v: BandVoorstel) { bewerkt.value = v.letter; concept.ja = v.ja; concept.toelichting = v.citaat }
async function besluit(v: BandVoorstel, soort: 'bevestig' | 'bewerk' | 'verwerp') {
  besluitBezig.value = true
  try {
    const r = await $fetch<any>(`/api/accounts/${a.value.id}/band-voorstel`, { method: 'POST', body: { letter: v.letter, besluit: soort, bronId: v.bron.id, ...(soort === 'bewerk' ? { ja: concept.ja, toelichting: concept.toelichting } : {}) } })
    bewerkt.value = null
    toast.toon(soort === 'verwerp' ? `Voorstel voor ${label(v.letter).toLowerCase()} verworpen.` : r.gemeld?.gewisseld ? 'BAND 3 van 4: gekwalificeerd.' : `${label(v.letter)} ingevuld uit het verslag.`)
    await laadVoorstellen()
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { besluitBezig.value = false }
}
async function ongedaan(letter: string) {
  try { await $fetch(`/api/accounts/${a.value.id}/band-voorstel`, { method: 'POST', body: { letter, besluit: 'ongedaan' } }); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const dagKort = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '')
const bronLabel = (b: { soort: string; datum: string }) => `${b.soort === 'afspraak' ? 'Verslag' : b.soort === 'transcript' ? 'Transcript' : 'Belverslag'} ${dagKort(b.datum)}`
async function kwalificeer() {
  try {
    const r = await $fetch<any>('/api/reis/gebeurtenis', { method: 'POST', body: { accountId: a.value.id, gebeurtenis: 'gekwalificeerd' } })
    toast.toon(r.gewisseld ? 'Gekwalificeerd; het account staat in de reis.' : 'Geen wissel.'); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// P19: de Profielbouwer stelt het buying committee voor (3 credits).
const committee = ref<any[] | null>(null)
const committeeBezig = ref(false)
async function stelCommitteeVoor() {
  committeeBezig.value = true
  try { const r = await $fetch<any>(`/api/accounts/${a.value.id}/committee`, { method: 'POST' }); committee.value = r.voorstellen; if (!r.voorstellen.length) toast.toon(r.reden ?? 'Nog te weinig functies bekend om een voorstel te doen.') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { committeeBezig.value = false }
}
const ontbrekend = computed(() => ((a.value.ontbrekendeRollen ?? []) as string[]).map((r) => CONTACTROL_LABEL[r as ContactRol] ?? r).join(', '))
</script>

<template>
  <article v-if="contact" class="kaart" data-test="kwalificatie-contact">
    <header class="kaart-kop"><h2 class="kaart-titel">{{ contact.roepnaam ?? contact.naam }} in het buying committee</h2></header>
    <p class="kaart-meta">Rol: <strong>{{ CONTACTROL_LABEL[contact.rol as ContactRol] ?? contact.rol }}</strong><template v-if="contact.functie"> · {{ contact.functie }}</template></p>
    <p v-if="a.ontbrekendeRollen?.length" class="kaart-meta mt-8">Nog niet bekend bij {{ a.naam }}: {{ ontbrekend }}.</p>
  </article>
  <article class="kaart" data-test="band">
    <header class="kaart-kop"><h2 class="kaart-titel">Kwalificatie BAND {{ bandJa }}/4</h2></header>
    <ul class="kaart-meta band-lijst">
      <li v-for="k in BAND" :key="k" class="band-rij">
        <label v-if="magBand" class="schakel-naam kb-vink"><input type="checkbox" :checked="!!a.band?.[k]?.ja" :data-test="`band-${k}`" @change="zetBand(k, ($event.target as HTMLInputElement).checked)"> {{ label(k) }}</label>
        <template v-else>{{ label(k) }}: {{ a.band?.[k]?.ja ? `ja (${a.band[k].bron ?? 'bron onbekend'})` : 'nog niet' }}</template>
        <span v-if="a.band?.[k]?.herkomst" class="kb-herkomst" :data-test="`band-herkomst-${k}`">
          <span class="kb-chip"><Icoon naam="FileText" :grootte="12" />Gebaseerd op {{ bronLabel(a.band[k].herkomst) }} · {{ a.band[k].herkomst.titel }}</span>
          <span v-if="a.band[k].toelichting" class="kb-citaat">"{{ a.band[k].toelichting }}"</span>
          <button v-if="magVoorstel && magBand" type="button" class="kb-link" :data-test="`band-ongedaan-${k}`" @click="ongedaan(k)">Ongedaan maken</button>
        </span>
      </li>
    </ul>
    <div v-if="magVoorstel && magBand" class="kb-ai" data-test="band-ai">
      <button type="button" class="dd-act" :disabled="aiBezig || !!aiUit" :aria-describedby="aiUit ? 'kb-ai-uit' : undefined" data-test="band-ai-knop" @click="vulMetAi"><Icoon naam="Sparkles" class="dd-act-icoon" />{{ aiBezig ? 'AI leest de verslagen…' : 'Vul in met AI' }}<span class="kb-ai-prijs tnum" data-test="band-ai-prijs">{{ aiCredits }} {{ aiCredits === 1 ? 'credit' : 'credits' }}</span></button>
      <span v-if="aiUit" id="kb-ai-uit" class="meta" data-test="band-ai-uit">{{ aiUit }}</span>
      <span v-else class="meta">Of vink zelf aan. De AI leest {{ ai?.verslagen }} {{ ai?.verslagen === 1 ? 'gespreksverslag' : 'gespreksverslagen' }} en doet per onderdeel een voorstel.</span>
    </div>
    <section v-if="magVoorstel && magBand && voorstellen.length" class="kb-voorstellen" data-test="band-voorstellen">
      <h3 class="kb-voorstellen-titel"><Label soort="ai" waarde="voorstel" /> Uit je gespreksverslagen</h3>
      <p class="kaart-meta"><template v-if="aantalAi">De AI las {{ ai?.verslagen }} {{ ai?.verslagen === 1 ? 'verslag' : 'verslagen' }}.</template><template v-else>De Notulist las {{ verslagen }} {{ verslagen === 1 ? 'verslag' : 'verslagen' }}.</template> Bevestig, bewerk of verwerp per letter; er wordt niets vanzelf ingevuld.</p>
      <article v-for="v in voorstellen" :key="v.letter" class="kb-voorstel" :data-test="`band-voorstel-${v.letter}`">
        <header class="kb-voorstel-kop">
          <strong>{{ label(v.letter) }}</strong><span class="meta">{{ BAND_UITLEG[v.letter] }}</span><span v-if="v.ai" class="kb-chip" data-test="band-voorstel-ai"><Icoon naam="Sparkles" :grootte="12" />AI</span>
          <span class="kb-oordeel" :class="v.ja ? 'kb-oordeel--ja' : 'kb-oordeel--nee'" data-test="band-voorstel-oordeel">{{ v.ja ? 'Ja' : 'Nee' }}</span>
        </header>
        <p class="kb-citaat">"{{ v.citaat }}"</p>
        <span class="kb-chip" data-test="band-voorstel-bron"><Icoon naam="FileText" :grootte="12" />Gebaseerd op {{ bronLabel(v.bron) }} · {{ v.bron.titel }}</span>
        <form v-if="bewerkt === v.letter" class="kb-bewerk" data-test="band-voorstel-bewerk" @submit.prevent="besluit(v, 'bewerk')">
          <fieldset class="kb-keuze"><legend class="veld-label">{{ label(v.letter) }}</legend>
            <label class="kb-vink"><input v-model="concept.ja" type="radio" :value="true" name="kb-ja"> Ja</label>
            <label class="kb-vink"><input v-model="concept.ja" type="radio" :value="false" name="kb-ja" data-test="band-voorstel-nee"> Nee</label>
          </fieldset>
          <label class="veld"><span class="veld-label">Toelichting</span><textarea v-model="concept.toelichting" class="invoer" rows="2" maxlength="300" data-test="band-voorstel-toelichting" /></label>
          <div class="kb-acties">
            <button type="submit" class="dd-act dd-act--primair" :disabled="besluitBezig" data-test="band-voorstel-bewaar">Bewaar</button>
            <button type="button" class="dd-act" @click="bewerkt = null">Annuleer</button>
          </div>
        </form>
        <div v-else class="kb-acties">
          <button type="button" class="dd-act dd-act--primair" :disabled="besluitBezig" data-test="band-voorstel-bevestig" @click="besluit(v, 'bevestig')"><Icoon naam="Check" class="dd-act-icoon" />Bevestig</button>
          <button type="button" class="dd-act" :disabled="besluitBezig" data-test="band-voorstel-bewerk-knop" @click="startBewerk(v)"><Icoon naam="Pencil" class="dd-act-icoon" />Bewerk</button>
          <button type="button" class="dd-act" :disabled="besluitBezig" data-test="band-voorstel-verwerp" @click="besluit(v, 'verwerp')"><Icoon naam="X" class="dd-act-icoon" />Verwerp</button>
        </div>
      </article>
    </section>
    <button v-if="a.kan?.kwalificeer" type="button" class="dd-act dd-act--primair mt-16" data-test="kwalificeer" @click="kwalificeer">Kwalificeer</button>
  </article>
  <section class="kb-committee">
    <div class="sec-head"><span class="kicker kicker--streep">Buying committee</span><button type="button" class="dd-act" :disabled="committeeBezig" data-test="committee-ai" @click="stelCommitteeVoor"><Icoon naam="Sparkles" class="dd-actie-icoon" />Stel voor met AI</button></div>
    <BuyingCommittee class="mt-16" :contacten="a.contacten ?? []" :ontbrekend="a.ontbrekendeRollen ?? []" />
    <ul v-if="committee?.length" class="schakel-lijst kaart mt-16" data-test="committee-voorstel">
      <li v-for="v in committee" :key="v.functie" class="schakel-rij"><span><strong>{{ v.functie }}</strong>: {{ v.rol }} <span v-if="v.vermoedelijk" class="pil pil--leeg">vermoedelijk</span><br><span class="meta">{{ v.bron }} · zekerheid {{ v.zekerheid }}</span></span></li>
    </ul>
    <ul v-if="a.contacten?.length" class="schakel-lijst kaart mt-16"><li v-for="c in a.contacten" :key="c.id" class="schakel-rij"><FunctieLink als-tekst :to="`/contacten/${c.id}`">{{ c.naam }}</FunctieLink><span class="meta">{{ CONTACTROL_LABEL[c.rol as ContactRol] }}<template v-if="c.functie"> · {{ c.functie }}</template><template v-if="c.status === 'vertrokken'"> · vertrokken</template><template v-if="c.herkomst?.bron === 'datacollectief'"> · Datacollectief · {{ c.herkomst.op.slice(0, 10) }}</template></span></li></ul>
  </section>
</template>

<style scoped>
.kb-vink { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
.kb-committee { margin-top: 8px; }
.band-rij { flex-wrap: wrap; }
.kb-herkomst { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; width: 100%; margin: 0 0 6px 26px; font-size: 12px; }
.kb-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border: 1px solid var(--border-strong); border-radius: 2px; font-size: 11px; font-weight: 600; color: var(--ink-soft); background: var(--wit); }
.kb-citaat { margin: 0; font-size: 13px; font-style: italic; line-height: 1.45; color: var(--ink-soft); overflow-wrap: anywhere; }
.kb-link { min-height: 28px; padding: 0 2px; background: none; border: 0; font: inherit; font-size: 12px; font-weight: 700; color: var(--ink); text-decoration: underline; cursor: pointer; }
.kb-voorstellen { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }
.kb-voorstellen-titel { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 700; }
.kb-voorstel { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px; border: 1px dashed var(--purple); border-radius: 2px; background: var(--wit); }
.kb-voorstel-kop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; width: 100%; }
.kb-oordeel { margin-left: auto; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.kb-oordeel--ja { color: var(--green); }
.kb-oordeel--nee { color: var(--red); }
.kb-acties { display: flex; flex-wrap: wrap; gap: 8px; }
.kb-ai { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 12px; }
.kb-ai-prijs { margin-left: 4px; padding: 1px 6px; border: 1px solid var(--border-strong); border-radius: 2px; font-size: 11px; font-weight: 700; color: var(--ink-soft); }
.kb-bewerk { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.kb-keuze { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; padding: 0; border: 0; }
@media (max-width: 767px) { .kb-acties .dd-act, .kb-link, .kb-ai .dd-act { min-height: 44px; } }
</style>
