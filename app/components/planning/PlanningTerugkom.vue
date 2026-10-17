<script setup lang="ts">
// Tabblad Terugkomregels (F13, F25): wanneer en hoe we terugkomen na een nee of een verlies, met de KPI "Hercontact op tijd", de opbrengst per regel (Expert) en wie
// binnenkort terugkomt. Inrichten gebeurt bij het verkoopverhaal (P28). Slapende klanten en de regels na
// een slapende periode staan hier niet: winback van klanten loopt in DealDrive (testronde, Prospects of klanten).
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/planning/terugkomregels', { default: () => null })
const { data: ritmes } = await useFetch<any>('/api/ritmes', { default: () => ({ ritmes: [] }) })
const aanpassen = ref<any>(null)
const datum = ref('')
const reden = ref('')
async function bewaarDatum() {
  try {
    const r = await $fetch<any>(`/api/accounts/${aanpassen.value.id}/terugkomdatum`, { method: 'PUT', body: { datum: datum.value, reden: reden.value } })
    toast.toon(r.melding ?? `Terug op ${r.terugOp}.`, r.melding ? 'let-op' : 'succes')
    aanpassen.value = null; datum.value = ''; reden.value = ''
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const voorstel = ref<any>(null)
const voorstelRitme = ref('')
const voorstelTekst = ref('')
async function stelVoor() {
  try {
    await $fetch('/api/planning/terugkomregels/voorstel', { method: 'POST', body: { regelId: voorstel.value.id, ritmeId: voorstelRitme.value || undefined, tekst: voorstelTekst.value } })
    toast.toon('Je voorstel staat bij je salesmanager.')
    voorstel.value = null; voorstelRitme.value = ''; voorstelTekst.value = ''
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const STAND: Record<string, string> = { gezond: 'pil--groen', aandacht: 'pil--oranje', risico: 'pil--rood' }
const datumLang = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))
</script>

<template>
  <div v-if="data" data-test="tab-terugkom">
    <div class="rijtje">
      <h2 class="title">Wanneer we terugkomen</h2>
      <span class="pil pil--leeg" data-test="bron">{{ data.bron.tekst }}</span>
      <span class="dd-acties-vul" />
      <NuxtLink v-if="data.kan.inrichten" class="dd-act" to="/instellingen">Inrichten</NuxtLink>
    </div>
    <p v-if="data.bron.soort === 'spiegel'" class="meta mt-8">Wijzigen doe je in SalesDNA.</p>
    <LegeStaat v-if="data.leeg" class="mt-16" titel="Jullie terugkomregels zijn nog niet vastgelegd." tekst="Tot dan is de afkoelperiode per kanaal de enige termijn." />
    <template v-else>
      <div class="stat-grid mt-16">
        <div class="stat-card" data-test="kpi"><span class="stat-label">Hercontact op tijd</span><span class="stat-num tnum">{{ data.kpi.procent == null ? 'nog geen' : `${data.kpi.procent}%` }}</span><span class="stat-foot"><span v-if="data.kpi.stand" class="pil" :class="STAND[data.kpi.stand]">{{ data.kpi.stand === 'gezond' ? 'Gezond' : data.kpi.stand === 'aandacht' ? 'Aandacht' : 'Risico' }}</span> norm 90 procent; eerste poging binnen 5 werkdagen</span></div>
      </div>
      <template v-for="l in (['verloren'] as const)" :key="l">
        <h3 class="kop-blok mt-32">Na een verlies of nee <span class="pil-teller">{{ data[l].length }}</span></h3>
        <div class="stapel mt-12" :data-test="`regels-${l}`">
          <article v-for="r in data[l]" :key="r.id" class="kaart" :data-regel="r.id">
            <header class="kaart-kop"><h4 class="kaart-titel">{{ r.reden }}</h4><span class="pil pil--zwart" data-test="termijn">{{ r.termijnTekst }}</span></header>
            <dl class="gegevens mt-8">
              <dt>Kanaal</dt><dd>{{ r.kanaal }}</dd>
              <dt>Klassen</dt><dd data-test="klassen">{{ r.klassenTekst }}</dd>
              <dt>Rollen</dt><dd>{{ (r.rollen ?? []).map((x: string) => x.replace(/^rol-/, '')).join(', ') || 'iedereen' }}</dd>
              <dt>Aanpak</dt><dd>{{ r.aanpak }}</dd>
            </dl>
            <p v-if="r.opbrengst" class="meta mt-8" data-test="opbrengst">{{ r.opbrengst.teruggekomen }} teruggekomen · {{ r.opbrengst.opTijd }} op tijd · {{ r.opbrengst.gesprekken }} gesprekken · {{ r.opbrengst.afspraken }} afspraken</p>
            <button v-if="data.kan.voorstellen" type="button" class="dd-act mt-8" @click="voorstel = r">Stel wijziging voor</button>
          </article>
        </div>
      </template>
    </template>
    <h3 class="kop-blok mt-32">Komt binnenkort terug</h3>
    <p v-if="!data.binnenkort.length" class="meta mt-8">In de komende 30 dagen komt niemand van jou terug.</p>
    <div v-else class="lijst mt-12" data-test="binnenkort">
      <div v-for="a in data.binnenkort" :key="a.id" class="rij rij--compact">
        <div class="rij-info"><NuxtLink :to="`/accounts/${a.id}`" class="rij-titel">{{ a.naam }}</NuxtLink><div class="rij-sub">Terug op {{ datumLang(a.terugOp) }}<template v-if="a.reden"> · {{ a.reden }}</template><template v-if="a.kanaal"> · {{ a.kanaal }}</template><template v-if="a.aanpak"> · {{ a.aanpak }}</template></div></div>
        <div class="rij-rechts"><button v-if="data.kan.aanpassen" type="button" class="dd-act" data-test="pas-datum-aan" @click="aanpassen = a; datum = a.terugOp">Pas datum aan</button></div>
      </div>
    </div>

    <FlyoutShell v-if="aanpassen" open titel-id="fs-planningterugkom0" breedte="smal" data-test="datum-flyout" @sluit="aanpassen = null">
      <template #kop><span class="fo-kicker">Pas datum aan</span><h2 id="fs-planningterugkom0" class="fo-titel">{{ aanpassen.naam }}</h2></template>
        <form id="fs-form" class="fs-form" @submit.prevent="bewaarDatum">
        <div class="fo-body fo-body--formulier">
          <label class="veld"><span class="veld-label">Terugkomdatum</span><input v-model="datum" type="date" class="invoer" required data-test="nieuwe-datum"></label>
          <label class="veld"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span><input v-model="reden" class="invoer" required data-test="datum-reden"></label>
          <p class="veld-uitleg">Een datum binnen de afkoelperiode schuift naar het einde ervan.</p>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="fs-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!datum || !reden.trim()" data-test="datum-bewaar"><Icoon naam="Check" :grootte="16" />Bewaar</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
    <FlyoutShell v-if="voorstel" open titel-id="fs-planningterugkom1" breedte="smal" data-test="voorstel-flyout" @sluit="voorstel = null">
      <template #kop><span class="fo-kicker">Stel wijziging voor</span><h2 id="fs-planningterugkom1" class="fo-titel">{{ voorstel.reden }}</h2></template>
        <form id="fs-form" class="fs-form" @submit.prevent="stelVoor">
        <div class="fo-body fo-body--formulier">
          <label class="veld"><span class="veld-label">Koppel aan hercontactritme</span><select v-model="voorstelRitme" class="invoer"><option value="">Geen wijziging</option><option v-for="r in ritmes.ritmes" :key="r.id" :value="r.id">{{ r.naam }}</option></select></label>
          <label class="veld"><span class="veld-label">Toelichting</span><textarea v-model="voorstelTekst" class="invoer" rows="3" /></label>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="fs-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!voorstelRitme && !voorstelTekst.trim()"><Icoon naam="Check" :grootte="16" />Stuur voorstel</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
  </div>
</template>
