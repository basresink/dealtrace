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
// Aan of uit: een sjabloon dat uit staat, blijft bewaard maar is niet te kiezen.
// useFetch geeft een shallowRef: de lijst vervangen, niet één veld wijzigen.
function zetActief(id: string, actief: boolean) {
  data.value = { ...data.value, sjablonen: data.value.sjablonen.map((x: any) => (x.id === id ? { ...x, actief } : x)) }
}
async function wissel(s: any, actief: boolean) {
  const oud = s.actief
  zetActief(s.id, actief)
  try { await $fetch(`/api/mailsjablonen/${s.id}/actief`, { method: 'PUT', body: { actief } }); toast.toon(actief ? `${s.naam} staat aan.` : `${s.naam} staat uit.`) } catch (e) { zetActief(s.id, oud); toast.toon(foutTekst(e), 'fout') }
}
const telling = computed(() => {
  const n = data.value.sjablonen.length
  const a = data.value.sjablonen.filter((s: any) => s.actief).length
  return `${a} van ${n} ${n === 1 ? 'sjabloon' : 'sjablonen'} aan`
})
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
          <LegeStaat v-if="!data.sjablonen.length" titel="Nog geen sjablonen." tekst="Een sjabloon is een vaste opzet per kanaal met variabelen, zodat een concept sneller klaarstaat." />
          <template v-else>
            <p class="meta" data-test="sj-telling">{{ telling }}</p>
            <div class="lijst mt-8" data-test="sj-lijst">
              <div v-for="s in data.sjablonen" :key="s.id" class="rij rij--compact" :class="{ 'rij--uit': !s.actief }" data-test="sj-rij" :data-naam="s.naam">
                <div class="rij-info"><h3 class="rij-titel">{{ s.naam }} <span class="pil pil--leeg">{{ s.kanaal }}</span> <span v-if="!s.actief" class="pil pil--grijs">Uit</span></h3><div class="rij-sub">{{ s.data.onderwerp }} · versie {{ s.versie }} · {{ (s.data.variabelen ?? []).join(' ') }}</div></div>
                <div class="sj-acties">
                  <Schakelaar :aan="s.actief" :label="`${s.naam} aan`" data-test="sj-actief" @wissel="wissel(s, $event)" />
                  <button type="button" class="dd-act" @click="bewerk = JSON.parse(JSON.stringify(s))">Bewerk</button>
                </div>
              </div>
            </div>
          </template>
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

<style scoped>
.sj-acties { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.rij--uit .rij-info { color: var(--muted); }
</style>
