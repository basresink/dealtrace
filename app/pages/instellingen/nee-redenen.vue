<script setup lang="ts">
// Instellingen, Verkoop: redenen voor nee (vast, alleen lezen), afkoelperiode per kanaal
// (beheerder) en de mapping van reden naar terugkomregel (uit het verkoopverhaal, P28).
const { functie } = useMe()
if (!functie('nav.instellingen')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang tot instellingen' })
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/reis/instellingen', { default: () => ({ redenen: [], kanalen: [], terugkomregels: [], redenmapping: [], kan: {} }) })
const dagen = reactive<Record<string, number>>({})
watchEffect(() => { for (const k of data.value.kanalen) dagen[k.id] = k.dagen })
async function bewaar() {
  try { await $fetch('/api/settings/afkoeling', { method: 'PUT', body: { value: { ...dagen } } }); toast.toon('Afkoelperiodes bewaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const regel = (id: string | null) => data.value.terugkomregels.find((r: any) => r.id === id)
useHead({ title: 'Redenen voor nee · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Verkoop" titel="Redenen voor nee en terugkomregels" uitleg="Een nee is een datapunt: met reden, afkoelperiode en een terugkomdatum." helpartikel="nee-met-reden-en-afkoelperiode" />
    <section class="section section--laatste">
      <div class="container instellingen-raster">
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Vaste redenen</h2></header>
          <ul class="schakel-lijst"><li v-for="r in data.redenen" :key="r" class="schakel-rij">{{ r }}<span v-if="r === 'Anders'" class="meta">toelichting verplicht</span></li></ul>
        </article>
        <form class="kaart" data-test="afkoeling" @submit.prevent="bewaar">
          <header class="kaart-kop"><h2 class="kaart-titel">Afkoelperiode per kanaal</h2></header>
          <p class="kaart-meta">In dagen. "Niet geschikt" is altijd 365 dagen voor elk kanaal.</p>
          <div class="formulier-raster mt-16">
            <label v-for="k in data.kanalen" :key="k.id" class="veld"><span class="veld-label">{{ k.label }}</span><input v-model.number="dagen[k.id]" type="number" min="0" max="730" class="invoer" :disabled="!data.kan.afkoeling" :data-test="`afkoeling-${k.id}`"><span class="veld-uitleg">Standaard {{ k.standaard }}</span></label>
          </div>
          <button v-if="data.kan.afkoeling" type="submit" class="dd-act dd-act--primair mt-16">Bewaren</button>
        </form>
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Reden naar terugkomregel</h2></header>
          <p class="kaart-meta">Uit het verkoopverhaal (Hercontact ritme). Bewerken komt met Richting.</p>
          <ul class="schakel-lijst"><li v-for="m in data.redenmapping" :key="`${m.bronSoort}-${m.reden}`" class="schakel-rij"><span>{{ m.reden }} <span class="meta">({{ m.bronSoort.replace('_', ' ') }})</span></span><span class="meta">{{ regel(m.terugkomregelId) ? `${regel(m.terugkomregelId).reden} · ${regel(m.terugkomregelId).termijn}` : 'afkoelperiode' }}</span></li></ul>
        </article>
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Terugkomregels</h2></header>
          <ul class="schakel-lijst"><li v-for="r in data.terugkomregels" :key="r.id" class="schakel-rij"><span><strong>{{ r.reden }}</strong><br><span class="meta">{{ r.termijn }} · {{ r.kanaal }} · {{ r.rollen.join(', ') }}</span><br>{{ r.aanpak }}</span></li></ul>
          <p v-if="!data.terugkomregels.length" class="kaart-meta">Nog geen terugkomregels. Ze komen uit het verkoopverhaal.</p>
        </article>
      </div>
    </section>
  </div>
</template>
