<script setup lang="ts">
// De rij dagkaarten van Bezoeken en Meetings (dagwisselaar van DealDrive): pijl naar de vorige week,
// ma tot en met vr met het aantal en een regel eronder (regiodag, eerste meeting), Hele week en de pijl
// naar de volgende week. De ouder zet de dag en de weergave in de URL.
const props = defineProps<{ dagen: { datum: string; aantal: number; sub: string }[]; actief: string | null; week: boolean; weekSub: string; vandaag: string }>()
const emit = defineEmits<{ dag: [datum: string]; week: []; stap: [n: number] }>()
const naam = (d: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)).replace(/\./g, '')
const lang = (d: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
const aan = (d: string) => !props.week && d === props.actief
</script>

<template>
  <nav class="dk" aria-label="Je week" data-test="bz-week">
    <button type="button" class="dk-pijl" aria-label="Vorige week" data-test="week-vorige" @click="emit('stap', -1)"><Icoon naam="ArrowLeft" /></button>
    <button
      v-for="w in dagen" :key="w.datum" type="button" class="dk-dag" :class="{ 'bz-dag--aan': aan(w.datum), 'dk-dag--vandaag': w.datum === vandaag }"
      :aria-pressed="aan(w.datum)" :aria-label="`${lang(w.datum)}: ${w.aantal}, ${w.sub}`" :data-test="`week-dag-${w.datum}`" @click="emit('dag', w.datum)"
    >
      <span class="dk-naam">{{ naam(w.datum) }}<span class="pil-teller">{{ w.aantal }}</span></span>
      <span class="dk-sub">{{ w.sub }}</span>
    </button>
    <button type="button" class="dk-dag dk-dag--week" :class="{ 'bz-dag--aan': week }" :aria-pressed="week" data-test="weergave-week" @click="emit('week')"><span class="dk-naam">Hele week</span><span class="dk-sub">{{ weekSub }}</span></button>
    <button type="button" class="dk-pijl" aria-label="Volgende week" data-test="week-volgende" @click="emit('stap', 1)"><Icoon naam="ArrowRight" /></button>
  </nav>
</template>

<style scoped>
.dk { display: flex; gap: 6px; margin-bottom: 16px; overflow-x: auto; scrollbar-width: none; }
.dk-pijl { flex: 0 0 44px; min-height: 44px; display: grid; place-items: center; background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); cursor: pointer; color: var(--ink); }
.dk-pijl:hover { border-color: var(--ink); }
.dk-dag { flex: 1 1 0; min-width: 104px; min-height: 52px; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 6px 12px; background: var(--wit); color: var(--muted); border: 1px solid var(--border-strong); border-radius: var(--radius); font: inherit; text-align: left; cursor: pointer; transition: border-color var(--transition-fast); }
.dk-dag:hover { border-color: var(--ink); color: var(--ink); }
.dk-naam { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: var(--fs-klein); font-weight: 700; color: var(--ink); text-transform: capitalize; }
.dk-sub { font-size: var(--fs-label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dk-dag--vandaag { box-shadow: inset 0 3px 0 var(--yellow); }
.bz-dag--aan { background: var(--ink); border-color: var(--ink); color: var(--wit-70); }
.bz-dag--aan .dk-naam { color: var(--yellow); }
.bz-dag--aan .pil-teller { background: var(--yellow-teller); color: var(--yellow); }
.dk-dag--week .dk-naam { text-transform: none; }
</style>
