<script setup lang="ts">
// Tabblad Jaarplanning (F13): wie dit verkoopjaar aan de beurt is per potentie. "Wat knelt er
// nu" met inplannen in belblokken en indelen, de jaarkalender van twaalf maandtegels en het
// maanddetail per groep. De rekenregels staan in shared/planning.ts.
import { POTENTIE_LABEL, maandInJaar } from '~~/shared/planning'
const toast = useToast()
const route = useRoute()
const router = useRouter()
const scope = computed(() => (route.query.scope === 'team' ? 'team' : 'mij'))
const { data, refresh } = await useFetch<any>('/api/planning/jaar', { query: computed(() => ({ scope: scope.value })), default: () => null })
const { data: inst } = await useFetch<any>('/api/settings', { default: () => ({}) })
const klassen = computed(() => ((inst.value?.klassen ?? []) as any[]).filter((k) => k.tabblad !== 'Klanten'))
const nu = new Date()
const huidig = computed(() => (data.value ? Math.min(12, Math.max(1, maandInJaar(nu.toISOString(), data.value.jaar.start))) : 1))
const maand = ref<number | null>(null)
const gekozen = computed(() => maand.value ?? (data.value?.stand.maanden.find((m: any) => m.maand === huidig.value)?.groepen.length ? huidig.value : data.value?.stand.maanden.find((m: any) => m.groepen.some((g: any) => g.teLaat))?.maand ?? huidig.value))
const tegel = computed(() => data.value?.stand.maanden.find((m: any) => m.maand === gekozen.value))
const VOLGORDE: Record<string, number> = { 'Nog niet benaderd': 0, Benaderd: 1, Gesproken: 2, Afspraak: 3 }
const rijenVan = (p: string) => (data.value?.accounts ?? []).filter((a: any) => a.potentie === p && a.venster && maandInJaar(a.venster.tot, data.value.jaar.start) >= gekozen.value)
  .sort((a: any, b: any) => VOLGORDE[a.status]! - VOLGORDE[b.status]! || a.naam.localeCompare(b.naam))
const teLaatIds = (p?: string) => (data.value?.accounts ?? []).filter((a: any) => (!p || a.potentie === p) && a.potentie && a.status === 'Nog niet benaderd' && a.venster && a.venster.tot < nu.toISOString().slice(0, 10)).map((a: any) => a.id)

