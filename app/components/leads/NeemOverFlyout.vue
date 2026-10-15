<script setup lang="ts">
// "Neem over" (F02): bevestig eigenaar, reis en eerste stap. Een salesmanager kan de lead voor
// een teamlid klaarzetten. "Zet in campagne" komt met P16.
const props = defineProps<{ lead: any | null; context: any }>()
const emit = defineEmits<{ sluit: []; klaar: [uit: any] }>()
const toast = useToast()
const eigenaar = ref('')
const reisId = ref('')
const stap = ref<'belblok' | 'bellen' | 'bezoek'>('belblok')
const bezig = ref(false)
const werkplekVan = (id: string) => (props.context?.team ?? []).find((u: any) => u.id === id)?.werkplek ?? props.context?.werkplek
watch(() => props.lead, (l) => {
  if (!l) return
  eigenaar.value = props.context?.ik ?? ''
  reisId.value = ''
  stap.value = werkplekVan(eigenaar.value) === 'buitendienst' ? 'bezoek' : 'belblok'
})
watch(eigenaar, (id) => { stap.value = werkplekVan(id) === 'buitendienst' ? 'bezoek' : 'belblok' })
const stappen = computed(() => werkplekVan(eigenaar.value) === 'buitendienst'
  ? [{ k: 'bezoek', t: 'Bezoek op je regiodag' }, { k: 'bellen', t: 'Bel eerst' }]
  : [{ k: 'belblok', t: 'Bel in je eerstvolgende acquisitieblok met script Koude acquisitie' }, { k: 'bellen', t: 'Bel morgen' }])
async function bevestig() {
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/leads/${props.lead.id}/overnemen`, { method: 'POST', body: { eigenaar: eigenaar.value || undefined, reisId: reisId.value || undefined, eersteStap: stap.value } })
    toast.toon(r.tekst, 'succes', { tekst: 'Open kaart', naar: `/accounts/${r.id}` })
    emit('klaar', r)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="lead" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-labelledby="no-titel" data-test="neem-over-flyout" @submit.prevent="bevestig">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Neem over</span><h2 id="no-titel" class="fo-titel">{{ lead.naam }}</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <label v-if="context?.team?.length" class="veld"><span class="veld-label">Eigenaar</span>
            <select v-model="eigenaar" class="invoer" data-test="no-eigenaar"><option v-for="u in context.team" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}{{ u.id === context.ik ? ' (jij)' : '' }}</option></select>
          </label>
          <label class="veld"><span class="veld-label">Doelgroep en reis</span>
            <select v-model="reisId" class="invoer" data-test="no-reis"><option value="">Voorstel van Dealtrace (past bij de doelgroep)</option><option v-for="r in context?.reizen ?? []" :key="r.id" :value="r.id">{{ r.naam }}{{ r.isStandaard ? ' · standaardreis' : '' }}</option></select>
          </label>
          <label class="veld"><span class="veld-label">Eerste stap</span>
            <select v-model="stap" class="invoer" data-test="no-stap"><option v-for="s in stappen" :key="s.k" :value="s.k">{{ s.t }}</option></select>
          </label>
          <label class="vink"><input type="checkbox" disabled> Zet in campagne <span class="meta">(komt met campagnes)</span></label>
          <p class="veld-uitleg">Dealtrace maakt de prospect met de gegevens, de contactpersonen en het bewijs als notitie, in fase Gevonden.</p>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="submit" class="dd-act dd-act--primair" :disabled="bezig" data-test="no-bevestig">Bevestig</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
