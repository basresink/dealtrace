<script setup lang="ts">
// De detailkolom op /opvolgreeksen (F7): kop met prospect en sjabloon, de stand in woorden, contact, eigenaar, start en
// aanleiding; bij een gestopte reeks waarom (een antwoord in de mailbox, een afspraak, een nee) met de taak bel terug.
// Daaronder ReeksStappen: de stappen per dag met mandaat C of B, concepten ter goedkeuring, Reactie ontvangen,
// Pauzeer en Stop. Een open beltaak opent het taakvenster.
import { OVERZICHT_LABEL, type OverzichtStand } from '~~/shared/opvolgreeks'

const props = defineProps<{ reeksId: string }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const d = ref<any>(null)
const fout = ref<string | null>(null)
const taakId = ref<string | null>(null)
async function laad() {
  fout.value = null
  try { d.value = await $fetch<any>(`/api/reeksen/${props.reeksId}`) } catch (e) { fout.value = foutTekst(e) }
}
await laad()
async function gewijzigd() { await laad(); emit('gewijzigd') }
async function taakDicht() { taakId.value = null; await gewijzigd() }
const r = computed(() => d.value?.reeks ?? null)
const dag = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace(/\./g, '') : '')
const pil = computed(() => {
  if (!r.value) return 'pil--grijs'
  if (r.value.status === 'loopt') return r.value.stand.wacht ? 'pil--geel' : 'pil--leeg'
  if (r.value.status === 'gestopt' && (r.value.stopreden === 'reactie' || r.value.stopreden === 'afspraak')) return 'pil--groen'
  return 'pil--grijs'
})
const stopTekst = computed(() => {
  const x = r.value
  if (!x || x.status !== 'gestopt') return null
  if (x.viaMail) return `Gestopt ${dag(x.gestoptOp)}: antwoord in de mailbox${x.mailOnderwerp ? ` ("${x.mailOnderwerp}")` : ''}.`
  if (x.stopToelichting) return `Gestopt ${dag(x.gestoptOp)}: ${x.stopToelichting.charAt(0).toLowerCase()}${x.stopToelichting.slice(1)}.`
  return `Gestopt ${dag(x.gestoptOp)}: ${String(x.stopLabel ?? 'handmatig').charAt(0).toLowerCase()}${String(x.stopLabel ?? 'handmatig').slice(1)}.`
})
</script>

<template>
  <div data-test="reeks-detail">
    <p v-if="fout" class="fo-fout">{{ fout }}</p>
    <template v-else-if="r">
      <header class="rd-kop">
        <div class="rd-kop-tekst">
          <p class="kicker">Opvolgreeks · {{ OVERZICHT_LABEL[(d.stand ?? 'loopt') as OverzichtStand] }}</p>
          <h2 class="rd-titel"><NuxtLink :to="`/accounts/${d.account.id}`" class="tekst-link">{{ d.account.naam }}</NuxtLink> · {{ r.naam }}</h2>
        </div>
        <span class="pil" :class="pil" data-test="rd-status">{{ r.stand.label }}</span>
      </header>
      <p class="meta rd-meta" data-test="rd-meta">
        <template v-if="r.contact">{{ r.contact.naam }} · </template>gestart {{ dag(r.gestartOp) }}<template v-if="r.aanleiding"> na "{{ r.aanleiding }}"</template><template v-if="r.eigenaar"> · {{ r.eigenaar.replace(/^Testgebruiker /, '') }}</template> · stap {{ r.stand.stap }} van {{ r.stand.van }}<template v-if="r.stand.wacht"> · {{ r.stand.wacht }} {{ r.stand.wacht === 1 ? 'wacht' : 'wachten' }} op jou</template>
      </p>
      <div v-if="stopTekst" class="rd-stop" :class="{ 'rd-stop--raak': r.stopreden === 'reactie' || r.stopreden === 'afspraak' }" data-test="rd-stop">
        <Icoon :naam="r.viaMail ? 'Inbox' : 'CircleCheck'" :grootte="16" />
        <p>{{ stopTekst }}<template v-if="r.belTerugTaakId"> <button type="button" class="tekst-link rd-link" data-test="rd-belterug" @click="taakId = r.belTerugTaakId">Open de taak bel terug</button></template><template v-else-if="r.belTerugReden"> Geen taak bel terug: {{ r.belTerugReden }}.</template></p>
      </div>
      <ReeksStappen :reeks="r" :mandaten="d.mandaten" :kan-wijzigen="d.kan.wijzigen" :kan-stappen="d.kan.stappen" @gewijzigd="gewijzigd" @open-taak="(id: string) => (taakId = id)" />
      <p v-if="!d.kan.stappen && ['loopt', 'gepauzeerd'].includes(r.status)" class="meta mt-8">Deze reeks is van {{ r.eigenaar ?? 'een collega' }}. De eigenaar keurt de concepten goed en vinkt de stappen af.</p>
    </template>
    <TaakFlyout :open="!!taakId" :taak-id="taakId" @sluit="taakDicht" @klaar="taakDicht" @gewijzigd="gewijzigd" />
  </div>
</template>

<style scoped>
.rd-kop { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.rd-kop-tekst { min-width: 0; }
.rd-titel { margin: 4px 0 0; font-family: var(--font-serif); font-size: var(--fs-kaarttitel, 19px); font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.rd-meta { margin: 6px 0 12px; }
.rd-stop { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 12px; padding: 10px 12px; background: var(--surface); border-left: 3px solid var(--border-strong); font-size: var(--fs-klein); }
.rd-stop p { margin: 0; }
.rd-stop--raak { border-left-color: var(--green); }
.rd-link { padding: 0; background: none; border: 0; font: inherit; cursor: pointer; }
@media (max-width: 719px) { .rd-link { min-height: var(--touch-target-min); } }
</style>
