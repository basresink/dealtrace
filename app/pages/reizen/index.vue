<script setup lang="ts">
// Prospectreizen (F05, P22): doelgroepen in prioriteitsvolgorde en per reis een kaart met de mini-funnel per
// hoofdfase. "+ Nieuwe reis" maakt een concept (leeg, vanuit de standaard of een bestaande reis); concepten
// waarvoor publicatie is aangevraagd staan bij "Wacht op publicatie". Gevorderd leest mee.
import { HOOFDFASEN, HOOFDFASE_LABEL } from '~~/shared/reis'
const { functie } = useMe()
const aan = computed(() => !!functie('nav.reizen')?.beschikbaar || !!functie('reis.overzicht')?.beschikbaar)
const toast = useToast()
const magDoelgroepen = computed(() => !!functie('doelgroepen.beheren')?.beschikbaar)
const { data: dg, refresh: refreshDg } = await useFetch<any>('/api/doelgroepen', { immediate: aan.value, default: () => ({ doelgroepen: [], branches: [], klassen: [], ambitie: null }) })
const { data: rz } = await useFetch<any>('/api/reizen', { immediate: aan.value, default: () => ({ reizen: [], kan: {} }) })
const statusFilter = ref('')
const reizen = computed(() => rz.value.reizen.filter((r: any) => !statusFilter.value || r.status === statusFilter.value))
const wacht = computed(() => rz.value.reizen.filter((r: any) => r.status === 'concept' && r.publicatieAangevraagd))
const actief = computed(() => rz.value.reizen.filter((r: any) => r.status === 'actief').length)
const concepten = computed(() => rz.value.reizen.filter((r: any) => r.status === 'concept').length)
const nieuweReis = ref(false)
const vanuit = ref('standaard')
const nieuweNaam = ref('')
async function maakReis() {
  try { const r = await $fetch<any>('/api/reizen', { method: 'POST', body: { vanuit: vanuit.value, naam: nieuweNaam.value || undefined } }); navigateTo(`/reizen/${r.id}`) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const maxHoofd = (r: any) => Math.max(1, ...Object.values(r.hoofdfasen ?? {}).map(Number))
const open = ref(false)
const bewerk = ref<any>(null)
function nieuw() { bewerk.value = null; open.value = true }
function wijzig(d: any) { bewerk.value = d; open.value = true }
async function bewaard() { open.value = false; await refreshDg() }
const branche = (id: string) => dg.value.branches.find((b: any) => b.id === id)?.naam ?? id
const STATUS: Record<string, string> = { concept: 'Concept', actief: 'Actief', gearchiveerd: 'Gearchiveerd', gepauzeerd: 'Gepauzeerd' }
useHead({ title: 'Prospectreizen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.reizen" />
    <template v-else>
    <PaginaKop kicker="Prospectreizen" :titel="`${actief} ${actief === 1 ? 'reis' : 'reizen'} actief${concepten ? `, ${concepten} ${concepten === 1 ? 'concept' : 'concepten'}` : ''}.`" uitleg="Per doelgroep de route van gevonden tot de overdracht na de eerste afspraak." helpartikel="doelgroepen-en-reizen">
      <template #acties>
        <button v-if="rz.kan?.maatwerk" type="button" class="dd-actie dd-actie--primair alleen-groot" data-test="reis-nieuw" @click="nieuweReis = true"><Icoon naam="Plus" class="dd-actie-icoon" />Nieuwe reis</button>
        <button v-if="magDoelgroepen" type="button" class="dd-actie dd-actie--secundair alleen-groot" data-test="doelgroep-nieuw" @click="nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Doelgroep</button>
      </template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <span class="kicker kicker--streep">Doelgroepen</span>
        <div class="tabel-wrap mt-16">
          <LegeStaat v-if="!dg.doelgroepen.length" titel="Nog geen doelgroepen." tekst="Zonder doelgroep komt elk account in de standaardreis." />
          <table v-else class="tabel tabel--kaarten" data-test="doelgroepen">
            <thead><tr><th>Naam</th><th>Status</th><th>Prioriteit</th><th>Branches</th><th>Accounts</th><th>Reis</th><th><span class="sr-only">Acties</span></th></tr></thead>
            <tbody>
              <tr v-for="d in dg.doelgroepen" :key="d.id">
                <td><strong>{{ d.naam }}</strong><br v-if="d.data.omschrijving"><span class="meta">{{ d.data.omschrijving }}</span></td>
                <td><span class="pil" :class="d.status === 'actief' ? 'pil--groen' : 'pil--grijs'">{{ STATUS[d.status] }}</span></td>
                <td class="tnum">{{ d.prioriteit }}</td>
                <td>{{ (d.data.brancheIds ?? []).map(branche).join(', ') || '-' }}</td>
                <td class="tnum">{{ d.aantal }}</td>
                <td>{{ d.reis?.naam ?? '-' }}</td>
                <td><button v-if="magDoelgroepen" type="button" class="dd-act" @click="wijzig(d)">Wijzigen</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <article v-if="rz.kan?.publiceren && wacht.length" class="kaart kaart--geel mt-16" data-test="wacht-op-publicatie">
          <h2 class="kaart-titel">Wacht op publicatie</h2>
          <ul class="schakel-lijst"><li v-for="r in wacht" :key="r.id" class="schakel-rij"><FunctieLink als-tekst :to="`/reizen/${r.id}`">{{ r.naam }}</FunctieLink><span class="meta">aangevraagd {{ new Date(r.publicatieAangevraagd.op).toLocaleDateString('nl-NL') }}</span></li></ul>
        </article>
        <div class="sec-head mt-16"><span class="kicker kicker--streep">Reizen</span>
          <select v-model="statusFilter" class="invoer invoer--klein rz-filter" aria-label="Status"><option value="">Alle statussen</option><option v-for="(l, k) in STATUS" :key="k" :value="k">{{ l }}</option></select></div>
        <LegeStaat v-if="rz.reizen.length === 1" class="mt-16" titel="Je werkt nu met de standaardreis." tekst="Maak een eigen reis als een doelgroep anders koopt." />
        <div class="mt-16 ak-blokken">
          <FunctieLink als-tekst v-for="r in reizen" :key="r.id" :to="`/reizen/${r.id}`" class="kaart top-kaart" :data-test="`reis-${r.isStandaard ? 'standaard' : r.id}`">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ r.naam }}</h2><span class="pil" :class="r.isStandaard ? 'pil--zwart' : 'pil--leeg'">{{ r.isStandaard ? 'Standaard' : `v${r.versie}` }}</span></header>
            <p class="kaart-meta">{{ r.totaal }} accounts · {{ STATUS[r.status] }}<template v-if="r.doelgroepId"> · {{ dg.doelgroepen.find((d: any) => d.id === r.doelgroepId)?.naam ?? '' }}</template></p>
            <div class="rz-funnel" aria-label="Accounts per hoofdfase">
              <div v-for="h in HOOFDFASEN" :key="h" class="rz-kolom"><div class="rz-balk" :style="{ height: `${((r.hoofdfasen?.[h] ?? 0) / maxHoofd(r)) * 100}%` }" /><span class="meta tnum">{{ r.hoofdfasen?.[h] ?? 0 }}</span><span class="meta">{{ HOOFDFASE_LABEL[h] }}</span></div>
            </div>
            <span class="dd-act mt-8">Open</span>
          </FunctieLink>
        </div>
      </div>
    </section>
    <FlyoutShell v-if="nieuweReis" open titel-id="fs-index0" breedte="smal" data-test="nieuwe-reis" @sluit="nieuweReis = false">
        <template #kop><span class="fo-kicker">Nieuwe reis</span><h2 id="fs-index0" class="fo-titel">Waar begin je?</h2></template>
        <form id="nr-form" class="fs-form" @submit.prevent="maakReis">
          <div class="fo-body fo-body--formulier">
            <label class="schakel-inline"><input v-model="vanuit" type="radio" value="standaard"> Vanuit de standaardreis</label>
            <label v-for="r in rz.reizen.filter((x: any) => !x.isStandaard && x.status !== 'concept')" :key="r.id" class="schakel-inline"><input v-model="vanuit" type="radio" :value="r.id"> Vanuit {{ r.naam }}</label>
            <label class="schakel-inline"><input v-model="vanuit" type="radio" value="leeg"> Leeg</label>
            <label class="veld"><span class="veld-label">Naam</span><input v-model="nieuweNaam" class="invoer" placeholder="Bijvoorbeeld: Installateurs woningbouw" data-test="nieuwe-reis-naam"></label>
          </div>
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
          <button type="submit" form="nr-form" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="nieuwe-reis-maak"><Icoon naam="Check" :grootte="16" />Maak concept</button>
          <span class="fo-foot-vul" />
        </footer>
        </template>
      </FlyoutShell>
    </template>
    <DoelgroepFlyout v-if="aan" :open="open" :doelgroep="bewerk" :branches="dg.branches" :klassen="dg.klassen" :ambitie="dg.ambitie" @sluit="open = false" @bewaard="bewaard" />
  </div>
</template>

<style scoped>
.rz-funnel { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; height: 90px; align-items: end; margin-top: 8px; }
.rz-kolom { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 2px; }
.rz-balk { width: 18px; min-height: 2px; background: var(--ink); }
.rz-filter { width: auto; }
</style>
