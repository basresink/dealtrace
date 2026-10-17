<script setup lang="ts">
// Bellijst op /belblokken: Top 5, 10 of 15 (zelfde rangorde als belmodus en vuller) of zelf
// kiezen. De top staat geel en geselecteerd, de rest grijs eronder. Top 10 en 15 vanaf
// Gevorderd; daaronder een slot met uitleg.
import { nlMoment } from '~~/shared/datum'

export interface BelRij {
  accountId: string
  accountNaam: string
  contactNaam?: string | null
  taskId?: string | null
  due?: string | null
  reden: string
  duur: number
  pil: string
  belblokId?: string | null
}

const props = defineProps<{ rijen: BelRij[]; kop: string; topOpties: number[] }>()
const top = defineModel<number | 'zelf'>('top', { required: true })
const zelf = defineModel<Set<string>>('zelf', { required: true })

const vandaag = nlMoment(new Date()).datum
const datumKort = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
/** "achterstallig sinds 3 okt", "vandaag" of niets (later of zonder datum). */
function wanneer(k: BelRij): string | null {
  if (!k.due) return null
  const d = nlMoment(new Date(k.due)).datum
  return d < vandaag ? `achterstallig sinds ${datumKort(k.due)}` : d === vandaag ? 'vandaag' : null
}
const inTop = (i: number) => top.value !== 'zelf' && i < top.value
const gekozen = (k: BelRij, i: number) => (top.value === 'zelf' ? zelf.value.has(k.accountId) : inTop(i))
function kies(id: string) { const n = new Set(zelf.value); n.has(id) ? n.delete(id) : n.add(id); zelf.value = n }
// Alleen de lengtes die aanstaan, staan er (wens: geen knop naar een uitgezette functie).
function kiesTop(n: number) { if (props.topOpties.includes(n)) top.value = n }
/** Reden in de bellijst als label: urgent gevuld, een kans zacht oranje, de rest een rand. */
const belLabel = (p: string) => (p === 'Urgent' ? { soort: 'prioriteit', waarde: 'urgent', tekst: p } : p === 'Kans' ? { soort: 'prioriteit', waarde: 'hoog', tekst: p } : { soort: 'actie', waarde: 'bellen', tekst: p })
</script>

<template>
  <div class="bl-kaart">
    <div class="bl-kop">
      <h2 class="bl-titel" data-test="bellijst-kop">{{ kop }}</h2>
      <div class="bl-keuze" role="group" aria-label="Lengte bellijst">
        <button
          v-for="n in [5, 10, 15].filter((x) => topOpties.includes(x))" :key="n" type="button" class="bl-keuzeknop keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': top === n, 'bl-keuzeknop--aan': top === n }"
          :aria-pressed="top === n" :data-test="`top-${n}`" @click="kiesTop(n)"
        >Top {{ n }}</button>
        <button type="button" class="bl-keuzeknop keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': top === 'zelf', 'bl-keuzeknop--aan': top === 'zelf' }" :aria-pressed="top === 'zelf'" data-test="zelf-kiezen" @click="top = 'zelf'">Zelf kiezen</button>
      </div>
    </div>
    <LegeStaat v-if="!rijen.length" titel="Er staat niemand op je bellijst." tekst="De motor zet nieuwe belpogingen klaar zodra ze aan de beurt zijn." />
    <ol v-else class="bl-lijst" data-test="bellijst">
      <template v-for="(k, i) in rijen" :key="k.accountId">
        <li v-if="top !== 'zelf' && i === top && i > 0" class="bl-grens">Grens Top {{ top }}. Hieronder valt buiten je keuze</li>
        <li class="bl-rij" :class="{ 'bl-rij--in': gekozen(k, Number(i)), 'bl-rij--buiten': top !== 'zelf' && !inTop(Number(i)), 'bl-rij--blok': !!k.belblokId }" :data-test="`bel-${k.accountId}`">
          <label v-if="top === 'zelf'" class="bl-vink">
            <input type="checkbox" :checked="zelf.has(k.accountId)" :aria-label="`Kies ${k.accountNaam}`" @change="kies(k.accountId)">
          </label>
          <span class="bl-rang tnum" aria-hidden="true">{{ Number(i) + 1 }}</span>
          <div class="bl-info">
            <NuxtLink :to="`/accounts/${k.accountId}`" class="bl-naam">{{ k.accountNaam }}</NuxtLink>
            <div class="bl-meta">
              <span>{{ k.contactNaam ?? 'geen contact' }}</span><span>{{ k.reden }}</span><span v-if="wanneer(k)" :class="{ 'bl-laat': wanneer(k)!.startsWith('achter') }">{{ wanneer(k) }}</span><span class="tnum">{{ k.duur }} min</span>
            </div>
          </div>
          <div class="bl-labels">
            <Label v-bind="belLabel(k.pil)" />
            <span v-if="k.belblokId" class="pil pil--leeg">in een blok</span>
          </div>
        </li>
      </template>
    </ol>
  </div>
