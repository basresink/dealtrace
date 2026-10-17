<script setup lang="ts">
// Persoonlijke weekreview (F10): vier kaarten om door te vegen (telefoon) of door te stappen (laptop).
// 1 Wat bewoog: cijfers tegen je eigen gemiddelde van acht weken. 2 Wat werkte: beste belmoment en het
// winpunt dat raakte, alleen bij genoeg gesprekken. 3 Wat bleef liggen: taken die drie keer of vaker
// doorschoven, elk met Plan in, Draag over of Laat los met een reden. 4 Volgende week: hooguit drie
// voornemens die meteen een belblok, taak of regiodag worden, optioneel gedeeld met je manager.
// Onder de kaarten Tips en tricks en drie artikelen uit de academie om van je week te leren (RitmeSteun).
// Eén bron: GET /api/weekreview (pure kern shared/weekreview.ts; steun uit shared/ritmeSteun.ts).
const { functie } = useMe()
const aan = !!functie('dagritme.weekreview')?.beschikbaar
const toast = useToast()
const route = useRoute()
const { data: r, refresh } = await useFetch<any>('/api/weekreview', { query: computed(() => ({ week: route.query.week || undefined })), immediate: aan, default: () => null })

const KAARTEN = ['Wat bewoog', 'Wat werkte', 'Wat bleef liggen', 'Volgende week'] as const
const nu = ref(0)
const baan = ref<HTMLElement | null>(null)
function ga(i: number) {
  nu.value = Math.max(0, Math.min(3, i))
  const el = baan.value
  if (el) el.scrollTo({ left: el.clientWidth * nu.value, behavior: 'smooth' })
}
function opScroll() {
  const el = baan.value
  if (!el || !el.clientWidth) return
  nu.value = Math.max(0, Math.min(3, Math.round(el.scrollLeft / el.clientWidth)))
}

