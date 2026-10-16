<script setup lang="ts">
// Platformbeheer · Roadmap (F23): het bord over alle klanten met het aantal organisaties per wens, stemmen,
// prioriteit, link naar de klantflyout en "Maak issue" (kan maar één keer; regel 50).
import { WENS_LABEL, WENS_STATUS, type WensStatus } from '~~/shared/platform'
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const status = computed(() => (route.query.status as string) || '')
const { data, refresh } = await useFetch<any>('/api/platform/roadmap', { query: computed(() => ({ status: status.value || undefined })), default: () => ({ wensen: [] }) })
async function zet(w: any, body: Record<string, string>) { try { await $fetch(`/api/platform/roadmap/${w.id}`, { method: 'PUT', body }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function issue(w: any) { try { const r: any = await $fetch(`/api/platform/roadmap/${w.id}/issue`, { method: 'POST' }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
useHead({ title: 'Roadmap · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Roadmap" uitleg="Wensen van alle klanten. Maak issue zet de wens op gestart; de bouwketen opent een pull request, nooit een merge." />
    <section class="section section--laatste">
      <div class="container stapel">
        <div class="chips"><button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !status }" @click="router.replace({ query: {} })">Alle</button><button v-for="s in WENS_STATUS" :key="s" type="button" class="filter-pil" :class="{ 'filter-pil--aan': status === s }" @click="router.replace({ query: { status: s } })">{{ WENS_LABEL[s] }}</button></div>
        <LegeStaat v-if="!data.wensen.length" titel="Geen wensen." tekst="Klanten dienen wensen in via Roadmap in het gebruikersmenu." />
        <article v-for="w in data.wensen" :key="w.id" class="kaart" :data-test="`wens-${w.id}`">
          <header class="kaart-kop"><h2 class="kaart-titel">{{ w.titel }}</h2><span class="pil" :class="w.status === 'opgeleverd' ? 'pil--groen' : 'pil--leeg'">{{ WENS_LABEL[w.status as WensStatus] }}</span></header>
          <p v-if="w.omschrijving" class="kaart-meta">{{ w.omschrijving }}</p>
          <p class="kaart-meta">{{ w.organisaties }} {{ w.organisaties === 1 ? 'organisatie' : 'organisaties' }} · {{ w.stemmen }} stemmen · <NuxtLink :to="`/platform/klanten?klant=${w.organisatieId}`">{{ w.klant }}</NuxtLink><template v-if="w.issue"> · <a :href="w.issue" target="_blank" rel="noopener">issue</a></template></p>
          <div class="dd-acties mt-8">
            <select class="invoer invoer--klein" :value="w.prioriteit ?? ''" aria-label="Prioriteit" @change="zet(w, { prioriteit: ($event.target as HTMLSelectElement).value })"><option value="" disabled>Prioriteit</option><option value="hoog">Hoog</option><option value="middel">Middel</option><option value="laag">Laag</option></select>
            <select class="invoer invoer--klein" :value="w.status" aria-label="Status" @change="zet(w, { status: ($event.target as HTMLSelectElement).value })"><option v-for="s in WENS_STATUS.filter((x) => x !== 'gestart' || w.status === 'gestart')" :key="s" :value="s" :disabled="s === 'gestart'">{{ WENS_LABEL[s] }}</option></select>
            <button type="button" class="dd-act" :disabled="w.status !== 'ingediend'" :data-test="`issue-${w.id}`" @click="issue(w)">Maak issue</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
