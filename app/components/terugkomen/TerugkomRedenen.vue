<script setup lang="ts">
// Instellingen, Terugkomen, tabblad Verliesredenen: elke reden waarmee een prospect verloren kan gaan wijst
// naar een regel. Zonder regel geldt de afkoeling van bellen; "Niet geschikt" is altijd 365 dagen. Een andere
// regel kiezen toont eerst wat er verschuift; Bewaar zet de koppeling (alleen de beheerder).
import { KANAAL_LABEL, type Kanaal } from '~~/shared/nbStatus'
import { BRON_LABEL, type Verschuiving } from '~~/shared/terugkomBeheer'

const props = defineProps<{ data: any }>()
const emit = defineEmits<{ bewaard: [] }>()
const toast = useToast()
const mag = computed(() => !!props.data.kan?.redenen)
const rijen = computed<any[]>(() => props.data.redenen ?? [])
const regels = computed<any[]>(() => props.data.regels ?? [])
const opties = (x: any) => regels.value.filter((r) => r.actief && (x.bronSoort === 'slapend' ? r.lijst === 'slapend' : r.lijst !== 'slapend'))
const sleutel = (x: any) => `${x.bronSoort}|${x.reden}`

const wacht = ref<{ rij: any; naar: string | null } | null>(null)
const lijst = ref<Verschuiving[] | null>(null)
const bezig = ref(false)
const waarde = (x: any) => (wacht.value && sleutel(wacht.value.rij) === sleutel(x) ? wacht.value.naar ?? '' : x.terugkomregelId ?? '')
async function kies(x: any, v: string) {
  const naar = v || null
  if ((x.terugkomregelId ?? null) === naar) { wacht.value = null; lijst.value = null; return }
  wacht.value = { rij: x, naar }
  lijst.value = null
  try {
    const r: any = await $fetch('/api/instellingen/terugkomen/proef', { method: 'POST', body: { reden: { bronSoort: x.bronSoort, reden: x.reden, terugkomregelId: naar } } })
    if (wacht.value?.rij === x) lijst.value = r.verschuivingen
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const naam = (id: string | null) => (id ? regels.value.find((r) => r.id === id)?.reden ?? id : 'geen regel')
async function bewaar() {
  if (!wacht.value) return
  bezig.value = true
  const { rij, naar } = wacht.value
  try {
    const r: any = await $fetch('/api/instellingen/terugkomen/redenen', { method: 'PUT', body: { bronSoort: rij.bronSoort, reden: rij.reden, terugkomregelId: naar } })
    toast.toon(`${rij.reden} hoort nu bij ${naam(naar)}. ${r.verschoven ? `${r.verschoven} ${r.verschoven === 1 ? 'prospect' : 'prospects'} verschoven.` : 'Er verschoof niets.'}`)
    wacht.value = null; lijst.value = null
    emit('bewaard')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const terugTekst = (x: any) => (x.vast ? '365 dagen, elk kanaal' : `${x.dagen} dagen, ${KANAAL_LABEL[x.kanaal as Kanaal].toLowerCase()}`)
</script>

<template>
  <div>
    <h2 class="kaart-titel">Verliesredenen</h2>
    <p class="meta mt-8">Elke reden waarmee een prospect verloren kan gaan, wijst naar een regel. Zonder regel geldt alleen de afkoeling van bellen. "Niet geschikt" komt nooit eerder terug dan na 365 dagen en heeft geen regel.</p>
    <p v-if="!mag" class="meta mt-8" data-test="tk-redenen-lezen">Alleen de beheerder koppelt redenen aan een regel.</p>
    <div class="kaart tk-redenen mt-16">
      <table class="tk-tabel" data-test="tk-mapping">
        <thead><tr><th scope="col">Reden</th><th scope="col">Waar hij vandaan komt</th><th scope="col">Regel</th><th scope="col">Terug na</th></tr></thead>
        <tbody>
          <tr v-for="x in rijen" :key="sleutel(x)" :class="{ 'tk-rij--wacht': wacht && sleutel(wacht.rij) === sleutel(x) }" :data-test="`tk-map-${x.reden}`">
            <td data-label="Reden"><strong>{{ x.reden }}</strong></td>
            <td data-label="Bron">{{ BRON_LABEL[x.bronSoort as keyof typeof BRON_LABEL] }}</td>
            <td data-label="Regel">
              <span v-if="x.vast" class="meta">Nooit vanzelf eerder terug</span>
              <template v-else>
                <label class="sr-only" :for="`tk-m-${sleutel(x)}`">Regel voor {{ x.reden }}</label>
                <select :id="`tk-m-${sleutel(x)}`" class="invoer" :value="waarde(x)" :disabled="!mag || bezig" :data-test="`tk-map-kies-${x.reden}`" @change="kies(x, ($event.target as HTMLSelectElement).value)">
                  <option value="">Geen regel (afkoeling bellen)</option>
                  <option v-for="r in opties(x)" :key="r.id" :value="r.id">{{ r.reden }}</option>
                </select>
                <span v-if="!x.expliciet && x.regelId" class="meta">Op naam: {{ naam(x.regelId) }}</span>
              </template>
            </td>
            <td data-label="Terug na" class="tnum">{{ terugTekst(x) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="wacht" class="kaart tk-wacht mt-16" data-test="tk-map-wacht">
      <p class="tk-wacht-kop"><strong>{{ wacht.rij.reden }}</strong> naar <strong>{{ naam(wacht.naar) }}</strong></p>
      <TerugkomVerschuif :lijst="lijst" :bezig="!lijst" :regels="regels" />
      <div class="tk-voet">
        <button type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="tk-map-bewaar" @click="bewaar">Bewaar</button>
        <button type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" @click="wacht = null; lijst = null">Annuleer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tk-redenen { padding: 0; overflow: hidden; }
.tk-tabel { width: 100%; border-collapse: collapse; }
.tk-tabel th, .tk-tabel td { padding: 10px 14px; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--border); font-size: var(--fs-klein); }
.tk-tabel th { font-family: var(--font-mono); font-size: var(--fs-label); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 600; background: var(--surface); }
.tk-tabel tr:last-child td { border-bottom: 0; }
.tk-tabel select { min-width: 200px; max-width: 100%; }
.tk-rij--wacht td { background: var(--yellow-zacht); }
.tk-wacht { padding: var(--kaart-padding); }
.tk-wacht-kop { margin: 0; }
.tk-voet { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 719px) {
  .tk-tabel thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
  .tk-tabel, .tk-tabel tbody, .tk-tabel tr, .tk-tabel td { display: block; width: 100%; }
  .tk-tabel tr { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  .tk-tabel tr:last-child { border-bottom: 0; }
  .tk-tabel td { padding: 4px 0; border: 0; display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; align-items: center; }
  .tk-tabel td::before { content: attr(data-label); color: var(--muted); font-size: 12px; }
  .tk-tabel select { min-width: 0; width: 100%; }
}
</style>
