<script setup lang="ts">
// De kaart CRM in Leadgenerator, tabblad Koppelingen (P20): alleen lezen met "Synchroniseer nu" voor de
// Expert; de beheerder richt in op /instellingen/koppelingen/crm.
const { functie } = useMe()
const toast = useToast()
const zichtbaar = computed(() => !!functie('koppeling.crm')?.beschikbaar || !!functie('koppeling.crmSync')?.beschikbaar || !!functie('leadgenerator.crm')?.beschikbaar)
const { data: crm, refresh } = await useFetch<any>('/api/koppelingen/hubspot', { immediate: zichtbaar.value, default: () => null })
const bezig = ref(false)
async function sync() {
  bezig.value = true
  try { const r = await $fetch<any>('/api/koppelingen/hubspot/sync', { method: 'POST' }); toast.toon(r.melding ?? `Gelezen ${fmt(r.gelezen)}, geschreven ${fmt(r.geschreven)}, fouten ${fmt(r.fouten)}.`, r.melding ? 'fout' : undefined); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const fmt = (n: number) => new Intl.NumberFormat('nl-NL').format(n ?? 0)
const datum = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
</script>

<template>
  <article class="kaart" data-test="kaart-crm">
    <header class="kaart-kop"><h3 class="kaart-titel">CRM</h3>
      <span v-if="crm" class="pil" :class="crm.verbonden ? 'pil--groen' : crm.status === 'fout' ? 'pil--rood' : 'pil--grijs'" data-test="crm-status">{{ crm.verbonden ? 'HubSpot gekoppeld' : crm.status === 'fout' ? 'Fout' : 'Niet gekoppeld' }}</span></header>
    <p class="tekst">Ontdubbelen tegen je CRM, klanten als profiel en prospects uit het CRM als bron. Overgenomen leads, uitkomsten en de overdracht gaan terug.</p>
    <template v-if="crm">
      <p v-if="crm.laatsteFout" class="meta tekst-rood mt-8">{{ crm.laatsteFout }}</p>
      <p v-else-if="!crm.verbonden" class="meta mt-8">Er is nog geen CRM gekoppeld. Verbind je CRM om te voorkomen dat je klanten of prospects van collega's opnieuw benadert.</p>
      <p v-if="crm.laatsteSync" class="meta mt-8">Laatst gesynchroniseerd {{ datum(crm.laatsteSync) }}</p>
      <div class="dd-acties mt-16">
        <button v-if="crm.verbonden" type="button" class="dd-act" :disabled="bezig || !crm.kan.synchroniseren" :title="crm.kan.synchroniseren ? undefined : 'Synchroniseren kan vanaf Expert'" data-test="crm-sync" @click="sync"><Icoon v-if="!crm.kan.synchroniseren" naam="Lock" class="dd-actie-icoon" />Synchroniseer nu</button>
        <NuxtLink v-if="crm.kan.inrichten" class="dd-act" to="/instellingen/koppelingen/crm">Inrichten</NuxtLink>
      </div>
    </template>
    <p v-else class="meta mt-8">De CRM-koppeling richt je beheerder in.</p>
  </article>
</template>
