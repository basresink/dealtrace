<script setup lang="ts">
// Richting (F25, mockup "Richting verbeterd"): de SalesDNA van de organisatie voor iedereen, alleen
// bevestigde inhoud. Een donkere kop "Waar we voor staan" (kernzin, belofte, vier kerncijfers en de
// voetregel), dan zeven tabbladen met teller die bovenaan plakken en met de pijltjestoetsen werken.
// Elk tabblad opent met zijn status en het blok "Waarom dit ertoe doet". Download concurrentiekaart
// vanaf Gevorderd, Stel voor bij Expert; inrichten doet de beheerder of salesmanager in Instellingen.
import { kernzin as eersteZin } from '~~/shared/verkoopverhaal'
import { CONCURRENT_FILTERS, RICHTING_TABS, RICHTING_TEKST, bevestigdStand, doelVoortgang, eenheidTekst, kerncijfers, type RichtingTab } from '~~/shared/richting'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const { data } = await useFetch<any>('/api/richting', { default: () => null })

const tab = computed(() => RICHTING_TABS.find((t) => t.k === route.query.tab) ?? RICHTING_TABS[0]!)
const st = computed(() => data.value?.status?.[tab.value.o] ?? null)
const stand = computed(() => data.value?.stand ?? {})
const tekst = (sleutel: string, br: string | null = null) => (stand.value.teksten ?? []).find((t: any) => t.sleutel === sleutel && (t.brancheId ?? null) === br)?.tekst ?? null
const algemeen = computed(() => (stand.value.teksten ?? []).find((t: any) => t.sleutel === 'bedrijfsverhaal' && !t.brancheId) ?? null)
const kernzin = computed(() => (algemeen.value ? algemeen.value.kernzin || eersteZin(algemeen.value.tekst) : null))
/** Het verhaal na de kernzin; staat de kernzin niet vooraan, dan het hele verhaal. */
const restVerhaal = computed(() => {
  const t: string = algemeen.value?.tekst ?? ''
  const k = kernzin.value ?? ''
  return k && t.startsWith(k) ? t.slice(k.length).trim() : t
})
const kernzinVooraan = computed(() => !!kernzin.value && (algemeen.value?.tekst ?? '').startsWith(kernzin.value))
const branches = computed(() => (data.value?.branches ?? []) as any[])
const concurrenten = computed(() => (stand.value.concurrenten ?? []) as any[])
const fasen = computed(() => (stand.value.fasen ?? []) as any[])
const winpunten = computed(() => ((stand.value.winpunten ?? []) as any[]).filter((w) => w.actief))
const winpuntenIn = (f: string) => winpunten.value.filter((w) => w.faseId === f)
const regels = computed(() => (stand.value.terugkomregels ?? []) as any[])
const cijfers = computed(() => kerncijfers(stand.value))
const bevestigd = computed(() => bevestigdStand(data.value?.status))
const doelJaar = computed(() => (stand.value.ambitiedoelen ?? []).map((d: any) => d.jaar).filter(Boolean).sort().at(-1) ?? null)
const tellers = computed<Record<RichtingTab, number | null>>(() => ({
  verhaal: null, richting: null, belofte: null, branches: branches.value.length, concurrenten: concurrenten.value.length, winpunten: winpunten.value.length, terugkomen: regels.value.length,
}))

// Tabbladen: klik of pijltjes (links, rechts, Home, End); de keuze staat in de URL.
function kies(k: RichtingTab, focus = false) {
  router.replace({ query: { ...route.query, tab: k === 'verhaal' ? undefined : k } })
  if (focus) nextTick(() => document.getElementById(`ri-tab-${k}`)?.focus())
}
function toets(e: KeyboardEvent) {
  const doel = (e.target as HTMLElement | null)?.id?.replace('ri-tab-', '')
  const i = Math.max(0, RICHTING_TABS.findIndex((t) => t.k === (doel || tab.value.k)))
  const n = RICHTING_TABS.length
  const naar = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
  if (naar < 0) return
  e.preventDefault()
  kies(RICHTING_TABS[naar]!.k, true)
}

