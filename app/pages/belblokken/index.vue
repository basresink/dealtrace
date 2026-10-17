<script setup lang="ts">
// Belblokken (F07), in de opzet van DealDrive: links de bellijst (Top 5, 10, 15 of zelf
// kiezen; zelfde rangorde als belmodus en vuller), rechts het blok plannen met advies uit je
// agenda, daaronder de vaste blokken en de geplande blokken.
const { functie } = useMe()
const aan = !!functie('belblok.uitvoeren')?.beschikbaar
const { data, refresh } = await useFetch<any>('/api/belblokken', { immediate: aan, default: () => ({ kop: 'Bellijst', bellijst: [], blokken: [], gepland: [], advies: [], kan: { top: [5] }, voorkeuren: { lunch: { start: '12:00', minuten: 45 } }, agenda: {} }) })

// Bellijst: de top staat meteen geselecteerd; bij "Zelf kiezen" vink je aan en uit.
const top = ref<number | 'zelf'>(5)
const zelf = ref<Set<string>>(new Set())
const gekozen = computed(() => (top.value === 'zelf' ? data.value.bellijst.filter((k: any) => zelf.value.has(k.accountId)) : data.value.bellijst.slice(0, top.value)).filter((k: any) => !k.belblokId))
async function gepland() { zelf.value = new Set(); await refresh() }

// Kop: + Taak (het venster Nieuwe taak met type Bellen), Start belblok en + Afspraak.
const nieuweTaak = ref(false)
const nieuweAfspraak = ref(false)

