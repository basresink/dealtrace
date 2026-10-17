<script setup lang="ts">
// Belprioriteit op Bezoeken en Meetings: de bellijst van vandaag (zelfde rangorde als Belblokken, zonder wie
// je die dag al bezoekt of spreekt) als kaarten in een raster, Top 5 of Top 10. Een klik op een kaart opent de
// beltaak in het taakvenster; een kandidaat zonder open beltaak krijgt eerst een beltaak (POST /api/tasks,
// eigenaar jij, aanleiding de bellijst) en die opent dan. Geen belknop per kaart: het nummer staat als link op de kaart.
const props = withDefaults(defineProps<{ lijst: any[]; kan: boolean; sleutel?: string; titel?: string; uitleg?: string; smal?: boolean }>(), {
  sleutel: 'bezoeken.bellijst', titel: 'Bel-prioriteit naast je bezoeken', uitleg: '', smal: false,
})
const emit = defineEmits<{ taak: [id: string]; gemaakt: [] }>()
const toast = useToast()
const bezig = ref<string | null>(null)
async function open(b: any) {
  if (b.taskId) { emit('taak', b.taskId); return }
  if (bezig.value) return
  bezig.value = b.accountId
  try {
    const t = await $fetch<{ id: string }>('/api/tasks', { method: 'POST', body: { title: `Bellen: ${b.accountNaam}`, actionType: 'bellen', accountId: b.accountId, contactId: b.contactId ?? undefined, aanleiding: `Uit de bellijst van vandaag: ${b.reden}` } })
    b.taskId = t.id
    emit('gemaakt')
    emit('taak', t.id)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
const top = ref<5 | 10>(5)
const zichtbaar = computed(() => props.lijst.slice(0, top.value))
</script>

<template>
  <div class="bp">
    <header class="bp-kop">
      <div>
        <span class="kicker kicker--streep">Bellijst · vandaag</span>
        <h2 class="bp-titel">{{ titel }}</h2>
        <p v-if="uitleg" class="bp-uitleg">{{ uitleg }}</p>
      </div>
      <div v-if="kan" class="keuzegroep keuzegroep--klein" role="group" aria-label="Aantal">
        <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': top === 5 }" :aria-pressed="top === 5" data-test="bel-top-5" @click="top = 5">Top 5</button>
        <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': top === 10 }" :aria-pressed="top === 10" data-test="bel-top-10" @click="top = 10">Top 10</button>
      </div>
    </header>
    <ol v-if="kan && zichtbaar.length" class="bp-raster" :class="{ 'bp-raster--smal': smal }">
      <DagKaart v-for="(b, i) in zichtbaar" :key="b.accountId" tag="li" :data-test="`bel-kaart-${b.accountId}`">
        <div class="dp-kaart-kop">
          <span class="bp-rang tnum">{{ Number(i) + 1 }}</span>
          <button type="button" class="dp-kaart-titel" :disabled="bezig === b.accountId" :data-test="`bel-open-${b.accountId}`" @click="open(b)">{{ b.accountNaam }}</button>
        </div>
        <p class="dp-kaart-tekst">{{ b.reden }}</p>
        <p v-if="b.contactNaam" class="bp-contact">{{ b.contactNaam }}<template v-if="b.telefoon"> · <a :href="`tel:${b.telefoon}`" class="dp-kaart-link tnum">{{ b.telefoon }}</a></template></p>
        <span class="dp-kaart-pillen"><Label soort="score" :waarde="b.score" :tekst="`Score ${b.score}`" /><span v-if="b.openTaken" class="pil">{{ b.openTaken }} open {{ b.openTaken === 1 ? 'taak' : 'taken' }}</span><Label v-if="b.heet" soort="status" waarde="heet" /><span v-if="!b.taskId" class="pil pil--grijs">Geen taak</span></span>
      </DagKaart>
    </ol>
    <p v-else-if="kan" class="bp-leeg">Niemand om te bellen.</p>
  </div>
</template>

<style scoped>
.bp-kop { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 18px; }
.bp-titel { margin: 8px 0 0; font-family: var(--font-serif); font-size: var(--fs-venstertitel); font-weight: 700; color: var(--ink); }
.bp-uitleg { margin: 6px 0 0; max-width: 620px; font-size: var(--fs-klein); line-height: 1.5; color: var(--ink-soft); }
.bp-leeg { margin: 0; padding: 24px 0; font-size: var(--fs-klein); font-style: italic; color: var(--muted); }
.bp-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: var(--kaart-gap, 16px); }
.bp-raster--smal { grid-template-columns: minmax(0, 1fr); gap: 10px; }
.bp-rang { font-family: var(--font-serif); font-size: 24px; font-weight: 700; line-height: 1; color: var(--yellow-dark); min-width: 22px; }
.bp-contact { width: fit-content; max-width: 100%; margin: 0; padding: 4px 10px; background: var(--surface); border-left: 3px solid var(--ink); font-size: var(--fs-meta); font-weight: 700; overflow-wrap: anywhere; }
@media (max-width: 719px) { .keuzegroep-knop { min-height: 44px; } }
</style>
