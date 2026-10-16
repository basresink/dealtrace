<script setup lang="ts">
// Platformbeheer · Verbruik en credits (F23, F26, 11.4): per klant de pot en het verbruik per soort en per
// gebruiker met geschatte kosten per model; extra credits toekennen met reden; de prijs per handeling met
// geldig-vanaf; credits per gebruiker per pakket staan bij Abonnementen. Alleen tellingen, nooit inhoud.
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { metHerbevestiging } = useHerbevestig()
const tab = computed(() => (route.query.tab as string) || 'klanten')
const maand = computed(() => (route.query.maand as string) || undefined)
const { data, refresh } = await useFetch<any>('/api/platform/verbruik', { query: computed(() => ({ maand: maand.value })), default: () => ({ klanten: [], maand: '' }) })
const { data: credits, refresh: verversCredits } = await useFetch<any>('/api/platform/credits', { default: () => ({ prijzen: [] }) })
const getal = (n: number) => new Intl.NumberFormat('nl-NL').format(n)
const euro = (c: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(c / 100)
const open = ref<string | null>(null)
const extra = reactive({ org: '', aantal: 1000, reden: '', factureren: true })
async function kenToe() {
  try { const r: any = await $fetch(`/api/platform/credits/${extra.org}/extra`, { method: 'POST', body: { aantal: Number(extra.aantal), reden: extra.reden, factureren: extra.factureren, sleutel: crypto.randomUUID() } }); toast.toon(r.tekst); extra.org = ''; extra.reden = ''; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const prijsVraag = ref<{ soort: string; naam: string; credits: number } | null>(null)
async function zetPrijs() {
  const p = prijsVraag.value!
  try { const r: any = await metHerbevestiging(() => $fetch('/api/platform/credits/prijzen', { method: 'PUT', body: { soort: p.soort, credits: p.credits } })); toast.toon(r.tekst); prijsVraag.value = null; await verversCredits() } catch (e: any) { if (!e?.geannuleerd) toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Verbruik en credits · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Verbruik en credits" :uitleg="`AI-credits per klant in ${data.maand}. Externe databronnen (KvK, Datacollectief) kosten geen credits.`" />
    <section class="section section--laatste">
      <div class="container stapel">
        <nav class="tabbalk" aria-label="Verbruik"><button v-for="[k, l] in [['klanten', 'Per klant'], ['prijzen', 'Prijs per handeling']]" :key="k" type="button" class="tab" :class="{ 'tab--actief': tab === k }" @click="router.replace({ query: { ...route.query, tab: k } })">{{ l }}</button></nav>
        <template v-if="tab === 'klanten'">
          <article class="kaart"><p class="kaart-meta">Samen {{ getal(data.totaalCredits ?? 0) }} credits, geschat {{ euro(data.totaalKostenCent ?? 0) }} aan AI-kosten.</p></article>
          <article v-for="k in data.klanten" :key="k.id" class="kaart" :data-test="`verbruik-${k.id}`">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ k.naam }}</h2><span class="meta tnum">{{ getal(k.verbruikt) }} van {{ getal(k.pot) }} credits<template v-if="k.extra"> (waarvan {{ getal(k.extra) }} extra)</template></span></header>
            <p v-if="k.openAanvragen" class="kaart-meta"><span class="pil pil--geel">{{ k.openAanvragen }} aanvraag extra credits</span></p>
            <div class="dd-acties mt-8"><button type="button" class="dd-act" @click="open = open === k.id ? null : k.id">{{ open === k.id ? 'Minder' : 'Per soort en gebruiker' }}</button><button type="button" class="dd-act" :data-test="`extra-${k.id}`" @click="extra.org = k.id">Extra credits</button></div>
            <div v-if="open === k.id" class="raster raster--2 mt-8">
              <ul class="schakel-lijst"><li v-for="s in k.perSoort" :key="s.soort" class="schakel-rij"><span>{{ s.naam }}<span class="meta"> · {{ s.model }}</span></span><span class="tnum">{{ getal(s.credits) }} · {{ euro(s.kostenCent) }}</span></li></ul>
              <ul class="schakel-lijst"><li v-for="g in k.perGebruiker" :key="g.gebruiker" class="schakel-rij"><span>{{ g.gebruiker }}</span><span class="tnum">{{ getal(g.credits) }}</span></li></ul>
            </div>
          </article>
        </template>
        <article v-else class="kaart" data-test="prijs-per-handeling">
          <p class="kaart-meta">Een wijziging geldt vanaf vandaag, zonder release. Wat eerder geboekt is, houdt zijn prijs.</p>
          <table class="tabel tabel--kaarten mt-8"><thead><tr><th>Soort</th><th>Standaard</th><th>Nu</th><th /></tr></thead>
            <tbody><tr v-for="p in credits.prijzen" :key="p.soort"><td data-label="Soort">{{ p.naam }}</td><td data-label="Standaard" class="tnum">{{ p.standaard }}</td><td data-label="Nu" class="tnum">{{ p.credits }}</td>
              <td><button type="button" class="dd-act" :data-test="`prijs-${p.soort}`" @click="prijsVraag = { soort: p.soort, naam: p.naam, credits: p.credits }">Wijzig</button></td></tr></tbody></table>
        </article>
      </div>
    </section>
    <BevestigVenster :open="!!extra.org" :titel="`Extra credits voor ${data.klanten.find((k: any) => k.id === extra.org)?.naam ?? ''}?`" tekst="De pot van deze maand groeit direct; ze vervallen aan het einde van de maand." bevestig="Ken toe" @bevestigd="kenToe" @geannuleerd="extra.org = ''">
      <div class="formulier-raster"><label class="veld"><span class="veld-label">Aantal</span><input v-model.number="extra.aantal" class="invoer" type="number" min="1"></label>
        <label class="veld"><span class="veld-label">Reden</span><input v-model="extra.reden" class="invoer" data-test="extra-reden"></label>
        <label class="veld veld--rij"><input v-model="extra.factureren" type="checkbox"> <span>Als regel op de volgende factuur</span></label></div>
    </BevestigVenster>
    <BevestigVenster :open="!!prijsVraag" :titel="`${prijsVraag?.naam ?? ''} op ${prijsVraag?.credits ?? 0} credits zetten?`" tekst="Vanaf vandaag rekent Dealtrace met deze prijs." bevestig="Prijs wijzigen" @bevestigd="zetPrijs" @geannuleerd="prijsVraag = null">
      <label v-if="prijsVraag" class="veld"><span class="veld-label">Credits per handeling</span><input v-model.number="prijsVraag.credits" class="invoer" type="number" min="0"></label>
    </BevestigVenster>
  </div>
</template>
