<script setup lang="ts">
// Inzichtkaart in de opzet van DealDrive (SignalCard), met het labelsysteem: een rustige kop met de
// accountnaam en Klant of Prospect als randlabel, daaronder de bron (Intern, Extern of Agenda) als
// randlabel met icoon, de soort en de datum, de relevantie als scorelabel (vanaf 75 met vlam), de titel,
// het waarom, de AI-context met het paarse AI-label en de voet met "+ Maak taak" en "Markeer als gelezen".
// Een klik op de kaart opent de inzichtflyout.
import { labelDef } from '~~/shared/labels'
const props = defineProps<{ inzicht: any }>()
const emit = defineEmits<{ open: []; taak: []; gelezen: [] }>()

/** Icoon van de soort voor de bronregel (zonder kleur: het icoon draagt het onderscheid). */
const soortIcoon = computed(() => labelDef('inzichtsoort', props.inzicht.type)?.icoon ?? null)
const gelezen = computed(() => props.inzicht.status === 'gelezen')
const afgewezen = computed(() => props.inzicht.status === 'afgewezen')

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
      <Label v-if="inzicht.account?.soort" soort="account" :waarde="inzicht.account.soort === 'klant' ? 'klant' : 'prospect'" />
    </div>
    <div class="ik-vlak">
      <header class="ik-kop">
        <Label soort="bron" :waarde="['intern', 'extern', 'agenda'].includes(inzicht.tag) ? inzicht.tag : 'intern'" data-test="ik-bron" />
        <span class="ik-meta tnum"><Icoon v-if="soortIcoon" :naam="soortIcoon" :grootte="13" /><strong>{{ inzicht.bronLabel }}</strong><span class="ik-punt">·</span><time :datetime="inzicht.createdAt">{{ wanneer }}</time></span>
        <Label class="ik-score" soort="score" :waarde="inzicht.relevantie" :titel="`Relevantie ${inzicht.relevantie}`" data-test="ik-score" />
      </header>
      <h3 class="ik-titel"><button type="button" class="ik-titel-knop" @click.stop="emit('open')">{{ inzicht.title }}</button></h3>
      <p v-if="inzicht.waarom" class="ik-tekst">{{ inzicht.waarom }}</p>
      <div v-if="inzicht.context" class="ik-context" data-test="ai-context"><Label soort="ai" waarde="context" class="ik-context-kop" />{{ inzicht.context }}</div>
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
.ik-balk { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px 8px 22px; background: var(--wit); border: 1px solid var(--border); border-bottom: 1px solid var(--border); min-height: 40px; transition: border-color var(--transition-fast); }
.ik-account { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ik-vlak { flex: 1; display: flex; flex-direction: column; background: var(--wit); border: 1px solid var(--border); border-top: 0; padding: 20px 22px; transition: border-color var(--transition-fast); }
.ik:hover .ik-vlak, .ik:hover .ik-balk { border-color: var(--ink-soft); }
.ik--gelezen .ik-vlak { background: var(--surface); }
.ik--gelezen .ik-titel, .ik--gelezen .ik-titel-knop { all: unset; cursor: pointer; }
.ik-titel-knop:focus-visible { outline: 2px solid var(--yellow-dark); outline-offset: 2px; }
.ik-tekst { opacity: 0.75; }
.ik-kop { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ik-meta { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); min-width: 0; }
.ik-meta strong { color: var(--ink); font-weight: 600; }
.ik-punt { color: var(--muted-light); }
.ik-score { margin-left: auto; }
.ik-titel { font-family: var(--font-serif); font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; margin: 0 0 10px; color: var(--ink); overflow-wrap: anywhere; }
.ik-titel-knop { all: unset; cursor: pointer; }
.ik-titel-knop:focus-visible { outline: 2px solid var(--yellow-dark); outline-offset: 2px; }
.ik-tekst { font-size: 14px; line-height: 1.55; color: var(--ink-soft); margin: 0 0 14px; }
.ik-context { background: var(--surface); border-left: 3px solid var(--lbl-paars-rand); padding: 12px 16px; font-size: 13px; line-height: 1.5; color: var(--ink-soft); margin: 0 0 16px; }
.ik-context-kop { display: flex; width: fit-content; margin-bottom: 6px; }
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