// Concurrenten: filter per soort.
const soort = ref<string>('alle')
const zichtbareConcurrenten = computed(() => concurrenten.value.filter((c) => soort.value === 'alle' || (c.soortSleutel ?? c.soort) === soort.value))
const telSoort = (k: string) => (k === 'alle' ? concurrenten.value.length : concurrenten.value.filter((c) => (c.soortSleutel ?? c.soort) === k).length)

// Expert: een voorstel naar de salesmanager.
const voorstel = ref<{ onderdeel: string; ref: string; titel: string } | null>(null)
const voorstelTekst = ref('')
async function stuurVoorstel() {
  try { await $fetch('/api/richting/voorstel', { method: 'POST', body: { onderdeel: voorstel.value!.onderdeel, ref: voorstel.value!.ref, soort: 'tekst', tekst: voorstelTekst.value } }); toast.toon('Je voorstel staat bij je salesmanager.'); voorstel.value = null; voorstelTekst.value = '' } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const datum = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(d)) : '')
const prio = (p: string | null | undefined) => (p === 'hoog' || p === 'midden' || p === 'laag' ? `prio-${p}` : null)
useHead({ title: 'Richting · Dealtrace' })
</script>

<template>
  <div v-if="data">
    <PaginaKop :kicker="RICHTING_TEKST.kicker" :titel="RICHTING_TEKST.titel" helpartikel="richting">
      <template #acties>
        <span class="pil pil--leeg vv-bron" data-test="vv-bron" title="Waar het verhaal vandaan komt">{{ data.bron === 'salesdna' ? `Uit SalesDNA${data.bronBijgewerkt ? ` · bijgewerkt ${datum(data.bronBijgewerkt)}` : ''}` : 'Eigen inrichting' }}</span>
        <span v-if="data.kan.inrichten && st?.bron === 'salesdna'" class="meta vv-bron" data-test="wijzig-in-salesdna">Wijzigen doe je in SalesDNA</span>
        <FunctieLink v-else-if="data.kan.inrichten" class="dd-act" to="/instellingen/verkoopverhaal" data-test="inrichten">Inrichten</FunctieLink>
      </template>
    </PaginaKop>
    <section class="section section--laatste ri-pagina">
      <div class="container">
        <LegeStaat v-if="data.leeg" :titel="RICHTING_TEKST.leeg" :tekst="data.kan.inrichten ? 'Klik Inrichten om te beginnen.' : 'Je beheerder richt het in.'" data-test="vv-leeg" />
        <template v-else>
          <RichtingHeld :kernzin="kernzin" :belofte="tekst('kernbelofte')" :cijfers="cijfers" :bevestigd="bevestigd" />

          <div class="ri-tabs" data-test="ri-tabs">
            <div class="tabbalk tabbalk--schuif ri-tabbalk" role="tablist" aria-label="Onderdelen" @keydown="toets">
              <button
                v-for="t in RICHTING_TABS" :id="`ri-tab-${t.k}`" :key="t.k" type="button" role="tab" class="tab" :class="{ 'tab--actief': tab.k === t.k }"
                :aria-selected="tab.k === t.k" :tabindex="tab.k === t.k ? 0 : -1" aria-controls="ri-paneel" :data-test="`tab-${t.k}`" @click="kies(t.k)"
              >
                {{ t.t }}<span v-if="tellers[t.k] != null" class="tab-teller ri-teller">{{ tellers[t.k] }}</span>
              </button>
            </div>
          </div>

          <section id="ri-paneel" class="ri-paneel" role="tabpanel" :aria-labelledby="`ri-tab-${tab.k}`" tabindex="-1">
            <RichtingPaneelKop :kicker="tab.t" :titel="tab.titel" :waarom="tab.waarom" :st="st" />

            <!-- Verhaal -->
            <div v-if="tab.k === 'verhaal'" data-test="vv-verhaal">
              <div class="ri-verhaal-raster">
                <article class="kaart">
                  <span class="ri-label">Het hele verhaal</span>
                  <p v-if="algemeen" class="ri-leestekst mt-8"><mark v-if="kernzinVooraan" class="ri-mark" data-test="kernzin">{{ kernzin }}</mark> {{ restVerhaal }}</p>
                  <p v-if="algemeen && !kernzinVooraan && kernzin" class="ri-leestekst mt-8"><mark class="ri-mark" data-test="kernzin">{{ kernzin }}</mark></p>
                  <p v-if="algemeen" class="meta mt-16">{{ RICHTING_TEKST.kernzinUitleg }}</p>
                  <p v-else class="meta mt-8">Nog geen algemeen verhaal bevestigd.</p>
                </article>
                <aside class="kaart" aria-labelledby="ri-perbranche">
                  <div class="kaart-kop"><h3 id="ri-perbranche" class="kaart-titel">Per branche</h3><span class="meta tnum" data-test="dekking-verhaal">{{ data.dekking.verhaal.met }} van {{ data.dekking.verhaal.totaal }} met een eigen verhaal</span></div>
                  <div class="ri-dekking" aria-hidden="true"><span v-for="b in branches" :key="b.id" :class="{ aan: !!tekst('verhaal', b.id) }" /></div>
                  <ul class="ri-branchelijst">
                    <li v-for="b in branches" :key="b.id" :data-branche="b.id">
                      <h4 class="ri-branche-naam">{{ b.naam }}<Label v-if="!tekst('verhaal', b.id)" soort="richting" waarde="algemeen" /></h4>
                      <p v-if="tekst('verhaal', b.id)">{{ tekst('verhaal', b.id) }}</p>
                      <p v-else class="ri-gat" data-test="gat">{{ RICHTING_TEKST.geenBrancheVerhaal }}</p>
                    </li>
                  </ul>
                </aside>
              </div>
              <div v-if="data.golden.waarom" class="kaart mt-16"><h3 class="kaart-titel">Waarom, hoe, wat</h3><dl class="gegevens mt-8"><dt>Waarom</dt><dd>{{ data.golden.waarom }}</dd><dt>Hoe</dt><dd>{{ data.golden.hoe }}</dd><template v-if="data.golden.wat"><dt>Wat</dt><dd>{{ data.golden.wat }}</dd></template></dl></div>
            </div>

            <!-- Richting -->
            <div v-else-if="tab.k === 'richting'" data-test="vv-richting">
              <div class="ri-raster-3 ri-koers mt-24">
                <article class="kaart"><h3 class="kaart-titel">Ambitie</h3><p class="ri-vraag">{{ doelJaar ? `Waar staan we in ${doelJaar}` : 'Waar we heen willen' }}</p><p class="ri-koers-tekst">{{ tekst('ambitie') ?? 'Nog niet vastgelegd.' }}</p></article>
                <article class="kaart"><h3 class="kaart-titel">Visie</h3><p class="ri-vraag">Wat er verandert in de markt</p><p class="ri-koers-tekst">{{ tekst('visie') ?? 'Nog niet vastgelegd.' }}</p></article>
                <article class="kaart"><h3 class="kaart-titel">Missie</h3><p class="ri-vraag">Wat we elke dag doen</p><p class="ri-koers-tekst">{{ tekst('missie') ?? 'Nog niet vastgelegd.' }}</p></article>
              </div>
              <template v-if="(stand.ambitiedoelen ?? []).length">
                <h3 class="ri-subkop mt-24">Ambitiedoelen</h3>
                <div class="ri-raster-2 mt-16">
                  <article v-for="d in stand.ambitiedoelen" :key="d.id" class="kaart ri-doel" data-test="ambitiedoel">
                    <div class="ri-doel-kop">
                      <div><span class="ri-label">{{ d.naam }}</span>
                        <p class="ri-doel-cijfer tnum mt-8">{{ d.stand == null ? 'Nog geen stand' : `${d.stand}${eenheidTekst(d.eenheid)}` }} <small>van {{ d.doel }}{{ eenheidTekst(d.eenheid) }}</small></p></div>
                      <span v-if="d.jaar" class="meta">doel {{ d.jaar }}</span>
                    </div>
                    <div class="ri-balk" role="img" :aria-label="doelVoortgang(d) == null ? 'Nog geen stand' : `${doelVoortgang(d)} procent van het doel`"><span :style="{ width: `${doelVoortgang(d) ?? 0}%` }" /></div>
                  </article>
                </div>
              </template>
            </div>

            <!-- Belofte -->
            <div v-else-if="tab.k === 'belofte'" data-test="vv-belofte">
              <div class="ri-belofte">
                <div><span class="ri-label">Kernbelofte</span><blockquote class="ri-citaat" data-test="kernbelofte">{{ tekst('kernbelofte') ?? 'Nog niet vastgelegd.' }}</blockquote></div>
                <div><span class="ri-label">Als de prospect doorvraagt</span><p class="ri-leestekst ri-leestekst--klein mt-8">{{ tekst('waardestatement') ?? 'Nog niet vastgelegd.' }}</p></div>
              </div>
              <div class="kaart-kop mt-24 ri-kop-rij"><h3 class="ri-subkop">Per branche</h3><span class="meta tnum" data-test="dekking-belofte">{{ data.dekking.belofte.met }} van {{ data.dekking.belofte.totaal }} branches hebben een eigen belofte</span></div>
              <div class="tabel-wrap ri-tabel-wrap">
                <table class="ri-tabel">
                  <thead><tr><th scope="col">Branche</th><th scope="col">Belofte</th><th scope="col">Als de prospect doorvraagt</th></tr></thead>
                  <tbody>
                    <tr v-for="b in branches" :key="b.id" :data-branche="b.id">
                      <th scope="row">{{ b.naam }}</th>
                      <td><template v-if="tekst('kernbelofte', b.id)">{{ tekst('kernbelofte', b.id) }}</template><span v-else class="ri-gat">{{ RICHTING_TEKST.geenBrancheBelofte }}</span></td>
                      <td><template v-if="tekst('kernbelofte', b.id) && tekst('waardestatement', b.id)">{{ tekst('waardestatement', b.id) }}</template><span v-else class="meta">Zie hierboven.</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Branches -->
            <div v-else-if="tab.k === 'branches'" data-test="vv-branches">
              <div class="kaart ri-branches mt-24">
                <div v-for="b in branches" :key="b.id" class="ri-brancherij" :data-branche="b.id">
                  <div class="ri-brancherij-naam">
                    <h3 class="kaart-titel">{{ b.naam }}</h3>
                    <div class="pil-tags ri-tags">
                      <Label soort="richting" :waarde="b.focus === 'primair' ? 'primair' : 'secundair'" :tekst="b.focus === 'primair' ? 'Primair' : 'Secundair'" />
                      <Label soort="richting" waarde="horizon" :tekst="`${b.horizon === 'toekomstig' ? 'Toekomstig' : 'Huidig'} · ${b.termijn || 'nu'}`" />
                      <Label v-if="prio(b.prioriteit)" soort="richting" :waarde="prio(b.prioriteit)" />
                    </div>
                  </div>
                  <div class="ri-cijfer"><strong class="tnum">{{ b.accounts }}</strong><span class="meta">accounts</span></div>
                  <div class="ri-aandeel">
                    <span class="meta">Gesprekken dit kwartaal</span>
                    <div class="ri-balk mt-8" role="img" :aria-label="b.aandeelGesprekken == null ? 'Nog geen gesprekken' : `${b.aandeelGesprekken} procent van de gesprekken`"><span :style="{ width: `${b.aandeelGesprekken ?? 0}%` }" /></div>
                    <span class="meta tnum">{{ b.aandeelGesprekken == null ? 'Nog geen gesprekken dit kwartaal' : `${b.aandeelGesprekken}% van alle gesprekken` }}</span>
                  </div>
                </div>
                <p v-if="!branches.length" class="meta ri-leeg-rij">Nog geen bevestigde branches.</p>
              </div>
            </div>

            <!-- Concurrenten -->
            <div v-else-if="tab.k === 'concurrenten'" data-test="vv-concurrenten">
              <div class="ri-filterrij">
                <div class="ri-filters" role="group" aria-label="Filter op soort">
                  <button
                    v-for="f in CONCURRENT_FILTERS" v-show="f.k === 'alle' || telSoort(f.k)" :key="f.k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': soort === f.k }"
                    :aria-pressed="soort === f.k" :data-test="`ri-soort-${f.k}`" @click="soort = f.k"
                  >{{ f.t }} <span class="pil-teller">{{ telSoort(f.k) }}</span></button>
                </div>
                <a v-if="data.kan.concurrentiekaart" class="dd-act" href="/api/richting/concurrentiekaart" target="_blank" data-test="concurrentiekaart"><Icoon naam="Download" :grootte="14" />Download concurrentiekaart</a>
              </div>
              <RichtingConcurrent v-for="c in zichtbareConcurrenten" :key="c.id" :c="c" :voorstellen="!!data.kan.voorstellen" class="mt-16" @voorstel="voorstel = { onderdeel: 'concurrenten', ref: c.id, titel: c.naam }" />
              <p v-if="!concurrenten.length" class="meta mt-16">Nog geen bevestigde concurrenten.</p>
            </div>

            <!-- Winpunten -->
            <div v-else-if="tab.k === 'winpunten'" data-test="vv-winpunten">
              <div class="ri-reis">
                <section v-for="(f, i) in fasen" :key="f.id" class="ri-fase" :class="{ 'ri-fase--met': winpuntenIn(f.id).length }" :data-fase="f.id" :aria-labelledby="`ri-f-${f.id}`">
                  <div class="ri-fase-kop"><span class="ri-fase-nr tnum" aria-hidden="true">{{ i + 1 }}</span><h3 :id="`ri-f-${f.id}`" class="ri-fase-naam">{{ f.naam }}</h3></div>
                  <article v-for="w in winpuntenIn(f.id)" :key="w.id" class="ri-wp" :data-winpunt="w.id">
                    <div class="pil-tags ri-tags ri-tags--boven">
                      <Label soort="richting" :waarde="`impact-${w.impact ?? 'midden'}`" />
                      <Label v-if="w.onderNorm" soort="richting" waarde="onder-norm" />
                    </div>
                    <h4 class="ri-wp-titel">{{ w.titel }}</h4>
                    <p class="ri-wp-tekst">{{ w.omschrijving }}</p>
                    <p v-if="w.waarom" class="ri-wp-waarom"><strong>Waarom wij hier winnen:</strong> {{ w.waarom }}</p>
                    <p v-if="w.onderNorm" class="meta mt-8">Klantfeedback onder de norm; komt niet als eerste winpunt.</p>
                    <button v-if="data.kan.voorstellen" type="button" class="dd-act mt-8" data-test="stel-voor" @click="voorstel = { onderdeel: 'winpunten', ref: w.id, titel: w.titel }"><Icoon naam="Pencil" :grootte="14" />Stel voor</button>
                  </article>
                  <p v-if="!winpuntenIn(f.id).length" class="ri-leegfase" data-test="gat">Geen winpunt in {{ f.naam }}. Hier zit nog een gat in het verhaal.</p>
                </section>
              </div>
              <p v-if="!fasen.length" class="meta mt-16">Nog geen fasen bevestigd.</p>
            </div>

            <!-- Terugkomen -->
            <div v-else data-test="vv-terugkomen">
              <RichtingTerugkomen :regels="regels" :ritmes="data.ritmes ?? []" />
            </div>
          </section>
        </template>
      </div>
    </section>
    <FlyoutShell v-if="voorstel" open titel-id="fs-richting0" breedte="smal" data-test="voorstel-flyout" @sluit="voorstel = null">
      <template #kop><span class="fo-kicker">Stel voor</span><h2 id="fs-richting0" class="fo-titel">{{ voorstel.titel }}</h2></template>
      <form id="rv-form" class="fs-form" @submit.prevent="stuurVoorstel">
        <div class="fo-body fo-body--formulier">
          <label class="veld"><span class="veld-label">Je voorstel (antwoord, bezwaar, bewijs of winpunt per branche)</span><textarea v-model="voorstelTekst" class="invoer" rows="4" required data-test="voorstel-tekst" /></label>
          <p class="meta mt-8">Je voorstel gaat naar je salesmanager. Die beoordeelt het in Instellingen.</p>
        </div>
      </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="rv-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!voorstelTekst.trim()" data-test="voorstel-stuur"><Icoon naam="Check" :grootte="16" />Stuur naar je salesmanager</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
  </div>
