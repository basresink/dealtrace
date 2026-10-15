<script setup lang="ts">
// Vandaag op de laptop (F01): kop, aanleiding van de dag, drie kolommen (taken,
// afspraken, prio), werkblok, concepten; vanaf Gevorderd agents, datakwaliteit en
// jouw week in eigen volgorde; voor de salesmanager "Team vandaag".
import { ACTIE_LABEL, CONTACT_ACTIES } from '~~/shared/taken'
import { fasePil } from '~/utils/accountWeergave'
const toast = useToast()
const { rondAf, versie } = useAfronden()
const motorVersie = useState('motorVersie', () => 0)
const { data: v, refresh } = await useFetch<any>('/api/vandaag', { default: () => null })
watch([versie, motorVersie], () => refresh())
const open = ref<string | null>(null)
const nieuweTaak = ref(false)
const nieuweProspect = ref(false)
async function maakTaak(id: string) {
  try { await $fetch(`/api/signals/${id}/omzetten`, { method: 'POST', body: {} }); toast.toon('Taak gemaakt uit het inzicht.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function vink(t: any) {
  if (CONTACT_ACTIES.has(t.actionType)) { open.value = t.id; return }
  if (await rondAf(t.id, { uitkomst: 'gedaan' })) await refresh()
}
const tijd = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)) : '')
const dagNaam = (d: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
async function verplaats(blok: string, richting: -1 | 1) {
  const l = [...v.value.volgorde]
  const i = l.indexOf(blok)
  const j = i + richting
  if (j < 0 || j >= l.length) return
  ;[l[i], l[j]] = [l[j]!, l[i]!]
  v.value.volgorde = l
  try { await $fetch('/api/mij/vandaag-volgorde', { method: 'POST', body: { volgorde: l } }) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function datakwaliteitTaak(g: any) {
  try { await $fetch('/api/tasks', { method: 'POST', body: { title: `Aanvullen: ${g.aantal} ${g.tekst}`, actionType: 'taak' } }); toast.toon('Taak gemaakt.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Vandaag · Dealtrace' })
</script>

<template>
  <div v-if="v">
    <section class="section">
      <div class="container">
        <div class="sec-head">
          <div>
            <span class="kicker kicker--streep" data-test="vandaag-kicker">{{ v.kop.kicker }}</span>
            <h1 class="title title--groot">{{ v.kop.groet }}</h1>
            <p class="subtitle subtitle--groot" data-test="samenvatting">{{ v.kop.samenvatting }}</p>
          </div>
          <div class="toolbar-buttons">
            <button type="button" class="dd-actie dd-actie--primair" data-test="vandaag-taak" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
            <button v-if="v.kan.nieuwProspect" type="button" class="dd-actie dd-actie--secundair" data-test="vandaag-prospect" @click="nieuweProspect = true"><Icoon naam="UserPlus" class="dd-actie-icoon" />Prospect</button>
            <NuxtLink class="dd-actie dd-actie--secundair" to="/help/vandaag"><Icoon naam="CircleHelp" class="dd-actie-icoon" />Hulp</NuxtLink>
          </div>
        </div>
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <article v-if="v.aanleiding" class="kaart aanleiding-blok" data-test="aanleiding-van-de-dag">
          <span class="kicker">Aanleiding van de dag</span>
          <h2 class="kaart-titel mt-8">{{ v.aanleiding.titel }}</h2>
          <p class="taak-meta"><template v-if="v.aanleiding.account">{{ v.aanleiding.account.naam }} · </template>{{ v.aanleiding.bron === 'extern' ? 'Extern' : 'Intern' }}<template v-if="v.aanleiding.bewijs?.[0]"> · {{ v.aanleiding.bewijs[0] }}</template></p>
          <p v-if="v.aanleiding.waarom" class="mt-8">{{ v.aanleiding.waarom }}</p>
          <div class="reis-knoppen mt-16"><button type="button" class="dd-act dd-act--primair" data-test="aanleiding-maak-taak" @click="maakTaak(v.aanleiding.id)">Maak taak</button><NuxtLink v-if="v.aanleiding.account" class="dd-act" :to="`/accounts/${v.aanleiding.account.id}`">Open kaart</NuxtLink></div>
        </article>

        <div class="vandaag-kolommen mt-16">
          <article class="kaart" data-test="kolom-taken">
            <header class="kaart-kop"><h2 class="kaart-titel">Taken <span class="pil pil--leeg tnum">{{ v.taken.totaal }}</span></h2></header>
            <LegeStaat v-if="!v.taken.lijst.length" titel="Niets te doen." tekst="De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn." />
            <ul class="schakel-lijst">
              <li v-for="t in v.taken.lijst" :key="t.id" class="taak-kaart" :class="{ 'taak-kaart--achter': t.achterstallig }" :data-test="`vandaag-taak-${t.id}`">
                <button type="button" class="taak-vink" :aria-label="`Rond ${t.title} af`" @click="vink(t)"><Icoon naam="CircleCheck" /></button>
                <span class="taak-meta tnum">{{ t.achterstallig ? 'over tijd' : tijd(t.dueDate) }}</span>
                <div>
                  <div class="taak-labels"><span class="pil pil--leeg">{{ ACTIE_LABEL[t.actionType] ?? 'TAAK' }}</span><span v-if="t.concept" class="pil pil--paars">AI</span><span v-if="t.account?.fase" class="pil" :class="fasePil(t.account.fase.kleur)">{{ t.account.fase.label }}</span></div>
                  <button type="button" class="taak-titel" @click="open = t.id">{{ t.title }}</button>
                  <p v-if="t.poging" class="taak-meta">poging {{ t.poging.n }} van {{ t.poging.van }}<template v-if="t.poging.vorige"> · vorige: {{ t.poging.vorige }}</template></p>
                </div>
                <span />
              </li>
            </ul>
            <NuxtLink v-if="v.taken.meer" to="/acties" class="tekst-link mt-8" data-test="nog-meer">nog {{ v.taken.meer }} meer →</NuxtLink>
          </article>
          <article class="kaart" data-test="kolom-afspraken">
            <header class="kaart-kop"><h2 class="kaart-titel">Afspraken <span class="pil pil--leeg tnum">{{ v.afspraken.totaal }}</span></h2></header>
            <p class="kaart-meta">Geen afspraken vandaag.</p>
          </article>
          <article class="kaart" data-test="kolom-prio">
            <header class="kaart-kop"><h2 class="kaart-titel">Prio <span class="pil pil--leeg tnum">{{ v.prio.length }}</span></h2></header>
            <p v-if="!v.prio.length" class="kaart-meta">Niets dringends.</p>
            <ul class="schakel-lijst"><li v-for="(p, i) in v.prio" :key="i" class="schakel-rij"><NuxtLink :to="p.link">{{ p.tekst }}</NuxtLink></li></ul>
          </article>
        </div>

        <div class="vandaag-blokken mt-16">
          <article class="kaart kaart--geel" data-test="werkblok">
            <span class="kicker">{{ v.werkblok.titel }}</span>
            <p class="mt-8">{{ v.werkblok.tekst }}</p>
            <NuxtLink :to="v.werkblok.knop.naar" class="dd-act dd-act--primair mt-16">{{ v.werkblok.knop.tekst }}</NuxtLink>
          </article>
          <article class="kaart" data-test="concepten">
            <span class="kicker">Klaargezet door AI</span>
            <p class="mt-8">{{ v.concepten.aantal ? `${v.concepten.aantal} concepten wachten op je goedkeuring.` : 'Er wachten geen concepten op je.' }}</p>
          </article>
        </div>

        <div class="vandaag-blokken mt-16">
          <template v-for="(blok, i) in v.volgorde" :key="blok">
            <article v-if="blok === 'agents' && v.agents" class="kaart" data-test="agents">
              <header class="kaart-kop"><span class="kicker">Door agents gedaan sinds gisteren</span><span v-if="v.kan.indeling" class="reis-knoppen"><button type="button" class="dd-act dd-act--icoon" aria-label="Eerder" :disabled="i === 0" @click="verplaats(blok, -1)">↑</button><button type="button" class="dd-act dd-act--icoon" aria-label="Later" :disabled="i === v.volgorde.length - 1" @click="verplaats(blok, 1)">↓</button></span></header>
              <p class="mt-8">{{ v.agents.taken }} taken en {{ v.agents.inzichten }} inzichten klaargezet · {{ v.agents.geparkeerd }} accounts geparkeerd</p>
            </article>
            <article v-if="blok === 'datakwaliteit' && v.datakwaliteit" class="kaart" data-test="datakwaliteit">
              <header class="kaart-kop"><span class="kicker">Datakwaliteit</span><span v-if="v.kan.indeling" class="reis-knoppen"><button type="button" class="dd-act dd-act--icoon" aria-label="Eerder" :disabled="i === 0" @click="verplaats(blok, -1)">↑</button><button type="button" class="dd-act dd-act--icoon" aria-label="Later" :disabled="i === v.volgorde.length - 1" @click="verplaats(blok, 1)">↓</button></span></header>
              <p v-if="!v.datakwaliteit.length" class="kaart-meta mt-8">Geen gaten bij je actieve prospects.</p>
              <ul class="schakel-lijst"><li v-for="g in v.datakwaliteit" :key="g.sleutel" class="schakel-rij"><span><strong class="tnum">{{ g.aantal }}</strong> {{ g.tekst }}</span><button v-if="g.knop === 'Maak taak'" type="button" class="dd-act" @click="datakwaliteitTaak(g)">Maak taak</button><NuxtLink v-else :to="`/prospects/alle?bereikbaarheid=${g.sleutel}`" class="dd-act">{{ g.knop }}</NuxtLink></li></ul>
            </article>
            <article v-if="blok === 'week' && v.week" class="kaart" data-test="week">
              <header class="kaart-kop"><span class="kicker">Jouw week</span><span v-if="v.kan.indeling" class="reis-knoppen"><button type="button" class="dd-act dd-act--icoon" aria-label="Eerder" :disabled="i === 0" @click="verplaats(blok, -1)">↑</button><button type="button" class="dd-act dd-act--icoon" aria-label="Later" :disabled="i === v.volgorde.length - 1" @click="verplaats(blok, 1)">↓</button></span></header>
              <div class="week-raster mt-8"><div v-for="d in v.week" :key="d.datum" class="week-dag"><strong>{{ dagNaam(d.datum) }}</strong><br><span class="tnum">{{ d.taken }}</span> <span class="taak-meta">taken</span></div></div>
            </article>
          </template>
          <article v-if="v.team" class="kaart" data-test="team-vandaag">
            <span class="kicker">Team vandaag</span>
            <ul class="schakel-lijst mt-8"><li v-for="l in v.team" :key="l.naam" class="schakel-rij"><span>{{ l.naam.replace(/^Testgebruiker /, '') }}</span><span class="taak-meta"><span :class="{ 'tekst-rood': l.achterstallig }">{{ l.achterstallig }} over tijd</span> · {{ l.open }} open · {{ l.inzichten }} wachten</span></li></ul>
          </article>
        </div>
      </div>
    </section>
    <TaakFlyout :open="!!open" :taak-id="open" @sluit="open = null" @klaar="refresh()" @gewijzigd="refresh()" />
    <NieuweTaakFlyout :open="nieuweTaak" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; refresh()" />
    <NieuweProspectFlyout :open="nieuweProspect" @sluit="nieuweProspect = false" @aangemaakt="(id) => navigateTo(`/accounts/${id}`)" @bestaand="(id) => navigateTo(`/accounts/${id}`)" />
  </div>
</template>
