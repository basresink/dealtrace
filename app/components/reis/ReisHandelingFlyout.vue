<script setup lang="ts">
// Kleine handelingen op de reis (F05): Fase corrigeren (met verplichte reden, meldt
// `handmatig`), Pauzeer tot, Verplaats naar reis en de terugkomdatum aanpassen.
type Soort = 'fase' | 'pauzeer' | 'verplaats' | 'terugop'
const props = defineProps<{ open: boolean; soort: Soort; account: any }>()
const emit = defineEmits<{ sluit: []; klaar: [tekst: string] }>()
const toast = useToast()
const keuze = ref('')
const reden = ref('')
const datum = ref('')
const bezig = ref(false)
watch(() => props.open, (o) => { if (o) { keuze.value = ''; reden.value = ''; datum.value = props.soort === 'terugop' ? props.account.terugkom?.datum ?? '' : '' } })
const morgen = computed(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10))
const titel = computed(() => ({ fase: 'Fase corrigeren', pauzeer: 'Pauzeer tot', verplaats: 'Verplaats naar reis', terugop: 'Terugkomdatum aanpassen' })[props.soort])
const knop = computed(() => ({ fase: 'Fase zetten', pauzeer: 'Pauzeren', verplaats: 'Verplaatsen', terugop: 'Datum bewaren' })[props.soort])
const ongeldig = computed(() => {
  if (props.soort === 'fase') return !keuze.value || !reden.value.trim()
  if (props.soort === 'verplaats') return !keuze.value || !reden.value.trim()
  if (props.soort === 'terugop') return !datum.value || !reden.value.trim()
  return !datum.value
})
async function bewaar() {
  if (ongeldig.value) return
  bezig.value = true
  const id = props.account.id
  try {
    if (props.soort === 'fase') {
      await $fetch('/api/reis/gebeurtenis', { method: 'POST', body: { accountId: id, gebeurtenis: 'handmatig', faseId: keuze.value, reden: reden.value } })
      emit('klaar', `Fase gezet op ${props.account.reis.fases.find((f: any) => f.id === keuze.value)?.label}.`)
    } else if (props.soort === 'pauzeer') {
      await $fetch(`/api/accounts/${id}/pauzeer`, { method: 'POST', body: { tot: datum.value, reden: reden.value || undefined } })
      emit('klaar', `${props.account.naam} is gepauzeerd tot ${datum.value}.`)
    } else if (props.soort === 'verplaats') {
      await $fetch(`/api/accounts/${id}/verplaats-reis`, { method: 'POST', body: { reisId: keuze.value, reden: reden.value } })
      emit('klaar', 'Verplaatst naar de andere reis.')
    } else {
      await $fetch(`/api/accounts/${id}/terug-op`, { method: 'PUT', body: { datum: datum.value, reden: reden.value } })
      emit('klaar', `Terug op ${datum.value}.`)
    }
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="rh-titel" :data-test="`reis-${soort}`" @submit.prevent="bewaar">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">{{ titel }}</span><h2 id="rh-titel" class="fo-titel">{{ account.naam }}</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <template v-if="soort === 'fase'">
              <p class="veld-uitleg">Nu: <strong>{{ account.reis?.fase?.label ?? 'geen fase' }}</strong>. Dealtrace meldt dit als handmatige correctie in de reisgeschiedenis.</p>
              <label class="veld mt-16"><span class="veld-label">Fase <span class="veld-verplicht">*</span></span>
                <select v-model="keuze" class="invoer" data-test="fase-keuze"><option value="" disabled>Kies een fase</option><option v-for="f in account.reis.fases.filter((x: any) => x.id !== account.reis.fase?.id)" :key="f.id" :value="f.id">{{ f.label }}</option></select>
              </label>
            </template>
            <label v-else-if="soort === 'verplaats'" class="veld"><span class="veld-label">Reis <span class="veld-verplicht">*</span></span>
              <select v-model="keuze" class="invoer"><option value="" disabled>Kies een reis</option><option v-for="r in account.reizen" :key="r.id" :value="r.id">{{ r.naam }}</option></select>
              <span v-if="!account.reizen.length" class="veld-uitleg">Er is nog geen andere actieve reis.</span>
            </label>
            <label v-else class="veld"><span class="veld-label">{{ soort === 'pauzeer' ? 'Tot en met' : 'Terug op' }} <span class="veld-verplicht">*</span></span><input v-model="datum" type="date" class="invoer" :min="morgen" data-test="reis-datum"></label>
            <label class="veld mt-16"><span class="veld-label">Reden <span v-if="soort !== 'pauzeer'" class="veld-verplicht">*</span></span><textarea v-model="reden" class="invoer" rows="2" data-test="reis-reden" /></label>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" class="dd-act dd-act--primair" :disabled="bezig || ongeldig" data-test="reis-bewaar">{{ knop }}</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
