<script setup lang="ts">
// Mijn instellingen (P27, 15.3): toestellen en sessies, het blok Telefoon (handschoen- en
// zonlichtmodus) en voor de beheerder tweestapsverificatie.
const toast = useToast()
const { me, laad } = useMe()
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
const beheerder = computed(() => ['beheerder', 'founder'].includes(me.value?.echteRol ?? me.value?.gebruiker.rol ?? ''))
const totp = ref<{ geheim: string; uri: string } | null>(null)
const totpCode = ref('')
async function totpStart() { try { totp.value = await $fetch<any>('/api/mij/totp', { method: 'POST', body: { stap: 'start' } }) as any } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function totpBevestig() { try { await $fetch('/api/mij/totp', { method: 'POST', body: { stap: 'bevestig', code: totpCode.value } }); totp.value = null; totpCode.value = ''; toast.toon('Tweestapsverificatie staat aan.'); await laad() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function totpUit() { try { await $fetch('/api/mij/totp', { method: 'POST', body: { stap: 'uit' } }); toast.toon('Tweestapsverificatie staat uit.'); await laad() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const wanneer = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t))
</script>

<template>
  <article class="kaart" data-test="toestellen">
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
  <article class="kaart" data-test="telefoon-modi">
    <header class="kaart-kop"><h2 class="kaart-titel">Telefoon</h2></header>
    <label class="vink"><input v-model="handschoen" type="checkbox" data-test="handschoen"> Handschoenmodus: grotere knoppen (54 px)</label>
    <label class="vink mt-8"><input v-model="zonlicht" type="checkbox" data-test="zonlicht"> Zonlichtmodus: meer contrast</label>
  </article>
  <article v-if="beheerder" class="kaart" data-test="totp">
    <header class="kaart-kop"><h2 class="kaart-titel">Tweestapsverificatie</h2></header>
    <p class="tekst">{{ me?.gebruiker.totpAan ? 'Staat aan: na je code vraagt Dealtrace ook de code uit je authenticator-app.' : 'Staat uit. Zet hem aan voor extra zekerheid.' }}</p>
    <div v-if="totp" class="mt-8">
      <p>Voeg Dealtrace toe aan je authenticator-app met deze sleutel: <code class="totp-geheim">{{ totp.geheim }}</code></p>
      <label class="veld mt-8"><span class="veld-label">Code uit de app</span><input v-model="totpCode" class="invoer" inputmode="numeric" maxlength="6"></label>
      <button type="button" class="dd-act dd-act--primair mt-8" :disabled="totpCode.length !== 6" @click="totpBevestig">Bevestig</button>
    </div>
    <button v-else-if="!me?.gebruiker.totpAan" type="button" class="dd-act mt-8" @click="totpStart">Zet aan</button>
    <button v-else-if="me?.echteRol !== 'founder'" type="button" class="dd-act mt-8" @click="totpUit">Zet uit</button>
  </article>
</template>
