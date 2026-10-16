<script setup lang="ts">
// Nieuw accountplan: klant of prospect (vast als je vanaf de accountkaart komt), titel en geldigheid. Na
// aanmaken ga je naar de pagina van het plan om de blokken en het actieplan in te vullen.
import { nlMoment } from '~~/shared/datum'
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: [] }>()
const toast = useToast()
const gekozen = ref<{ id: string; naam: string } | null>(null)
const q = ref('')
const treffers = ref<{ id: string; naam: string; plaats?: string | null }[]>([])
const titel = ref('')
const van = ref('')
const tot = ref('')
const bezig = ref(false)
watch(() => props.open, (o) => {
  if (!o) return
  const vandaag = nlMoment(new Date()).datum
  gekozen.value = props.account ?? null
  q.value = ''; treffers.value = []
  titel.value = `Accountplan ${vandaag.slice(0, 4)}`
  van.value = vandaag
  tot.value = `${vandaag.slice(0, 4)}-12-31`
})
let timer: ReturnType<typeof setTimeout> | undefined
watch(q, (v) => {
  clearTimeout(timer)
  timer = setTimeout(async () => { treffers.value = v.trim().length < 2 ? [] : await $fetch<any[]>('/api/accounts/kies', { query: { q: v } }).catch(() => []) }, 250)
})
function kies(a: { id: string; naam: string }) { gekozen.value = { id: a.id, naam: a.naam }; q.value = ''; treffers.value = [] }
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
          <div class="fo-head-tekst"><span class="fo-kicker">Accountplan</span><h2 id="apn-titel" class="fo-titel">Nieuw accountplan</h2><p class="fo-meta">Eén plan per klant en per periode. De blokken en acties vul je daarna op de pagina van het plan in.</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <div class="veld">
            <span class="veld-label">Klant of prospect</span>
            <div v-if="gekozen" class="apn-gekozen" data-test="apn-gekozen">
              <span>{{ gekozen.naam }}</span>
              <button v-if="!account" type="button" class="dd-act dd-act--icoon" aria-label="Andere klant kiezen" @click="gekozen = null"><Icoon naam="X" :grootte="14" /></button>
            </div>
            <template v-else>
              <input v-model="q" class="invoer" placeholder="Zoek een klant of prospect op naam" aria-label="Zoek een klant of prospect" data-test="apn-zoek">
              <ul v-if="treffers.length" class="apn-treffers" role="list">
                <li v-for="t in treffers" :key="t.id"><button type="button" class="apn-treffer" :data-test="`apn-kies-${t.id}`" @click="kies(t)">{{ t.naam }}<span v-if="t.plaats" class="meta"> · {{ t.plaats }}</span></button></li>
              </ul>
            </template>
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
.apn-treffers { list-style: none; margin: 4px 0 0; padding: 0; border: 1px solid var(--border); max-height: 240px; overflow-y: auto; }
.apn-treffer { display: block; width: 100%; min-height: 44px; padding: 8px 12px; text-align: left; background: var(--wit); border: 0; border-bottom: 1px solid var(--border); font: inherit; cursor: pointer; }
.apn-treffer:hover { background: var(--surface); }
.apn-rij { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 719px) { .apn-rij { grid-template-columns: 1fr; } }
</style>
