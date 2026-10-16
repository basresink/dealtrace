<script setup lang="ts">
// Mijn instellingen (/mijn-instellingen, P27, 15.3): toestellen en sessies en het blok Telefoon
// (handschoen- en zonlichtmodus). De tweestapsverificatie staat op Account (/mij).
const toast = useToast()
const { data: toestellen, refresh } = await useFetch<any[]>('/api/mij/toestellen', { default: () => [] })
const bevestig = ref(false)
async function uitAlle() {
  bevestig.value = false
  await $fetch('/api/auth/uitloggen', { method: 'POST', body: { alleToestellen: true } })
  await navigateTo('/login', { external: true })
}
async function uitEen(t: any) {
  try { await $fetch(`/api/mij/toestellen/${t.id}`, { method: 'DELETE' }); if (t.ditToestel) return navigateTo('/login', { external: true }); toast.toon('Uitgelogd op dat toestel.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const handschoen = ref(false)
const zonlicht = ref(false)
onMounted(() => { try { handschoen.value = localStorage.getItem('dt_handschoen') === '1'; zonlicht.value = localStorage.getItem('dt_zonlicht') === '1' } catch { /* */ } })
watch(handschoen, (v) => { try { localStorage.setItem('dt_handschoen', v ? '1' : '0') } catch { /* */ } document.documentElement.classList.toggle('handschoen', v) })
watch(zonlicht, (v) => { try { localStorage.setItem('dt_zonlicht', v ? '1' : '0') } catch { /* */ } document.documentElement.classList.toggle('zonlicht', v) })
const wanneer = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t))
</script>

<template>
  <article id="toestellen" class="kaart mi-sectie" data-test="toestellen">
    <header class="kaart-kop"><h2 class="kaart-titel">Toestellen en sessies</h2></header>
    <div class="lijst">
      <div v-for="t in toestellen" :key="t.id" class="rij rij--compact">
        <div class="rij-info"><span class="rij-titel">{{ t.label }}<span v-if="t.ditToestel" class="pil pil--leeg"> dit toestel</span></span><div class="rij-sub">Laatst gezien {{ wanneer(t.laatstGezien) }}</div></div>
        <div class="rij-rechts"><button type="button" class="dd-act" @click="uitEen(t)">Uitloggen</button></div>
      </div>
    </div>
    <button type="button" class="dd-act mt-16" data-test="uit-alle" @click="bevestig = true">Uitloggen op alle toestellen</button>
    <BevestigVenster :open="bevestig" titel="Uitloggen op alle toestellen?" tekst="Elke sessie wordt ongeldig, ook op je laptop. Daarna log je opnieuw in met een code." bevestig="Uitloggen" @geannuleerd="bevestig = false" @bevestigd="uitAlle" />
  </article>
  <article id="telefoon" class="kaart mi-sectie" data-test="telefoon-modi">
    <header class="kaart-kop"><h2 class="kaart-titel">Telefoon</h2></header>
    <label class="vink"><input v-model="handschoen" type="checkbox" data-test="handschoen"> Handschoenmodus: grotere knoppen (54 px)</label>
    <label class="vink mt-8"><input v-model="zonlicht" type="checkbox" data-test="zonlicht"> Zonlichtmodus: meer contrast</label>
  </article>
</template>
