<script setup lang="ts">
// Inzichtkaart in de opzet van DealDrive (SignalCard): een zwarte kopbalk met de accountnaam en
// Klant of Prospect, daaronder de tag (Intern, Extern of Agenda), de bron met een gekleurd vierkantje
// en de datum, de relevantie in een gele tegel, de titel, het waarom, de AI-context en de voet met
// "+ Maak taak" en "Markeer als gelezen". Een klik op de kaart opent de inzichtflyout.
const props = defineProps<{ inzicht: any }>()
const emit = defineEmits<{ open: []; taak: []; gelezen: [] }>()

const KLEUR: Record<string, string> = {
  vacature: 'var(--purple)', nieuws: 'var(--ink)', website: 'var(--green)', kvk: 'var(--orange)', aanbesteding: 'var(--blue)',
  koopsignaal: 'var(--green)', 'te-lang-in-fase': 'var(--red)', kansanalyse: 'var(--yellow-dark)', 'campagne-achterstand': 'var(--purple)',
  agenda: 'var(--blue)', 'regel-voorstel': 'var(--muted)',
}
const kleur = computed(() => KLEUR[props.inzicht.type] ?? (props.inzicht.bron === 'extern' ? 'var(--blue)' : 'var(--ink)'))
const gelezen = computed(() => props.inzicht.status === 'gelezen')
const afgewezen = computed(() => props.inzicht.status === 'afgewezen')
const TAG: Record<string, string> = { intern: 'Intern', extern: 'Extern', agenda: 'Agenda' }

// Dagen in Amsterdamse tijd, zodat server en browser dezelfde tekst tonen.
const dag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const wanneer = computed(() => {
  const op = new Date(props.inzicht.createdAt)
  const verschil = Math.round((Date.parse(dag(new Date())) - Date.parse(dag(op))) / 864e5)
  if (verschil <= 0) return 'vandaag'
  if (verschil === 1) return 'gisteren'
  if (verschil < 7) return `${verschil} dgn`
  return op.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
})
</script>

<template>
  <article class="ik inzicht-kaart" :class="{ 'ik--gelezen': gelezen }" :data-test="`inzicht-${inzicht.id}`" @click="emit('open')">
    <div class="ik-balk">
      <span class="ik-account">{{ inzicht.account?.naam ?? 'Zonder account' }}</span>
      <span v-if="inzicht.account?.soort" class="ik-soort">{{ inzicht.account.soort === 'klant' ? 'Klant' : 'Prospect' }}</span>
    </div>
    <div class="ik-vlak">
      <header class="ik-kop">
        <span class="ik-tag" :class="`ik-tag--${inzicht.tag}`">{{ TAG[inzicht.tag] ?? 'Intern' }}</span>
        <span class="ik-meta tnum"><span class="ik-vierkant" :style="{ background: kleur }" /><strong>{{ inzicht.bronLabel }}</strong><span class="ik-punt">·</span><time :datetime="inzicht.createdAt">{{ wanneer }}</time></span>
        <span class="ik-score tnum" :title="`Relevantie ${inzicht.relevantie}`">{{ inzicht.relevantie }}</span>
      </header>
      <h3 class="ik-titel"><button type="button" class="ik-titel-knop" @click.stop="emit('open')">{{ inzicht.title }}</button></h3>
      <p v-if="inzicht.waarom" class="ik-tekst">{{ inzicht.waarom }}</p>
      <div v-if="inzicht.context" class="ik-context" data-test="ai-context"><span class="ik-context-kop">AI-context</span>{{ inzicht.context }}</div>
      <footer v-if="afgewezen" class="ik-voet" data-test="kaart-afgewezen">
        <span class="ik-afgewezen"><Icoon naam="X" :grootte="14" />Afgewezen<template v-if="inzicht.afwijsReden">: {{ inzicht.afwijsReden }}</template></span>
      </footer>
      <footer v-else class="ik-voet">
        <button type="button" class="ik-taak" @click.stop="emit('taak')">+ Maak taak</button>
        <button v-if="!gelezen" type="button" class="ik-gelezen" data-test="kaart-gelezen" @click.stop="emit('gelezen')">Markeer als gelezen</button>
        <span v-else class="ik-gelezen-pil"><Icoon naam="CircleCheck" :grootte="14" />Gelezen</span>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.ik { display: flex; flex-direction: column; gap: 0; cursor: pointer; min-width: 0; transition: transform var(--transition-fast); }
