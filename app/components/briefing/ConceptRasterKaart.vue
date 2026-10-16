<script setup lang="ts">
// Conceptkaart in het raster van /concepten, in de opzet van de inzichtkaart: een zwarte kopbalk met de
// accountnaam en Klant of Prospect, daaronder de soort (mail, belscript, taakvoorstel, WhatsApp), de agent
// die het klaarzette en de datum, de status, het onderwerp, de eerste regels, het contact en de knoppen.
// Een klik op de kaart opent de ConceptFlyout met het volledige concept.
import { agentLabel, CONCEPT_STATUS, eersteRegels, soortLabel, statusFilter } from '~~/shared/concepten'
const props = defineProps<{ concept: any; metEigenaar?: boolean }>()
const emit = defineEmits<{ open: []; gewijzigd: [] }>()
const c = computed(() => props.concept)
const { bezig, besluit, verstuur } = useConceptActies(c, () => emit('gewijzigd'))

const status = computed(() => statusFilter(c.value.status))
const titel = computed(() => {
  const x = c.value.concept ?? {}
  if (x.onderwerp) return x.onderwerp as string
  if (x.type === 'taak' && x.tekst) return String(x.tekst)
  return `${soortLabel(x.type)}${c.value.account?.naam ? ` voor ${c.value.account.naam}` : ''}`
})
const regels = computed(() => (c.value.concept?.type === 'taak' && !c.value.concept?.onderwerp ? c.value.concept?.aanleiding ?? '' : eersteRegels(c.value.concept)))

// Dagen in Amsterdamse tijd, zodat server en browser dezelfde tekst tonen.
const dag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const wanneer = computed(() => {
  const op = new Date(c.value.op)
  const verschil = Math.round((Date.parse(dag(new Date())) - Date.parse(dag(op))) / 864e5)
  if (verschil <= 0) return 'vandaag'
  if (verschil === 1) return 'gisteren'
  if (verschil < 7) return `${verschil} dgn`
  return op.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
})
const ICOON: Record<string, string> = { mail: 'Mail', whatsapp: 'MessageCircle', linkedin: 'Linkedin', belscript: 'Phone', briefing: 'FileText', taak: 'ListTodo' }
</script>

<template>
  <article class="ck" :class="[`ck--${status}`]" :data-test="`concept-${c.id}`" @click="emit('open')">
    <div class="ck-balk">
      <span class="ck-account">{{ c.account?.naam ?? c.accountNaam ?? 'Zonder account' }}</span>
      <span v-if="c.account?.soort" class="ck-soort">{{ c.account.soort === 'klant' ? 'Klant' : 'Prospect' }}</span>
    </div>
    <div class="ck-vlak">
      <header class="ck-kop">
        <span class="ck-tag" :class="`ck-tag--${c.concept?.type ?? 'leeg'}`" data-test="concept-soort"><Icoon :naam="ICOON[c.concept?.type] ?? 'FileText'" :grootte="12" />{{ soortLabel(c.concept?.type) }}</span>
        <span class="ck-meta tnum"><strong>{{ agentLabel(c.agent) }}</strong><span class="ck-punt">·</span><time :datetime="c.op">{{ wanneer }}</time></span>
        <span class="ck-status" :class="`ck-status--${status}`" data-test="concept-status">{{ CONCEPT_STATUS[status] ?? status }}</span>
      </header>
      <h3 class="ck-titel"><button type="button" class="ck-titel-knop" @click.stop="emit('open')">{{ titel }}</button></h3>
      <p v-if="regels" class="ck-tekst">{{ regels }}</p>
      <p v-if="c.contact || (metEigenaar && c.gebruiker)" class="ck-contact">
        <template v-if="c.contact"><Icoon naam="CircleUser" :grootte="13" />{{ c.contact.naam }}<template v-if="c.contact.functie"> · {{ c.contact.functie }}</template></template>
        <template v-if="metEigenaar && c.gebruiker"><span v-if="c.contact" class="ck-punt">·</span>van {{ String(c.gebruiker).replace(/^Testgebruiker /, '') }}</template>
      </p>
      <footer class="ck-voet">
        <template v-if="c.status === 'klaar'">
          <button type="button" class="ck-primair" data-test="kaart-goedkeuren" @click.stop="besluit('goedkeuren')">Goedkeuren</button>
          <button type="button" class="ck-stil" data-test="kaart-afwijzen" @click.stop="besluit('verwerpen')">Afwijzen</button>
        </template>
        <template v-else-if="c.status === 'goedgekeurd' && c.concept?.type === 'mail'">
          <button type="button" class="ck-primair" :disabled="bezig" data-test="kaart-verstuur" @click.stop="verstuur">Verstuur</button>
          <button type="button" class="ck-stil" @click.stop="emit('open')">Bekijk</button>
        </template>
        <button v-else type="button" class="ck-stil ck-stil--links" @click.stop="emit('open')">Bekijk concept</button>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.ck { display: flex; flex-direction: column; cursor: pointer; min-width: 0; transition: transform var(--transition-fast); }
