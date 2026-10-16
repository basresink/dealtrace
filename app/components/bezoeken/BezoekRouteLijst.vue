<script setup lang="ts">
// Routelijst van één dag in de opzet van DealDrive (RouteList): een dagkop met het aantal stops en
// de duur, per stop de tijd met duur en VOLGENDE, de titel, het account en het adres, en de acties
// van Dealtrace (Navigeer, Open, Rond af). Tussen de stops de reistijd als die bekend is.
import { duurLabel, kaartLink, type Kaartapp } from '~~/shared/route'
const props = defineProps<{ datum: string; stops: any[]; app: Kaartapp; nummerVanaf?: number; leegTekst?: string }>()
const emit = defineEmits<{ open: [id: string] }>()
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const minuten = (s: any) => Math.max(0, Math.round((Date.parse(s.eind) - Date.parse(s.start)) / 60_000))
const dagKop = computed(() => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${props.datum}T12:00:00Z`)))
const totaal = computed(() => duurLabel(props.stops.reduce((s, x) => s + minuten(x), 0)))
</script>

<template>
  <div class="rl" :data-test="`routedag-${datum}`">
    <header class="rl-dag">
      <strong>{{ dagKop }}</strong>
      <span class="tnum">{{ stops.length }} {{ stops.length === 1 ? 'stop' : 'stops' }} · {{ totaal }}</span>
    </header>
    <p v-if="!stops.length" class="rl-leeg">{{ leegTekst ?? 'Geen bezoeken gepland op deze dag.' }}</p>
    <template v-for="(s, i) in stops" :key="s.id">
      <article class="rl-item" :class="{ 'rl-item--volgende': s.volgende }" :data-test="`stop-${s.id}`">
        <div class="rl-tijd">
          <span class="rl-van tnum">{{ tijd(s.start) }}</span>
          <span class="rl-duur tnum">{{ duurLabel(minuten(s)) }}</span>
          <span v-if="s.volgende" class="rl-badge">Volgende</span>
          <span v-else-if="s.status === 'afgerond'" class="rl-badge rl-badge--af">Afgerond</span>
        </div>
        <div class="rl-body">
          <h3 class="rl-titel">
            <span class="rl-nr tnum">{{ (nummerVanaf ?? 0) + Number(i) + 1 }}</span>
            <NuxtLink v-if="s.accountId" :to="`/accounts/${s.accountId}`">{{ s.accountNaam }}</NuxtLink>
            <template v-else>{{ s.accountNaam ?? s.titel }}</template>
          </h3>
          <p class="rl-meta"><span class="rl-soort">{{ s.titel }}</span><span>{{ s.adres || 'Geen adres bekend' }}</span><span v-if="s.geoBron && s.geoBron !== 'adres'">punt op {{ s.geoBron }}</span></p>
          <p class="rl-acties">
            <a class="dd-act" :href="kaartLink({ adres: s.adres, punt: s.punt }, app) ?? undefined" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
            <button v-if="s.soort === 'afspraak'" type="button" class="dd-act" @click="emit('open', s.id)">Open</button>
            <button v-if="s.soort === 'afspraak' && s.status === 'gepland'" type="button" class="dd-act dd-act--geel" @click="emit('open', s.id)">Rond af</button>
          </p>
        </div>
      </article>
      <p v-if="s.reistijdNaVolgende" class="rl-reis"><Icoon naam="Route" :grootte="14" />{{ s.reistijdNaVolgende.minuten }} min rijden · {{ s.reistijdNaVolgende.km }} km<template v-if="s.reistijdNaVolgende.schatting"> · schatting</template></p>
    </template>
  </div>
</template>

<style scoped>
.rl { background: var(--wit); border: 1px solid var(--border); }
.rl-dag { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: var(--fs-label); font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.rl-dag strong { color: var(--ink); }
.rl-leeg { padding: 32px 24px; margin: 0; text-align: center; font-size: var(--fs-body); font-style: italic; color: var(--muted); }
.rl-item { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.rl-item:last-of-type { border-bottom: 0; }
.rl-item--volgende { background: rgba(254, 216, 0, .08); border-left: 3px solid var(--yellow); padding-left: 17px; }
.rl-tijd { display: flex; flex-direction: column; gap: 2px; }
.rl-van { font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); }
.rl-duur { font-size: var(--fs-label); color: var(--muted); }
.rl-badge { width: fit-content; margin-top: 4px; padding: 1px 5px; background: var(--red); color: var(--wit); font-size: var(--fs-label); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.rl-badge--af { background: var(--surface); color: var(--muted); }
.rl-titel { display: flex; align-items: baseline; gap: 8px; margin: 0 0 6px; font-family: var(--font-serif); font-size: 16px; font-weight: 700; line-height: 1.25; }
.rl-titel a { color: var(--ink); text-decoration: none; }
.rl-titel a:hover { text-decoration: underline; text-underline-offset: 3px; }
.rl-nr { display: inline-grid; place-items: center; flex: 0 0 22px; height: 22px; background: var(--ink); color: var(--yellow); border: 2px solid var(--yellow); font-family: var(--font-sans); font-size: var(--fs-label); font-weight: 800; }
.rl-item--volgende .rl-nr { background: var(--red); color: var(--wit); border-color: var(--wit); }
.rl-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 8px; font-size: var(--fs-meta); color: var(--muted); }
.rl-soort { font-weight: 600; color: var(--ink); }
.rl-acties { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.rl-reis { display: flex; align-items: center; gap: 6px; margin: 0; padding: 6px 20px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: var(--fs-meta); color: var(--muted); }
@media (max-width: 600px) {
  .rl-item { grid-template-columns: 1fr; gap: 6px; padding: 14px 16px; }
  .rl-tijd { flex-direction: row; align-items: baseline; gap: 8px; }
  .rl-acties .dd-act { min-height: 44px; }
}
</style>
