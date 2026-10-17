<script setup lang="ts">
// Vaste belblokken: per blok de dagen en tijd, soort en plek, en hoe hij gevuld wordt.
// "Vult zichzelf" alleen voor Expert, eigen blokken vanaf Gevorderd (PUT /api/mij/belblokken).
import { dagenLabel, eindTijd, kaalBlok, soortLabel, type VastBlok } from '~~/shared/belblokken'

interface Sessie { id: string; start: string; eind: string; vastBlokId?: string | null; gesprekken: number; open: number }
const props = defineProps<{
  blokken: VastBlok[]
  gepland: Sessie[]
  voorkeuren: { lunch: { start: string; minuten: number } }
  kanPlannen: boolean
  kanAutomatisch: boolean
}>()
const emit = defineEmits<{ ververs: [] }>()
const toast = useToast()

const lijst = ref<VastBlok[]>([])
watch(() => props.blokken, (b) => { lijst.value = (b ?? []).map(kaalBlok) }, { immediate: true })
const status = ref('')
async function bewaar(blokken: VastBlok[], melding?: string) {
  status.value = 'Opslaan…'
  const vorige = lijst.value
  lijst.value = blokken
  try {
    await $fetch('/api/mij/belblokken', { method: 'PUT', body: { blokken, voorkeuren: props.voorkeuren } })
    status.value = 'Opgeslagen'
    if (melding) toast.toon(melding)
    emit('ververs')
  } catch (e) { lijst.value = vorige; status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
}

// Schuifvenster
const venster = ref(false)
const bewerk = ref<VastBlok | null>(null)
function nieuw() { bewerk.value = null; venster.value = true }
function wijzig(b: VastBlok) { bewerk.value = b; venster.value = true }
function opgeslagen(b: VastBlok) {
  const bestaand = lijst.value.some((x) => x.id === b.id)
  venster.value = false
  bewaar(bestaand ? lijst.value.map((x) => (x.id === b.id ? b : x)) : [...lijst.value, b], bestaand ? 'Vast blok gewijzigd.' : 'Vast blok toegevoegd.')
}
const wissel = (b: VastBlok, aan: boolean) => bewaar(lijst.value.map((x) => (x.id === b.id ? { ...x, automatisch: aan } : x)))
const verwijder = (b: VastBlok) => bewaar(lijst.value.filter((x) => x.id !== b.id), 'Vast blok verwijderd.')

// Vulstand: de eerstvolgende sessie van dit blok die al gesprekken heeft.
const nu = Date.now()
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const volgende = (b: VastBlok) => props.gepland.find((s) => s.vastBlokId === b.id && Date.parse(s.eind) > nu)
</script>

<template>
  <section class="section section--alt">
    <div class="container">
      <div class="vb-kop">
        <div>
          <span class="kicker kicker--streep">Vaste belblokken</span>
          <h2 class="vb-titel">Ritme dat zichzelf vult.</h2>
          <p class="vb-uitleg">Een vast blok komt elke week terug. Laat hem zichzelf vullen met de urgentste gesprekken, of vul hem zelf vanuit je bellijst. Wat in een los blok niet past, schuift naar het eerstvolgende vaste blok.</p>
        </div>
        <div class="vb-acties">
          <span v-if="status" class="meta" role="status">{{ status }}</span>
          <button v-if="kanPlannen" type="button" class="dd-actie dd-actie--primair" data-test="nieuw-vast-blok" @click="nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Vast blok plannen</button>
        </div>
      </div>
      <p v-if="!lijst.length" class="vb-leeg">Nog geen vaste blokken. Dat mag: dan plan je losse blokken vanuit je bellijst, wanneer het jou uitkomt.</p>
      <div v-else class="vb-raster" data-test="vaste-blokken">
        <article v-for="b in lijst" :key="b.id" class="vb-kaart" :class="{ 'vb-kaart--auto': b.automatisch }" :data-test="`vast-blok-${b.id}`">
          <header class="vb-kaart-kop">
            <div class="vb-kaart-info">
              <h3 class="vb-wanneer">{{ dagenLabel(b.dagen) }} <span class="tnum">{{ b.start }} tot {{ eindTijd(b) }}</span></h3>
              <p class="vb-soort">{{ soortLabel(b) }} · {{ b.plek }}</p>
            </div>
            <div class="vb-schakel">
              <Schakelaar v-if="kanAutomatisch" :aan="b.automatisch" :label="b.automatisch ? 'Vult zichzelf' : 'Ik vul zelf'" @wissel="wissel(b, $event)" />
              <span class="vb-stand">{{ b.automatisch ? 'Vult zichzelf' : 'Ik vul zelf' }}</span>
            </div>
          </header>
          <p class="vb-vul">
            <template v-if="volgende(b)">
              <strong>{{ volgende(b)!.gesprekken }} {{ volgende(b)!.gesprekken === 1 ? 'gesprek' : 'gesprekken' }}</strong> ingepland voor {{ tijd(volgende(b)!.start) }}<template v-if="volgende(b)!.open < volgende(b)!.gesprekken">, {{ volgende(b)!.open }} nog open</template>.
            </template>
            <template v-else-if="b.automatisch">Vult zichzelf: op de dag zelf zet de motor er de urgentste gesprekken in die passen. Wat jij er zelf inzet blijft staan, en een blok zonder kandidaten wordt niet aangemaakt.</template>
            <template v-else>Blijft leeg tot jij hem vult. Hij staat bovenaan in het advies als je een belblok plant.</template>
          </p>
          <div v-if="kanPlannen" class="vb-kaart-voet">
            <button type="button" class="dd-act" :data-test="`wijzig-${b.id}`" @click="wijzig(b)"><Icoon naam="Pencil" :grootte="14" /> Wijzig</button>
            <button type="button" class="dd-act dd-act--gevaar" :data-test="`verwijder-${b.id}`" @click="verwijder(b)">Verwijderen</button>
          </div>
        </article>
      </div>
    </div>
    <VastBlokFlyout :open="venster" :blok="bewerk" :kan-automatisch="kanAutomatisch" @sluit="venster = false" @bewaar="opgeslagen" />
  </section>
</template>

<style scoped>
.vb-kop { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.vb-titel { font-family: var(--font-serif); font-size: clamp(22px, 3vw, 28px); font-weight: 700; line-height: 1.15; margin: 6px 0 4px; }
.vb-uitleg { margin: 0; max-width: 640px; color: var(--muted); font-size: 14px; }
.vb-acties { display: flex; align-items: center; gap: 12px; }
.vb-leeg { padding: 20px; color: var(--muted); font-size: 14px; background: var(--wit); border: 1px solid var(--border); margin: 0; }
.vb-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 12px; }
.vb-kaart { display: flex; flex-direction: column; gap: 10px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--border-strong); padding: 14px 16px; min-width: 0; }
.vb-kaart--auto { border-left-color: var(--yellow); }
.vb-kaart-kop { display: flex; align-items: flex-start; gap: 12px; }
.vb-kaart-info { min-width: 0; flex: 1; }
.vb-wanneer { font-size: 15px; font-weight: 700; margin: 0; color: var(--ink); }
.vb-soort { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
.vb-schakel { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.vb-stand { font-size: 11px; font-weight: 700; color: var(--ink); white-space: nowrap; }
.vb-slot { display: inline-flex; align-items: center; justify-content: center; min-width: var(--touch-target-min); min-height: var(--touch-target-min); background: var(--surface); border: 1px dashed var(--border-strong); color: var(--muted); cursor: pointer; }
.vb-slot:hover { color: var(--ink); border-color: var(--ink); }
.vb-vul { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.vb-vul strong { color: var(--ink); }
.vb-kaart-voet { display: flex; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 4px; border-top: 1px solid var(--border); }
</style>
