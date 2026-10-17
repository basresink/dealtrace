<script setup lang="ts">
// Het venster achter een cel, balk of getal op Mijn dashboard (zoals de lijst achter een fase op /funnel):
// de prospects of pogingen erachter uit GET /api/resultaten/dashboard-lijst, met dezelfde periode als het
// dashboard. Per regel de naam als link naar de accountkaart, de status prospect, de fase, een metaregel en
// de taak erachter (opent het taakvenster op /taken). Het slot `boven` toont extra cijfers, zoals bij welke
// poging de eerste afspraak kwam.
const props = defineProps<{ keuze: { blok: string; sleutel: string } | null; periode: Record<string, string | undefined> }>()
const emit = defineEmits<{ sluit: [] }>()

const query = computed(() => ({ ...props.periode, blok: props.keuze?.blok, sleutel: props.keuze?.sleutel }))
const { data, pending, error, execute } = useFetch<any>('/api/resultaten/dashboard-lijst', { query, immediate: false, watch: false, default: () => null })
watch(() => props.keuze, (k) => { if (k) execute() }, { immediate: true })
const items = computed(() => (data.value?.items ?? []) as any[])
</script>

<template>
  <FlyoutShell v-if="keuze" open :kicker="data?.kicker ?? 'Mijn dashboard'" :titel="data?.titel ?? 'Laden…'" :meta="data?.meta ?? null" titel-id="dl-titel" data-test="dashboard-lijst" @sluit="emit('sluit')">
    <div class="fo-body dl-body">
      <slot name="boven" />
      <p v-if="pending && !data" class="dl-leeg">Laden…</p>
      <p v-else-if="error" class="dl-leeg">Kon de lijst niet laden.</p>
      <p v-else-if="!items.length" class="dl-leeg" data-test="dashboard-lijst-leeg">Hier zitten nu geen prospects achter.</p>
      <ul v-else class="dl-lijst">
        <li v-for="i in items" :key="i.id" class="dl-rij" data-test="dashboard-lijst-rij">
          <div class="dl-kop">
            <NuxtLink v-if="i.accountId" :to="`/accounts/${i.accountId}`" class="dl-naam">{{ i.naam }}</NuxtLink>
            <span v-else class="dl-naam dl-naam--tekst">{{ i.naam }}</span>
            <Label v-if="i.prospectStatus" soort="prospectstatus" :waarde="i.prospectStatus" />
          </div>
          <p class="dl-meta"><span v-if="i.fase">{{ i.fase }}</span><span v-for="m in i.meta" :key="m">{{ m }}</span></p>
          <FunctieLink v-if="i.taak" :to="`/taken?taak=${i.taak.id}`" class="dl-taak" data-test="dashboard-lijst-taak"><Icoon naam="SquareCheck" :grootte="14" />{{ i.taak.titel }}</FunctieLink>
        </li>
      </ul>
    </div>
  </FlyoutShell>
</template>

<style scoped>
.dl-body { display: flex; flex-direction: column; gap: 12px; }
.dl-leeg { margin: 0; font-size: 13px; color: var(--muted); }
.dl-lijst { list-style: none; margin: 0; padding: 0; }
.dl-rij { display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.dl-kop { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dl-naam { display: inline-flex; align-items: center; min-height: 32px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.dl-naam--tekst { color: var(--muted); }
.dl-meta { display: flex; flex-wrap: wrap; gap: 2px 10px; margin: 0; font-size: 12px; color: var(--muted); }
.dl-taak { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; min-height: 32px; font-size: 13px; color: var(--ink); }
@media (max-width: 767px) {
  .dl-naam, .dl-taak { min-height: var(--touch-target-min); }
}
</style>
