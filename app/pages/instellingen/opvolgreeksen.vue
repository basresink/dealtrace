<script setup lang="ts">
// Sjablonen voor opvolgreeksen (F7, salesmanager en beheerder, per organisatie). Per sjabloon de stappen per dag met
// kanaal (mail, LinkedIn of bellen), de titel van de taak en voor de Schrijver een onderwerp en een instructie; het
// einde (de dag en na hoeveel dagen het ritme verder gaat); bij welke uitkomst Rond af en de belmodus het sjabloon
// voorstellen; de stopregels; en aan of uit. Lopende reeksen houden de stappen waarmee ze startten.
import { REEKS_KANAAL_LABEL, REEKS_KANALEN, REEKS_UITKOMSTEN, REEKS_UITKOMST_LABEL, STANDAARD_STOPREGELS, STOPREGELS, STOPREGEL_LABEL, valideerSjabloon } from '~~/shared/opvolgreeks'

const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.opvolgreeksen')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/reekssjablonen', { query: { alle: '1' }, immediate: aan.value, default: () => ({ sjablonen: [] }) })
const bewerk = ref<any>(null)
const bezig = ref(false)
function open(s: any) { bewerk.value = JSON.parse(JSON.stringify({ ...s, omschrijving: s.omschrijving ?? '', na: s.na ?? '' })) }
function nieuw() {
  bewerk.value = { id: null, naam: '', omschrijving: '', na: '', actief: true, uitkomsten: [], stopregels: { ...STANDAARD_STOPREGELS },
    stappen: [{ dag: 0, kanaal: 'mail', titel: 'Mail: ', onderwerp: '', instructie: '' }, { dag: 3, kanaal: 'bellen', titel: 'Bellen: ', onderwerp: '', instructie: '' }], einde: { dag: 14, wachtDagen: 30 } }
}
function voegStapToe() {
  const laatste = Math.max(0, ...bewerk.value.stappen.map((s: any) => Number(s.dag) || 0))
  bewerk.value.stappen.push({ dag: laatste + 3, kanaal: 'mail', titel: '', onderwerp: '', instructie: '' })
  if (bewerk.value.einde.dag <= laatste + 3) bewerk.value.einde.dag = laatste + 7
}
function wisselUitkomst(u: string) {
  const l: string[] = bewerk.value.uitkomsten
  bewerk.value.uitkomsten = l.includes(u) ? l.filter((x) => x !== u) : [...l, u]
}
const fouten = computed(() => (bewerk.value ? valideerSjabloon({ ...bewerk.value, stappen: bewerk.value.stappen.map((s: any) => ({ ...s, dag: Number(s.dag) })), einde: { dag: Number(bewerk.value.einde.dag), wachtDagen: Number(bewerk.value.einde.wachtDagen) } }) : []))
async function bewaar() {
  if (fouten.value.length) return
  bezig.value = true
  const b = bewerk.value
  const body = { naam: b.naam, omschrijving: b.omschrijving, na: b.na, actief: b.actief, uitkomsten: b.uitkomsten, stopregels: b.stopregels, einde: { dag: Number(b.einde.dag), wachtDagen: Number(b.einde.wachtDagen) }, stappen: b.stappen.map((s: any) => ({ ...s, dag: Number(s.dag) })) }
  try {
    if (b.id) await $fetch(`/api/reekssjablonen/${b.id}`, { method: 'PUT', body })
    else await $fetch('/api/reekssjablonen', { method: 'POST', body })
    toast.toon('Sjabloon bewaard.'); bewerk.value = null; await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function zetActief(s: any, actief: boolean) {
  try { await $fetch(`/api/reekssjablonen/${s.id}`, { method: 'PUT', body: { actief } }); toast.toon(actief ? `${s.naam} staat aan.` : `${s.naam} staat uit. Lopende reeksen lopen door.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const ICOON: Record<string, string> = { mail: 'Mail', linkedin: 'Linkedin', bellen: 'Phone' }
const stappenTekst = (s: any) => `${s.stappen.map((x: any) => `dag ${x.dag} ${(REEKS_KANAAL_LABEL[x.kanaal as keyof typeof REEKS_KANAAL_LABEL] ?? x.kanaal).toLowerCase()}`).join(' · ')} · dag ${s.einde.dag} terug naar het ritme`
useHead({ title: 'Sjablonen voor opvolgreeksen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.opvolgreeksen" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Werkwijze" titel="Sjablonen voor opvolgreeksen" uitleg="Een reeks van mail, LinkedIn en bellen die vanzelf stopt zodra de prospect reageert. De Schrijver maakt elke mail en elk bericht vlak voor de verzenddag; jij of je verkopers keuren goed." helpartikel="volgen">
        <template #acties>
          <NuxtLink to="/opvolgreeksen" class="dd-actie dd-actie--secundair">Naar de reeksen</NuxtLink>
          <button type="button" class="dd-actie dd-actie--primair" data-test="rsj-nieuw" @click="nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Sjabloon</button>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.sjablonen.length" titel="Nog geen sjablonen." tekst="Maak een eerste sjabloon. De startset (Na informatie, Na voicemail, Na eerste gesprek) komt bij het eerste gebruik vanzelf." />
          <div v-else class="lijst" data-test="rsj-lijst">
            <div v-for="s in data.sjablonen" :key="s.id" class="rij rij--compact" :class="{ 'rij--uit': !s.actief }" :data-test="`rsj-${s.sleutel}`">
              <div class="rij-info">
                <h3 class="rij-titel">{{ s.naam }} <span v-if="!s.actief" class="pil">uit</span><span v-for="u in s.uitkomsten" :key="u" class="pil pil--leeg">{{ REEKS_UITKOMST_LABEL[u as keyof typeof REEKS_UITKOMST_LABEL] ?? u }}</span></h3>
                <div class="rij-sub">{{ stappenTekst(s) }}<template v-if="s.lopend"> · {{ s.lopend }} {{ s.lopend === 1 ? 'reeks loopt' : 'reeksen lopen' }}</template></div>
              </div>
              <div class="rsj-knoppen">
                <Schakelaar :aan="s.actief" :label="s.actief ? `${s.naam} staat aan` : `${s.naam} staat uit`" @wissel="zetActief(s, $event)" />
                <button type="button" class="dd-act" :data-test="`rsj-bewerk-${s.sleutel}`" @click="open(s)">Bewerk</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
    <FlyoutShell v-if="bewerk" open titel-id="rsj-titel" breedte="breed" data-test="rsj-flyout" @sluit="bewerk = null">
        <template #kop><span class="fo-kicker">Sjabloon voor opvolgreeksen</span><h2 id="rsj-titel" class="fo-titel">{{ bewerk.naam || 'Nieuw sjabloon' }}</h2><p class="fo-meta">Lopende reeksen houden hun stappen; nieuwe reeksen krijgen dit sjabloon.</p></template>
        <form id="rsj-form" class="fs-form" @submit.prevent="bewaar">
          <div class="fo-body fo-body--formulier">
            <article class="fo-blok">
              <div class="formulier-raster">
                <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="bewerk.naam" class="invoer" maxlength="80" required data-test="rsj-naam"></label>
                <label class="veld"><span class="veld-label">Na (de aanleiding)</span><input v-model="bewerk.na" class="invoer" maxlength="80" placeholder="Stuur maar wat informatie" data-test="rsj-na"></label>
              </div>
              <label class="veld mt-16"><span class="veld-label">Omschrijving</span><input v-model="bewerk.omschrijving" class="invoer" maxlength="300"></label>
              <fieldset class="veld mt-16">
                <legend class="veld-label">Stel voor bij de uitkomst</legend>
                <div class="rsj-pillen">
                  <button v-for="u in REEKS_UITKOMSTEN" :key="u" type="button" class="filter-pil" :class="{ 'filter-pil--aan': bewerk.uitkomsten.includes(u) }" :aria-pressed="bewerk.uitkomsten.includes(u)" :data-test="`rsj-uitkomst-${u}`" @click="wisselUitkomst(u)">{{ REEKS_UITKOMST_LABEL[u] }}</button>
                </div>
                <span class="veld-uitleg">In Rond af en de belmodus staat dit sjabloon dan klaar bij die uitkomst. Starten blijft een keuze.</span>
              </fieldset>
              <p class="schakel-rij mt-16"><span>Actief</span><Schakelaar :aan="bewerk.actief !== false" label="Actief" @wissel="bewerk.actief = $event" /></p>
            </article>
            <article class="fo-blok">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Stappen</h3></header>
              <ol class="rsj-stappen" data-test="rsj-stappen">
                <li v-for="(s, i) in bewerk.stappen" :key="i" class="rsj-stap" :data-test="`rsj-stap-${Number(i) + 1}`">
                  <div class="rsj-stap-kop">
                    <span class="item-icoon" aria-hidden="true"><Icoon :naam="ICOON[s.kanaal] ?? 'ListTodo'" :grootte="16" /></span>
                    <label class="veld rsj-dag"><span class="veld-label">Dag</span><input v-model.number="s.dag" type="number" min="0" max="90" class="invoer tnum" :data-test="`rsj-dag-${Number(i) + 1}`"></label>
                    <label class="veld"><span class="veld-label">Kanaal</span><select v-model="s.kanaal" class="invoer" :data-test="`rsj-kanaal-${Number(i) + 1}`"><option v-for="k in REEKS_KANALEN" :key="k" :value="k">{{ REEKS_KANAAL_LABEL[k] }}</option></select></label>
                    <button type="button" class="dd-act dd-act--icoon rsj-weg" :aria-label="`Verwijder stap ${Number(i) + 1}`" :disabled="bewerk.stappen.length < 2" @click="bewerk.stappen.splice(i, 1)"><Icoon naam="Trash2" /></button>
                  </div>
                  <label class="veld"><span class="veld-label">Titel van de taak</span><input v-model="s.titel" class="invoer" maxlength="120" :data-test="`rsj-titel-${Number(i) + 1}`"></label>
                  <template v-if="s.kanaal !== 'bellen'">
                    <label v-if="s.kanaal === 'mail'" class="veld"><span class="veld-label">Onderwerp van de mail</span><input v-model="s.onderwerp" class="invoer" maxlength="120" placeholder="Leeg: de Schrijver kiest"></label>
                    <label class="veld"><span class="veld-label">Instructie voor de Schrijver</span><textarea v-model="s.instructie" class="invoer" rows="2" maxlength="600" placeholder="Bijvoorbeeld: noem het winpunt en een praktijkvoorbeeld uit dezelfde branche" :data-test="`rsj-instructie-${Number(i) + 1}`" /></label>
                  </template>
                  <p v-else class="meta">Een beltaak in het eerste vaste belblok van die dag.</p>
                </li>
              </ol>
              <button type="button" class="dd-act mt-8" data-test="rsj-stap-erbij" @click="voegStapToe"><Icoon naam="Plus" :grootte="14" />Stap toevoegen</button>
              <div class="formulier-raster mt-16">
                <label class="veld"><span class="veld-label">Einde op dag</span><input v-model.number="bewerk.einde.dag" type="number" min="1" max="120" class="invoer tnum" data-test="rsj-einde-dag"></label>
                <label class="veld"><span class="veld-label">Daarna het ritme na (dagen)</span><input v-model.number="bewerk.einde.wachtDagen" type="number" min="1" max="365" class="invoer tnum"></label>
              </div>
            </article>
            <article class="fo-blok">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Stopregels</h3></header>
              <p v-for="r in STOPREGELS" :key="r" class="schakel-rij"><span>{{ STOPREGEL_LABEL[r] }}</span><Schakelaar :aan="bewerk.stopregels[r] !== false" :label="STOPREGEL_LABEL[r]" @wissel="bewerk.stopregels[r] = $event" /></p>
              <p class="meta">Een afmelding voor mail stopt de reeks altijd. Na een reactie of een afspraak komt er een taak: bel terug binnen twee uur.</p>
            </article>
            <ul v-if="fouten.length" class="fo-fout rsj-fouten" data-test="rsj-fouten"><li v-for="f in fouten" :key="f">{{ f }}</li></ul>
          </div>
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
          <button type="submit" form="rsj-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !!fouten.length" data-test="rsj-bewaar"><Icoon naam="Check" :grootte="16" />Bewaar</button>
          <span class="fo-foot-vul" />
        </footer>
        </template>
      </FlyoutShell>
  </div>
</template>

<style scoped>
.rsj-knoppen { display: flex; align-items: center; gap: 10px; }
.rsj-pillen { display: flex; flex-wrap: wrap; gap: 8px; }
.rsj-stappen { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.rsj-stap { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); }
.rsj-stap-kop { display: grid; grid-template-columns: 36px 90px minmax(0, 1fr) auto; align-items: end; gap: 10px; }
.rsj-weg { align-self: end; }
.rsj-fouten { margin: 0; padding-left: 20px; }
@media (max-width: 719px) {
  .rsj-stap-kop { grid-template-columns: 70px minmax(0, 1fr) auto; }
  .rsj-stap-kop .item-icoon { display: none; }
  .rsj-knoppen .dd-act { min-height: var(--touch-target-min); }
}
</style>
