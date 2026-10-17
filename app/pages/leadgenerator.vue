<script setup lang="ts">
// Leadgenerator (F02): één leadstroom met de bronnen AI-zoeker en KvK, plus de tabbladen
// Importeren (P04), Koppelingen en Rondes en verbruik. Het tabblad Zoeken staat hier: de
// zoekopdracht in vakken, de groepen met bewijs en de meters. De beoordeling rekent met
// dezelfde functies als de server, zodat een aangepaste zoekopdracht direct doorwerkt.
import {
  ANDERE_REDEN, ANDERE_REDEN_MAX, ANDERE_REDEN_MIN, BRON_LABEL, CRITERIUM_LABEL, GROEP_LABEL, GROEP_WEERGAVE, beoordeelLead, dossierLabel, groepeerLead,
  type LeadGroep, type Zoekopdracht,
} from '~~/shared/leadGenerator'
import { CREDITS_OP_TEKST, creditsVoor } from '~~/shared/credits'
const { functie } = useMe()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const kanRonde = computed(() => !!functie('nav.leadgenerator')?.beschikbaar)
const kanOvernemen = computed(() => !!functie('leads.overnemen')?.beschikbaar)
const kanImport = computed(() => !!functie('import.uitvoeren')?.beschikbaar)
const toegang = computed(() => kanRonde.value || kanOvernemen.value)

type Tab = 'zoeken' | 'importeren' | 'koppelingen' | 'rondes'
const TABS: { k: Tab; t: string }[] = [{ k: 'zoeken', t: 'Zoeken' }, { k: 'importeren', t: 'Importeren' }, { k: 'koppelingen', t: 'Koppelingen' }, { k: 'rondes', t: 'Rondes en verbruik' }]
const tabs = computed(() => TABS.filter((t) => t.k === 'zoeken' || (kanRonde.value && (t.k !== 'importeren' || kanImport.value))))
const tab = computed<Tab>(() => (tabs.value.find((t) => t.k === route.query.tab)?.k ?? 'zoeken'))
const naarTab = (k: Tab) => router.replace({ query: { ...route.query, tab: k === 'zoeken' ? undefined : k } })

const { data: context, refresh: verversContext } = toegang.value ? await useFetch<any>('/api/leads/context', { default: () => null }) : { data: ref<any>(null), refresh: async () => {} }
const { data: lijst, refresh } = toegang.value ? await useFetch<any>('/api/leads', { query: computed(() => ({ ronde: route.query.ronde })), default: () => ({ ronde: null, zoekopdracht: null, leads: [], afgewezen: [] }) }) : { data: ref<any>({ leads: [], afgewezen: [] }), refresh: async () => {} }