const bevestig = ref<{ ids: string[]; tekst: string } | null>(null)
async function vraagInplannen(p?: string) {
  const ids = teLaatIds(p)
  try {
    const r = await $fetch<any>('/api/planning/inplannen', { method: 'POST', body: { accountIds: ids, doel: 'belblokken', proef: true } })
    bevestig.value = { ids, tekst: `${r.tekst}.${r.over ? ` ${r.over} passen niet in de komende weken.` : ''}${r.inRitme ? ` ${r.inRitme} staan al in een ritme en blijven daar.` : ''}` }
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function planIn() {
  const ids = bevestig.value!.ids
  bevestig.value = null
  try {
    const r = await $fetch<any>('/api/planning/inplannen', { method: 'POST', body: { accountIds: ids, doel: 'belblokken' } })
    toast.toon(r.ingepland ? `${r.ingepland} belpogingen ingepland.` : r.tekst, r.ingepland ? 'succes' : 'let-op')
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const indelen = ref(false)
const zonderKlasse = computed(() => (data.value?.accounts ?? []).filter((a: any) => !a.potentie))
async function deelIn(a: any, klasse: string) {
  try { await $fetch(`/api/accounts/${a.id}`, { method: 'PUT', body: { klasse } }); toast.toon(`${a.naam} is ingedeeld.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const bezoek = ref<{ id: string; naam: string } | null>(null)
const NIVEAU: Record<string, string> = { urgent: 'kaart--rood', letop: 'kaart--geel', info: 'kaart--vlak', goed: 'kaart--vlak' }
</script>

<template>
  <div v-if="data" data-test="tab-jaar">
    <div class="rijtje">
      <span class="kicker kicker--streep" data-test="jaar-kicker">Verkoopjaar {{ data.jaar.jaar }} · {{ data.stand.ingedeeld }} van {{ data.stand.totaal }} prospects ingedeeld</span>
      <span class="dd-acties-vul" />
      <div v-if="data.kan.team" class="keuzegroep keuzegroep--klein" role="group" aria-label="Wie">
        <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': scope === 'mij' }" @click="router.replace({ query: { ...route.query, scope: undefined } })">Van mij</button>
        <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': scope === 'team' }" data-test="scope-team" @click="router.replace({ query: { ...route.query, scope: 'team' } })">Team</button>
      </div>
    </div>

    <LegeStaat v-if="!data.stand.totaal" class="mt-16" titel="Er zijn nog geen prospects met een klasse." tekst="Deel ze in om de jaarplanning te vullen." />
    <template v-else>
      <h2 class="kop-blok mt-24">Wat knelt er nu</h2>
      <div class="stapel mt-12" data-test="knelt">
        <article v-for="k in data.knelt" :key="k.titel" class="kaart" :class="NIVEAU[k.niveau]" :data-niveau="k.niveau">
          <p><strong>{{ k.titel }}:</strong> {{ k.tekst }}</p>
          <div v-if="k.actie" class="dd-acties mt-8">
            <button v-if="k.actie.soort === 'inplannen' && data.kan.inplannen" type="button" class="dd-act dd-act--primair" :data-test="`plan-${k.actie.potentie}`" @click="vraagInplannen(k.actie.potentie)">Plan {{ k.actie.aantal }} in belblokken</button>
            <button v-if="k.actie.soort === 'indelen' && data.kan.indelen" type="button" class="dd-act" data-test="deel-in" @click="indelen = !indelen">Deel in</button>
          </div>
          <div v-if="k.actie?.soort === 'indelen' && indelen" class="lijst mt-12" data-test="indelen">
            <div v-for="a in zonderKlasse" :key="a.id" class="rij rij--compact">
              <div class="rij-info"><span class="rij-titel">{{ a.naam }}</span><div class="rij-sub">{{ a.plaats }}</div></div>
              <div class="rij-rechts"><select class="invoer invoer--klein" :aria-label="`Klasse voor ${a.naam}`" @change="deelIn(a, ($event.target as HTMLSelectElement).value)"><option value="">Kies klasse</option><option v-for="kl in klassen" :key="kl.id" :value="kl.id">{{ kl.naam }}</option></select></div>
            </div>
          </div>
        </article>
      </div>

      <h2 class="kop-blok mt-32">Jaarkalender</h2>
      <div class="jaarkalender mt-12" data-test="kalender">
        <button v-for="m in data.stand.maanden" :key="m.maand" type="button" class="maandtegel" :class="{ 'maandtegel--aan': gekozen === m.maand, 'maandtegel--nu': huidig === m.maand }" :data-maand="m.maand" @click="maand = m.maand">
          <span class="maandtegel-naam">{{ m.label }}</span>
          <span v-for="g in m.groepen" :key="g.potentie" class="maandtegel-groep">{{ POTENTIE_LABEL[g.potentie as 'groot'] }} · {{ g.benaderd }}/{{ g.totaal }} benaderd <span v-if="g.teLaat" class="pil pil--rood-vol">{{ g.teLaat }} te laat</span></span>
          <span v-if="!m.groepen.length" class="maandtegel-groep meta">Niets aan de beurt</span>
        </button>
      </div>

      <h2 class="kop-blok mt-32 hoofdletter">{{ tegel?.label }}</h2>
      <div v-for="g in tegel?.groepen ?? []" :key="g.potentie" class="kaart mt-12" :data-groep="g.potentie">
        <header class="kaart-kop"><h3 class="kaart-titel">{{ POTENTIE_LABEL[g.potentie as 'groot'] }}</h3><span class="meta">{{ g.benaderd }} van {{ g.totaal }} benaderd</span></header>
        <div class="voortgang"><span class="voortgang-vul" :style="{ width: `${Math.round((g.benaderd / g.totaal) * 100)}%` }" /></div>
        <div class="lijst mt-12">
          <div v-for="a in rijenVan(g.potentie)" :key="a.id" class="rij rij--compact plan-rij" :data-account="a.naam">
            <div class="rij-info"><NuxtLink :to="`/accounts/${a.id}`" class="rij-titel">{{ a.naam }}</NuxtLink><div class="rij-sub">{{ a.klasse ?? 'geen klasse' }} · {{ a.plaats ?? 'plaats onbekend' }} · {{ a.status }} · {{ a.pogingen }} {{ a.pogingen === 1 ? 'contactmoment' : 'contactmomenten' }}</div></div>
            <div class="rij-rechts">
              <a v-if="a.telefoon" class="dd-act" :href="`tel:${a.telefoon}`" data-test="bel">Bel</a>
              <NuxtLink v-else class="dd-act" :to="`/accounts/${a.id}`" data-test="bel">Bel</NuxtLink>
              <button type="button" class="dd-act" data-test="plan-bezoek" @click="bezoek = { id: a.id, naam: a.naam }">Plan bezoek</button>
            </div>
          </div>
        </div>
      </div>
    </template>
    <BevestigVenster :open="!!bevestig" titel="Inplannen in belblokken?" :tekst="bevestig?.tekst ?? ''" bevestig="Plan in" @geannuleerd="bevestig = null" @bevestigd="planIn" />
    <NieuweTaakFlyout :open="!!bezoek" :account="bezoek" actiesoort="bezoek" @sluit="bezoek = null" @gemaakt="bezoek = null" />
  </div>
</template>