.ik:hover { transform: translateY(-1px); }
.ik-balk { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: var(--ink); min-height: 36px; }
.ik-account { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--yellow); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ik-soort { flex-shrink: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--yellow); }
.ik-vlak { flex: 1; display: flex; flex-direction: column; background: var(--wit); border: 1px solid var(--border); border-top: 0; padding: 20px 22px; transition: border-color var(--transition-fast); }
.ik:hover .ik-vlak { border-color: var(--ink-soft); }
.ik--gelezen .ik-vlak { background: var(--surface); }
.ik--gelezen .ik-titel, .ik--gelezen .ik-titel-knop { all: unset; cursor: pointer; }
.ik-titel-knop:focus-visible { outline: 2px solid var(--yellow-dark); outline-offset: 2px; }
.ik-tekst { opacity: 0.75; }
.ik-kop { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ik-tag { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 7px; border: 1px solid var(--ink); border-radius: 2px; }
.ik-tag--intern { background: var(--ink); color: var(--yellow); }
.ik-tag--extern { background: transparent; color: var(--ink); }
.ik-tag--agenda { background: transparent; color: var(--blue); border-color: var(--blue); }
.ik-meta { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); min-width: 0; }
.ik-meta strong { color: var(--ink); font-weight: 600; }
.ik-vierkant { width: 10px; height: 10px; display: inline-block; flex-shrink: 0; }
.ik-punt { color: var(--muted-light); }
.ik-score { margin-left: auto; font-size: 14px; font-weight: 700; color: var(--ink); background: var(--yellow); padding: 2px 8px; }
.ik-titel { font-family: var(--font-serif); font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; margin: 0 0 10px; color: var(--ink); overflow-wrap: anywhere; }
.ik-titel-knop { all: unset; cursor: pointer; }
.ik-titel-knop:focus-visible { outline: 2px solid var(--yellow-dark); outline-offset: 2px; }
.ik-tekst { font-size: 14px; line-height: 1.55; color: var(--ink-soft); margin: 0 0 14px; }
.ik-context { background: var(--surface); border-left: 3px solid var(--yellow); padding: 12px 16px; font-size: 13px; line-height: 1.5; color: var(--ink-soft); margin: 0 0 16px; }
.ik-context-kop { display: block; font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: var(--yellow-dark); margin-bottom: 4px; }
.ik-voet { margin-top: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid var(--border); }
.ik-taak { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; background: var(--ink); color: var(--yellow); border: 1px solid var(--ink); border-radius: 2px; font-size: 12px; font-weight: 700; cursor: pointer; }
.ik-taak:hover { background: var(--ink-soft); }
.ik-gelezen { margin-left: auto; min-height: 36px; padding: 0 10px; background: transparent; color: var(--muted); border: 1px solid transparent; border-radius: 2px; font-size: 12px; font-weight: 600; cursor: pointer; }
.ik-gelezen:hover { color: var(--ink); border-color: var(--border); }
.ik-afgewezen { display: inline-flex; align-items: center; gap: 4px; min-width: 0; font-size: 12px; font-weight: 600; color: var(--muted); overflow-wrap: anywhere; }
.ik-gelezen-pil { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--green); }
@media (max-width: 719px) {
  .ik-vlak { padding: 16px; }
  .ik-taak, .ik-gelezen { min-height: var(--touch-target-min); }
}
</style>