// Blijvers: per taak één open besluit tegelijk.
const keuze = reactive<{ taakId: string | null; besluit: 'inplannen' | 'overdragen' | 'loslaten' | null; datum: string; naar: string; reden: string }>({ taakId: null, besluit: null, datum: '', naar: '', reden: '' })
function kies(taakId: string, besluit: 'inplannen' | 'overdragen' | 'loslaten') {
  Object.assign(keuze, { taakId, besluit, datum: r.value?.week?.volgende ?? '', naar: r.value?.collegas?.[0]?.id ?? '', reden: '' })
}
const bezig = ref(false)
async function bevestigBesluit() {
  if (!keuze.taakId || !keuze.besluit) return
  bezig.value = true
  try {
    await $fetch('/api/weekreview/blijver', { method: 'POST', body: { week: r.value.week.van, taakId: keuze.taakId, besluit: keuze.besluit, datum: keuze.datum, naar: keuze.naar, reden: keuze.reden } })
    toast.toon(keuze.besluit === 'inplannen' ? 'Ingepland.' : keuze.besluit === 'overdragen' ? 'Overgedragen.' : 'Losgelaten met je reden.')
    Object.assign(keuze, { taakId: null, besluit: null })
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const besluitTekst = (b: any) => {
  if (!b) return ''
  if (b.besluit === 'inplannen') return `Ingepland op ${datumKort(b.datum)}`
  if (b.besluit === 'overdragen') return `Overgedragen aan ${b.naarNaam ?? 'een collega'}`
  return `Losgelaten: ${b.reden}`
}
const datumKort = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '')

// Voornemens: hooguit drie; voorstellen plus eigen voornemens (die worden een taak).
const gekozen = ref<Set<string>>(new Set())
const eigen = ref<{ sleutel: string; tekst: string }[]>([])
const eigenTekst = ref('')
const delen = ref(false)
watch(r, (x) => {
  if (!x) return
  gekozen.value = new Set((x.volgende?.voorstellen ?? []).filter((v: any) => v.gekozen).map((v: any) => v.sleutel))
  delen.value = !!x.deelStandaard && !!x.manager
}, { immediate: true })
const aantal = computed(() => gekozen.value.size)
function wissel(sleutel: string) {
  const s = new Set(gekozen.value)
  if (s.has(sleutel)) s.delete(sleutel)
  else if (s.size >= 3) { toast.toon('Hooguit drie voornemens.', 'fout'); return } else s.add(sleutel)
  gekozen.value = s
}
function voegEigenToe() {
  const t = eigenTekst.value.trim()
  if (!t) return
  if (gekozen.value.size >= 3) { toast.toon('Hooguit drie voornemens.', 'fout'); return }
  const sleutel = `eigen:${Date.now()}`
  eigen.value.push({ sleutel, tekst: t })
  gekozen.value = new Set([...gekozen.value, sleutel])
  eigenTekst.value = ''
}
async function zetIn() {
  const voorstellen = (r.value?.volgende?.voorstellen ?? []).filter((v: any) => gekozen.value.has(v.sleutel)).map((v: any) => ({ soort: v.soort, tekst: v.tekst, data: v.data }))
  const eigenLijst = eigen.value.filter((v) => gekozen.value.has(v.sleutel)).map((v) => ({ soort: 'taak', tekst: v.tekst, data: { titel: v.tekst } }))
  const voornemens = [...voorstellen, ...eigenLijst]
  if (!voornemens.length) { toast.toon('Kies minstens één voornemen.', 'fout'); return }
  bezig.value = true
  try {
    const uit = await $fetch<any>('/api/weekreview/voornemens', { method: 'POST', body: { week: r.value.week.van, voornemens, delen: delen.value } })
    toast.toon(`${uit.voornemens.length === 1 ? '1 voornemen staat' : `${uit.voornemens.length} voornemens staan`} in volgende week${uit.gedeeldMet ? `, gedeeld met ${uit.gedeeldMet}` : ''}.`)
    eigen.value = []
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function kiesOpnieuw() {
  try { await $fetch('/api/weekreview/voornemens', { method: 'DELETE', query: { week: r.value.week.van } }); toast.toon('Je kiest opnieuw; wat ze werden is weer uit je agenda.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verzet() {
  try { await $fetch('/api/weekreview/verzet', { method: 'POST', body: { week: r.value.week.van } }); toast.toon('Verzet naar maandagochtend.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const managerNaam = computed(() => r.value?.manager?.naam?.replace(/^Testgebruiker /, '').split(' ')[0] ?? '')
const SOORT_ICOON: Record<string, string> = { belblok: 'Phone', taak: 'SquareCheck', regiodag: 'MapPin' }
useHead({ title: 'Weekreview · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="dagritme.weekreview" />
    <template v-else-if="r">
      <PaginaKop :kicker="`Mijn dashboard · Weekreview · week ${r.week.nummer}`" :titel="r.titel" :uitleg="r.moment" helpartikel="weekreview">
        <template #acties>
          <button v-if="!r.verzet && !r.afgerondOp && !r.volgende.ingepland.length" type="button" class="dd-actie dd-actie--secundair" data-test="wr-verzet" @click="verzet"><Icoon naam="Clock" class="dd-actie-icoon" />Verzet naar maandag</button>
          <NuxtLink to="/weekstart" class="dd-actie dd-actie--secundair" data-test="wr-naar-weekstart"><Icoon naam="CalendarRange" class="dd-actie-icoon" />Weekstart</NuxtLink>
        </template>
      </PaginaKop>

      <section class="section">
        <div class="container wr">
          <aside v-if="r.lopend.length" class="kaart wr-lopend" data-test="wr-lopend">
            <span class="kicker">Vorige week beloofd</span>
            <ul class="wr-lijst"><li v-for="v in r.lopend" :key="v.tekst"><span>{{ v.tekst }}</span><span class="pil" :class="v.stand.klaar ? 'pil--groen' : 'pil--grijs'">{{ v.stand.tekst }}</span></li></ul>
          </aside>

          <nav class="wr-stappen" aria-label="Kaarten van de weekreview">
            <button v-for="(k, i) in KAARTEN" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': nu === i }" :aria-current="nu === i ? 'step' : undefined" :data-test="`wr-stap-${i}`" @click="ga(i)">{{ i + 1 }} · {{ k }}</button>
          </nav>

          <div ref="baan" class="wr-baan" data-test="wr-baan" @scroll.passive="opScroll">
            <!-- 1 Wat bewoog -->
            <article class="kaart wr-kaart" data-test="wr-kaart-0" :aria-hidden="nu !== 0">
              <span class="kicker">1 van 4 · Wat bewoog</span>
              <h2 class="wr-kop" data-test="wr-kop-bewoog">{{ r.bewoog.kop }}</h2>
              <div class="wr-cijfers">
                <div v-for="c in r.bewoog.cijfers" :key="c.sleutel" class="wr-cijfer" :data-test="`wr-cijfer-${c.sleutel}`">
                  <span class="wr-cijfer-label">{{ c.label }}</span>
                  <span class="wr-cijfer-n tnum">{{ c.waarde }}{{ c.eenheid }}</span>
                  <span class="wr-cijfer-meta" :class="{ 'wr-pos': c.richting === 'hoger', 'wr-neg': c.richting === 'lager' }">{{ c.tekst }}</span>
                </div>
              </div>
              <p v-if="r.bewoog.melding" class="wr-melding" data-test="wr-te-weinig">{{ r.bewoog.melding }}</p>
            </article>

            <!-- 2 Wat werkte -->
            <article class="kaart wr-kaart" data-test="wr-kaart-1" :aria-hidden="nu !== 1">
              <span class="kicker">2 van 4 · Wat werkte</span>
              <h2 class="wr-kop">{{ r.werkte.kop }}</h2>
              <div v-for="p in r.werkte.patronen" :key="p.soort" class="wr-patroon" :data-test="`wr-patroon-${p.soort}`">
                <b>{{ p.titel }}</b>
                <p>{{ p.tekst }}</p>
              </div>
              <p v-if="r.werkte.melding" class="wr-melding" data-test="wr-geen-patroon">{{ r.werkte.melding }}</p>
            </article>

            <!-- 3 Wat bleef liggen -->
            <article class="kaart wr-kaart" data-test="wr-kaart-2" :aria-hidden="nu !== 2">
              <span class="kicker">3 van 4 · Wat bleef liggen</span>
              <h2 class="wr-kop" data-test="wr-kop-liggen">{{ r.liggen.kop }}</h2>
              <ul v-if="r.liggen.blijvers.length" class="wr-blijvers">
                <li v-for="b in r.liggen.blijvers" :key="b.id" class="wr-blijver" :data-test="`wr-blijver-${b.id}`">
                  <div class="wr-blijver-kop">
                    <div class="item-body">
                      <p class="item-naam">{{ b.titel }}</p>
                      <span class="item-meta">{{ b.tekst }}<template v-if="b.accountNaam"> · {{ b.accountNaam }}</template></span>
                    </div>
                    <span v-if="b.besluit" class="pil pil--groen" data-test="wr-besluit">{{ besluitTekst(b.besluit) }}</span>
                    <div v-else class="wr-keuzes">
                      <button type="button" class="dd-act" :class="{ 'dd-act--primair': keuze.taakId === b.id && keuze.besluit === 'inplannen' }" data-test="wr-inplannen" @click="kies(b.id, 'inplannen')">Plan in</button>
                      <button v-if="b.keuzes.includes('overdragen')" type="button" class="dd-act" :class="{ 'dd-act--primair': keuze.taakId === b.id && keuze.besluit === 'overdragen' }" data-test="wr-overdragen" @click="kies(b.id, 'overdragen')">Draag over</button>
                      <button type="button" class="dd-act" :class="{ 'dd-act--primair': keuze.taakId === b.id && keuze.besluit === 'loslaten' }" data-test="wr-loslaten" @click="kies(b.id, 'loslaten')">Laat los</button>
                    </div>
                  </div>
                  <form v-if="keuze.taakId === b.id && !b.besluit" class="wr-besluit" @submit.prevent="bevestigBesluit">
                    <label v-if="keuze.besluit === 'inplannen'" class="veld"><span>Op welke dag?</span><input v-model="keuze.datum" type="date" required data-test="wr-datum"></label>
                    <label v-else-if="keuze.besluit === 'overdragen'" class="veld"><span>Aan wie?</span>
                      <select v-model="keuze.naar" required data-test="wr-naar"><option v-for="c in r.collegas" :key="c.id" :value="c.id">{{ c.naam }}</option></select>
                    </label>
                    <label v-else class="veld"><span>Waarom laat je hem los?</span><input v-model="keuze.reden" type="text" maxlength="200" required placeholder="Bijvoorbeeld: prospect koos een ander" data-test="wr-reden"></label>
                    <div class="wr-besluit-knoppen">
                      <button type="button" class="dd-act" @click="keuze.taakId = null">Annuleer</button>
                      <button type="submit" class="dd-act dd-act--geel" :disabled="bezig" data-test="wr-bevestig">Bevestig</button>
                    </div>
                  </form>
                </li>
              </ul>
              <p v-else class="wr-melding" data-test="wr-geen-blijvers">Mooi: geen taak schoof drie keer door. Wat je uitstelt, telt Dealtrace vanzelf.</p>
            </article>

            <!-- 4 Volgende week -->
            <article class="kaart wr-kaart" data-test="wr-kaart-3" :aria-hidden="nu !== 3">
              <span class="kicker">4 van 4 · Volgende week</span>
              <h2 class="wr-kop" data-test="wr-kop-volgende">{{ r.volgende.kop }}</h2>
              <ul v-if="r.volgende.ingepland.length" class="wr-lijst" data-test="wr-ingepland">
                <li v-for="v in r.volgende.ingepland" :key="v.id"><span class="wr-vn-ico"><Icoon :naam="SOORT_ICOON[v.soort] ?? 'SquareCheck'" :grootte="16" /></span><span>{{ v.tekst }}</span><span v-if="v.gedeeld" class="pil pil--paars">Gedeeld</span></li>
              </ul>
              <button v-if="r.volgende.ingepland.length" type="button" class="dd-act wr-zet-in" data-test="wr-opnieuw" @click="kiesOpnieuw"><Icoon naam="RefreshCw" />Kies opnieuw</button>
              <template v-else>
                <p class="wr-sub">{{ aantal }} van 3 gekozen. Elk voornemen wordt meteen iets in je agenda.</p>
                <div class="wr-voornemens">
                  <button v-for="v in r.volgende.voorstellen" :key="v.sleutel" type="button" class="wr-vn" :aria-pressed="gekozen.has(v.sleutel)" :data-test="`wr-voorstel-${v.sleutel}`" @click="wissel(v.sleutel)">
                    <span class="wr-vn-vink"><Icoon v-if="gekozen.has(v.sleutel)" naam="Check" :grootte="14" /></span>
                    <span class="wr-vn-tekst"><b>{{ v.tekst }}</b><span class="item-meta">{{ v.wordt }}</span></span>
                  </button>
                  <button v-for="v in eigen" :key="v.sleutel" type="button" class="wr-vn" :aria-pressed="gekozen.has(v.sleutel)" data-test="wr-eigen-voornemen" @click="wissel(v.sleutel)">
                    <span class="wr-vn-vink"><Icoon v-if="gekozen.has(v.sleutel)" naam="Check" :grootte="14" /></span>
                    <span class="wr-vn-tekst"><b>{{ v.tekst }}</b><span class="item-meta">Wordt: een taak op maandag</span></span>
                  </button>
                </div>
                <form class="wr-eigen" @submit.prevent="voegEigenToe">
                  <label class="veld"><span>Eigen voornemen</span><input v-model="eigenTekst" type="text" maxlength="140" placeholder="Bijvoorbeeld: elke afspraak met een tweede contact" data-test="wr-eigen"></label>
                  <button type="submit" class="dd-act" data-test="wr-eigen-toevoegen"><Icoon naam="Plus" />Voeg toe</button>
                </form>
                <p v-if="r.manager" class="schakel-rij wr-delen"><span>Deel mijn voornemens met {{ managerNaam }}</span><Schakelaar :aan="delen" :label="`Deel mijn voornemens met ${managerNaam}`" data-test="wr-delen" @wissel="delen = $event" /></p>
                <button type="button" class="dd-actie dd-actie--primair wr-zet-in" :disabled="bezig || !aantal" data-test="wr-zet-in" @click="zetIn"><Icoon naam="CalendarCheck" class="dd-actie-icoon" />Zet in volgende week</button>
              </template>
            </article>
          </div>

          <div class="wr-nav">
            <button type="button" class="dd-act" :disabled="nu === 0" data-test="wr-vorige" @click="ga(nu - 1)"><Icoon naam="ChevronLeft" />Vorige</button>
            <span class="wr-dots" aria-hidden="true"><i v-for="i in 4" :key="i" :class="{ nu: nu === i - 1 }" /></span>
            <span class="wr-stand" aria-live="polite">{{ nu + 1 }} van 4</span>
            <button type="button" class="dd-act" :disabled="nu === 3" data-test="wr-volgende" @click="ga(nu + 1)">Volgende<Icoon naam="ChevronRight" /></button>
          </div>
        </div>
      </section>

      <section class="section section--laatste">
        <div class="container"><RitmeSteun :steun="r.steun" moment="weekreview" /></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.wr { display: flex; flex-direction: column; gap: 16px; }
.wr-lopend { padding: 16px 20px; }
.wr-lijst { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; }
.wr-lijst li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--border); font-size: 14px; }
.wr-lijst li:first-child { border-top: 0; }
.wr-stappen { display: flex; gap: 8px; flex-wrap: wrap; }
.wr-baan { display: flex; align-items: flex-start; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; gap: 0; }
.wr-baan::-webkit-scrollbar { display: none; }
.wr-kaart { flex: 0 0 100%; min-width: 0; scroll-snap-align: start; padding: 24px; background: var(--wit); display: flex; flex-direction: column; gap: 14px; }
.wr-kop { margin: 0; font-family: var(--font-serif); font-size: 24px; line-height: 1.25; font-weight: 700; color: var(--ink); }
.wr-sub { margin: 0; font-size: 13px; color: var(--muted); }
.wr-cijfers { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.wr-cijfer { display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1px solid var(--border); min-width: 0; }
.wr-cijfer-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.wr-cijfer-n { font-family: var(--font-serif); font-size: 30px; font-weight: 700; line-height: 1; color: var(--ink); }
.wr-cijfer-meta { font-size: 12px; color: var(--muted); }
.wr-pos { color: var(--green); font-weight: 600; }
.wr-neg { color: var(--red); font-weight: 600; }
.wr-melding { margin: 0; padding: 12px 14px; background: var(--surface); font-size: 13px; color: var(--ink-soft); }
.wr-patroon { padding: 14px; border: 1px solid var(--border); border-left: 3px solid var(--yellow); }
.wr-patroon b { font-size: 14px; }
.wr-patroon p { margin: 4px 0 0; font-size: 14px; color: var(--ink-soft); line-height: 1.5; }
.wr-blijvers { list-style: none; margin: 0; padding: 0; }
.wr-blijver { padding: 12px 0; border-top: 1px solid var(--border); }
.wr-blijver:first-child { border-top: 0; }
.wr-blijver-kop { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.wr-keuzes { display: flex; gap: 6px; flex-wrap: wrap; }
.wr-besluit { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-top: 10px; padding: 12px; background: var(--surface); }
.wr-besluit .veld { flex: 1 1 220px; }
.wr-besluit-knoppen { display: flex; gap: 6px; }
.veld { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--ink); }
.veld input, .veld select { min-height: 44px; padding: 0 10px; border: 1px solid var(--border-strong); background: var(--wit); font: inherit; font-weight: 400; font-size: 14px; color: var(--ink); }
.wr-voornemens { display: grid; gap: 8px; }
.wr-vn { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 10px; align-items: start; min-height: 44px; padding: 12px 14px; text-align: left; background: var(--wit); border: 1px solid var(--border-strong); color: var(--ink); font: inherit; cursor: pointer; }
.wr-vn[aria-pressed='true'] { border-color: var(--ink); background: var(--surface); }
.wr-vn-vink { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1.5px solid var(--ink); background: var(--wit); }
.wr-vn[aria-pressed='true'] .wr-vn-vink { background: var(--yellow); }
.wr-vn-tekst { display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
.wr-vn-ico { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; background: var(--surface); }
.wr-eigen { display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; }
.wr-eigen .veld { flex: 1 1 240px; }
.wr-delen { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0; font-size: 14px; }
.wr-zet-in { align-self: flex-start; }
.wr-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wr-dots { display: inline-flex; gap: 6px; }
.wr-dots i { width: 8px; height: 8px; background: var(--border-strong); }
.wr-dots i.nu { background: var(--ink); }
.wr-stand { font-size: 12px; color: var(--muted); }
@media (max-width: 900px) { .wr-cijfers { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 719px) {
  .wr-kaart { padding: 16px; }
  .wr-kop { font-size: 20px; }
  .wr-stappen { display: none; }
  .wr-dots { display: inline-flex; }
  .wr-stand { display: none; }
  .wr-keuzes .dd-act, .wr-besluit-knoppen .dd-act, .wr-nav .dd-act, .wr-eigen .dd-act { min-height: 44px; }
}
@media (min-width: 720px) { .wr-dots { display: none; } }
</style>