// De zoekopdracht: uit de laatste ronde, anders leeg. Aanpassen werkt direct door in de groepen.
const leeg = (): Zoekopdracht => ({ doelgroepId: null, doelgroepNaam: null, lijktOpKlanten: false, klassen: [], sbi: [], brancheId: null, werkgebied: { postcodes: [], straal: null }, aanleiding: '', concurrentId: null })
const z = reactive<Zoekopdracht>(leeg())
const bronnen = ref<string[]>([])
watch(() => lijst.value?.zoekopdracht, (w) => { Object.assign(z, leeg(), w ?? {}, { werkgebied: { postcodes: [], straal: null, ...(w?.werkgebied ?? {}) } }) }, { immediate: true })
watch(() => [context.value, lijst.value?.ronde] as const, ([c, r]) => {
  if (!c) return
  const kies = (r?.bronnen ?? ['kvk', 'ai']).filter((b: string) => c.bronnen[b]?.beschikbaar)
  bronnen.value = kies.length ? kies : ['kvk', 'ai'].filter((b) => c.bronnen[b]?.beschikbaar)
}, { immediate: true })
const paneel = ref(false)
const postcodesTekst = computed({ get: () => (z.werkgebied?.postcodes ?? []).join(', '), set: (v: string) => { z.werkgebied = { ...z.werkgebied, postcodes: v.split(/[,\s]+/).filter(Boolean) } } })
const straalAan = computed({ get: () => !!z.werkgebied?.straal, set: (v: boolean) => { const t = context.value?.thuisbasis; z.werkgebied = { ...z.werkgebied, straal: v && t ? { lat: t.lat, lng: t.lng, km: z.werkgebied?.straal?.km ?? 50 } : null } } })
const straalKm = computed({ get: () => z.werkgebied?.straal?.km ?? 50, set: (v: number) => { if (z.werkgebied?.straal) z.werkgebied = { ...z.werkgebied, straal: { ...z.werkgebied.straal, km: Number(v) } } } })
function kiesBranche(id: string) {
  z.brancheId = id || null
  const b = context.value?.branches.find((x: any) => x.id === id)
  z.sbi = b?.sbi ?? []
}
const codeVan = (id: string) => (context.value?.klassen ?? []).find((k: any) => k.id === id)?.naam?.match(/^\s*([A-Z0-9]{1,2})\s*·/)?.[1] ?? id
const klasseCodes = computed(() => (context.value?.klassen ?? []).map((k: any) => codeVan(k.id)))
function wisselKlasse(c: string) { z.klassen = z.klassen?.includes(c) ? z.klassen.filter((x) => x !== c) : [...(z.klassen ?? []), c] }
function wisselBron(b: string) { bronnen.value = bronnen.value.includes(b) ? bronnen.value.filter((x) => x !== b) : [...bronnen.value, b] }

// Beoordelen en groeperen met de huidige zoekopdracht (dezelfde functies als de server).
const nu = new Date()
const leads = computed(() => (lijst.value?.leads ?? []).map((l: any) => {
  const b = beoordeelLead(l.feiten, z, context.value?.klassen ?? [], nu)
  return { ...l, bewijs: b.bewijs, score: b.score, groep: groepeerLead({ alBekend: !!l.alBekend, bewijs: b.bewijs, dossierOp: l.dossierOp }, nu) as LeadGroep }
}))
// Filter: een groep, of Niet relevant (de afgewezen leads van deze ronde met hun reden, ook een eigen reden).
const filter = ref<LeadGroep | 'afgewezen' | null>(null)
const groepen = computed(() => (filter.value === 'afgewezen' ? [] : GROEP_WEERGAVE.map((g) => ({ g, leads: leads.value.filter((l: any) => l.groep === g) })).filter((x) => x.leads.length && (!filter.value || x.g === filter.value))))
const afgewezen = computed<any[]>(() => lijst.value?.afgewezen ?? [])
const redenFilter = ref<string | null>(null)
const redenTelling = computed(() => { const m = new Map<string, number>(); for (const a of afgewezen.value) m.set(a.reden, (m.get(a.reden) ?? 0) + 1); return [...m].map(([reden, n]) => ({ reden, n })) })
const afgewezenZichtbaar = computed(() => afgewezen.value.filter((a) => !redenFilter.value || a.reden === redenFilter.value))
watch(filter, () => { redenFilter.value = null })
const telling = computed(() => Object.fromEntries(GROEP_WEERGAVE.map((g) => [g, leads.value.filter((l: any) => l.groep === g).length])))