</template>

<style scoped>
/* De bronpil staat midden op de hoogte van de knoppen in de kop (B22). */
.vv-bron { align-self: center; }
.ri-pagina { padding-top: 0; }

/* Tabbladen: plakken bovenaan (op de telefoon onder de mobiele kop). */
.ri-tabs { position: sticky; top: 0; z-index: var(--z-sticky); margin-top: 24px; background: var(--bg); }
.ri-tabbalk { position: static; background: var(--bg); column-gap: 4px; }
.ri-tabbalk .tab { padding: 12px 10px; font-size: var(--fs-body); }
.ri-teller { min-width: 18px; text-align: center; }
.tab--actief .ri-teller { background: var(--ink); color: var(--yellow); }
@media (max-width: 767px) { .ri-tabs { top: var(--kop-h); } }

.ri-paneel { padding: 24px 0 32px; outline: none; }
.ri-label { display: block; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.ri-subkop { margin: 0; font-family: var(--font-serif); font-size: 20px; font-weight: 700; color: var(--ink); }
.ri-leestekst { margin: 0; font-size: var(--fs-lees); line-height: 1.65; max-width: 70ch; color: var(--ink); }
.ri-leestekst--klein { font-size: 15px; }
.ri-mark { background: var(--yellow-licht); color: var(--ink); padding: 0 2px; box-shadow: inset 0 -2px 0 var(--yellow); }
.ri-gat { color: var(--muted); font-style: italic; }

/* Verhaal */
.ri-verhaal-raster { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; margin-top: 20px; align-items: start; }
.ri-dekking { display: flex; gap: 4px; margin-top: 10px; }
.ri-dekking span { flex: 1; height: 6px; border-radius: 1px; background: var(--border); }
.ri-dekking span.aan { background: var(--yellow); }
.ri-branchelijst { list-style: none; margin: 14px 0 0; padding: 0; }
.ri-branchelijst li { padding: 12px 0; border-top: 1px solid var(--border); }
.ri-branchelijst p { margin: 4px 0 0; font-size: var(--fs-klein); line-height: 1.5; }
.ri-branche-naam { margin: 0; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--ink); }

