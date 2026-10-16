<script setup lang="ts">
// Voorkeuren op /notificaties: per soort In de app, E-mail en Push (P26). Dezelfde opslag als de kaart
// Meldingen in je instellingen (persoonlijke_instellingen.data.kanalen via de sync-wachtrij, dus ook
// offline). Het oude veld meldingen[soort] = false zet een soort helemaal uit; een keuze per kanaal
// vervangt dat. Daaronder het dagritme per mail (DagritmeMailVoorkeuren).
import { kanalenVoor, MELDING_KANAAL_LABEL, MELDING_KANALEN, MELDING_SOORT_LABEL, MELDING_SOORT_UITLEG, MELDING_SOORTEN, type MeldingKanaal, type MeldingSoort } from '~~/shared/kanalen'
const emit = defineEmits<{ gewijzigd: [] }>()
const { voegToe } = useSyncQueue()
const { me, functie } = useMe()
const { data: pers } = await useFetch<{ id: string; data: Record<string, any>; versie: number }>('/api/mij/instellingen', { key: 'notificatie-kanalen' })
const kanalen = computed(() => pers.value?.data.kanalen ?? {})
const keuze = (s: MeldingSoort) => kanalenVoor(s, kanalen.value, pers.value?.data.meldingen)
const beheerKanalen = computed(() => me.value?.gebruiker?.rol === 'beheerder' && !!functie('instellingen.kanalen')?.beschikbaar)
async function wissel(s: MeldingSoort, k: MeldingKanaal, aan: boolean) {
  if (!pers.value) return
  const nieuw = { ...kanalen.value, [s]: { ...keuze(s), [k]: aan } }
  const meldingen = { ...(pers.value.data.meldingen ?? {}) }; delete meldingen[s]
  pers.value = { ...pers.value, data: { ...pers.value.data, kanalen: nieuw, meldingen } }
  await voegToe({ tabel: 'persoonlijke_instellingen', op: 'patch', recordId: pers.value.id, patch: { kanalen: nieuw, meldingen } })
  emit('gewijzigd')
}
</script>

<template>
  <section class="nk" data-test="notificatie-kanalen">
    <header class="nk-kop">
      <div>
        <h2 class="nk-titel">Hoe krijg je je meldingen?</h2>
        <p class="nk-uitleg">Kies per soort: in de app, per e-mail of als push. Gelezen geldt op al je toestellen. Een soort die in de app uit staat, zie je hier niet.</p>
      </div>
      <NuxtLink v-if="beheerKanalen" to="/instellingen/kanalen" class="nk-link" data-test="kanalen-organisatie">Kanalen van de organisatie</NuxtLink>
    </header>
    <div v-if="pers" class="nk-raster">
      <span /><span v-for="k in MELDING_KANALEN" :key="k" class="nk-kanaal">{{ MELDING_KANAAL_LABEL[k] }}</span>
      <template v-for="s in MELDING_SOORTEN" :key="s">
        <div class="nk-soort"><span class="nk-soort-naam"><span class="nk-vierkant" :class="`nk-vierkant--${s}`" />{{ MELDING_SOORT_LABEL[s] }}</span><span class="nk-soort-uitleg">{{ MELDING_SOORT_UITLEG[s] }}</span></div>
        <span v-for="k in MELDING_KANALEN" :key="k" class="nk-cel"><Schakelaar :aan="keuze(s)[k]" :label="`${MELDING_SOORT_LABEL[s]}: ${MELDING_KANAAL_LABEL[k]}`" :data-test="`kanaal-${s}-${k}`" @wissel="wissel(s, k, $event)" /></span>
      </template>
    </div>
    <DagritmeMailVoorkeuren class="nk-dagritme" />
  </section>
</template>

<style scoped>
.nk { padding: 20px 22px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); }
.nk-kop { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.nk-titel { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0 0 4px; }
.nk-uitleg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); max-width: 64ch; }
.nk-link { display: inline-flex; align-items: center; min-height: var(--touch-target-min); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; color: var(--ink); text-decoration: none; border-bottom: 2px solid var(--yellow); }
.nk-link::after { content: ' \2192'; white-space: pre; }
.nk-raster { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 72px); gap: 8px; align-items: center; }
.nk-kanaal { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); text-align: center; }
.nk-soort { display: flex; flex-direction: column; min-width: 0; padding: 6px 0; border-top: 1px solid var(--border); }
.nk-soort-naam { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.nk-soort-uitleg { font-size: 12px; color: var(--muted); line-height: 1.45; }
.nk-cel { display: flex; justify-content: center; align-items: center; min-height: var(--touch-target-min); border-top: 1px solid var(--border); }
.nk-vierkant { width: 10px; height: 10px; flex-shrink: 0; background: var(--muted); }
.nk-vierkant--kritiek { background: var(--red); }
.nk-vierkant--hot { background: var(--purple); }
.nk-vierkant--dagstart { background: var(--blue); }
.nk-vierkant--herinnering { background: var(--yellow); }
.nk-vierkant--inzicht { background: var(--green); }
.nk-vierkant--systeem { background: var(--ink); }
.nk .nk-dagritme { margin-top: 18px; padding: 16px 0 0; border: 0; border-top: 1px solid var(--border); }
@media (max-width: 719px) {
  .nk { padding: 16px; }
  .nk-raster { grid-template-columns: minmax(0, 1fr) repeat(3, 52px); gap: 6px; }
  .nk-soort-uitleg { display: none; }
}
</style>
