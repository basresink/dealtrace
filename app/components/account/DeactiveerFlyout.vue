<script setup lang="ts">
// Deactiveren (0064) in plaats van verwijderen: een vaste reden (bij Overig met toelichting) en de uitleg wat er
// gebeurt. De historie blijft; heractiveren kan altijd via de balk op de accountkaart.
import { DEACTIVEER_REDENEN, DEACTIVEER_REDEN_LABEL, type DeactiveerReden } from '~~/shared/deactiveren'

const props = defineProps<{ open: boolean; account: { id: string; naam: string } }>()
const emit = defineEmits<{ sluit: []; klaar: [tekst: string] }>()
const toast = useToast()
const reden = ref<DeactiveerReden | ''>('')
const toelichting = ref('')
const bezig = ref(false)
watch(() => props.open, (o) => { if (o) { reden.value = ''; toelichting.value = '' } })
const ongeldig = computed(() => !reden.value || (reden.value === 'overig' && !toelichting.value.trim()))
async function bewaar() {
  if (ongeldig.value) return
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/accounts/${props.account.id}/deactiveren`, { method: 'POST', body: { reden: reden.value, toelichting: toelichting.value.trim() || undefined } })
    const gestopt = r.gestopt?.taken ? ` ${r.gestopt.taken} open ${r.gestopt.taken === 1 ? 'taak is' : 'taken zijn'} gestopt.` : ''
    emit('klaar', `${props.account.naam} is gedeactiveerd.${gestopt}`)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="deactiveer-titel" data-test="deactiveer-venster" @submit.prevent="bewaar">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Deactiveren</span><h2 id="deactiveer-titel" class="fo-titel">{{ account.naam }}</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <fieldset class="nee-redenen">
              <legend class="veld-label">Reden <span class="veld-verplicht">*</span></legend>
              <label v-for="r in DEACTIVEER_REDENEN" :key="r" class="nee-reden" :class="{ 'nee-reden--actief': reden === r }">
                <input v-model="reden" type="radio" name="deactiveer-reden" :value="r" class="sr-only" :data-test="`deactiveer-reden-${r}`"><span>{{ DEACTIVEER_REDEN_LABEL[r] }}</span>
              </label>
            </fieldset>
            <label v-if="reden" class="veld mt-16">
              <span class="veld-label">Toelichting <span v-if="reden === 'overig'" class="veld-verplicht">*</span></span>
              <textarea v-model="toelichting" class="invoer" rows="2" maxlength="500" data-test="deactiveer-toelichting" />
            </label>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Wat er gebeurt</h3></header>
            <ul class="deactiveer-gevolgen">
              <li>De motor zet geen taken meer klaar; open taken, een hercontactritme en een opvolgreeks stoppen met deze reden.</li>
              <li>De prospect valt uit belblokken, campagnes en de signaalradar en staat niet meer in de lijsten.</li>
              <li>De tijdlijn, taken, afspraken, verslagen en de audit blijven bewaard. Je vindt hem terug met het filter Status.</li>
            </ul>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" class="dd-act dd-act--primair" :disabled="bezig || ongeldig" data-test="deactiveer-bevestig">Deactiveren</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.deactiveer-gevolgen { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 13px; color: var(--ink-soft, var(--ink)); }
</style>
