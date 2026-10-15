<script setup lang="ts">
// Briefings (Gevorderd): je komende afspraken en open taken, ook achterstallige, met de soort die elke
// ingang kiest en de drie regels. Open er een voor de hele briefing en de Pitstop.
import { BRIEFING_SOORTEN, SOORT_LABEL, type BriefingSoort } from '~~/shared/briefing'
const { functie } = useMe()
const aan = !!functie('briefing.bewerken')?.beschikbaar
const route = useRoute()
const router = useRouter()
const query = computed(() => ({ dagen: route.query.dagen ?? 7, soort: route.query.soort || undefined }))
const { data } = await useFetch<any>('/api/briefing/overzicht', { query, immediate: aan, default: () => ({ briefings: [] }) })
const open = ref<{ onderwerp: 'afspraak' | 'taak'; id: string; naam: string } | null>(null)
const wanneer = (iso: string | null) => (iso ? new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : 'Geen datum')
useHead({ title: 'Briefings · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="briefing.bewerken" />
    <template v-else>
      <PaginaKop kicker="Agenda · Briefings" titel="Briefings" uitleg="Voor elk gesprek de briefing met de juiste soort. Achterstallige taken staan er ook in." helpartikel="briefing-en-pitstop" />
      <section class="section">
        <div class="container container--smal">
          <div class="cp-filters mb-16">
            <label class="veld"><span class="veld-label">Periode</span><select class="invoer" :value="String(route.query.dagen ?? 7)" @change="router.replace({ query: { ...route.query, dagen: ($event.target as HTMLSelectElement).value } })"><option value="1">Vandaag en morgen</option><option value="7">Komende week</option><option value="30">Komende maand</option></select></label>
            <label class="veld"><span class="veld-label">Soort</span><select class="invoer" :value="route.query.soort ?? ''" @change="router.replace({ query: { ...route.query, soort: ($event.target as HTMLSelectElement).value || undefined } })"><option value="">Alle</option><option v-for="s in BRIEFING_SOORTEN" :key="s" :value="s">{{ SOORT_LABEL[s as BriefingSoort] }}</option></select></label>
          </div>
          <LegeStaat v-if="!data.briefings.length" titel="Geen briefings in deze periode." />
          <div v-else class="cn-lijst" data-test="briefings">
            <button v-for="b in data.briefings" :key="b.id" type="button" class="kaart cn-kaart bf-rij" @click="open = { onderwerp: b.onderwerp, id: b.id, naam: b.account.naam }">
              <span class="cn-kop"><span class="pil pil--leeg">{{ b.soortLabel }}</span><strong>{{ b.account.naam }}</strong><span class="meta">{{ b.onderwerp === 'afspraak' ? 'Afspraak' : 'Taak' }} · {{ wanneer(b.wanneer) }}</span></span>
              <ul class="bf-regels"><li v-for="r in b.drieRegels" :key="r">{{ r }}</li></ul>
            </button>
          </div>
        </div>
      </section>
    </template>
    <Teleport to="body">
      <div v-if="open" class="fo-overlay" @click.self="open = null">
        <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="bf-titel">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Briefing</span><h2 id="bf-titel" class="fo-titel">{{ open.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="open = null"><Icoon naam="X" /></button></header>
          <div class="fo-body"><BriefingPaneel :onderwerp="open.onderwerp" :id="open.id" /></div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>
