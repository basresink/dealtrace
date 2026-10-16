<script setup lang="ts">
// Platformbeheer · Facturen (F23): facturen uit Stripe Billing met status, marge per klant, extra credits die
// nog op een factuur moeten en achterstallige klanten met "AI gepauzeerd". Moneybird als job.
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/platform/facturen', { default: () => ({ facturen: [], marge: [], teFactureren: [], achterstallig: [] }) })
const { data: klanten } = await useFetch<any>('/api/platform/klanten', { default: () => ({ klanten: [] }) })
const euro = (c: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(c / 100)
const STATUS: Record<string, string> = { open: 'Open', betaald: 'Betaald', achterstallig: 'Achterstallig', geannuleerd: 'Geannuleerd' }
const klant = ref('')
async function doe(url: string, body?: Record<string, unknown>) { try { const r: any = await $fetch(url, { method: 'POST', body }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
useHead({ title: 'Facturen · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Facturen" uitleg="Facturen uit Stripe, marge per klant en de synchronisatie met Moneybird." />
    <section class="section section--laatste">
      <div class="container stapel">
        <article v-if="data.achterstallig.length" class="kaart kaart--geel" data-test="achterstallig"><strong>Achterstallig:</strong> {{ data.achterstallig.join(', ') }} <span class="pil pil--rood">AI gepauzeerd</span></article>
        <article class="kaart">
          <div class="dd-acties">
            <select v-model="klant" class="invoer invoer--klein" aria-label="Klant"><option value="">Kies een klant</option><option v-for="k in klanten.klanten" :key="k.id" :value="k.id">{{ k.naam }}</option></select>
            <button type="button" class="dd-act" :disabled="!klant" data-test="maak-factuur" @click="doe('/api/platform/facturen/maak', { organisatieId: klant })">Maak maandfactuur</button>
            <button type="button" class="dd-act" @click="doe('/api/platform/facturen/moneybird')">Synchroniseer Moneybird</button>
          </div>
        </article>
        <article class="kaart" data-test="facturen-lijst">
          <h2 class="kaart-titel">Facturen</h2>
          <p v-if="!data.facturen.length" class="kaart-meta">Nog geen facturen.</p>
          <table v-else class="tabel tabel--kaarten mt-8"><thead><tr><th>Nummer</th><th>Klant</th><th>Bedrag</th><th>Status</th><th>Vervalt</th><th>Moneybird</th></tr></thead>
            <tbody><tr v-for="f in data.facturen" :key="f.id"><td data-label="Nummer">{{ f.nummer }}</td><td data-label="Klant">{{ f.klant }}</td><td data-label="Bedrag" class="tnum">{{ euro(f.bedragCent) }}</td>
              <td data-label="Status"><span class="pil" :class="f.status === 'betaald' ? 'pil--groen' : f.status === 'achterstallig' ? 'pil--rood' : 'pil--leeg'">{{ STATUS[f.status] }}</span></td><td data-label="Vervalt">{{ f.vervaltOp ?? '-' }}</td><td data-label="Moneybird">{{ f.moneybird ?? '-' }}</td></tr></tbody></table>
        </article>
        <div class="raster raster--2">
          <article class="kaart" data-test="marge"><h2 class="kaart-titel">Marge per klant</h2><p class="kaart-meta">Gefactureerd zonder btw min de geschatte AI-kosten van deze maand.</p>
            <ul class="schakel-lijst"><li v-for="m in data.marge" :key="m.organisatieId" class="schakel-rij"><span>{{ m.klant }}</span><span class="tnum">{{ euro(m.margeCent) }}</span></li></ul></article>
          <article class="kaart"><h2 class="kaart-titel">Extra credits te factureren</h2><p v-if="!data.teFactureren.length" class="kaart-meta">Niets.</p>
            <ul class="schakel-lijst"><li v-for="t in data.teFactureren" :key="t.organisatieId" class="schakel-rij"><span>{{ t.klant }}</span><span class="tnum">{{ t.credits }} credits</span></li></ul></article>
        </div>
      </div>
    </section>
  </div>
</template>
