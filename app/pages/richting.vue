<script setup lang="ts">
// Richting (F25): het verkoopverhaal voor iedereen, alleen bevestigde inhoud. Tabbladen Verhaal,
// Richting, Belofte, Branches, Concurrenten, Winpunten en Terugkomen; per onderdeel de status,
// "Controleren" en de dekking per branche. Een Expert stelt voor; inrichten doet de beheerder
// of salesmanager in Instellingen.
import { leesAlsDeKlantZegt } from '~~/shared/verkoopverhaal'
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { data } = await useFetch<any>('/api/richting', { default: () => null })
const TABS = [
  { k: 'verhaal', t: 'Verhaal', o: 'bedrijfsverhaal' }, { k: 'richting', t: 'Richting', o: 'ambitie' }, { k: 'belofte', t: 'Belofte', o: 'waarde' },
  { k: 'branches', t: 'Branches', o: 'branches' }, { k: 'concurrenten', t: 'Concurrenten', o: 'concurrenten' }, { k: 'winpunten', t: 'Winpunten', o: 'winpunten' }, { k: 'terugkomen', t: 'Terugkomen', o: 'terugkomregels' },
] as const
const tab = computed(() => TABS.find((t) => t.k === route.query.tab) ?? TABS[0])
const st = computed(() => data.value?.status[tab.value.o])
const stand = computed(() => data.value?.stand ?? {})
const tekst = (sleutel: string, br: string | null = null) => (stand.value.teksten ?? []).find((t: any) => t.sleutel === sleutel && (t.brancheId ?? null) === br)?.tekst ?? null
const algemeen = computed(() => (stand.value.teksten ?? []).find((t: any) => t.sleutel === 'bedrijfsverhaal' && !t.brancheId))
const fasen = computed(() => (stand.value.fasen ?? []) as any[])
const winpuntenIn = (f: string) => (stand.value.winpunten ?? []).filter((w: any) => w.actief && w.faseId === f)
const ritmeNaam = (id: string | null) => data.value?.ritmes.find((r: any) => r.id === id)?.naam ?? 'Nog geen ritme gekoppeld'
const datum = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(d)) : '')
const voorstel = ref<{ onderdeel: string; ref: string; titel: string } | null>(null)
const voorstelTekst = ref('')
async function stuurVoorstel() {
  try { await $fetch('/api/richting/voorstel', { method: 'POST', body: { onderdeel: voorstel.value!.onderdeel, ref: voorstel.value!.ref, soort: 'tekst', tekst: voorstelTekst.value } }); toast.toon('Je voorstel staat bij je salesmanager.'); voorstel.value = null; voorstelTekst.value = '' } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Richting · Dealtrace' })
</script>

<template>
  <div v-if="data">
    <PaginaKop kicker="Richting · Verkoopverhaal" titel="Ons verhaal" helpartikel="ons-verhaal">
      <template #acties>
        <span class="pil pil--leeg" data-test="vv-bron">{{ data.bron === 'salesdna' ? 'Uit SalesDNA' : 'Eigen inrichting' }}</span>
        <NuxtLink v-if="data.kan.inrichten" class="dd-act" to="/instellingen/verkoopverhaal" data-test="inrichten">Inrichten</NuxtLink>
      </template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <LegeStaat v-if="data.leeg" titel="Jullie verkoopverhaal is nog niet vastgelegd." :tekst="data.kan.inrichten ? 'Klik Inrichten om te beginnen.' : 'Je beheerder richt het in.'" data-test="vv-leeg" />
        <template v-else>
          <nav class="tabbalk tabbalk--schuif" aria-label="Onderdelen">
            <button v-for="t in TABS" :key="t.k" type="button" class="tab" :class="{ 'tab--actief': tab.k === t.k }" :data-test="`tab-${t.k}`" @click="router.replace({ query: { tab: t.k === 'verhaal' ? undefined : t.k } })">{{ t.t }}</button>
          </nav>
          <p class="rijtje mt-16" data-test="vv-status">
            <span class="pil" :class="st?.status === 'bevestigd' ? 'pil--groen' : 'pil--grijs'">{{ st?.status === 'bevestigd' ? `Bevestigd · versie ${st.versie}` : 'Concept' }}</span>
            <span v-if="st?.bevestigdOp" class="meta">{{ datum(st.bevestigdOp) }}</span>
            <span v-if="st?.controleren" class="pil pil--oranje" data-test="controleren">Controleren</span>
            <span v-if="st?.verouderd" class="pil pil--oranje">Mogelijk verouderd in SalesDNA</span>
          </p>

          <div v-if="tab.k === 'verhaal'" class="stapel mt-16" data-test="vv-verhaal">
            <div v-if="data.golden.waarom" class="kaart"><h3 class="kop-kaart">Waarom, hoe, wat</h3><dl class="gegevens mt-8"><dt>Waarom</dt><dd>{{ data.golden.waarom }}</dd><dt>Hoe</dt><dd>{{ data.golden.hoe }}</dd><dt v-if="data.golden.wat">Wat</dt><dd v-if="data.golden.wat">{{ data.golden.wat }}</dd></dl></div>
            <p v-if="algemeen" class="title kernzin" data-test="kernzin">{{ algemeen.kernzin || algemeen.tekst }}</p>
            <p v-if="algemeen" class="tekst">{{ algemeen.tekst }}</p>
            <p class="meta" data-test="dekking-verhaal">{{ data.dekking.verhaal.tekst }}</p>
            <article v-for="b in data.branches" :key="b.id" class="kaart" :data-branche="b.id">
              <h3 class="kop-kaart">{{ b.naam }}</h3>
              <p v-if="tekst('verhaal', b.id)" class="tekst mt-8">{{ tekst('verhaal', b.id) }}</p>
              <p v-else class="meta mt-8" data-test="gat">Voor {{ b.naam }} is nog geen eigen verhaal; je ziet het algemene verhaal.</p>
            </article>
          </div>

          <div v-else-if="tab.k === 'richting'" class="stapel mt-16" data-test="vv-richting">
            <div v-for="k in ['ambitie', 'visie', 'missie']" :key="k" class="kaart"><h3 class="kop-kaart">{{ k[0]!.toUpperCase() + k.slice(1) }}</h3><p class="tekst mt-8">{{ tekst(k) ?? 'Nog niet vastgelegd.' }}</p></div>
            <div v-for="d in stand.ambitiedoelen" :key="d.id" class="kaart" data-test="ambitiedoel">
              <p><strong>{{ d.naam }}:</strong> {{ d.stand ?? 'nog geen stand' }} van {{ d.doel }}<template v-if="d.jaar">, doel {{ d.jaar }}</template></p>
              <div class="voortgang mt-8"><span class="voortgang-vul" :style="{ width: `${d.stand ? Math.min(100, (d.stand / d.doel) * 100) : 0}%` }" /></div>
            </div>
          </div>

          <div v-else-if="tab.k === 'belofte'" class="stapel mt-16" data-test="vv-belofte">
            <div class="kaart"><h3 class="kop-kaart">Kernbelofte</h3><p class="title mt-8">{{ tekst('kernbelofte') }}</p>
              <details class="mt-8"><summary>Als de klant doorvraagt</summary><p class="tekst mt-8">{{ tekst('waardestatement') }}</p></details></div>
            <p class="meta" data-test="dekking-belofte">{{ data.dekking.belofte.tekst }}</p>
            <article v-for="b in data.branches" :key="b.id" class="kaart"><h3 class="kop-kaart">{{ b.naam }}</h3>
              <template v-if="tekst('kernbelofte', b.id)"><p class="tekst mt-8">{{ tekst('kernbelofte', b.id) }}</p><details v-if="tekst('waardestatement', b.id)" class="mt-8"><summary>Als de klant doorvraagt</summary><p class="tekst mt-8">{{ tekst('waardestatement', b.id) }}</p></details></template>
              <p v-else class="meta mt-8">Geen eigen belofte; de algemene geldt.</p>
            </article>
          </div>

          <div v-else-if="tab.k === 'branches'" class="tabel-wrap mt-16" data-test="vv-branches">
            <table class="tabel tabel--kaarten"><thead><tr><th>Branche</th><th>Focus</th><th>Horizon</th><th>Termijn</th><th>Prioriteit</th><th class="cel-r">Accounts</th><th class="cel-r">Gesprekken dit kwartaal</th></tr></thead>
              <tbody><tr v-for="b in data.branches" :key="b.id"><td><strong>{{ b.naam }}</strong></td><td>{{ b.focus }}</td><td>{{ b.horizon }}</td><td>{{ b.termijn }}</td><td>{{ b.prioriteit }}</td><td class="cel-r tnum">{{ b.accounts }}</td><td class="cel-r tnum">{{ b.aandeelGesprekken == null ? 'nog geen' : `${b.aandeelGesprekken}%` }}</td></tr></tbody></table>
          </div>

          <div v-else-if="tab.k === 'concurrenten'" class="mt-16" data-test="vv-concurrenten">
            <a v-if="data.kan.concurrentiekaart" class="dd-act" href="/api/richting/concurrentiekaart" target="_blank" data-test="concurrentiekaart">Download concurrentiekaart</a>
            <div class="raster raster--3 mt-16">
              <article v-for="c in stand.concurrenten" :key="c.id" class="kaart" :data-concurrent="c.id">
                <header class="kaart-kop"><h3 class="kaart-titel">{{ c.naam }}</h3><span class="pil pil--leeg">{{ c.soort }}</span></header>
                <dl class="gegevens mt-8">
                  <template v-if="c.sterk"><dt>Sterk</dt><dd>{{ c.sterk }}</dd></template>
                  <template v-if="c.zwak"><dt>Zwak</dt><dd>{{ c.zwak }}</dd></template>
                  <template v-if="c.onderscheid"><dt>Onderscheid</dt><dd>{{ c.onderscheid }}</dd></template>
                  <template v-if="c.zoZegJeHet"><dt>Zo zeg je het</dt><dd>{{ c.zoZegJeHet }}</dd></template>
                  <template v-if="leesAlsDeKlantZegt(c.alsDeKlantZegt)"><dt>Als de klant zegt</dt><dd>"{{ leesAlsDeKlantZegt(c.alsDeKlantZegt)!.bezwaar }}" Antwoord: "{{ leesAlsDeKlantZegt(c.alsDeKlantZegt)!.antwoord }}"</dd></template>
                  <template v-else-if="c.alsDeKlantZegt"><dt>Als de klant zegt</dt><dd>{{ c.alsDeKlantZegt }}</dd></template>
                  <template v-if="c.bewijs"><dt>Bewijs</dt><dd>{{ c.bewijs }}</dd></template>
                  <template v-if="c.wanneerVerliezen"><dt>Wanneer we verliezen</dt><dd>{{ c.wanneerVerliezen }}</dd></template>
                </dl>
                <button v-if="data.kan.voorstellen" type="button" class="dd-act mt-8" data-test="stel-voor" @click="voorstel = { onderdeel: 'concurrenten', ref: c.id, titel: c.naam }">Stel voor</button>
              </article>
            </div>
          </div>

          <div v-else-if="tab.k === 'winpunten'" class="stapel mt-16" data-test="vv-winpunten">
            <section v-for="f in fasen" :key="f.id" :data-fase="f.id">
              <h3 class="kop-blok">{{ f.naam }}</h3>
              <p v-if="!winpuntenIn(f.id).length" class="meta mt-8" data-test="gat">Geen winpunt in {{ f.naam }}</p>
              <article v-for="w in winpuntenIn(f.id)" :key="w.id" class="kaart mt-8"><header class="kaart-kop"><h4 class="kaart-titel">{{ w.titel }}</h4><span class="pil" :class="w.impact === 'hoog' ? 'pil--zwart' : 'pil--leeg'">impact {{ w.impact }}</span></header>
                <p class="tekst mt-8">{{ w.omschrijving }}</p><p v-if="w.waarom" class="meta mt-8">Waarom wij hier winnen: {{ w.waarom }}</p>
                <p v-if="w.onderNorm" class="meta mt-8">Klantfeedback onder de norm; komt niet als eerste winpunt.</p>
                <button v-if="data.kan.voorstellen" type="button" class="dd-act mt-8" @click="voorstel = { onderdeel: 'winpunten', ref: w.id, titel: w.titel }">Stel voor</button>
              </article>
            </section>
          </div>

          <div v-else class="mt-16" data-test="vv-terugkomen">
            <template v-for="l in (['verloren', 'slapend'] as const)" :key="l">
              <h3 class="kop-blok mt-16">{{ l === 'verloren' ? 'Na een verlies of nee' : 'Na een slapende periode' }}</h3>
              <div class="stapel mt-8">
                <article v-for="r in (stand.terugkomregels ?? []).filter((x: any) => x.lijst === l)" :key="r.id" class="kaart" :data-regel="r.id">
                  <header class="kaart-kop"><h4 class="kaart-titel">{{ r.reden }}</h4><span class="pil pil--zwart">{{ r.termijnDagen === 0 ? 'direct' : `${r.termijnDagen} dagen` }}</span></header>
                  <dl class="gegevens mt-8"><dt>Kanaal</dt><dd>{{ r.kanaal }}</dd><dt>Klassen</dt><dd>{{ r.klassen?.length ? r.klassen.join(', ') : 'alle klassen' }}</dd><dt>Rollen</dt><dd>{{ r.rollen.join(', ') || 'iedereen' }}</dd><dt>Aanpak</dt><dd>{{ r.aanpak }}</dd><dt>Hercontactritme</dt><dd>{{ ritmeNaam(r.hercontactritmeId) }}</dd></dl>
                </article>
              </div>
            </template>
          </div>
        </template>
      </div>
    </section>
    <div v-if="voorstel" class="fo-overlay" @click.self="voorstel = null">
      <form class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" data-test="voorstel-flyout" @submit.prevent="stuurVoorstel">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Stel voor</span><h2 class="fo-titel">{{ voorstel.titel }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="voorstel = null"><Icoon naam="X" /></button></header>
        <div class="fo-body fo-body--formulier"><label class="veld"><span class="veld-label">Je voorstel (antwoord, bezwaar, bewijs of winpunt per branche)</span><textarea v-model="voorstelTekst" class="invoer" rows="4" required data-test="voorstel-tekst" /></label></div>
        <footer class="fo-foot dd-acties"><button type="submit" class="dd-act dd-act--primair" :disabled="!voorstelTekst.trim()">Stuur naar je salesmanager</button><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="voorstel = null">Annuleren</button></footer>
      </form>
    </div>
  </div>
</template>