// Acties
const bezig = ref<string | null>(null)
const aiOp = computed(() => bronnen.value.includes('ai') && (context.value?.meters.credits ?? 0) < creditsVoor('zoekronde'))
async function nieuweRonde() {
  if (aiOp.value) { toast.toon(CREDITS_OP_TEKST, 'let-op'); return }
  if (!bronnen.value.length) { toast.toon('Kies minstens één bron', 'let-op'); paneel.value = true; return }
  bezig.value = 'ronde'
  try {
    const r = await $fetch<any>('/api/leads/ronde', { method: 'POST', body: { zoekopdracht: z, bronnen: bronnen.value } })
    toast.toon(r.bewaard ? `Bewaard resultaat van eerder vandaag: ${r.aantal} bedrijven, zonder kosten.` : `${r.aantal} bedrijven gevonden${r.credits ? `, ${r.credits} AI-credits` : ''}${r.kvk ? `, ${r.kvk} KvK-bevragingen` : ''}${r.dc ? `, ${r.dc} Datacollectief-records` : ''}.`)
    if (r.melding) toast.toon(r.melding, 'let-op')
    paneel.value = false
    await router.replace({ query: { ...route.query, ronde: r.rondeId } })
    await Promise.all([refresh(), verversContext()])
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
async function dossier(l: any) {
  bezig.value = l.id
  try {
    await $fetch(`/api/leads/${l.id}/dossier`, { method: 'POST' })
    toast.toon(`Dossier van ${l.naam} is bijgewerkt.`)
    await Promise.all([refresh(), verversContext()])
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
const afwijzen = ref<any>(null)
const reden = ref('')
const eigenReden = ref('')
const kanAfwijzen = computed(() => !!reden.value && (reden.value !== ANDERE_REDEN || eigenReden.value.trim().length >= ANDERE_REDEN_MIN))
function openAfwijzen(l: any) { afwijzen.value = l; reden.value = ''; eigenReden.value = '' }
async function wijsAf() {
  const l = afwijzen.value
  if (!kanAfwijzen.value) return
  try {
    await $fetch(`/api/leads/${l.id}/afwijzen`, { method: 'POST', body: { reden: reden.value, ...(reden.value === ANDERE_REDEN ? { toelichting: eigenReden.value.trim() } : {}) } })
    toast.toon('Reden bewaard. Dit bedrijf komt niet terug.')
    afwijzen.value = null; reden.value = ''; eigenReden.value = ''
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Voeg toe (voorheen Neem over): de flyout maakt het account; daarna een melding met een link naar de kaart.
const toevoegen = ref<any>(null)
const toegevoegd = ref<{ id: string; naam: string; tekst: string; accountplanId: string | null } | null>(null)
async function isToegevoegd(r: { id: string; naam: string; tekst: string; accountplanId: string | null }) { toevoegen.value = null; toegevoegd.value = r; await refresh() }

const opslaan = ref(false)
const opslaanNaam = ref('')
const wekelijks = ref(false)
async function bewaar() {
  try {
    await $fetch('/api/leads/zoekopdrachten', { method: 'POST', body: { naam: opslaanNaam.value, zoekopdracht: z, bronnen: bronnen.value, automatisch: wekelijks.value ? 'wekelijks' : 'uit' } })
    toast.toon(wekelijks.value ? 'Bewaard als zoekopdracht. Draait elke week.' : 'Bewaard als zoekopdracht.')
    opslaan.value = false; opslaanNaam.value = ''; wekelijks.value = false
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

const branche = computed(() => context.value?.branches.find((b: any) => b.id === z.brancheId))
const vakken = computed(() => {
  const c = context.value
  const wg = z.werkgebied
  return [
    { label: 'Klasse of omvang', waarde: z.klassen?.length ? z.klassen.join(' en ') : 'Alle klassen', herkomst: z.doelgroepId ? 'uit de doelgroep' : 'jouw keuze' },
    { label: 'Branche', waarde: z.sbi?.length ? z.sbi.join(' en ') : 'Alle branches', herkomst: z.lijktOpKlanten ? `Uit je ${c?.lijktOpKlanten.aantalKlanten ?? 0} klanten in deze klassen` : branche.value?.naam ?? 'verkoopverhaal' },
    { label: 'Werkgebied', waarde: wg?.straal ? `${wg.straal.km} km rond ${c?.thuisbasis?.plaats ?? 'je thuisbasis'}` : wg?.postcodes?.length ? wg.postcodes.join(', ') : 'Overal', herkomst: wg?.straal ? 'straal rond je thuisbasis' : wg?.postcodes?.length ? 'postcodegebieden' : 'geen werkgebied' },
    { label: 'Aanleiding', waarde: z.aanleiding || 'Geen', herkomst: 'jij' },
    { label: 'Bronnen', waarde: bronnen.value.map((b) => BRON_LABEL[b as 'ai']).join(', ') || 'Geen', herkomst: context.value?.bronnen?.datacollectief?.beschikbaar ? 'Datacollectief gekoppeld' : 'Datacollectief niet gekoppeld' },
  ]
})
const kicker = computed(() => `Leadgenerator · ${leads.value.length} gevonden`)
const fmt = (n: number) => new Intl.NumberFormat('nl-NL').format(n)
const datumKort = (d?: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(d)) : '')
const contactRegel = (l: any) => { const c = (l.feiten.contacten ?? [])[0]; return c ? `${c.naam}${c.functie ? ` · ${c.functie}` : ''}${c.functie && /eigenaar|directeur/i.test(c.functie) ? ' · beslisser' : ''}` : 'contactpersoon onbekend' }
const alBekendTekst = (l: any) => (l.alBekend?.crm ? `Al ${l.alBekend.crm.soort} in het CRM${l.alBekend.crm.eigenaar ? ` · ${l.alBekend.crm.eigenaar}` : ''}` : l.alBekend?.dealdrive ? `Al ${l.alBekend.dealdrive.soort} in DealDrive${l.alBekend.dealdrive.eigenaar ? ` · ${l.alBekend.dealdrive.eigenaar}` : ''}` : l.status === 'overgenomen' ? 'Overgenomen' : 'Gelijk aan een account in je bestand')
useHead({ title: 'Leadgenerator · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!toegang" sleutel="nav.leadgenerator" />
    <template v-else>
      <PaginaKop :kicker="kicker" titel="Leadgenerator" uitleg="Bedrijven die passen bij je doelgroep, met bewijs, bron en datum." helpartikel="leadgenerator">
        <template v-if="kanRonde && tab === 'zoeken'" #acties>
          <button type="button" class="dd-actie dd-actie--secundair" data-test="zoekopdracht-aanpassen" @click="paneel = !paneel">Zoekopdracht aanpassen</button>
          <button type="button" class="dd-actie dd-actie--primair" :disabled="bezig === 'ronde'" data-test="nieuwe-ronde" @click="nieuweRonde"><Icoon naam="Sparkles" class="dd-actie-icoon" />{{ bezig === 'ronde' ? 'Bezig…' : 'Nieuwe ronde' }}</button>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel" data-test="groot-scherm">Beter op een groot scherm. KvK opzoeken kan wel: tik op Zoeken.</p>
          <nav v-if="tabs.length > 1" class="tabbalk" aria-label="Leadgenerator">
            <button v-for="t in tabs" :key="t.k" type="button" class="tab" :class="{ 'tab--actief': tab === t.k }" :aria-current="tab === t.k ? 'page' : undefined" :data-test="`tab-${t.k}`" @click="naarTab(t.k)">{{ t.t }}</button>
          </nav>

          <div v-if="tab === 'zoeken'" class="mt-16" data-test="tab-zoeken">
            <p v-if="aiOp" class="kaart kaart--geel" role="status" data-test="credits-op">{{ CREDITS_OP_TEKST }}</p>
            <div v-if="toegevoegd" class="kaart lg-toegevoegd mb-16" role="status" data-test="toegevoegd-melding">
              <p class="lg-toegevoegd-tekst">{{ toegevoegd.tekst }}</p>
              <div class="rijtje">
                <NuxtLink :to="`/accounts/${toegevoegd.id}`" class="dd-act dd-act--primair" data-test="toegevoegd-open">Open {{ toegevoegd.naam }}</NuxtLink>
                <FunctieLink v-if="toegevoegd.accountplanId" :to="`/accountplannen/${toegevoegd.accountplanId}`" class="dd-act" data-test="toegevoegd-plan">Open accountplan</FunctieLink>
                <button type="button" class="dd-act" aria-label="Melding sluiten" @click="toegevoegd = null"><Icoon naam="X" :grootte="14" /></button>
              </div>
            </div>
            <div class="stat-grid lg-vakken" data-test="vakken">
              <div v-for="v in vakken" :key="v.label" class="stat-card"><span class="stat-label">{{ v.label }}</span><span class="stat-value-tekst">{{ v.waarde }}</span><span class="stat-foot">{{ v.herkomst }}</span></div>
            </div>

            <div v-if="paneel && context" class="kaart mt-16" data-test="zoekpaneel">
              <div class="formulier-raster">
                <label class="veld"><span class="veld-label">Branche</span>
                  <select class="invoer" :value="z.brancheId ?? ''" data-test="zp-branche" @change="kiesBranche(($event.target as HTMLSelectElement).value)">
                    <option value="">Alle branches</option>
                    <option v-for="b in context.branches" :key="b.id" :value="b.id">{{ b.naam }}{{ b.sbi.length ? ` (SBI ${b.sbi.join(', ')})` : '' }}</option>
                  </select>
                </label>
                <div class="veld"><span class="veld-label">Klasse</span>
                  <div class="keuzegroep" role="group" aria-label="Klasse"><button v-for="c in klasseCodes" :key="c" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': z.klassen?.includes(c) }" :data-test="`zp-klasse-${c}`" @click="wisselKlasse(c)">{{ c }}</button></div>
                </div>
                <label class="veld"><span class="veld-label">Postcodegebieden</span><input v-model.lazy="postcodesTekst" class="invoer" placeholder="Bijvoorbeeld 80, 97" data-test="zp-postcodes"></label>
                <div class="veld"><span class="veld-label">Straal rond je thuisbasis</span>
                  <label v-if="context.thuisbasis" class="vink"><input v-model="straalAan" type="checkbox" data-test="zp-straal"> {{ context.thuisbasis.plaats }}<input v-if="straalAan" v-model.number="straalKm" class="invoer invoer--klein" type="number" min="5" max="300" aria-label="Kilometers" style="width: 90px; margin-left: 8px"> <span v-if="straalAan">km</span></label>
                  <span v-else class="veld-uitleg">Geen thuisbasis bekend.</span>
                </div>
                <label class="veld"><span class="veld-label">Aanleiding</span><input v-model="z.aanleiding" class="invoer" placeholder="Bijvoorbeeld werft servicemonteurs" maxlength="200" data-test="zp-aanleiding"></label>
                <div class="veld"><span class="veld-label">Bronnen</span>
                  <div class="rijtje">
                    <label v-for="b in (['ai', 'kvk', 'datacollectief', 'crm'] as const).filter((x) => context.bronnen[x])" :key="b" class="vink" :title="context.bronnen[b].reden ?? ''"><input type="checkbox" :checked="bronnen.includes(b)" :disabled="!context.bronnen[b].beschikbaar" :data-test="`zp-bron-${b}`" @change="wisselBron(b)"> {{ BRON_LABEL[b] }}<span v-if="!context.bronnen[b].beschikbaar" class="meta"> · {{ context.bronnen[b].reden }}</span></label>
                  </div>
                </div>
              </div>
              <div class="dd-acties mt-16">
                <button v-if="context.kan.opslaan" type="button" class="dd-act" data-test="bewaar-zoekopdracht" @click="opslaan = !opslaan">Bewaar als zoekopdracht</button>
                <span class="dd-acties-vul" />
                <button type="button" class="dd-act dd-act--primair" :disabled="bezig === 'ronde'" @click="nieuweRonde">Nieuwe ronde</button>
              </div>
              <form v-if="opslaan" class="rijtje mt-16" @submit.prevent="bewaar">
                <input v-model="opslaanNaam" class="invoer" required placeholder="Naam van de zoekopdracht" aria-label="Naam van de zoekopdracht" data-test="zoekopdracht-naam">
                <label v-if="context.kan.automatisch" class="vink"><input v-model="wekelijks" type="checkbox" data-test="wekelijks"> Elke week laten draaien</label>
                <button type="submit" class="dd-act dd-act--primair" data-test="zoekopdracht-opslaan">Bewaar</button>
              </form>
            </div>

            <LegeStaat v-if="!leads.length && !afgewezen.length" class="mt-32" titel="Nog geen leads." tekst="Pas je zoekopdracht aan en start een ronde." />
            <template v-else>
              <div class="filter-groep mt-24" role="group" aria-label="Groepen">
                <button v-for="g in GROEP_WEERGAVE.filter((x) => telling[x])" :key="g" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter === g }" :data-test="`filter-${g}`" @click="filter = filter === g ? null : g">{{ GROEP_LABEL[g] }} <span class="pil-teller">{{ telling[g] }}</span></button>
                <button v-if="afgewezen.length" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter === 'afgewezen' }" data-test="filter-afgewezen" @click="filter = filter === 'afgewezen' ? null : 'afgewezen'">Niet relevant <span class="pil-teller">{{ afgewezen.length }}</span></button>
              </div>
              <div v-if="filter === 'afgewezen'" data-groep="afgewezen">
                <h2 class="kop-blok mt-32">Niet relevant <span class="pil-teller">{{ afgewezen.length }}</span></h2>
                <p class="meta mt-8">Deze bedrijven komen niet terug in een volgende ronde. Je reden stuurt de zoeker bij.</p>
                <div v-if="redenTelling.length > 1" class="filter-groep mt-12" role="group" aria-label="Reden">
                  <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !redenFilter }" data-test="reden-alle" @click="redenFilter = null">Alle redenen</button>
                  <button v-for="r in redenTelling" :key="r.reden" type="button" class="filter-pil" :class="{ 'filter-pil--aan': redenFilter === r.reden }" :data-reden-filter="r.reden" @click="redenFilter = redenFilter === r.reden ? null : r.reden">{{ r.reden }} <span class="pil-teller">{{ r.n }}</span></button>
                </div>
                <div class="lijst mt-12" data-test="afgewezen-lijst">
                  <div v-for="a in afgewezenZichtbaar" :key="a.id" class="rij rij--compact" :data-afgewezen="a.naam">
                    <div class="rij-info"><h3 class="rij-titel">{{ a.naam }}</h3><div class="rij-sub">{{ a.plaats ?? 'plaats onbekend' }} · afgewezen op {{ datumKort(a.op) }}</div></div>
                    <div class="rij-rechts lg-reden">
                      <span class="pil pil--grijs">{{ a.reden }}</span>
                      <span v-if="a.toelichting" class="meta lg-reden-tekst" data-test="afgewezen-eigen">{{ a.toelichting }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else-if="!groepen.length" class="mt-16">Geen leads in deze groep. <button type="button" class="dd-tekstknop" @click="filter = null">Toon alles</button></p>
              <div v-for="gr in groepen" :key="gr.g" :data-groep="gr.g">
                <h2 class="kop-blok mt-32">{{ GROEP_LABEL[gr.g] }} <span class="pil-teller">{{ gr.leads.length }}</span></h2>
                <div v-if="gr.g === 'alBekend'" class="lijst mt-12">
                  <div v-for="l in gr.leads" :key="l.id" class="rij rij--compact" :data-lead="l.naam">
                    <div class="rij-info"><h3 class="rij-titel">{{ l.naam }}</h3><div class="rij-sub">{{ l.plaats }} · {{ alBekendTekst(l) }}</div></div>
                    <div class="rij-rechts">
                      <span v-if="l.alBekend?.crm" class="pil" :class="l.alBekend.crm.soort === 'klant' ? 'pil--rood' : 'pil--blauw'" data-test="crm-pil">Al {{ l.alBekend.crm.soort }} in het CRM</span>
                      <span v-if="l.alBekend?.dealdrive" class="pil" :class="l.alBekend.dealdrive.soort === 'klant' ? 'pil--rood' : 'pil--blauw'" data-test="dd-pil">Al {{ l.alBekend.dealdrive.soort }} in DealDrive</span>
                      <NuxtLink v-if="l.alBekend?.accountId" class="dd-act" :to="`/accounts/${l.alBekend.accountId}`" data-test="open-kaart">Open kaart</NuxtLink>
                    </div>
                  </div>
                </div>
                <div v-else class="stapel mt-12">
                  <article v-for="l in gr.leads" :key="l.id" class="kaart" :data-lead="l.naam">
                    <header class="kaart-kop">
                      <div><h3 class="kaart-titel">{{ l.naam }}</h3><p class="meta">{{ l.plaats ?? 'plaats onbekend' }} · {{ contactRegel(l) }}</p></div>
                      <div class="rijtje">
                        <span class="pil pil--zwart">{{ l.bronLabel }}</span>
                        <span v-if="l.klasse" class="klasse" :class="`klasse--${l.klasse.toLowerCase()}`">{{ l.klasse }}</span>
                        <span v-if="dossierLabel(l.dossierOp, nu)" class="pil" :class="dossierLabel(l.dossierOp, nu)!.oranje ? 'pil--oranje' : 'pil--groen'">{{ dossierLabel(l.dossierOp, nu)!.tekst }}</span>
                        <span class="cijfer" data-test="score">{{ l.score }}/6</span>
                      </div>
                    </header>
                    <div v-for="b in l.bewijs" :key="b.criterium" class="bewijs" :class="`bewijs--${b.oordeel}`" :data-criterium="b.criterium">
                      <Icoon :naam="b.oordeel === 'ja' ? 'CircleCheck' : b.oordeel === 'nee' ? 'CircleX' : 'CircleDot'" />
                      <span>{{ CRITERIUM_LABEL[b.criterium as 'klasse'] }}: {{ b.zin }} <span class="bewijs-bron"><template v-if="b.url"><a :href="b.url" target="_blank" rel="noopener">{{ b.bron }}</a></template><template v-else>{{ b.bron }}</template>{{ b.datum ? `, ${datumKort(b.datum)}` : '' }}</span></span>
                    </div>
                    <div v-if="kanOvernemen || kanRonde" class="rijtje mt-12">
                      <button v-if="kanOvernemen && gr.g !== 'verlopen'" type="button" class="dd-act" :class="{ 'dd-act--primair': gr.g === 'passend' }" data-test="voeg-toe" @click="toevoegen = l"><Icoon naam="Plus" :grootte="14" />Voeg toe</button>
                      <button v-if="kanRonde && gr.g === 'verlopen'" type="button" class="dd-act dd-act--primair" :disabled="bezig === l.id" data-test="opnieuw-uitzoeken" @click="dossier(l)">Opnieuw uitzoeken · Kost 10 credits</button>
                      <button v-if="kanRonde && gr.g === 'onbeoordeeld'" type="button" class="dd-act" :disabled="bezig === l.id" data-test="toch-uitzoeken" @click="dossier(l)">Toch uitzoeken · 10 credits</button>
                      <button v-if="kanOvernemen" type="button" class="dd-act" data-test="niet-relevant" @click="openAfwijzen(l)">Niet relevant</button>
                    </div>
                    <form v-if="afwijzen?.id === l.id" class="kaart kaart--vlak mt-12" data-test="afwijs-paneel" @submit.prevent="wijsAf">
                      <span class="veld-label">Waarom niet relevant?</span>
                      <div class="keuzegroep keuzegroep--klein mt-8" role="radiogroup" aria-label="Reden"><button v-for="r in [...(context?.afwijsredenen ?? []), ANDERE_REDEN]" :key="r" type="button" role="radio" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': reden === r }" :aria-checked="reden === r" :data-reden="r" @click="reden = r">{{ r }}</button></div>
                      <label v-if="reden === ANDERE_REDEN" class="veld mt-12"><span class="veld-label">Andere reden</span>
                        <input v-model="eigenReden" class="invoer" :maxlength="ANDERE_REDEN_MAX" placeholder="Bijvoorbeeld: zit in een overname, over een jaar opnieuw bekijken" data-test="afwijs-eigen">
                        <span class="veld-uitleg">Minstens {{ ANDERE_REDEN_MIN }} tekens. Je ziet de reden terug bij Niet relevant.</span>
                      </label>
                      <div class="dd-acties mt-12"><button type="submit" class="dd-act dd-act--primair" :disabled="!kanAfwijzen" data-test="afwijzen-bevestig">Bewaar reden</button><button type="button" class="dd-act" @click="afwijzen = null">Annuleren</button></div>
                    </form>
                  </article>
                </div>
              </div>
            </template>

            <div v-if="context" class="stat-grid mt-32" data-test="meters">
              <div class="stat-card"><span class="stat-label">AI-credits deze maand</span><span class="stat-num tnum" data-test="meter-credits">{{ fmt(context.meters.credits) }} over</span><span class="stat-foot">Een zoekronde kost 20, een dossier 10</span></div>
              <div class="stat-card"><span class="stat-label">KvK-bevragingen</span><span class="stat-num tnum" data-test="meter-kvk">{{ fmt(context.meters.kvk.gebruikt) }} / {{ fmt(context.meters.kvk.plafond) }}</span><div class="voortgang"><span class="voortgang-vul" :style="{ width: `${context.meters.kvk.plafond ? Math.min(100, (context.meters.kvk.gebruikt / context.meters.kvk.plafond) * 100) : 0}%` }" /></div><span class="stat-foot">KvK is geen AI en telt niet in de credits</span></div>
              <div v-if="context.meters.dc" class="stat-card"><span class="stat-label">Datacollectief-records</span><span class="stat-num tnum" data-test="meter-dc">{{ fmt(context.meters.dc.gebruikt) }} / {{ fmt(context.meters.dc.plafond) }}</span><div class="voortgang"><span class="voortgang-vul" :style="{ width: `${context.meters.dc.plafond ? Math.min(100, (context.meters.dc.gebruikt / context.meters.dc.plafond) * 100) : 0}%` }" /></div><span class="stat-foot">Datacollectief is geen AI en telt niet in de credits</span></div>
            </div>
          </div>

          <LeadImport v-else-if="tab === 'importeren'" class="mt-16" />
          <LeadKoppelingen v-else-if="tab === 'koppelingen'" class="mt-16" />
          <LeadRondes v-else-if="tab === 'rondes'" class="mt-16" />
        </div>
      </section>
      <VoegToeFlyout :lead="toevoegen" :context="context" @sluit="toevoegen = null" @klaar="isToegevoegd" />
    </template>
  </div>
</template>

<style scoped>
/* Vijf vakken (de doelgroep staat niet meer in de zoekopdracht). */
@media (min-width: 720px) { .lg-vakken { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (max-width: 767px) { .lg-vakken { grid-template-columns: 1fr 1fr; } }
.lg-toegevoegd { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; border-left: 3px solid var(--green); }
.lg-toegevoegd-tekst { flex: 1 1 320px; margin: 0; font-size: 14px; }
.lg-reden { flex-wrap: wrap; justify-content: flex-end; gap: 6px 10px; max-width: 60%; }
.lg-reden-tekst { overflow-wrap: anywhere; text-align: right; }
@media (max-width: 599px) { .lg-reden { max-width: none; justify-content: flex-start; } .lg-reden-tekst { text-align: left; } }
</style>