/* Richting */
.ri-raster-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.ri-raster-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ri-koers .kaart { position: relative; padding-top: 24px; }
.ri-koers .kaart::before { content: ''; position: absolute; left: 24px; top: 0; width: 32px; height: 3px; background: var(--yellow); }
.ri-vraag { margin: 2px 0 0; font-size: var(--fs-meta); color: var(--muted); }
.ri-koers-tekst { margin: 10px 0 0; font-size: 15px; line-height: 1.55; color: var(--ink); }
.ri-doel-kop { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: space-between; align-items: flex-end; }
.ri-doel-cijfer { margin-bottom: 0; font-family: var(--font-serif); font-size: 34px; font-weight: 700; line-height: 1; color: var(--ink); }
.ri-doel-cijfer small { font-family: var(--font-sans); font-size: var(--fs-body); font-weight: 400; color: var(--muted); }
.ri-balk { height: 8px; margin-top: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
.ri-balk span { display: block; height: 100%; background: var(--yellow); }

/* Belofte */
.ri-belofte { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 20px; background: var(--wit); border: 1px solid var(--border); border-radius: 3px; }
.ri-belofte > div { padding: 24px; min-width: 0; }
.ri-belofte > div + div { border-left: 1px solid var(--border); background: var(--surface); }
.ri-citaat { margin: 10px 0 0; padding-left: 16px; border-left: 4px solid var(--yellow); font-family: var(--font-serif); font-size: clamp(22px, 3vw, 30px); font-weight: 700; line-height: 1.25; color: var(--ink); }
.ri-kop-rij { flex-wrap: wrap; align-items: baseline; }
.ri-tabel-wrap { margin-top: 8px; overflow-x: auto; background: var(--wit); border: 1px solid var(--border); border-radius: 3px; }
.ri-tabel { width: 100%; border-collapse: collapse; font-size: var(--fs-klein); }
.ri-tabel thead th { padding: 10px 14px; text-align: left; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); background: var(--surface); border-bottom: 1px solid var(--border); white-space: nowrap; }
.ri-tabel tbody th, .ri-tabel td { padding: 12px 14px; text-align: left; vertical-align: top; border-top: 1px solid var(--border); line-height: 1.5; }
.ri-tabel tbody tr:first-child th, .ri-tabel tbody tr:first-child td { border-top: 0; }
.ri-tabel tbody th { min-width: 160px; font-size: var(--fs-body); font-weight: 700; color: var(--ink); }
.ri-tabel td { min-width: 200px; color: var(--ink); }