// Een leeg gepland blok: het vulvoorstel uit je bellijst (zoals Dagstart en Weekstart) met de knop Vul.
const toast = useToast()
const vullend = ref<string | null>(null)
const namen = (l: { accountNaam: string }[]) => (l.length <= 3 ? l.map((x) => x.accountNaam).join(', ') : `${l.slice(0, 3).map((x) => x.accountNaam).join(', ')} en ${l.length - 3} meer`)
async function vul(s: { id: string; voorstel: { accountId: string }[] }) {
  vullend.value = s.id
  try {
    const r = await $fetch<any>(`/api/belblokken/${s.id}/vul`, { method: 'POST', body: { accountIds: s.voorstel.map((v) => v.accountId) } })
    toast.toon(r.toast)
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { vullend.value = null }
}

const nu = Date.now()
const volgende = computed(() => data.value.gepland.find((s: any) => s.open > 0 && Date.parse(s.eind) > nu))
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
useHead({ title: 'Belblokken · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="belblok.uitvoeren" />
    <template v-else>
      <PaginaKop kicker="Plannen · Belblokken" titel="Een blok is een blok. Wie het vult, kies jij." uitleg="Vaste belblokken die zichzelf vullen, én de mogelijkheid om er nu een Top 5 in te schuiven. Wat niet past schuift door naar het eerstvolgende blok." helpartikel="belblokken">
        <template #acties>
          <FunctieLink v-if="volgende" :to="`/belblokken/${volgende.id}`" class="dd-actie dd-actie--secundair" data-test="start-belblok" :title="`Volgende blok ${tijd(volgende.start)} · ${volgende.open} gesprekken`"><Icoon naam="Phone" class="dd-actie-icoon" />Start belblok</FunctieLink>
          <button v-if="$aan('agenda.basis')" type="button" class="dd-actie dd-actie--zwart" data-test="belblokken-afspraak" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
          <button v-if="$aan('taken.basis')" type="button" class="dd-actie dd-actie--primair" data-test="belblokken-taak" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
        </template>
      </PaginaKop>

      <section class="section section--alt">
        <div class="container">
          <div class="bb-split">
            <BellijstKaart v-model:top="top" v-model:zelf="zelf" :rijen="data.bellijst" :kop="data.kop" :top-opties="data.kan.top" />
            <BelblokPlannen
              :gekozen="gekozen" :advies="data.advies" :blokken="data.blokken" :voorkeuren="data.voorkeuren"
              :agenda-gekoppeld="!!data.agenda.gekoppeld" :kan-plannen="!!data.kan.plannen" @gepland="gepland" @ververs="refresh()"
            />
          </div>
        </div>
      </section>

      <VasteBlokken :blokken="data.blokken" :gepland="data.gepland" :voorkeuren="data.voorkeuren" :kan-plannen="!!data.kan.plannen" :kan-automatisch="!!data.kan.automatisch" @ververs="refresh()" />

      <section v-if="data.gepland.length" class="section section--laatste">
        <div class="container">
          <span class="kicker kicker--streep">Gepland</span>
          <h2 class="bb-titel">Je komende blokken</h2>
          <p v-if="volgende" class="meta">Volgende blok {{ tijd(volgende.start) }} · {{ volgende.open }} {{ volgende.open === 1 ? 'gesprek' : 'gesprekken' }}</p>
          <ul class="bb-gepland" data-test="gepland">
            <li v-for="s in data.gepland" :key="s.id" class="bb-gepland-rij">
              <div class="bb-gepland-info">
                <h3 class="bb-gepland-tijd">{{ tijd(s.start) }}</h3>
                <p class="bb-gepland-sub">{{ s.open }} van {{ s.gesprekken }} gesprekken open · {{ s.plek ?? 'Kantoor' }}{{ s.vastBlokId ? ' · vast blok' : '' }}{{ s.status === 'bezig' ? ' · loopt' : '' }}</p>
                <template v-if="!s.gesprekken && s.stand">
                  <p v-if="s.voorstel?.length" class="bb-gepland-sub" :data-test="`blok-voorstel-${s.id}`">{{ s.stand }}. Past erin: {{ namen(s.voorstel) }}</p>
                  <p v-else class="bb-gepland-sub" :data-test="`blok-voorstel-${s.id}`">{{ s.stand }}. Niemand in je bellijst past bij dit blok.</p>
                </template>
              </div>
              <button v-if="!s.gesprekken && s.voorstel?.length" type="button" class="dd-act dd-act--vast bb-vul" :disabled="!!vullend" :data-test="`vul-blok-${s.id}`" @click="vul(s)"><Icoon naam="Plus" />Vul met {{ s.voorstel.length }}</button>
              <FunctieLink :to="`/belblokken/${s.id}`" class="dd-act dd-act--vast" :data-test="`open-blok-${s.id}`">{{ s.status === 'bezig' ? 'Verder bellen' : 'Start' }}</FunctieLink>
            </li>
          </ul>
        </div>
      </section>
    </template>
    <NieuweTaakFlyout :open="nieuweTaak" actiesoort="bellen" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; refresh()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
  </div>
</template>

<style scoped>
.bb-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 360px); gap: 20px; align-items: start; }
@media (max-width: 900px) { .bb-split { grid-template-columns: minmax(0, 1fr); } }
.bb-titel { font-family: var(--font-serif); font-size: clamp(22px, 3vw, 28px); font-weight: 700; margin: 6px 0 4px; }
.bb-gepland { list-style: none; margin: 14px 0 0; padding: 0; background: var(--wit); border: 1px solid var(--border); }
.bb-gepland-rij { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.bb-gepland-rij:last-child { border-bottom: none; }
.bb-gepland-info { min-width: 0; flex: 1; }
.bb-gepland-tijd { margin: 0; font-size: 14px; font-weight: 700; }
.bb-gepland-sub { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
/* Een leeg blok met vulvoorstel: op een telefoon staan Vul en Start onder de tekst. */
@media (max-width: 480px) {
  .bb-gepland-rij:has(.bb-vul) { flex-wrap: wrap; }
  .bb-gepland-rij:has(.bb-vul) .bb-gepland-info { flex-basis: 100%; }
}
</style>
