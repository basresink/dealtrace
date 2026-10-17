<script setup lang="ts">
// Archiveren met overdracht (pakket B). Laat vooraf zien hoeveel prospects, open taken en lopende reeksen
// verhuizen en vraagt aan wie (standaard de manager van het team). Overdracht is verplicht zodra er iets is.
interface Stand {
  gebruiker: { id: string; naam: string }
  prospects: number
  taken: number
  reeksen: number
  standaard: string | null
  ontvangers: { id: string; naam: string; rol: string }[]
}
const props = defineProps<{ gebruiker: { id: string; naam: string } | null }>()
const emit = defineEmits<{ gearchiveerd: [uit: { naar: string | null; prospects: number; taken: number; reeksen: number }]; geannuleerd: [] }>()

const stand = ref<Stand | null>(null)
const naar = ref('')
const laadFout = ref('')
const bezig = ref(false)
const fout = ref('')
const ROL: Record<string, string> = { accountmanager: 'accountmanager', salesmanager: 'salesmanager', beheerder: 'beheerder' }

watch(() => props.gebruiker?.id, async (id) => {
  stand.value = null
  naar.value = ''
  fout.value = ''
  laadFout.value = ''
  if (!id) return
  try {
    stand.value = await $fetch<Stand>(`/api/gebruikers/${id}/overdracht`)
    naar.value = stand.value.standaard ?? ''
  } catch (e: any) { laadFout.value = e?.data?.statusMessage ?? 'Kon niet laden wat er verhuist' }
}, { immediate: true })

const iets = computed(() => !!stand.value && stand.value.prospects + stand.value.taken + stand.value.reeksen > 0)
const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`
const samenvatting = computed(() => {
  const s = stand.value
  if (!s) return ''
  return [meervoud(s.prospects, 'prospect', 'prospects'), meervoud(s.taken, 'open taak', 'open taken'), meervoud(s.reeksen, 'lopende reeks', 'lopende reeksen')].join(', ').replace(/, ([^,]*)$/, ' en $1')
})
const kan = computed(() => !!stand.value && !bezig.value && (!iets.value || !!naar.value))

async function bevestig() {
  if (!props.gebruiker || !kan.value) return
  bezig.value = true
  fout.value = ''
  try {
    const r = await $fetch<{ overdracht: { naar: string | null; prospects: number; taken: number; reeksen: number } }>(`/api/gebruikers/${props.gebruiker.id}/archiveer`, { method: 'POST', body: { naar: naar.value || null } })
    emit('gearchiveerd', r.overdracht)
  } catch (e: any) { fout.value = e?.data?.statusMessage ?? 'Archiveren mislukt' } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="gebruiker" class="cd-overlay" @click.self="emit('geannuleerd')">
      <div class="cd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="av-titel" data-test="archiveer-venster">
        <div class="cd-head"><h2 id="av-titel" class="cd-title">{{ gebruiker.naam }} archiveren</h2></div>
        <p class="cd-message">{{ gebruiker.naam }} kan daarna niet meer inloggen. Zijn gegevens en geschiedenis blijven bewaard; je kunt hem later heractiveren.</p>
        <p v-if="laadFout" class="av-fout" role="alert">{{ laadFout }}</p>
        <p v-else-if="!stand" class="cd-message">Even kijken wat er verhuist…</p>
        <template v-else>
          <div v-if="iets" class="av-blok" data-test="archiveer-telling">
            <p class="av-kop">Dit gaat over: {{ samenvatting }}.</p>
            <label class="veld">
              <span class="veld-label">Draag over aan <span class="veld-verplicht">verplicht</span></span>
              <select v-model="naar" class="invoer" data-test="archiveer-naar">
                <option value="" disabled>Kies een collega</option>
                <option v-for="o in stand.ontvangers" :key="o.id" :value="o.id">{{ o.naam }} · {{ ROL[o.rol] ?? o.rol }}{{ o.id === stand.standaard ? ' (manager van het team)' : '' }}</option>
              </select>
            </label>
            <p class="veld-uitleg">Prospects gaan met hun open taken mee. Lopende reeksen lopen door op naam van de nieuwe eigenaar.</p>
          </div>
          <p v-else class="cd-message" data-test="archiveer-niets">Er staan geen prospects, open taken of lopende reeksen op zijn naam. Er hoeft niets over te gaan.</p>
        </template>
        <p v-if="fout" class="av-fout" role="alert" data-test="archiveer-fout">{{ fout }}</p>
        <div class="cd-foot">
          <button type="button" class="cd-btn cd-btn--ghost" @click="emit('geannuleerd')">Annuleren</button>
          <button type="button" class="cd-btn cd-btn--danger" data-test="archiveer-bevestig" :disabled="!kan" @click="bevestig">{{ iets ? 'Overdragen en archiveren' : 'Archiveer' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.av-blok { display: flex; flex-direction: column; gap: 10px; margin: 0 0 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); }
.av-kop { margin: 0; font-weight: 600; color: var(--ink); }
.av-fout { margin: 0 0 12px; color: var(--red); font-size: 13px; font-weight: 600; }
.av-blok .invoer { min-height: var(--touch-target-min); }
</style>
