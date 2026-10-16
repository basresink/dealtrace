<script setup lang="ts">
// Platformbeheer · Motor (F23): per organisatie de laatste run met fouten per stap, taken en inzichten, de runs
// en fouten van de laatste 7 dagen, en "Draai opnieuw voor deze klant".
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/platform/motor', { default: () => ({ klanten: [] }) })
const moment = (s: string | null) => (s ? new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : 'nog nooit')
async function draai(k: any) { try { const r: any = await $fetch(`/api/platform/motor/${k.id}/run`, { method: 'POST' }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
useHead({ title: 'Motor · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Motor" uitleg="De laatste run per klant. Alleen tellingen en stappen, geen klantrecords." />
    <section class="section section--laatste">
      <div class="container stapel">
        <article v-for="k in data.klanten" :key="k.id" class="kaart" :data-test="`motor-${k.id}`">
          <header class="kaart-kop"><h2 class="kaart-titel">{{ k.naam }}</h2><span class="pil" :class="k.fouten7d ? 'pil--rood' : 'pil--leeg'">{{ k.runs7d }} runs · {{ k.fouten7d }} met fouten (7 dagen)</span></header>
          <p class="kaart-meta">Laatste run {{ moment(k.laatste) }}<template v-if="k.laatste"> ({{ k.soort }}) · {{ k.taken }} taken · {{ k.inzichten }} inzichten</template></p>
          <ul v-if="k.stappen.length" class="schakel-lijst mt-8"><li v-for="s in k.stappen" :key="s.stap" class="schakel-rij"><span>{{ s.stap }}</span><span class="meta">{{ s.status }}<template v-if="s.toelichting"> · {{ s.toelichting }}</template></span></li></ul>
          <p v-for="f in k.fouten" :key="String(f)" class="kaart-meta meta--oranje">{{ typeof f === 'string' ? f : f.fout ?? JSON.stringify(f) }}</p>
          <button type="button" class="dd-act mt-8" @click="draai(k)">Draai opnieuw voor deze klant</button>
        </article>
      </div>
    </section>
  </div>
</template>
