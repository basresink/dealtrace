<script setup lang="ts">
// Belscript Studio (/belscripts): vier tabbladen. Standaardscript (de salesmanager bouwt het script
// van het team in blokken en activeert een versie), Templates (zes startpunten met resultaten uit de
// eigen gesprekken), Per prospect (de AI vult de AI-blokken voor één prospect; de accountmanager
// beoordeelt elk blok en bewaart een versie) en In de belmodus (zo staat het script tijdens het
// bellen). Tabblad, script en prospect staan in de URL.
const { functie } = useMe()
const aan = !!functie('belscript.kiezen')?.beschikbaar
const route = useRoute()
const router = useRouter()
const TABS = [
  { sleutel: 'standaard', label: 'Standaardscript' },
  { sleutel: 'templates', label: 'Templates' },
  { sleutel: 'prospect', label: 'Per prospect' },
  { sleutel: 'belmodus', label: 'In de belmodus' },
] as const
type Tab = typeof TABS[number]['sleutel']
const tab = computed<Tab>(() => (TABS.some((t) => t.sleutel === route.query.tab) ? route.query.tab as Tab : 'standaard'))
const scriptId = computed(() => (route.query.script as string) || null)
const prospectId = computed(() => (route.query.prospect as string) || null)
const zet = (q: Record<string, string | null | undefined>) => router.replace({ query: { ...route.query, ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v || undefined])) } })
function naarTab(t: Tab, extra: Record<string, string | null> = {}) { zet({ tab: t === 'standaard' ? null : t, ...extra }); if (import.meta.client) window.scrollTo({ top: 0 }) }

const { data: lijst, refresh: verversLijst } = await useFetch<any>('/api/belscripts', { immediate: aan, default: () => ({ scripts: [], mijn: [], kan: {}, teams: [] }) })
const { data: keuze } = await useFetch<any>('/api/belscripts/prospecten', { immediate: aan, default: () => ({ prospecten: [], bron: 'belblok' }) })
// Zonder gekozen prospect: het eerste uit je belblok.
const prospect = computed(() => prospectId.value ?? keuze.value.prospecten[0]?.accountId ?? null)

const tabRefs = ref<HTMLButtonElement[]>([])
function toets(e: KeyboardEvent, i: number) {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!d) return
  const j = (i + d + TABS.length) % TABS.length
  naarTab(TABS[j]!.sleutel)
  nextTick(() => tabRefs.value[j]?.focus())
}
useHead({ title: 'Belscripts · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="belscript.kiezen" />
    <template v-else>
      <PaginaKop kicker="Plannen · Belscripts" titel="Belscripts" uitleg="Bouw het standaardscript van je team, start vanuit een template of laat de AI een script per prospect vullen met de aanleiding en je verkoopverhaal. Jij beslist wat er gezegd wordt; de belmodus toont het compact tijdens het bellen." helpartikel="belscripts-maken">
        <template #acties>
          <button type="button" class="dd-actie dd-actie--secundair" data-test="kop-template" @click="naarTab('templates')"><Icoon naam="Copy" class="dd-actie-icoon" />Kies template</button>
          <button type="button" class="dd-actie dd-actie--primair" data-test="kop-belmodus" @click="naarTab('belmodus')"><Icoon naam="Phone" class="dd-actie-icoon" />Open belmodus</button>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <nav class="tabbalk tabbalk--schuif bs-tabs" role="tablist" aria-label="Onderdelen van Belscripts">
            <button
              v-for="(t, i) in TABS" :key="t.sleutel" ref="tabRefs" type="button" role="tab" class="tab" :class="{ 'tab--actief': tab === t.sleutel }"
              :aria-selected="tab === t.sleutel" :tabindex="tab === t.sleutel ? 0 : -1" :aria-controls="`bs-paneel-${t.sleutel}`" :id="`bs-tab-${t.sleutel}`" :data-test="`tab-${t.sleutel}`"
              @click="naarTab(t.sleutel)" @keydown="toets($event, Number(i))"
            ><span class="tab-teller">{{ Number(i) + 1 }}</span>{{ t.label }}</button>
          </nav>
          <div :id="`bs-paneel-${tab}`" role="tabpanel" :aria-labelledby="`bs-tab-${tab}`" class="mt-16">
            <StudioStandaard
              v-if="tab === 'standaard'" :script-id="scriptId" :lijst="lijst" @kies="(id: string) => zet({ script: id })" @ververs="verversLijst()"
            />
            <StudioTemplates
              v-else-if="tab === 'templates'" :lijst="lijst"
              @gebruikt="async (id: string) => { await verversLijst(); naarTab('standaard', { script: id }) }"
            />
            <StudioProspect
              v-else-if="tab === 'prospect'" :account-id="prospect" :keuze="keuze"
              @kies="(id: string) => zet({ prospect: id })" @belmodus="(id: string) => naarTab('belmodus', { prospect: id })"
            />
            <StudioBelmodus v-else :account-id="prospect" @kies="(id: string) => zet({ prospect: id })" />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.bs-tabs { position: static; background: transparent; }
.bs-tabs .tab-teller { min-width: 20px; text-align: center; }
.bs-tabs .tab--actief .tab-teller { background: var(--ink); color: var(--yellow); }
</style>
