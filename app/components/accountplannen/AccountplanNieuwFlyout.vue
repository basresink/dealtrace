<script setup lang="ts">
// Nieuw accountplan: een topprospect (vast als je vanaf de accountkaart komt), titel en geldigheid. Na
// aanmaken ga je naar de pagina van het plan om de blokken en het actieplan in te vullen.
import { nlMoment } from '~~/shared/datum'
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: [] }>()
const toast = useToast()
const gekozen = ref<{ id: string; naam: string } | null>(null)
const titel = ref('')
const van = ref('')
const tot = ref('')
const bezig = ref(false)
watch(() => props.open, (o) => {
  if (!o) return
  const vandaag = nlMoment(new Date()).datum
  gekozen.value = props.account ?? null
  titel.value = `Accountplan ${vandaag.slice(0, 4)}`
  van.value = vandaag
  tot.value = `${vandaag.slice(0, 4)}-12-31`
})
// Alleen prospects: een plan voor een klant hoort in DealDrive.
const zoek = (q: string) => zoekAccounts(q, 'prospect')
function kies(a: { id: string; naam: string }) { gekozen.value = { id: a.id, naam: a.naam } }
async function maak() {
  if (!gekozen.value) return
  bezig.value = true
  try {
    const p = await $fetch<any>('/api/accountplannen', { method: 'POST', body: { accountId: gekozen.value.id, titel: titel.value, geldigVan: van.value || null, geldigTot: tot.value || null } })
    toast.toon('Accountplan aangemaakt. Vul nu de blokken en het actieplan in.')
    emit('sluit')
    await navigateTo(`/accountplannen/${p.id}`)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')" @keydown.esc="emit('sluit')">
      <form class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="apn-titel" data-test="ap-nieuw-flyout" @submit.prevent="maak">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Accountplan</span><h2 id="apn-titel" class="fo-titel">Nieuw accountplan</h2><p class="fo-meta">Eén plan per topprospect en per periode. De blokken en acties vul je daarna op de pagina van het plan in.</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <div class="veld">
            <span class="veld-label">Prospect</span>
            <div v-if="gekozen" class="apn-gekozen" data-test="apn-gekozen">
              <span>{{ gekozen.naam }}</span>
              <button v-if="!account" type="button" class="dd-act dd-act--icoon" aria-label="Andere prospect kiezen" @click="gekozen = null"><Icoon naam="X" :grootte="14" /></button>
            </div>
            <ZoekKiezer v-else :zoek="zoek" placeholder="Zoek een prospect op naam" label="Zoek een prospect" data-test="apn-zoek" :optie-test="(t) => `apn-kies-${t.id}`" :sub="accountSub" leeg="Geen prospect gevonden." @kies="kies" />
          </div>
          <label class="veld mt-16"><span class="veld-label">Titel</span><input v-model="titel" class="invoer" maxlength="160" required data-test="apn-titel"><span class="veld-uitleg">Zet de periode in de titel, dan zie je in elke lijst voor welk jaar het plan geldt.</span></label>
          <div class="apn-rij mt-16">
            <label class="veld"><span class="veld-label">Geldig van</span><input v-model="van" type="date" class="invoer tnum" data-test="apn-van"></label>
            <label class="veld"><span class="veld-label">Geldig tot</span><input v-model="tot" type="date" class="invoer tnum" data-test="apn-tot"></label>
          </div>
          <p class="meta mt-8">Na de einddatum staat het plan bij Verlopen. Dat is het moment om te evalueren en een nieuwe periode te openen.</p>
        </div>
        <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button><button type="submit" class="dd-act dd-act--geel" :disabled="bezig || !gekozen || titel.trim().length < 3" data-test="apn-maak">Plan aanmaken</button></footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.apn-gekozen { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 0 0 12px; border: 1px solid var(--border-strong); font-weight: 600; }
.apn-rij { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 719px) { .apn-rij { grid-template-columns: 1fr; } }
</style>
