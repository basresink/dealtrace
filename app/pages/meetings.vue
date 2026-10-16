<script setup lang="ts">
// Meetings (Plannen): je meetings van de komende vier weken per week, met filter op meetingsoort en vorm,
// "+ Afspraak" en, vanaf Gevorderd, "Wie is er aan de beurt?" (voorheen een weergave in de agenda).
// Een meeting opent het afspraakvenster.
import { nlMoment, plusDagen } from '~~/shared/datum'
const { functie } = useMe()
const route = useRoute()
const router = useRouter()
const vandaag = nlMoment(new Date()).datum
const van = vandaag
const tot = plusDagen(vandaag, 28)
const { data, refresh } = await useFetch<any>('/api/agenda', { query: { van, tot }, default: () => ({ afspraken: [], meetingsoorten: [] }) })
const soort = computed(() => (route.query.soort as string) || '')
const vorm = computed(() => (route.query.vorm as string) || '')
const zet = (k: string, v: string) => router.replace({ query: { ...route.query, [k]: v || undefined } })
const meetings = computed(() => data.value.afspraken
  .filter((a: any) => a.status !== 'geannuleerd' && (!soort.value || a.soort.slug === soort.value) && (!vorm.value || a.vorm === vorm.value))
  .sort((a: any, b: any) => a.start.localeCompare(b.start)))
const dagVan = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const dagLang = (d: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
const weekLabel = (i: number) => (i === 0 ? 'Deze week' : i === 1 ? 'Volgende week' : `Over ${i} weken`)
const wd = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7
const weken = computed(() => {
  const maandag = plusDagen(vandaag, -wd(vandaag))
  return [0, 1, 2, 3, 4].map((i) => {
    const start = plusDagen(maandag, i * 7); const eind = plusDagen(start, 7)
    return { label: weekLabel(i), van: start, meetings: meetings.value.filter((m: any) => dagVan(m.start) >= start && dagVan(m.start) < eind) }
  }).filter((w) => w.meetings.length)
})
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const afspraakId = computed(() => (route.query.afspraak as string) || null)
const planOpen = ref(false)
const planAccount = ref<{ id: string; naam: string } | null>(null)
function plan(account: { id: string; naam: string } | null = null) { planAccount.value = account; planOpen.value = true }
async function gepland(id: string) { planOpen.value = false; await refresh(); zet('afspraak', id) }
const aanDeBeurtAan = computed(() => !!functie('agenda.aanDeBeurt')?.beschikbaar)
const { data: beurt } = await useFetch<any>('/api/meetings/aan-de-beurt', { immediate: aanDeBeurtAan.value, default: () => null })
useHead({ title: 'Meetings · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Plannen · Meetings" titel="Je meetings, vier weken vooruit" :uitleg="`${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'} tot ${dagLang(tot)}. Klik een meeting voor doel, briefing en verslag.`" helpartikel="agenda">
      <template #acties>
        <button type="button" class="dd-actie dd-actie--zwart" data-test="meetings-afspraak" @click="plan()"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <NuxtLink to="/agenda" class="dd-actie dd-actie--secundair"><Icoon naam="Calendar" class="dd-actie-icoon" />Agenda</NuxtLink>
      </template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container stapel">
        <div class="chips" data-test="meetings-filters">
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !soort }" @click="zet('soort', '')">Alle soorten</button>
          <button v-for="m in data.meetingsoorten" :key="m.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': soort === m.slug }" @click="zet('soort', soort === m.slug ? '' : m.slug)">{{ m.naam }}</button>
          <span class="mt-scheider" />
          <button v-for="[k, l] in Object.entries(VORM)" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': vorm === k }" @click="zet('vorm', vorm === k ? '' : k)">{{ l }}</button>
        </div>
        <LegeStaat v-if="!weken.length" titel="Geen meetings gepland." tekst="Plan een afspraak, of kijk hieronder wie er aan de beurt is." />
        <article v-for="w in weken" :key="w.van" class="kaart mt-week" :data-test="`meetings-week-${w.van}`">
          <header class="kaart-kop"><h2 class="kaart-titel">{{ w.label }}</h2><span class="meta tnum">{{ w.meetings.length }}</span></header>
          <ul class="mt-lijst">
            <li v-for="m in w.meetings" :key="m.id">
              <button type="button" class="mt-rij item-rij" :data-test="`meeting-${m.id}`" @click="zet('afspraak', m.id)">
                <span class="item-tijd">{{ tijd(m.start) }}<small>{{ dagLang(dagVan(m.start)) }}</small></span>
                <span class="item-icoon" :class="`item-icoon--${m.vorm === 'bezoek' ? 'visit' : m.vorm === 'telefoon' ? 'call' : 'note'}`" aria-hidden="true"><Icoon :naam="m.vorm === 'bezoek' ? 'MapPin' : m.vorm === 'telefoon' ? 'Phone' : 'Calendar'" :grootte="16" /></span>
                <span class="item-body"><span class="item-naam mt-naam">{{ m.accountNaam ?? m.soort.naam }}</span><span class="item-meta">{{ tijd(m.start) }} tot {{ tijd(m.eind) }} · {{ VORM[m.vorm] ?? m.vorm }}<template v-if="m.locatie"> · {{ m.locatie }}</template><template v-if="m.geplandDoor"> · gepland door {{ m.geplandDoor }}</template></span><span class="pil" :class="m.vorm === 'bezoek' ? 'pil--groen' : 'pil--blauw'">{{ m.soort.naam }}</span></span>
              </button>
            </li>
          </ul>
        </article>

        <article v-if="aanDeBeurtAan" class="kaart" data-test="aan-de-beurt">
          <header class="kaart-kop"><h2 class="kaart-titel">Wie is er aan de beurt?</h2></header>
          <p v-if="beurt && !beurt.voorstellen.length" class="kaart-meta">Niemand is nu aan de beurt. De motor zet nieuwe voorstellen klaar zodra een ritme verloopt.</p>
          <ul v-else-if="beurt" class="schakel-lijst">
            <li v-for="v in beurt.voorstellen" :key="v.accountId" class="schakel-rij" :data-test="`beurt-${v.accountId}`">
              <span><NuxtLink :to="`/accounts/${v.accountId}`"><strong>{{ v.naam }}</strong></NuxtLink><span class="meta"> · {{ v.reden }}<template v-if="v.dagenAchter"> · {{ v.dagenAchter }} dagen</template> · {{ v.vormAdvies }}</span></span>
              <button type="button" class="dd-act dd-act--primair" @click="plan({ id: v.accountId, naam: v.naam })">Plan</button>
            </li>
          </ul>
        </article>
      </div>
    </section>
    <PlanAfspraakFlyout :open="planOpen" :account="planAccount" @sluit="planOpen = false" @gepland="gepland" />
    <AfspraakFlyout :open="!!afspraakId" :afspraak-id="afspraakId" @sluit="zet('afspraak', '')" @gewijzigd="refresh()" />
  </div>
</template>

<style scoped>
.mt-scheider { width: 1px; align-self: stretch; background: var(--border); margin: 0 4px; }
.mt-lijst { list-style: none; margin: 0; padding: 0; }
</style>
