<script setup lang="ts">
// De blokken van Dagstart en Weekstart (shared/ritmeBlokken.ts, server/utils/ritmeBlokken.ts): belblokken
// om te vullen (of een voorstel op het beste uur), belprioriteit naast je afspraken, kansen langs de route,
// lopende campagnes en lopende accountplannen. Alleen je eigen data. Elk blok staat er alleen als de
// functie voor jou aanstaat en zegt waarom het er staat. Een taak opent de TaakFlyout, een afspraak de
// afspraakflyout, "Plan in" bij een kans de flyout Plan een afspraak.
import { RITME_BLOK_FUNCTIE, type RitmeBlokken } from '~~/shared/ritmeBlokken'

const props = defineProps<{ blokken: RitmeBlokken | null | undefined; moment: 'dagstart' | 'weekstart'; dag?: string }>()
const emit = defineEmits<{ ververs: [] }>()
const { functie } = useMe()
const toast = useToast()
const aan = (k: keyof typeof RITME_BLOK_FUNCTIE) => !!functie(RITME_BLOK_FUNCTIE[k])?.beschikbaar && !!props.blokken?.[k]
const dagstartAan = !!functie('dagritme.dagstart')?.beschikbaar
const week = computed(() => props.moment === 'weekstart')
const periode = computed(() => (week.value ? 'deze week' : 'vandaag'))

const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const dagKort = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const dagNr = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const dagLabel = (d: string) => { const s = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)); return s.charAt(0).toUpperCase() + s.slice(1) }
const namen = (l: { accountNaam: string }[]) => (l.length <= 3 ? l.map((x) => x.accountNaam).join(', ') : `${l.slice(0, 3).map((x) => x.accountNaam).join(', ')} en ${l.length - 3} meer`)

const bb = computed(() => props.blokken?.belblokken ?? null)
const bp = computed(() => props.blokken?.belprioriteit ?? null)
const kn = computed(() => props.blokken?.kansen ?? null)
const cp = computed(() => props.blokken?.campagnes ?? null)
const ap = computed(() => props.blokken?.accountplannen ?? null)
const zichtbaar = computed(() => (['belblokken', 'belprioriteit', 'kansen', 'campagnes', 'accountplannen'] as const).some((k) => aan(k)))

// Flyouts
const taak = ref<string | null>(null)
const afspraak = ref<string | null>(null)
const plan = reactive({ open: false, account: null as null | { id: string; naam: string }, taskId: null as string | null, aanleiding: '', voorstel: null as any })
function planKans(k: { accountId: string; naam: string; taakId: string | null; reden: string | null; momentStart: string | null }, datum: string) {
  Object.assign(plan, { open: true, account: { id: k.accountId, naam: k.naam }, taskId: k.taakId, aanleiding: k.reden ?? '', voorstel: { datum, start: k.momentStart ? tijd(k.momentStart).replace(/:(\d)\d$/, (_m: string, t: string) => `:${Number(t) >= 3 ? '30' : '00'}`) : undefined, duurMin: 30, vorm: 'bezoek', soort: 'kennismaking' } })
}