</template>

<style scoped>
.bl-kaart { background: var(--wit); border: 1px solid var(--border); min-width: 0; }
.bl-kop { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 18px; border-bottom: 1px solid var(--border-strong); }
.bl-titel { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0; margin-right: auto; }
.bl-keuze { display: flex; border: 1px solid var(--border-strong); max-width: 100%; }
/* De globale keuzegroep-klassen blijven voor de tests; de opmaak komt hier. */
.bl-keuze .bl-keuzeknop {
  display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; min-height: var(--touch-target-min);
  font: inherit; font-size: 12px; font-weight: 700; color: var(--muted); background: var(--wit);
  border: none; border-right: 1px solid var(--border-strong); border-radius: 0; cursor: pointer; white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.bl-keuze .bl-keuzeknop:last-child { border-right: none; }
.bl-keuze .bl-keuzeknop:hover { color: var(--ink); }
.bl-keuze .bl-keuzeknop--aan, .bl-keuze .bl-keuzeknop--aan:hover { background: var(--ink); color: var(--yellow); }
.bl-keuze .bl-keuzeknop--slot { color: var(--muted); opacity: 0.7; }
.bl-lijst { list-style: none; margin: 0; padding: 0; }
.bl-rij { display: flex; align-items: center; gap: 12px; padding: 11px 18px; border-bottom: 1px solid var(--border); min-height: var(--touch-target-min); transition: background var(--transition-fast), opacity var(--transition-fast); }
.bl-rij:last-child { border-bottom: none; }
.bl-rij--in { background: rgba(254, 216, 0, 0.14); }
.bl-rij--buiten { opacity: 0.5; }
.bl-rang { font-family: var(--font-serif); font-size: 17px; font-weight: 700; color: var(--muted); width: 22px; flex-shrink: 0; text-align: right; }
.bl-rij--in .bl-rang { color: var(--ink); }
.bl-vink { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; min-height: var(--touch-target-min); cursor: pointer; flex-shrink: 0; }
.bl-vink input { width: 18px; height: 18px; accent-color: var(--ink); cursor: pointer; }
.bl-info { min-width: 0; flex: 1; }
.bl-naam { font-weight: 700; font-size: 14px; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.bl-naam:hover { text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 2px; }
.bl-meta { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.bl-meta > span + span::before { content: '·'; margin: 0 5px; }
.bl-laat { color: var(--red); }
.bl-labels { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.bl-labels .pil { text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; font-weight: 800; }
.bl-grens { padding: 6px 18px; background: var(--surface); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); }
@media (max-width: 480px) {
  .bl-kop, .bl-rij { padding-left: 12px; padding-right: 12px; }
  .bl-keuze { width: 100%; }
  .bl-keuze .bl-keuzeknop { flex: 1; justify-content: center; padding: 6px 4px; }
  .bl-rij { gap: 8px; }
}
</style>