.ck:hover { transform: translateY(-1px); }
.ck-balk { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: var(--ink); min-height: 36px; }
.ck-account { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--yellow); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ck-soort { flex-shrink: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--yellow); }
.ck-vlak { flex: 1; display: flex; flex-direction: column; background: var(--wit); border: 1px solid var(--border); border-top: 0; padding: 20px 22px; transition: border-color var(--transition-fast); }
.ck:hover .ck-vlak { border-color: var(--ink-soft); }
.ck--verstuurd .ck-vlak, .ck--afgewezen .ck-vlak { background: var(--surface); }
.ck-kop { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ck-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 7px; border: 1px solid var(--ink); border-radius: 2px; background: var(--ink); color: var(--yellow); }
.ck-tag--mail { background: var(--blue); border-color: var(--blue); color: var(--wit); }
.ck-tag--whatsapp { background: var(--green); border-color: var(--green); color: var(--wit); }
.ck-tag--linkedin { background: transparent; border-color: var(--blue); color: var(--blue); }
.ck-tag--belscript { background: var(--yellow); border-color: var(--yellow); color: var(--ink); }
.ck-tag--taak { background: var(--purple); border-color: var(--purple); color: var(--wit); }
.ck-meta { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); min-width: 0; }
.ck-meta strong { color: var(--ink); font-weight: 600; }
.ck-punt { color: var(--muted-light); margin: 0 4px; }
.ck-meta .ck-punt { margin: 0; }
.ck-status { margin-left: auto; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; background: var(--yellow); color: var(--ink); }
.ck-status--goedgekeurd { background: var(--green); color: var(--wit); }
.ck-status--verstuurd { background: var(--surface); color: var(--ink); border: 1px solid var(--border); }
.ck-status--afgewezen, .ck-status--mislukt { background: var(--surface); color: var(--red); border: 1px solid var(--border); }
.ck-titel { font-family: var(--font-serif); font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; margin: 0 0 10px; color: var(--ink); overflow-wrap: anywhere; }
.ck-titel-knop { all: unset; cursor: pointer; }
.ck-titel-knop:focus-visible { outline: 2px solid var(--yellow-dark); outline-offset: 2px; }
.ck-tekst { font-size: 14px; line-height: 1.55; color: var(--ink-soft); margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.ck-contact { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: 0 0 14px; }
.ck-voet { margin-top: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid var(--border); }
.ck-primair { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; background: var(--ink); color: var(--yellow); border: 1px solid var(--ink); border-radius: 2px; font-size: 12px; font-weight: 700; cursor: pointer; }
.ck-primair:hover { background: var(--ink-soft); }
.ck-primair:disabled { opacity: 0.6; cursor: wait; }
.ck-stil { margin-left: auto; min-height: 36px; padding: 0 10px; background: transparent; color: var(--muted); border: 1px solid transparent; border-radius: 2px; font-size: 12px; font-weight: 600; cursor: pointer; }
.ck-stil:hover { color: var(--ink); border-color: var(--border); }
.ck-stil--links { margin-left: 0; padding-left: 0; }
@media (max-width: 719px) {
  .ck-vlak { padding: 16px; }
  .ck-primair, .ck-stil { min-height: var(--touch-target-min); }
}
</style>
