<script setup lang="ts">
// Contactkaart (F04): naam, functie, bedrijf, bellinks, stuurstrip van het account,
// toestemming en voorkeur, "Bel me niet", vertrokken, verhuizen (Expert).
import { CONTACTROL_LABEL, ROLLEN_CONTACT, type ContactRol } from '~~/shared/contactgegevens'
import { datumKort, initialen, telLink } from '~/utils/accountWeergave'
const route = useRoute()
const toast = useToast()
const { functie } = useMe()
if (!functie('contacten.basis')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const { data: c, refresh } = await useFetch<any>(() => `/api/contacten/${route.params.id}`)
if (!c.value) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
const tab = ref<'tijdlijn' | 'taken' | 'notities' | 'afspraken' | 'verslagen'>('tijdlijn')
async function wijzig(patch: Record<string, unknown>) {
  try { await $fetch(`/api/contacten/${c.value.id}`, { method: 'PUT', body: patch }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const verhuisNaar = ref('')
const { data: accounts } = c.value.kan.verhuizen ? await useFetch<any>('/api/accounts', { query: { eigenaar: 'iedereen' }, default: () => ({ rijen: [] }) }) : { data: ref({ rijen: [] }) }
async function verhuis() {
  try { await $fetch(`/api/contacten/${c.value.id}/verhuis`, { method: 'POST', body: { accountId: verhuisNaar.value } }); toast.toon('Contact verhuisd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const STATUS_C: Record<string, string> = { onbekend: 'Onbekend', ja: 'Ja', nee: 'Nee' }
useHead({ title: computed(() => `${c.value?.naam ?? 'Contact'} · Dealtrace`) })
</script>

<template>
  <div v-if="c">
    <section class="section">
      <div class="container">
        <NuxtLink :to="`/accounts/${c.accountId}`" class="kruimel"><Icoon naam="ArrowLeft" :grootte="14" /> {{ c.account?.naam }}</NuxtLink>
        <div class="ak-kop">
          <div class="contact-kop">
            <span class="account-logo account-logo--a">{{ initialen(c.naam) }}</span>
            <div>
              <h1 class="title title--groot">{{ c.naam }}</h1>
              <p class="subtitle">{{ c.functie }} · <NuxtLink :to="`/accounts/${c.accountId}`">{{ c.account?.naam }}</NuxtLink></p>
              <div class="account-naam mt-8">
                <select class="invoer invoer--klein" :value="c.rol" aria-label="Rol" @change="wijzig({ rol: ($event.target as HTMLSelectElement).value })"><option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option></select>
                <span v-if="c.status === 'vertrokken'" class="pil pil--grijs">Vertrokken {{ c.vertrokkenOp }}</span>
              </div>
              <div class="ak-contactstrip mt-8">
                <a v-for="n in [c.mobiel, c.telefoon].filter(Boolean)" :key="n" :href="c.belMeNiet ? undefined : telLink(n)" :class="{ 'dd-act--uit': c.belMeNiet }"><Icoon naam="Phone" :grootte="16" /> {{ n }}</a>
                <a v-if="c.email" :href="`mailto:${c.email}`"><Icoon naam="Mail" :grootte="16" /> {{ c.email }}</a>
              </div>
            </div>
          </div>
        </div>
        <dl class="ak-stuur mt-16"><div><dt>Account · laatste contact</dt><dd>{{ datumKort(c.account?.laatsteContactOp) }}</dd></div><div><dt>Account · laatste call</dt><dd>{{ datumKort(c.account?.laatsteCall) }}</dd></div></dl>
      </div>
    </section>
    <section class="section">
      <div class="container instellingen-raster">
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Toestemming en voorkeur</h2></header>
          <div class="formulier-raster">
            <label v-for="k in ['email', 'whatsapp']" :key="k" class="veld"><span class="veld-label">{{ k === 'email' ? 'E-mail' : 'WhatsApp' }}</span>
              <select class="invoer" :value="c.consent?.[k]?.status ?? 'onbekend'" @change="wijzig({ consent: { [k]: ($event.target as HTMLSelectElement).value } })"><option v-for="(l, s) in STATUS_C" :key="s" :value="s">{{ l }}</option></select>
              <span v-if="c.consent?.[k]?.op" class="veld-uitleg">{{ c.consent[k].op.slice(0, 10) }} · {{ c.consent[k].bron }}</span>
            </label>
            <label class="veld"><span class="veld-label">Voorkeurskanaal</span><select class="invoer" :value="c.voorkeurskanaal ?? ''" @change="wijzig({ voorkeurskanaal: ($event.target as HTMLSelectElement).value || null })"><option value="">Geen</option><option value="telefoon">Telefoon</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></label>
          </div>
          <div class="schakel-rij mt-16"><div><span class="schakel-naam">Bel me niet</span><span class="veld-uitleg">Haalt het nummer uit elke bellijst.</span></div><Schakelaar :aan="c.belMeNiet" label="Bel me niet" data-test="bel-me-niet" @wissel="wijzig({ belMeNiet: $event })" /></div>
          <button type="button" class="dd-act mt-16" @click="wijzig({ status: c.status === 'vertrokken' ? 'actief' : 'vertrokken' })">{{ c.status === 'vertrokken' ? 'Weer actief' : 'Markeer als vertrokken' }}</button>
        </article>
        <article v-if="c.kan.verhuizen" class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Verhuizen</h2></header>
          <p class="kaart-meta">Naar een ander bedrijf. De historie blijft bewaard.</p>
          <select v-model="verhuisNaar" class="invoer mt-16"><option value="">Kies een bedrijf</option><option v-for="a in accounts.rijen" :key="a.id" :value="a.id">{{ a.name }}</option></select>
          <button type="button" class="dd-act mt-16" :disabled="!verhuisNaar" @click="verhuis">Verhuis</button>
        </article>
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <nav class="tabbalk" aria-label="Tabbladen"><button v-for="t in ([['tijdlijn', 'Tijdlijn'], ['taken', 'Taken'], ['notities', 'Notities'], ['afspraken', 'Afspraken'], ['verslagen', 'Verslagen']] as const)" :key="t[0]" type="button" class="tab" :class="{ 'tab--actief': tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button></nav>
        <div class="mt-16">
          <ul v-if="tab === 'tijdlijn' && c.tijdlijn.length" class="schakel-lijst kaart"><li v-for="x in c.tijdlijn" :key="x.id" class="schakel-rij"><span>{{ x.soort }}<template v-if="x.tekst"> · {{ x.tekst }}</template></span><span class="meta">{{ datumKort(x.op) }}</span></li></ul>
          <LegeStaat v-else :titel="tab === 'tijdlijn' ? 'Nog niets gebeurd.' : 'Nog niets.'" :tekst="tab === 'tijdlijn' ? 'Gesprekken en notities met deze persoon verschijnen hier.' : 'Komt in een volgende versie.'" />
        </div>
        <p class="meta mt-16">Daarnaast {{ c.openTakenAccount }} open taken op accountniveau.</p>
      </div>
    </section>
  </div>
</template>