/* Branches */
.ri-branches { padding: 0; }
.ri-brancherij { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.6fr) minmax(0, 1.2fr); gap: 12px 24px; align-items: center; padding: 16px 20px; border-top: 1px solid var(--border); }
.ri-brancherij:first-child { border-top: 0; }
.ri-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ri-tags--boven { margin: 0 0 6px; }
.ri-cijfer strong { display: block; font-family: var(--font-serif); font-size: 22px; line-height: 1.1; color: var(--ink); }
.ri-aandeel { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ri-aandeel .ri-balk { margin: 4px 0; }
.ri-leeg-rij { padding: 16px 20px; margin: 0; }

/* Concurrenten */
.ri-filterrij { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; justify-content: space-between; margin-top: 20px; }
.ri-filters { display: flex; flex-wrap: wrap; gap: 6px; }

/* Winpunten */
.ri-reis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: 20px; background: var(--wit); border: 1px solid var(--border); border-radius: 3px; }
.ri-fase { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 16px; border-left: 1px solid var(--border); }
.ri-fase:first-child { border-left: 0; }
.ri-fase-kop { display: flex; align-items: center; gap: 8px; }
.ri-fase-nr { display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border-strong); font-size: var(--fs-meta); font-weight: 700; color: var(--ink); }
.ri-fase--met .ri-fase-nr { background: var(--yellow); border-color: var(--yellow); }
.ri-fase-naam { margin: 0; min-width: 0; font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); }
.ri-wp { padding: 12px; background: var(--bg); border: 1px solid var(--border); border-top: 3px solid var(--yellow); border-radius: 2px; }
.ri-wp-titel { margin: 0; font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--ink); }
.ri-wp-tekst { margin: 6px 0 0; font-size: var(--fs-klein); line-height: 1.5; }
.ri-wp-waarom { margin: 8px 0 0; padding-top: 8px; border-top: 1px dashed var(--border-strong); font-size: var(--fs-klein); line-height: 1.5; }
.ri-leegfase { margin: 0; padding: 12px; border: 1px dashed var(--border-strong); border-radius: 2px; font-size: var(--fs-klein); color: var(--muted); }

@media (max-width: 1100px) {
  .ri-reis { grid-template-columns: minmax(0, 1fr); }
  .ri-fase { border-left: 0; border-top: 1px solid var(--border); }
  .ri-fase:first-child { border-top: 0; }
}
@media (max-width: 1000px) { .ri-verhaal-raster { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 900px) { .ri-raster-3 { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 800px) {
  .ri-belofte { grid-template-columns: minmax(0, 1fr); }
  .ri-belofte > div { padding: 18px 16px; }
  .ri-belofte > div + div { border-left: 0; border-top: 1px solid var(--border); }
  .ri-brancherij { grid-template-columns: minmax(0, 1fr); padding: 14px 16px; }
}
@media (max-width: 719px) { .ri-raster-2 { grid-template-columns: minmax(0, 1fr); } }
</style>
