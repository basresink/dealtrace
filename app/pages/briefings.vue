<script setup lang="ts">
// Briefings (Gevorderd), te openen vanaf Taken. Bovenaan kies je zelf een prospect (zoekveld met hooguit zes
// treffers) en eventueel een contactpersoon van dat prospect: dan staat de briefing van het account eronder,
// met de gegevens, de laatste contactmomenten en de komende gesprekken van het contact. De keuze staat in de
// URL (?account=&contact=). Daaronder je komende afspraken en open taken, ook achterstallige, met de soort die
// elke ingang kiest en de drie regels. Open er een voor de hele briefing en de Pitstop.
import { BRIEFING_SOORTEN, SOORT_LABEL, type BriefingSoort } from '~~/shared/briefing'
import type { Contact, Klant } from '~/components/taken/KlantContactKiezer.vue'
const { functie } = useMe()
const aan = !!functie('briefing.bewerken')?.beschikbaar
const route = useRoute()
const router = useRouter()
const query = computed(() => ({ dagen: route.query.dagen ?? 7, soort: route.query.soort || undefined }))
const { data } = await useFetch<any>('/api/briefing/overzicht', { query, immediate: aan, default: () => ({ briefings: [] }) })
const open = ref<{ onderwerp: 'afspraak' | 'taak'; id: string; naam: string } | null>(null)
const wanneer = (iso: string | null) => (iso ? new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : 'Geen datum')

// Zelf kiezen: prospect en optioneel een contact, in de URL zodat de keuze een link is.
const q = (k: string) => (typeof route.query[k] === 'string' && route.query[k] ? (route.query[k] as string) : null)
const startAccount = q('account')
const prospect = ref<Klant | null>(startAccount ? { id: startAccount, naam: '…' } : null)
const contact = ref<Contact | null>(startAccount && q('contact') ? { id: q('contact')!, naam: '…', accountId: startAccount } : null)
watch([prospect, contact], ([p, c]) => {
  if ((p?.id ?? null) === q('account') && (c?.id ?? null) === q('contact')) return
  router.replace({ query: { ...route.query, account: p?.id || undefined, contact: c?.id || undefined } })
})
// Na een link of herladen kent de kiezer alleen de ids; de briefing levert de namen.
function geladen(d: any) {
  if (prospect.value && d?.account?.id === prospect.value.id && prospect.value.naam !== d.account.naam) prospect.value = { ...prospect.value, naam: d.account.naam }
  if (contact.value && d?.contact?.id === contact.value.id && contact.value.naam !== d.contact.naam) contact.value = { ...contact.value, naam: d.contact.naam, functie: d.contact.functie }
}
useHead({ title: 'Briefings · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="briefing.bewerken" />
    <template v-else>
      <PaginaKop kicker="Taken · Briefings" titel="Briefings" uitleg="Kies een prospect en eventueel een contactpersoon voor zijn briefing, of open de briefing van een komend gesprek. Achterstallige taken staan er ook in." helpartikel="briefing-en-pitstop" />
      <section class="section">
        <div class="container container--smal">
          <article class="kaart bfz" data-test="briefing-zoeken">
            <h2 class="kicker kicker--streep">Briefing opzoeken</h2>
            <div class="bfz-velden mt-8">
              <KlantContactKiezer v-model:klant="prospect" v-model:contact="contact" prefix="bf" klant-label="Prospect" />
            </div>
            <div v-if="prospect" class="bfz-uitkomst" data-test="briefing-gekozen">
              <header class="bfz-kop">
                <div>
                  <span class="fo-kicker">{{ contact ? 'Briefing voor je contact met' : 'Briefing van' }}</span>
                  <h3 class="bfz-titel">{{ contact ? `${contact.naam} · ${prospect.naam}` : prospect.naam }}</h3>
                </div>
                <NuxtLink :to="`/accounts/${prospect.id}`" class="dd-act" data-test="briefing-open-account">Open accountkaart</NuxtLink>
              </header>
              <ClientOnly>
                <BriefingPaneel :key="`${prospect.id}:${contact?.id ?? ''}`" onderwerp="account" :id="prospect.id" :contact-id="contact?.id ?? null" @geladen="geladen" @gesprek="(g) => (open = { onderwerp: g.onderwerp, id: g.id, naam: prospect!.naam })" />
              </ClientOnly>
            </div>
            <p v-else class="meta mt-8">Typ minstens twee letters van de naam. Je ziet hooguit zes prospects.</p>
          </article>

          <h2 class="kicker kicker--streep mt-24">Komende gesprekken</h2>
          <div class="cp-filters mt-16 mb-16">
            <label class="veld"><span class="veld-label">Periode</span><select class="invoer" :value="String(route.query.dagen ?? 7)" @change="router.replace({ query: { ...route.query, dagen: ($event.target as HTMLSelectElement).value } })"><option value="1">Vandaag en morgen</option><option value="7">Komende week</option><option value="30">Komende maand</option></select></label>
            <label class="veld"><span class="veld-label">Soort</span><select class="invoer" :value="route.query.soort ?? ''" @change="router.replace({ query: { ...route.query, soort: ($event.target as HTMLSelectElement).value || undefined } })"><option value="">Alle</option><option v-for="s in BRIEFING_SOORTEN" :key="s" :value="s">{{ SOORT_LABEL[s as BriefingSoort] }}</option></select></label>
          </div>
          <LegeStaat v-if="!data.briefings.length" titel="Geen briefings in deze periode." tekst="Geen afspraken of open taken met een account in deze periode. Kies hierboven zelf een prospect." />
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
        <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="bf-titel" data-test="briefing-venster">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Briefing</span><h2 id="bf-titel" class="fo-titel">{{ open.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="open = null"><Icoon naam="X" /></button></header>
          <div class="fo-body"><BriefingPaneel :onderwerp="open.onderwerp" :id="open.id" /></div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.bfz-velden { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px 16px; }
.bfz-velden :deep(.veld) { position: relative; margin: 0; }
.bfz-uitkomst { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.bfz-kop { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px 16px; margin-bottom: 8px; }
.bfz-titel { margin: 2px 0 0; font-family: var(--font-serif); font-size: 20px; line-height: 1.25; overflow-wrap: anywhere; }
@media (max-width: 720px) { .bfz-kop .dd-act { min-height: var(--touch-target-min); } }
</style>
