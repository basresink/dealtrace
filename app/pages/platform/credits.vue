<script setup lang="ts">
// Platformbeheer, AI-credits (P33; P24 maakt de pagina compleet met facturatie en marge): per
// organisatie pot, verbruik, extra en open aanvragen met "Toekennen"; prijs per handeling en
// credits per gebruiker per pakket. Alleen tellingen, nooit de inhoud van gesprekken.
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/platform/credits', { default: () => ({ organisaties: [], prijzen: [], pakketten: [] }) })
const getal = (n: number) => new Intl.NumberFormat('nl-NL').format(n)
const doe = async (url: string, body: unknown, method = 'POST') => { try { const r: any = await ($fetch as any)(url, { method, body }); toast.toon(r.tekst ?? 'Bewaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const ken = (o: any) => { const n = Number(prompt(`Hoeveel extra credits voor ${o.naam}?`, '1000')); if (n > 0) doe(`/api/platform/credits/${o.id}/extra`, { aantal: n }) }
useHead({ title: 'AI-credits · Platformbeheer' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="AI-credits" uitleg="Pot en verbruik per organisatie, extra credits en de prijs per handeling." />
    <section class="section section--laatste">
      <div class="container stapel">
        <nav class="tabbalk" aria-label="Platformbeheer"><NuxtLink to="/platform/klanten" class="tab">Klanten</NuxtLink><NuxtLink to="/platform/features" class="tab">Features per niveau</NuxtLink><NuxtLink to="/platform/credits" class="tab tab--actief">AI-credits</NuxtLink></nav>
        <article class="kaart" data-test="platform-credits">
          <table class="tabel tabel--kaarten"><thead><tr><th>Organisatie</th><th>Pakket</th><th>Pot</th><th>Verbruikt</th><th>Aanvragen</th><th /></tr></thead>
            <tbody><tr v-for="o in data.organisaties" :key="o.id"><td data-label="Organisatie">{{ o.naam }}</td><td data-label="Pakket">{{ o.pakket }}</td><td data-label="Pot" class="tnum">{{ getal(o.toegekend + o.extra) }}</td><td data-label="Verbruikt" class="tnum">{{ getal(o.verbruikt) }}</td><td data-label="Aanvragen">{{ o.openAanvragen }}</td>
              <td><button type="button" class="dd-act" :data-test="`toekennen-${o.id}`" @click="ken(o)">Extra credits toekennen</button></td></tr></tbody></table>
        </article>
        <article class="kaart">
          <h2 class="kaart-titel">Prijs per handeling</h2>
          <div class="vv-velden mt-8"><label v-for="p in data.prijzen" :key="p.soort" class="veld"><span class="veld-label">{{ p.naam }} (standaard {{ p.standaard }})</span><input class="invoer" type="number" min="0" :value="p.credits" @change="doe('/api/platform/credits/prijzen', { soort: p.soort, credits: Number(($event.target as HTMLInputElement).value) }, 'PUT')"></label></div>
        </article>
        <article class="kaart">
          <h2 class="kaart-titel">Credits per gebruiker per maand</h2>
          <div class="vv-velden mt-8"><label v-for="p in data.pakketten" :key="p.pakket" class="veld"><span class="veld-label">{{ p.pakket }} (standaard {{ p.standaard }})</span><input class="invoer" type="number" min="0" :value="p.perGebruiker" @change="doe(`/api/platform/pakketten/${p.pakket}/credits`, { perGebruiker: Number(($event.target as HTMLInputElement).value) }, 'PUT')"></label></div>
        </article>
      </div>
    </section>
  </div>
</template>
