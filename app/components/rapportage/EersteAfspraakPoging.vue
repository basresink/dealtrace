<script setup lang="ts">
// Bij welke poging de eerste afspraak kwam (shared/funnel eersteAfspraakPoging): het gemiddelde en de
// verdeling bij poging 1, 2, 3 of 4 en later. Vorm "strook" toont vier vakjes met een balk, vorm "regel"
// één zin. Zonder eerste afspraken een korte lege tekst.
import type { EersteAfspraakPoging } from '~~/shared/funnel'

const props = withDefaults(defineProps<{ data: EersteAfspraakPoging | null | undefined; vorm?: 'strook' | 'regel' }>(), { vorm: 'strook' })
const BAKKEN = [
  { sleutel: '1', label: 'Poging 1' },
  { sleutel: '2', label: 'Poging 2' },
  { sleutel: '3', label: 'Poging 3' },
  { sleutel: '4+', label: '4 of later' },
] as const
const nl = (n: number) => n.toLocaleString('nl-NL')
const n = computed(() => props.data?.accounts ?? 0)
const pct = (x: number) => (n.value ? Math.round((x / n.value) * 100) : 0)
const kop = computed(() => (props.data?.gemiddeld != null ? `Eerste afspraak gemiddeld bij poging ${nl(props.data.gemiddeld)}` : 'Nog geen eerste afspraak uit je pogingen'))
const verdelingTekst = computed(() => {
  const d = BAKKEN.map((b) => `${props.data?.verdeling[b.sleutel] ?? 0} bij ${b.sleutel === '4+' ? 'poging 4 of later' : `poging ${b.sleutel}`}`)
  return `${d.slice(0, -1).join(', ')} en ${d.at(-1)}`
})
</script>

<template>
  <div class="eap" :class="`eap--${vorm}`">
    <template v-if="vorm === 'regel'">
      <p class="eap-regel">
        <template v-if="n"><strong>{{ kop }}</strong> ({{ n }} {{ n === 1 ? 'account' : 'accounts' }}): {{ verdelingTekst }}.</template>
        <template v-else>{{ kop }} in deze periode.</template>
      </p>
    </template>
    <template v-else>
      <p class="eap-kop"><strong>{{ kop }}</strong><span v-if="n" class="eap-meta">{{ n }} {{ n === 1 ? 'account' : 'accounts' }} met een eerste afspraak</span></p>
      <dl v-if="n" class="eap-raster">
        <div v-for="b in BAKKEN" :key="b.sleutel" class="eap-vak" :class="{ 'eap-vak--meest': data?.meest === b.sleutel }" :data-test="`eerste-afspraak-${b.sleutel === '4+' ? '4' : b.sleutel}`">
          <dt class="eap-label">{{ b.label }}</dt>
          <dd class="eap-waarde"><span class="tnum">{{ data?.verdeling[b.sleutel] ?? 0 }}</span><span class="eap-pct tnum">{{ pct(data?.verdeling[b.sleutel] ?? 0) }}%</span>
            <span class="eap-balk" aria-hidden="true"><span class="eap-vul" :style="{ width: `${pct(data?.verdeling[b.sleutel] ?? 0)}%` }" /></span>
          </dd>
        </div>
      </dl>
    </template>
  </div>
</template>

<style scoped>
.eap-kop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0 0 10px; font-size: 13px; color: var(--ink); }
.eap-meta { font-size: 12px; color: var(--muted); }
.eap-regel { margin: 0; font-size: 12px; line-height: 1.55; color: var(--muted); }
.eap-regel strong { color: var(--ink); }
.eap-raster { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0; }
.eap-vak { padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); min-width: 0; }
.eap-vak--meest { border-color: var(--yellow-dark); }
.eap-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.eap-waarde { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; margin: 4px 0 0; font-size: 18px; font-weight: 800; color: var(--ink); }
.eap-pct { font-size: 11px; font-weight: 600; color: var(--muted); }
.eap-balk { flex-basis: 100%; height: 4px; margin-top: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.eap-vul { display: block; height: 100%; background: var(--yellow); }
@media (max-width: 480px) {
  .eap-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
