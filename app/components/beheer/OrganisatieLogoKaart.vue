<script setup lang="ts">
// Logo van de organisatie (F22) op Instellingen, Organisatie: png, jpg of svg tot 200 kB. De server controleert
// de inhoud; het scherm controleert vooraf alleen grootte en extensie, zodat je meteen weet wat er mis is.
// Het logo staat daarna in de zijbalk van iedereen in de organisatie.
import { controleerLogo, LOGO_MAX_BYTES } from '~~/shared/organisatieLogo'

const { me, laad } = useMe()
const toast = useToast()
const logo = computed(() => me.value?.organisatie?.logo ?? null)
const invoer = ref<HTMLInputElement | null>(null)
const fout = ref('')
const bezig = ref(false)

function alsBase64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

async function gekozen(e: Event) {
  const bestand = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!bestand) return
  fout.value = ''
  if (bestand.size > LOGO_MAX_BYTES) { fout.value = 'Het logo is te groot. Kies een bestand van hooguit 200 kB.'; return }
  const inhoud = new Uint8Array(await bestand.arrayBuffer())
  const c = controleerLogo(inhoud)
  if (!c.ok) { fout.value = c.fout; return }
  bezig.value = true
  try {
    await $fetch('/api/instellingen/logo', { method: 'POST', body: { data: alsBase64(inhoud) } })
    await laad()
    toast.toon('Logo bewaard. Het staat nu in de zijbalk.')
  } catch (err: any) {
    fout.value = err?.data?.statusMessage ?? foutTekst(err)
  } finally {
    bezig.value = false
  }
}

async function verwijder() {
  bezig.value = true
  try {
    await $fetch('/api/instellingen/logo', { method: 'DELETE' })
    await laad()
    toast.toon('Logo verwijderd.')
  } catch (err) {
    toast.toon(foutTekst(err), 'fout')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <article class="kaart" data-test="org-logo">
    <header class="kaart-kop"><h2 class="kaart-titel">Logo</h2></header>
    <p class="kaart-meta">Het logo staat bovenin de zijbalk van iedereen in je organisatie. Gebruik een png, jpg of svg van hooguit 200 kB, het liefst liggend.</p>
    <div class="logo-voorbeeld">
      <img v-if="logo" :src="logo" :alt="`Logo van ${me?.organisatie?.naam ?? 'de organisatie'}`" class="logo-beeld" data-test="org-logo-beeld">
      <LegeStaat v-else titel="Nog geen logo" tekst="Zonder logo toont de zijbalk alleen Dealtrace." />
    </div>
    <p v-if="fout" class="veld-fout veld-fout--regel" role="alert" data-test="org-logo-fout">{{ fout }}</p>
    <input ref="invoer" type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" class="logo-invoer" aria-label="Kies een logo" data-test="org-logo-invoer" @change="gekozen">
    <div class="dd-acties mt-16">
      <button type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" data-test="org-logo-kies" @click="invoer?.click()"><Icoon naam="Upload" /> {{ logo ? 'Ander logo kiezen' : 'Logo uploaden' }}</button>
      <button v-if="logo" type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" data-test="org-logo-weg" @click="verwijder"><Icoon naam="Trash2" /> Verwijderen</button>
    </div>
  </article>
</template>

<style scoped>
.logo-voorbeeld { margin-top: 12px; }
.logo-beeld { display: block; max-width: 100%; max-height: 64px; object-fit: contain; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--wit); }
.logo-invoer { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
