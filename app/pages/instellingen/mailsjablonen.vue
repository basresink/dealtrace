<script setup lang="ts">
// Mailsjablonen (beheerder): naam, kanaal, onderwerp en tekst met variabelen zoals {contact.voornaam};
// gebruikt in campagnesoorten en concepten.
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.mailsjablonen')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/mailsjablonen', { immediate: aan.value, default: () => ({ sjablonen: [] }) })
const bewerk = ref<any>(null)
// Opslaan-status in de kop van de flyout: Gewijzigd tot Sjabloon opslaan; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [bewerk.value])
async function bewaar() {
  try { await opslag.bewaar(() => $fetch('/api/mailsjablonen', { method: 'PUT', body: bewerk.value })); toast.toon('Sjabloon bewaard.'); bewerk.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const KANAAL: Record<string, string> = { mail: 'Mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', kaart: 'Kaart' }
const ACTIE: Record<string, string> = { mail: 'mailen', linkedin: 'linkedin', whatsapp: 'whatsapp' }
const filter = reactive({ kanaal: '', stand: '' })
const aantalFilters = computed(() => (filter.kanaal ? 1 : 0) + (filter.stand ? 1 : 0))
const kanalen = computed(() => [...new Set<string>(data.value.sjablonen.map((s: any) => s.kanaal))])
const lijst = computed(() => data.value.sjablonen.filter((s: any) => (!filter.kanaal || s.kanaal === filter.kanaal) && (!filter.stand || (filter.stand === 'aan') === !!s.actief)))
function wis() { filter.kanaal = ''; filter.stand = '' }
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
const titel = computed(() => (data.value.sjablonen.length ? `${data.value.sjablonen.filter((s: any) => s.actief).length} van ${data.value.sjablonen.length} mailsjablonen aan` : 'Mailsjablonen'))
useHead({ title: 'Mailsjablonen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.mailsjablonen" />
    <template v-else>
      <InstellingenKop groep="Verkoop" :titel="titel" uitleg="Mailsjablonen per kanaal. Variabelen tussen accolades, zoals {contact.voornaam}, {winpunt} en {gebruiker.voornaam}." helpartikel="concepten-goedkeuren-en-versturen" :filters="data.sjablonen.length ? aantalFilters : null" @reset="wis">
        <template #acties><button type="button" class="dd-actie dd-actie--primair" data-test="sj-nieuw" @click="bewerk = { naam: '', kanaal: 'mail', actief: true, data: { onderwerp: '', tekst: '' } }"><Icoon naam="Plus" class="dd-actie-icoon" />Sjabloon</button></template>
        <template #filters>
          <div class="ifp-groep" role="group" aria-label="Kanaal"><span class="filter-label">Kanaal</span>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.kanaal }" :aria-pressed="!filter.kanaal" @click="filter.kanaal = ''">Alle</button>
            <button v-for="k in kanalen" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.kanaal === k }" :aria-pressed="filter.kanaal === k" @click="filter.kanaal = k">{{ KANAAL[k] ?? k }}</button>
          </div>
          <div class="ifp-groep" role="group" aria-label="Stand"><span class="filter-label">Stand</span>
            <button v-for="[k, l] in [['', 'Alle'], ['aan', 'Aan'], ['uit', 'Uit']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.stand === k }" :aria-pressed="filter.stand === k" @click="filter.stand = k!">{{ l }}</button>
          </div>
        </template>
      </InstellingenKop>
      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.sjablonen.length" kicker="Mailsjablonen" titel="Nog geen sjablonen." tekst="Een sjabloon is een vaste opzet per kanaal met variabelen, zodat een concept sneller klaarstaat." />
          <template v-else>
            <p v-if="aantalFilters" class="meta" data-test="sj-telling">{{ lijst.length }} van {{ data.sjablonen.length }} sjablonen in dit filter</p>
            <LegeStaat v-if="!lijst.length" kicker="Niets gevonden" titel="Geen sjablonen in dit filter." tekst="Kies een ander kanaal of een andere stand.">
              <button type="button" class="dd-act mt-16" @click="wis">Wis filters</button>
            </LegeStaat>
            <div v-else class="lijst mt-8" data-test="sj-lijst">
              <div v-for="s in lijst" :key="s.id" class="rij rij--compact inst-rij" :class="{ 'inst-rij--uit': !s.actief }" data-test="sj-rij" :data-naam="s.naam">
                <div class="rij-info"><h3 class="rij-titel">{{ s.naam }} <Label soort="actie" :waarde="ACTIE[s.kanaal] ?? 'taak'" :tekst="KANAAL[s.kanaal] ?? s.kanaal" /> <Label v-if="!s.actief" soort="instelling" waarde="uit" /></h3><div class="rij-sub">{{ s.data.onderwerp }} · versie {{ s.versie }} · {{ (s.data.variabelen ?? []).join(' ') }}</div></div>
                <div class="inst-rij-acties">
                  <Schakelaar :aan="s.actief" :label="`${s.naam} aan`" data-test="sj-actief" @wissel="wissel(s, $event)" />
                  <button type="button" class="dd-act" @click="bewerk = JSON.parse(JSON.stringify(s))">Bewerk</button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>
      <FlyoutShell v-if="bewerk" open titel-id="sj-titel" data-test="sj-flyout" :opslag="opslag" @sluit="bewerk = null" @bewaar="bewaar">
        <template #kop><span class="fo-kicker">Mailsjabloon</span><h2 id="sj-titel" class="fo-titel">{{ bewerk.id ? bewerk.naam : 'Nieuw sjabloon' }}</h2></template>
        <form id="sj-form" class="fs-form" data-test="sj-form" @submit.prevent="bewaar">
          <div class="fo-body fo-body--formulier"><article class="fo-blok">
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="bewerk.naam" class="invoer" required minlength="2"></label>
              <label class="veld"><span class="veld-label">Kanaal</span><select v-model="bewerk.kanaal" class="invoer"><option value="mail">Mail</option><option value="linkedin">LinkedIn</option><option value="whatsapp">WhatsApp</option><option value="kaart">Kaart</option></select></label>
            </div>
            <label class="veld mt-16"><span class="veld-label">Onderwerp</span><input v-model="bewerk.data.onderwerp" class="invoer"></label>
            <label class="veld mt-16"><span class="veld-label">Tekst</span><textarea v-model="bewerk.data.tekst" class="invoer" rows="10" /></label>
          </article></div>
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
            <button type="submit" form="sj-form" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="sj-bewaar"><Icoon naam="Check" :grootte="16" />Sjabloon opslaan</button>
            <span class="fo-foot-vul" />
          </footer>
        </template>
      </FlyoutShell>
    </template>
  </div>
</template>