const bezig = ref<string | null>(null)
async function vul(b: { id: string; voorstel: { accountId: string }[] }) {
  bezig.value = b.id
  try {
    const r = await $fetch<any>(`/api/belblokken/${b.id}/vul`, { method: 'POST', body: { accountIds: b.voorstel.map((v) => v.accountId) } })
    toast.toon(r.toast)
    emit('ververs')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
async function zetVoorstel(v: { datum: string; start: string }) {
  bezig.value = v.start
  try {
    await $fetch<any>('/api/dagstart/belblokken', { method: 'POST', body: { dag: v.datum, starts: [v.start] } })
    toast.toon(`Het belblok staat in je agenda, ${week.value ? dagKort(v.start) : 'vandaag'} om ${tijd(v.start)}.`)
    emit('ververs')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
const TEMPO: Record<string, string> = { 'Voor op schema': 'voor', 'Op schema': 'op', 'Achter op schema': 'achter' }
</script>

<template>
  <div v-if="zichtbaar" class="rb" :data-test="`rb-${moment}`">
    <!-- 1. Belblokken om te vullen -->
    <article v-if="aan('belblokken') && bb" class="kaart rb-kaart" data-test="rb-belblokken">
      <header class="kaart-kop rb-kop"><h2 class="kaart-titel">Belblokken om te vullen</h2></header>
      <p class="rb-waarom" data-test="rb-waarom">{{ week ? 'Vul je lege belblokken nu, dan hoef je tijdens het blok niet te zoeken wie je belt.' : 'Een belblok zonder gesprekken is verloren beltijd.' }} Het voorstel komt uit je eigen bellijst, in de volgorde van Belblokken, zonder wie je die dag al spreekt.</p>
      <ul v-if="bb.blokken.length || bb.voorstellen.length" class="rb-lijst">
        <li v-for="b in bb.blokken" :key="b.id" :data-test="`rb-blok-${b.id}`">
          <div class="item-rij">
            <span class="item-tijd">{{ week ? dagNr(b.start) : tijd(b.start) }}<small>{{ week ? tijd(b.start) : tijd(b.eind) }}</small></span>
            <span class="item-icoon item-icoon--call"><Icoon naam="Phone" /></span>
            <span class="item-body">
              <span class="item-naam">{{ b.soortLabel }}</span>
              <span class="item-meta">{{ b.stand }}</span>
              <span v-if="b.voorstel.length" class="item-meta" data-test="rb-voorstel">Past erin: {{ namen(b.voorstel) }}</span>
              <span v-else class="item-meta">Niemand in je bellijst past bij dit blok.</span>
              <span class="pil-tags"><span class="pil" :class="b.leeg ? 'pil--rood' : 'pil--geel'">{{ b.leeg ? 'Leeg' : 'Te weinig' }}</span></span>
            </span>
            <span class="item-acties">
              <button v-if="b.kanVullen" type="button" class="dd-act" :disabled="!!bezig" :data-test="`rb-vul-${b.id}`" @click="vul(b)"><Icoon naam="Plus" />Vul met {{ b.voorstel.length }}</button>
              <FunctieLink :to="`/belblokken/${b.id}`" class="dd-act" :data-test="`rb-open-${b.id}`">Open</FunctieLink>
            </span>
          </div>
        </li>
        <li v-for="v in bb.voorstellen" :key="v.start" :data-test="`rb-geen-blok-${v.datum}`">
          <div class="item-rij">
            <span class="item-tijd">{{ week ? dagNr(v.start) : tijd(v.start) }}<small>{{ week ? tijd(v.start) : tijd(v.eind) }}</small></span>
            <span class="item-icoon item-icoon--call"><Icoon naam="CalendarClock" /></span>
            <span class="item-body">
              <span class="item-naam">Nog geen belblok{{ week ? ` op ${dagKort(v.start)}` : '' }}</span>
              <span class="item-meta">Voorstel op het beste uur: {{ tijd(v.start) }} tot {{ tijd(v.eind) }}.</span>
              <span v-if="v.uitleg" class="item-meta">{{ v.uitleg }}</span>
              <span class="pil-tags"><span class="pil pil--geel">Voorstel</span></span>
            </span>
            <span v-if="dagstartAan" class="item-acties"><button type="button" class="dd-act" :disabled="!!bezig" data-test="rb-zet-voorstel" @click="zetVoorstel(v)"><Icoon naam="CalendarCheck" />Zet in mijn agenda</button></span>
          </div>
        </li>
      </ul>
      <LegeStaat v-else-if="bb.totaal" :titel="`Je belblokken ${periode} zijn vol.`" tekst="Elk gepland belblok heeft genoeg gesprekken. Nieuwe belacties schuiven naar je volgende blok." data-test="rb-belblokken-leeg" />
      <LegeStaat v-else :titel="`Geen belblok ${periode}.`" tekst="Er is niemand om te bellen of geen vrij uur. Plan een blok zodra je bellijst groeit." data-test="rb-belblokken-leeg"><FunctieLink to="/belblokken" class="tekst-link rb-link">Naar Belblokken</FunctieLink></LegeStaat>
    </article>

    <!-- 2. Belprioriteit naast je afspraken -->
    <article v-if="aan('belprioriteit') && bp" class="kaart rb-kaart" data-test="rb-belprioriteit">
      <header class="kaart-kop rb-kop"><h2 class="kaart-titel">Belprioriteit naast je afspraken</h2></header>
      <p class="rb-waarom" data-test="rb-waarom">Tussen je afspraken door bel je wie nu het belangrijkst is. Dezelfde volgorde als op Belblokken en Bezoeken, zonder wie je {{ periode }} al spreekt{{ bp.afspraken.length ? ` (${bp.afspraken.length === 1 ? '1 afspraak' : `${bp.afspraken.length} afspraken`})` : '' }}.</p>
      <template v-if="!week && bp.afspraken.length">
        <h3 class="rb-sub">Je afspraken {{ periode }}</h3>
        <ul class="rb-lijst" data-test="rb-afspraken">
          <li v-for="a in bp.afspraken" :key="a.id">
            <button type="button" class="item-rij" :data-test="`rb-afspraak-${a.id}`" @click="afspraak = a.id">
              <span class="item-tijd">{{ tijd(a.start) }}<small>{{ tijd(a.eind) }}</small></span>
              <span class="item-icoon" :class="a.vorm === 'bezoek' ? 'item-icoon--visit' : 'item-icoon--email'"><Icoon :naam="a.vorm === 'bezoek' ? 'MapPin' : 'Handshake'" /></span>
              <span class="item-body"><span class="item-naam">{{ a.titel }}</span><span class="item-meta">{{ a.vorm === 'bezoek' ? 'Op locatie' : a.vorm === 'telefoon' ? 'Telefonisch' : 'Online' }}</span></span>
            </button>
          </li>
        </ul>
        <h3 class="rb-sub">Bel tussendoor</h3>
      </template>
      <ol v-if="bp.lijst.length" class="rb-lijst" data-test="rb-bellijst">
        <li v-for="(b, i) in bp.lijst" :key="b.accountId" :data-test="`rb-bel-${b.accountId}`">
          <div class="item-rij">
            <span class="item-tijd">#{{ i + 1 }}</span>
            <span class="item-icoon item-icoon--call"><Icoon naam="Phone" /></span>
            <span class="item-body">
              <button v-if="b.taskId" type="button" class="item-naam rb-naam" :data-test="`rb-bel-taak-${b.taskId}`" @click="taak = b.taskId">{{ b.accountNaam }}</button>
              <NuxtLink v-else :to="`/accounts/${b.accountId}?bel=1`" class="item-naam rb-naam">{{ b.accountNaam }}</NuxtLink>
              <span class="item-meta">{{ b.reden }}<template v-if="b.contactNaam"> · {{ b.contactNaam }}</template></span>
              <span class="pil-tags"><Label soort="score" :waarde="b.score" :tekst="`Score ${b.score}`" /><Label v-if="b.heet" soort="status" waarde="heet" /><span v-if="b.inBelblok" class="pil">In belblok</span></span>
            </span>
            <span v-if="b.telefoon" class="item-acties"><a :href="`tel:${b.telefoon}`" class="dd-act" :aria-label="`Bel ${b.accountNaam}`"><Icoon naam="Phone" />Bel</a></span>
          </div>
        </li>
      </ol>
      <LegeStaat v-else titel="Niemand om tussendoor te bellen." :tekst="`Je bellijst is leeg, of je spreekt iedereen erop ${periode} al.`" data-test="rb-belprioriteit-leeg" />
    </article>

    <!-- 3. Kansen langs de route -->
    <article v-if="aan('kansen') && kn" class="kaart rb-kaart" data-test="rb-kansen">
      <header class="kaart-kop rb-kop"><h2 class="kaart-titel">Kansen langs de route</h2></header>
      <p class="rb-waarom" data-test="rb-waarom">Je bent toch in de buurt. Deze eigen prospects liggen langs de route van je bezoeken, met weinig omrijden. Neem er een mee als tussenstop.</p>
      <template v-if="kn.dagen.length">
        <section v-for="d in kn.dagen" :key="d.datum" :data-test="`rb-kansen-${d.datum}`">
          <h3 v-if="week" class="rb-sub">{{ dagLabel(d.datum) }} · {{ d.bezoeken === 1 ? '1 bezoek' : `${d.bezoeken} bezoeken` }}</h3>
          <ul v-if="d.kansen.length" class="rb-lijst">
            <li v-for="k in d.kansen" :key="k.accountId">
              <div class="item-rij">
                <span class="item-tijd">{{ k.momentStart ? tijd(k.momentStart) : `+${k.omrij} min` }}<small v-if="k.momentStart">+{{ k.omrij }} min</small></span>
                <span class="item-icoon item-icoon--visit"><Icoon naam="Compass" /></span>
                <span class="item-body">
                  <button v-if="k.taakId" type="button" class="item-naam rb-naam" @click="taak = k.taakId">{{ k.naam }}</button>
                  <NuxtLink v-else :to="`/accounts/${k.accountId}`" class="item-naam rb-naam">{{ k.naam }}</NuxtLink>
                  <span class="item-meta">{{ k.reden ?? 'Langs je route' }} · {{ k.omrij }} min omrijden</span>
                  <span class="pil-tags"><span class="pil pil--groen">Kans</span><span class="pil pil--grijs">Score {{ k.score }}</span></span>
                </span>
                <span class="item-acties"><button type="button" class="dd-act" :data-test="`rb-kans-plan-${k.accountId}`" @click="planKans(k, d.datum)"><Icoon naam="Plus" />Plan in</button></span>
              </div>
            </li>
          </ul>
          <p v-else class="meta rb-dagleeg">Geen eigen prospects binnen 20 minuten omrijden van deze route.</p>
        </section>
      </template>
      <LegeStaat v-else :titel="`Geen bezoeken ${periode}.`" tekst="Kansen langs de route zie je zodra je een bezoek plant. Tot die tijd: bel je prospects." data-test="rb-kansen-leeg" />
    </article>

    <!-- 4. Lopende campagnes -->
    <article v-if="aan('campagnes') && cp" class="kaart rb-kaart" data-test="rb-campagnes">
      <header class="kaart-kop rb-kop"><h2 class="kaart-titel">Lopende campagnes</h2></header>
      <p class="rb-waarom" data-test="rb-waarom">Een campagne loopt op tempo. Zo zie je welke kaarten {{ periode }} aan de beurt zijn, voordat je achter raakt.</p>
      <div v-if="cp.lopend.length" class="rb-groepen">
        <section v-for="c in cp.lopend" :key="c.id" class="rb-groep" :data-test="`rb-campagne-${c.id}`">
          <FunctieLink als-tekst :to="`/campagnes/${c.id}`" class="rb-groepkop">
            <span class="rb-groepnaam">{{ c.naam }}</span>
            <span class="meta">{{ c.kaarten.gedaan }} van {{ c.kaarten.totaal }} {{ c.kaarten.totaal === 1 ? 'kaart' : 'kaarten' }} gedaan<template v-if="c.dagenOver != null"> · nog {{ c.dagenOver === 1 ? '1 dag' : `${c.dagenOver} dagen` }}</template></span>
            <span class="pil-tags"><Label v-if="c.tempo" soort="tempo" :waarde="TEMPO[c.tempo.pil] ?? (c.tempo.pil.startsWith('Achter') ? 'achter' : 'op')" :tekst="c.tempo.pil" /><span class="pil" :class="c.aanDeBeurt ? 'pil--zwart' : 'pil--grijs'">{{ c.aanDeBeurt ? `${c.aanDeBeurt} aan de beurt` : 'Niets aan de beurt' }}</span></span>
          </FunctieLink>
          <span class="rb-staaf" role="img" :aria-label="`${c.kaarten.gedaan} van ${c.kaarten.totaal} kaarten gedaan`"><span :style="{ width: `${c.kaarten.totaal ? Math.round((c.kaarten.gedaan / c.kaarten.totaal) * 100) : 0}%` }" /></span>
          <ul v-if="c.taken.length" class="rb-lijst">
            <li v-for="t in c.taken" :key="t.id">
              <button type="button" class="item-rij" :data-test="`rb-taak-${t.id}`" @click="taak = t.id">
                <span class="item-tijd" :class="{ 'item-tijd--rood': t.teLaat }">{{ t.due ? (t.teLaat ? 'Over tijd' : week ? dagNr(t.due) : tijd(t.due)) : '' }}<small v-if="t.due && (t.teLaat || week)">{{ t.teLaat ? dagNr(t.due) : tijd(t.due) }}</small></span>
                <span class="item-icoon"><Icoon naam="Megaphone" /></span>
                <span class="item-body"><span class="item-naam">{{ t.titel }}</span><span v-if="t.accountNaam" class="item-meta">{{ t.accountNaam }}</span></span>
              </button>
            </li>
          </ul>
          <FunctieLink v-if="c.aanDeBeurt > c.taken.length" :to="`/campagnes/${c.id}`" class="tekst-link rb-link">Nog {{ c.aanDeBeurt - c.taken.length }} op het bord</FunctieLink>
        </section>
      </div>
      <LegeStaat v-else titel="Geen lopende campagnes." tekst="Doe je mee aan een campagne, dan zie je hier je kaarten en wat aan de beurt is." data-test="rb-campagnes-leeg"><FunctieLink to="/campagnes" class="tekst-link rb-link">Naar Campagnes</FunctieLink></LegeStaat>
    </article>

    <!-- 5. Lopende accountplannen -->
    <article v-if="aan('accountplannen') && ap" class="kaart rb-kaart" data-test="rb-accountplannen">
      <header class="kaart-kop rb-kop"><h2 class="kaart-titel">Lopende accountplannen</h2></header>
      <p class="rb-waarom" data-test="rb-waarom">Een accountplan werkt alleen als de acties gebeuren. Dit staat {{ periode }} open in je eigen plannen.</p>
      <div v-if="ap.lopend.length" class="rb-groepen">
        <section v-for="p in ap.lopend" :key="p.id" class="rb-groep" :data-test="`rb-plan-${p.id}`">
          <FunctieLink als-tekst :to="`/accountplannen/${p.id}`" class="rb-groepkop">
            <span class="rb-groepnaam">{{ p.accountNaam }}</span>
            <span class="meta">{{ p.titel }} · {{ p.voortgang.klaar }} van {{ p.voortgang.totaal }} {{ p.voortgang.totaal === 1 ? 'actie' : 'acties' }} klaar</span>
            <span class="pil-tags"><span class="pil" :class="p.open ? 'pil--zwart' : 'pil--grijs'">{{ p.open ? `${p.open} open ${periode}` : `Niets open ${periode}` }}</span></span>
          </FunctieLink>
          <span class="rb-staaf" role="img" :aria-label="`${p.voortgang.percentage} procent van het actieplan klaar`"><span :style="{ width: `${p.voortgang.percentage}%` }" /></span>
          <ul v-if="p.acties.length" class="rb-lijst">
            <li v-for="t in p.acties" :key="t.id">
              <button type="button" class="item-rij" :data-test="`rb-taak-${t.id}`" @click="taak = t.id">
                <span class="item-tijd" :class="{ 'item-tijd--rood': t.teLaat }">{{ t.due ? (t.teLaat ? 'Over tijd' : week ? dagNr(t.due) : tijd(t.due)) : '' }}<small v-if="t.due && (t.teLaat || week)">{{ t.teLaat ? dagNr(t.due) : tijd(t.due) }}</small></span>
                <span class="item-icoon"><Icoon naam="ClipboardCheck" /></span>
                <span class="item-body"><span class="item-naam">{{ t.titel }}</span></span>
              </button>
            </li>
          </ul>
          <button v-else-if="p.volgende" type="button" class="rb-volgende tekst-link" :data-test="`rb-taak-${p.volgende.id}`" @click="taak = p.volgende.id">Volgende actie: {{ p.volgende.titel }}<template v-if="p.volgende.due"> op {{ dagKort(p.volgende.due) }}</template></button>
          <p v-else class="meta rb-dagleeg">Geen open acties. Voeg een actie toe in het plan.</p>
        </section>
      </div>
      <LegeStaat v-else titel="Geen lopende accountplannen." tekst="Maak een plan voor een account waar je meer wilt halen. Hier zie je dan elke dag wat openstaat." data-test="rb-accountplannen-leeg"><FunctieLink to="/accountplannen" class="tekst-link rb-link">Naar Accountplannen</FunctieLink></LegeStaat>
    </article>

    <TaakFlyout :open="!!taak" :taak-id="taak" @sluit="taak = null" @klaar="taak = null; emit('ververs')" @gewijzigd="emit('ververs')" />
    <AfspraakFlyout :open="!!afspraak" :afspraak-id="afspraak" @sluit="afspraak = null" @gewijzigd="emit('ververs')" />
    <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :task-id="plan.taskId" :aanleiding="plan.aanleiding" :voorstel="plan.voorstel" @sluit="plan.open = false" @gepland="plan.open = false; emit('ververs')" />
  </div>
</template>

<style scoped>
.rb { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
.rb-kaart { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rb-kop { margin-bottom: 0; }
.rb-waarom { margin: 0 0 4px; font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.rb-lijst { list-style: none; margin: 0; padding: 0; min-width: 0; }
.rb-sub { margin: 12px 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.rb-naam { padding: 0; background: none; border: 0; font: inherit; font-size: 14px; font-weight: 600; text-align: left; color: var(--ink); text-decoration: none; cursor: pointer; }
.rb-naam:hover { color: var(--yellow-dark); }
.rb-groepen { display: grid; gap: 16px; }
.rb-groep { display: grid; gap: 6px; min-width: 0; padding-top: 12px; border-top: 1px solid var(--border); }
.rb-groep:first-child { padding-top: 4px; border-top: 0; }
.rb-groepkop { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; color: inherit; text-decoration: none; }
.rb-groepnaam { font-size: 14px; font-weight: 700; color: var(--ink); }
.rb-groepkop:hover .rb-groepnaam { color: var(--yellow-dark); }
.rb-staaf { display: block; height: 6px; background: var(--surface); }
.rb-staaf > span { display: block; height: 100%; background: var(--yellow); }
.rb-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 13px; }
.rb-volgende { justify-self: start; min-height: 44px; padding: 0; background: none; border: 0; font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.rb-dagleeg { margin: 4px 0 0; }
@media (max-width: 1023px) { .rb { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 719px) {
  .rb-naam { min-height: 44px; display: inline-flex; align-items: center; }
  .rb-groepkop { min-height: 44px; }
}
</style>
