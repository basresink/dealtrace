<script setup lang="ts">
// De agendakoppeling voor de organisatie (beheerder): aan of uit, en hoeveel mensen hun agenda al
// koppelden. Iedereen koppelt daarna zelf bij Account; daar staat alleen de persoonlijke koppeling.
const toast = useToast()
const { data, refresh } = await useFetch<{ aan: boolean; gebruikers: number; gekoppeld: number; providers: string[] }>('/api/instellingen/agenda')
const bezig = ref(false)
async function zet(aan: boolean) {
  bezig.value = true
  try { await $fetch('/api/koppelingen/agenda', { method: 'PUT', body: { aan } }); await refresh(); toast.toon(aan ? 'Agendakoppeling staat aan voor de organisatie.' : 'Agendakoppeling staat uit.') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <article v-if="data" class="kaart" data-test="agenda-organisatie">
    <header class="kaart-kop"><h2 class="kaart-titel">Voor de organisatie</h2></header>
    <div class="schakel-rij">
      <div><span class="schakel-naam">Agendakoppeling aan</span><span class="veld-uitleg">{{ data.providers.join(' en ') }}. Wat in iemands agenda staat, telt mee als bezet; afspraken uit Dealtrace komen erin.</span></div>
      <Schakelaar :aan="data.aan" :uit="bezig" label="Agendakoppeling aan voor de organisatie" data-test="agenda-org-schakelaar" @wissel="zet" />
    </div>
    <p class="meta mt-16" data-test="agenda-org-stand">{{ data.aan ? `${data.gekoppeld} van ${data.gebruikers} gebruikers hebben hun agenda gekoppeld.` : 'Staat uit: niemand kan zijn agenda koppelen.' }}</p>
    <p class="veld-uitleg mt-8">Ieder koppelt zijn eigen agenda bij <NuxtLink to="/mij#agenda">Account</NuxtLink>.</p>
  </article>
</template>
