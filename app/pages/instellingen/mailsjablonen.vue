<script setup lang="ts">
// Mailsjablonen (beheerder): naam, kanaal, onderwerp en tekst met variabelen zoals {contact.voornaam};
// gebruikt in campagnesoorten en concepten.
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.mailsjablonen')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/mailsjablonen', { immediate: aan.value, default: () => ({ sjablonen: [] }) })
const bewerk = ref<any>(null)
async function bewaar() {
  try { await $fetch('/api/mailsjablonen', { method: 'PUT', body: bewerk.value }); toast.toon('Sjabloon bewaard.'); bewerk.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Mailsjablonen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.mailsjablonen" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Verkoop" titel="Mailsjablonen" uitleg="Variabelen tussen accolades, zoals {contact.voornaam}, {winpunt} en {gebruiker.voornaam}." helpartikel="concepten-goedkeuren-en-versturen">
        <template #acties><button type="button" class="dd-actie dd-actie--primair" data-test="sj-nieuw" @click="bewerk = { naam: '', kanaal: 'mail', actief: true, data: { onderwerp: '', tekst: '' } }"><Icoon naam="Plus" class="dd-actie-icoon" />Sjabloon</button></template>
      </PaginaKop>
      <section class="section">
        <div class="container container--smal">
          <LegeStaat v-if="!data.sjablonen.length" titel="Nog geen sjablonen." />
          <div v-else class="lijst" data-test="sj-lijst">
            <div v-for="s in data.sjablonen" :key="s.id" class="rij rij--compact" :class="{ 'rij--uit': !s.actief }">
              <div class="rij-info"><h3 class="rij-titel">{{ s.naam }} <span class="pil pil--leeg">{{ s.kanaal }}</span></h3><div class="rij-sub">{{ s.data.onderwerp }} · versie {{ s.versie }} · {{ (s.data.variabelen ?? []).join(' ') }}</div></div>
              <button type="button" class="dd-act" @click="bewerk = JSON.parse(JSON.stringify(s))">Bewerk</button>
            </div>
          </div>
          <form v-if="bewerk" class="kaart mt-16" data-test="sj-form" @submit.prevent="bewaar">
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Naam</span><input v-model="bewerk.naam" class="invoer" required minlength="2"></label>
              <label class="veld"><span class="veld-label">Kanaal</span><select v-model="bewerk.kanaal" class="invoer"><option value="mail">Mail</option><option value="linkedin">LinkedIn</option><option value="whatsapp">WhatsApp</option><option value="kaart">Kaart</option></select></label>
              <label class="veld veld--breed"><span class="veld-label">Onderwerp</span><input v-model="bewerk.data.onderwerp" class="invoer"></label>
              <label class="veld veld--breed"><span class="veld-label">Tekst</span><textarea v-model="bewerk.data.tekst" class="invoer" rows="8" /></label>
            </div>
            <div class="dd-acties mt-16"><button type="submit" class="dd-actie dd-actie--primair">Bewaar</button><button type="button" class="dd-actie dd-actie--secundair" @click="bewerk = null">Annuleren</button></div>
          </form>
        </div>
      </section>
    </template>
  </div>
</template>
