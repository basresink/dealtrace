<script setup lang="ts">
// Accountkaart (F03, 8.5.5): kop, contactstrip, stuurstrip, knoppen, statstrook,
// aanleiding, blokken, buying committee en tabbladen. Op de telefoon compact met
// een plakkende actiebalk (Bellen, Mail, WhatsApp, Navigeer).
import { CONTACTROL_LABEL, type ContactRol } from '~~/shared/contactgegevens'
import { STATUS_LABEL, STATUS_PIL, datumKort, fasePil, klasseKort, telLink, toonTelefoon } from '~/utils/accountWeergave'
const route = useRoute()
const { functie } = useMe()
if (!functie('prospects.kaart')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const toast = useToast()
const { data: a, refresh } = await useFetch<any>(() => `/api/accounts/${route.params.id}`)
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
const infoOpen = ref(false)
const contactenOpen = ref(false)
const verwijderOpen = ref(false)
const tab = ref<'tijdlijn' | 'taken' | 'contacten' | 'notities' | 'reis' | 'eigenvelden'>('tijdlijn')
const notitie = ref('')
// P05: reis, fase en status
const geschiedenisOpen = ref(false)
const neeOpen = ref(false)
const handeling = ref<null | 'fase' | 'pauzeer' | 'verplaats' | 'terugop'>(null)
async function zetLeverancier(id: string) {
  try { await $fetch(`/api/accounts/${a.value.id}`, { method: 'PUT', body: { huidigeLeverancierId: id || null } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function klaar(tekst: string) { neeOpen.value = false; handeling.value = null; toast.toon(tekst); await refresh() }
async function kwalificeer() {
  try {
    const r = await $fetch<any>('/api/reis/gebeurtenis', { method: 'POST', body: { accountId: a.value.id, gebeurtenis: 'gekwalificeerd' } })
    toast.toon(r.gewisseld ? 'Gekwalificeerd; het account staat in de reis.' : 'Geen wissel.'); await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function zetBand(letter: string, ja: boolean) {
  try {
    const r = await $fetch<any>(`/api/accounts/${a.value.id}/band`, { method: 'PUT', body: { letter, ja } })
    if (r.gemeld?.gewisseld) toast.toon('BAND 3 van 4: gekwalificeerd.')
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function openFase() { if (a.value.kan.geschiedenis) geschiedenisOpen.value = true }
const primair = computed(() => a.value.contacten.find((c: any) => c.id === a.value.primairContactId) ?? null)
const belNummer = computed(() => (primair.value && !primair.value.belMeNiet ? primair.value.mobiel ?? primair.value.telefoon : null) ?? a.value.telefoon)
const mailAdres = computed(() => primair.value?.email ?? a.value.email)
const whatsapp = computed(() => primair.value?.consent?.whatsapp?.status === 'ja' ? (primair.value.mobiel ?? null) : null)
const navigeer = computed(() => {
  const adres = [a.value.adres, a.value.postcode, a.value.plaats].filter(Boolean).join(', ')
  if (!adres) return null
  const ios = import.meta.client && /iPhone|iPad/.test(navigator.userAgent)
  return ios ? `https://maps.apple.com/?q=${encodeURIComponent(adres)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`
})
async function zetKlasse(k: string) {
  try { await $fetch(`/api/accounts/${a.value.id}`, { method: 'PUT', body: { klasse: k || null } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function bewaarNotitie() {
  if (!notitie.value.trim()) return
  try { await $fetch(`/api/accounts/${a.value.id}/notities`, { method: 'POST', body: { tekst: notitie.value } }); notitie.value = ''; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijder() {
  verwijderOpen.value = false
  try { await $fetch(`/api/accounts/${a.value.id}`, { method: 'DELETE' }); toast.toon(`${a.value.naam} is verwijderd.`); await navigateTo('/prospects/alle') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const SOORT: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', notitie: 'Notitie', bericht: 'Bericht', afspraak: 'Afspraak', bezoek: 'Bezoek', 'account verwijderd': 'Verwijderd', reis: 'Reis', import: 'Import' }
const notities = computed(() => a.value.tijdlijn.filter((x: any) => x.soort === 'notitie'))
const momenten = computed(() => a.value.tijdlijn.filter((x: any) => x.soort !== 'notitie').slice(0, 3))
useHead({ title: computed(() => `${a.value?.naam ?? 'Account'} · Dealtrace`) })
</script>

<template>
  <div v-if="a" class="accountkaart">
    <section class="section">
      <div class="container">
        <NuxtLink :to="a.soort === 'klant' ? '/klanten' : '/prospects/alle'" class="kruimel"><Icoon naam="ArrowLeft" :grootte="14" /> {{ a.soort === 'klant' ? 'Klanten' : 'Alle prospects' }}</NuxtLink>
        <div class="ak-kop">
          <div>
            <h1 class="title title--groot" data-test="account-naam">{{ a.naam }}</h1>
            <div class="account-naam mt-8">
              <select v-if="a.kan.klasse" class="invoer invoer--klein" :value="a.klasse ?? ''" aria-label="Klasse" data-test="klasse" @change="zetKlasse(($event.target as HTMLSelectElement).value)">
                <option value="">Geen klasse</option><option v-for="k in a.klassen" :key="k.id" :value="k.id" :title="k.naam">{{ k.naam }}</option>
              </select>
              <span v-else-if="a.klasse" class="pil pil--zwart">{{ klasseKort(a.klasse, a.klassen) }}</span>
              <button v-if="a.reis?.fase" type="button" class="pil reis-pil-knop" :class="fasePil(a.reis.fase.kleur)" :disabled="!a.kan.geschiedenis" :title="a.kan.geschiedenis ? 'Reisgeschiedenis' : undefined" data-test="fasepil" @click="openFase">{{ a.reis.fase.label }}</button>
              <span class="pil" :class="STATUS_PIL[a.status]" data-test="statuspil">{{ STATUS_LABEL[a.status] ?? a.status }}</span>
              <span v-if="a.dagenInFase !== null && a.reis" class="meta" :class="{ 'meta--oranje': a.reis.fase?.overschreden }" data-test="dagen-in-fase">{{ a.dagenInFase }} dagen in fase</span>
              <span v-if="a.vvBranche" class="chip chip--branche" title="Branche (verkoopverhaal)" data-test="vv-branche">{{ a.vvBranche.naam }}</span>
              <span v-for="c in [a.branche, a.plaats, a.land].filter(Boolean)" :key="c" class="pil pil--leeg">{{ c }}</span>
            </div>
            <div v-if="a.soort === 'prospect' && (a.concurrenten.length || a.huidigeLeverancier)" class="ak-leverancier mt-8" data-test="leverancier">
              <label class="veld veld--rij"><span class="veld-label">Huidige leverancier</span>
                <select v-if="a.kanLeverancier" class="invoer invoer--klein" :value="a.huidigeLeverancier?.id ?? ''" data-test="leverancier-kies" @change="zetLeverancier(($event.target as HTMLSelectElement).value)"><option value="">Onbekend</option><option v-for="c in a.concurrenten" :key="c.id" :value="c.id">{{ c.naam }}</option></select>
                <span v-else>{{ a.huidigeLeverancier?.naam ?? 'Onbekend' }}</span>
              </label>
              <div v-if="a.huidigeLeverancier?.zoZegJeHet" class="kaart kaart--vlak mt-8" data-test="zo-zeg-je-het">
                <p><strong>Zo zeg je het:</strong> {{ a.huidigeLeverancier.zoZegJeHet }}</p>
                <p v-if="a.huidigeLeverancier.bewijs" class="mt-8"><strong>Bewijs:</strong> {{ a.huidigeLeverancier.bewijs }}</p>
                <p v-if="a.huidigeLeverancier.wanneerVerliezen && a.reis?.fase?.id === 'gekwalificeerd'" class="veld-fout mt-8" data-test="verlies-waarschuwing">Let op: hier verliezen we vaak van {{ a.huidigeLeverancier.naam }}. {{ a.huidigeLeverancier.wanneerVerliezen }}</p>
              </div>
            </div>
            <div class="ak-contactstrip mt-8">
              <a v-if="a.website" :href="a.website" target="_blank" rel="noopener"><Icoon naam="Globe" :grootte="16" /> Website</a>
              <a v-if="a.telefoon" :href="telLink(a.telefoon)"><Icoon naam="Phone" :grootte="16" /> {{ toonTelefoon(a.telefoon) }}</a>
              <a v-if="a.linkedin" :href="a.linkedin" target="_blank" rel="noopener"><Icoon naam="Linkedin" :grootte="16" /> LinkedIn</a>
            </div>
          </div>
          <div class="toolbar-buttons">
            <button type="button" class="dd-actie dd-actie--secundair" data-test="info-knop" @click="infoOpen = true"><Icoon naam="Info" class="dd-actie-icoon" />Info</button>
            <button type="button" class="dd-actie dd-actie--secundair" data-test="contacten-knop" @click="contactenOpen = true"><Icoon naam="Users" class="dd-actie-icoon" />Contacten {{ a.contacten.filter((c: any) => c.status !== 'vertrokken').length }}</button>
            <a v-if="belNummer" class="dd-actie dd-actie--primair alleen-groot" :href="telLink(belNummer)"><Icoon naam="Phone" class="dd-actie-icoon" />Bel</a>
          </div>
        </div>
        <!-- Telefoon: compacte kaart (8.5.5): waarom nu, contacten, laatste momenten. -->
        <div class="ak-mobiel mt-16" data-test="compacte-kaart">
          <p v-if="a.aanleiding" class="account-aanleiding" :class="{ 'account-aanleiding--heet': a.aanleiding.heet }"><strong>Waarom nu:</strong> {{ a.aanleiding.tekst }} <span class="meta">· {{ a.aanleiding.bron }}</span></p>
          <p v-if="a.terugkom" class="reis-terug" data-test="terug-op-mobiel">{{ a.terugkom.tekst }}</p>
          <ul class="schakel-lijst kaart">
            <li v-for="c in a.contacten.filter((x: any) => x.status !== 'vertrokken')" :key="c.id" class="schakel-rij">
              <span><strong>{{ c.naam }}</strong><br><span class="meta">{{ CONTACTROL_LABEL[c.rol as ContactRol] }}</span></span>
              <a v-if="(c.mobiel || c.telefoon) && !c.belMeNiet" class="dd-act" :href="telLink(c.mobiel ?? c.telefoon)" :aria-label="`Bel ${c.naam}`"><Icoon naam="Phone" class="dd-act-icoon" />Bel</a>
            </li>
            <li v-if="!a.contacten.length" class="schakel-rij"><span class="meta">Geen contactpersoon</span></li>
          </ul>
          <ul v-if="momenten.length" class="schakel-lijst kaart mt-8"><li v-for="x in momenten" :key="x.id" class="schakel-rij"><span>{{ SOORT[x.soort] ?? x.soort }}<template v-if="x.uitkomst"> · {{ x.uitkomst }}</template></span><span class="meta">{{ datumKort(x.op) }}</span></li></ul>
        </div>
        <dl class="ak-stuur mt-16 alleen-groot" data-test="stuurstrip">
          <div><dt>Laatste actie</dt><dd>{{ datumKort(a.stuur.laatsteActie) }}</dd></div>
          <div><dt>Laatste call</dt><dd>{{ datumKort(a.stuur.laatsteCall) }}</dd></div>
          <div><dt>Laatste bezoek</dt><dd>{{ datumKort(a.stuur.laatsteBezoek) }}</dd></div>
          <div><dt>Reis</dt><dd><NuxtLink v-if="a.reis && a.kan.reisBekijken" :to="`/reizen/${a.reis.id}`" data-test="reis-link">{{ a.reis.naam }}</NuxtLink><template v-else>{{ a.reis?.naam ?? 'Geen reis' }}</template></dd></div>
          <div><dt>Fase</dt><dd>{{ a.reis?.fase?.label ?? '–' }}<template v-if="a.dagenInFase !== null && a.reis"> · <span :class="{ 'meta--oranje': a.reis.fase?.overschreden }">{{ a.dagenInFase }} dagen</span></template></dd></div>
          <div v-if="a.terugkom" class="ak-stuur-breed"><dt>Terug op</dt><dd data-test="terug-op">{{ a.terugkom.tekst.replace(/^Terug op /, '').split(' · ').slice(0, 2).join(' · ') }}</dd></div>
        </dl>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="stat-grid stat-grid--6 alleen-groot" data-test="statstrook">
          <div class="stat-card"><span class="stat-label">Open acties</span><span class="stat-num tnum">{{ a.openTaken }}</span></div>
          <div class="stat-card"><span class="stat-label">Inzichten</span><span class="stat-num tnum">0</span></div>
          <div class="stat-card"><span class="stat-label">Afspraak</span><span class="stat-value-tekst">Geen gepland</span></div>
          <div class="stat-card"><span class="stat-label">Score</span><span class="stat-num tnum">{{ a.score }}</span></div>
          <div class="stat-card"><span class="stat-label">Laatste contact</span><span class="stat-value-tekst">{{ datumKort(a.laatsteContactOp) }}</span></div>
          <div class="stat-card"><span class="stat-label">Eigenaar</span><span class="stat-value-tekst">{{ a.eigenaar?.naam?.replace(/^Testgebruiker /, '') ?? 'Niemand' }}</span></div>
        </div>
        <div v-if="a.aanleiding" class="account-aanleiding mt-16 alleen-groot" :class="{ 'account-aanleiding--heet': a.aanleiding.heet }" data-test="aanleiding"><strong>Waarom nu:</strong> {{ a.aanleiding.tekst }} <span class="meta">· {{ a.aanleiding.bron }} · {{ datumKort(a.aanleiding.op) }}</span></div>
        <div class="ak-blokken mt-16">
          <article class="kaart"><header class="kaart-kop"><h2 class="kaart-titel">Dossier</h2></header><p class="kaart-meta">{{ a.dossier ? `${a.dossier.criteria ?? 0} criteria` : 'Nog geen dossier. Het dossier vult zich met de reis en de AI-onderzoeker.' }}</p></article>
          <article class="kaart" data-test="band"><header class="kaart-kop"><h2 class="kaart-titel">Kwalificatie BAND {{ Object.values(a.band).filter((b: any) => b?.ja).length }}/4</h2></header>
            <ul class="kaart-meta band-lijst">
              <li v-for="k in ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak']" :key="k" class="band-rij">
                <label v-if="a.kan.kwalificeer || (a.kan.reis && a.status === 'nieuw')" class="schakel-naam"><input type="checkbox" :checked="!!a.band[k]?.ja" :data-test="`band-${k}`" @change="zetBand(k, ($event.target as HTMLInputElement).checked)"> {{ k.charAt(0).toUpperCase() + k.slice(1) }}</label>
                <template v-else>{{ k.charAt(0).toUpperCase() + k.slice(1) }}: {{ a.band[k]?.ja ? `ja (${a.band[k].bron ?? 'bron onbekend'})` : 'nog niet' }}</template>
              </li>
            </ul>
            <button v-if="a.kan.kwalificeer" type="button" class="dd-act dd-act--primair mt-16" data-test="kwalificeer" @click="kwalificeer">Kwalificeer</button>
          </article>
          <article v-if="a.kan.reis" class="kaart" data-test="ritme"><header class="kaart-kop"><h2 class="kaart-titel">Ritme</h2></header>
            <p class="kaart-meta"><template v-if="a.terugkom">{{ a.terugkom.tekst }}</template><template v-else-if="a.reis?.fase">Fase {{ a.reis.fase.label }}<template v-if="a.reis.fase.accent">: {{ a.reis.fase.accent }}</template></template><template v-else>Nog geen reis.</template></p>
            <div class="reis-knoppen mt-16">
              <button v-if="a.kan.nee" type="button" class="dd-act" data-test="zet-nee-knop" @click="neeOpen = true">Zet nee</button>
              <button v-if="a.kan.pauzeer" type="button" class="dd-act" data-test="pauzeer-knop" @click="handeling = 'pauzeer'">Pauzeer tot</button>
              <button v-if="a.kan.verplaatsen" type="button" class="dd-act" data-test="verplaats-knop" @click="handeling = 'verplaats'">Verplaats naar reis</button>
              <button v-if="a.kan.faseCorrigeren && a.reis" type="button" class="dd-act" data-test="fase-corrigeren-knop" @click="handeling = 'fase'">Fase corrigeren</button>
              <button v-if="a.kan.terugOp" type="button" class="dd-act" data-test="terugop-knop" @click="handeling = 'terugop'">Terugkomdatum</button>
            </div>
          </article>
        </div>
        <div class="mt-16">
          <span class="kicker kicker--streep">Buying committee</span>
          <BuyingCommittee class="mt-16" :contacten="a.contacten" :ontbrekend="a.ontbrekendeRollen" />
        </div>
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <nav class="tabbalk" aria-label="Tabbladen">
          <button v-for="t in ([['tijdlijn', 'Tijdlijn'], ['taken', 'Taken'], ['contacten', 'Contacten'], ['notities', 'Notities'], ['reis', 'Reis'], ['eigenvelden', 'Eigen velden']] as const)" :key="t[0]" type="button" class="tab" :class="{ 'tab--actief': tab === t[0] }" :aria-current="tab === t[0] ? 'page' : undefined" @click="tab = t[0]">{{ t[1] }}</button>
        </nav>
        <div class="mt-16">
          <template v-if="tab === 'tijdlijn'">
            <LegeStaat v-if="!a.tijdlijn.length" titel="Nog niets gebeurd." tekst="Gesprekken, mails en notities verschijnen hier." />
            <ul v-else class="schakel-lijst kaart"><li v-for="x in a.tijdlijn" :key="x.id" class="schakel-rij"><span><strong>{{ SOORT[x.soort] ?? x.soort }}</strong><template v-if="x.uitkomst"> · {{ x.uitkomst }}</template><template v-if="x.tekst"> · {{ x.tekst }}</template></span><span class="meta">{{ datumKort(x.op) }}<template v-if="x.door"> · {{ x.door }}</template></span></li></ul>
          </template>
          <LegeStaat v-else-if="tab === 'taken'" titel="Nog geen taken." tekst="Taken komen in een volgende versie (P07)." />
          <template v-else-if="tab === 'contacten'">
            <ul class="schakel-lijst kaart"><li v-for="c in a.contacten" :key="c.id" class="schakel-rij"><NuxtLink :to="`/contacten/${c.id}`">{{ c.naam }}</NuxtLink><span class="meta">{{ CONTACTROL_LABEL[c.rol as ContactRol] }}<template v-if="c.status === 'vertrokken'"> · vertrokken</template></span></li></ul>
          </template>
          <template v-else-if="tab === 'notities'">
            <form class="kaart" @submit.prevent="bewaarNotitie"><label class="veld"><span class="veld-label">Nieuwe notitie</span><textarea v-model="notitie" class="invoer" rows="3" data-test="notitie" /></label><button type="submit" class="dd-act dd-act--primair mt-16" :disabled="!notitie.trim()">Notitie bewaren</button></form>
            <ul class="schakel-lijst kaart mt-16"><li v-for="n in notities" :key="n.id" class="schakel-rij"><span>{{ n.tekst }}</span><span class="meta">{{ datumKort(n.op) }} · {{ n.door }}</span></li></ul>
          </template>
          <template v-else-if="tab === 'reis'">
            <LegeStaat v-if="!a.reis" titel="Geen reis." tekst="Klanten lopen geen prospectreis; het vervolg loopt in DealDrive of je CRM." />
            <div v-else class="kaart">
              <p><strong>{{ a.reis.naam }}</strong> · {{ a.reis.fase?.label }} · {{ STATUS_LABEL[a.status] ?? a.status }}</p>
              <p v-if="a.reis.fase?.accent" class="fasekaart-accent">{{ a.reis.fase.accent }}</p>
              <p v-if="a.nee" class="mt-16">Nee: {{ a.nee.reden }}<template v-if="a.nee.toelichting"> ({{ a.nee.toelichting }})</template>; afkoeling bellen tot {{ a.nee.tot.bellen }}, mail tot {{ a.nee.tot.mail }}.</p>
              <button v-if="a.kan.geschiedenis" type="button" class="dd-act mt-16" data-test="geschiedenis-knop" @click="geschiedenisOpen = true">Reisgeschiedenis</button>
            </div>
          </template>
          <template v-else-if="tab === 'eigenvelden'">
            <LegeStaat v-if="!a.eigenVelden.length" titel="Geen eigen velden." tekst="Je beheerder maakt eigen velden bij Instellingen." />
            <dl v-else class="gegevens kaart"><template v-for="v in a.eigenVelden" :key="v.sleutel"><dt>{{ v.naam }}</dt><dd>{{ a.customFields[v.sleutel] ?? '–' }}</dd></template></dl>
            <EigenVeldVoorstel v-if="a.kan.voorstellen" class="mt-16" />
          </template>
        </div>
      </div>
    </section>

    <!-- Telefoon: compacte blokken en de plakkende actiebalk (8.5.5). -->
    <div class="actiebalk" data-test="actiebalk">
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !belNummer }" :href="belNummer ? telLink(belNummer) : undefined" :aria-disabled="!belNummer" :title="belNummer ? undefined : 'Geen telefoonnummer'" data-test="ab-bellen"><Icoon naam="Phone" />Bellen</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !mailAdres }" :href="mailAdres ? `mailto:${mailAdres}` : undefined" :aria-disabled="!mailAdres" :title="mailAdres ? undefined : 'Geen e-mailadres'"><Icoon naam="Mail" />Mail</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !whatsapp }" :href="whatsapp ? `https://wa.me/${whatsapp.replace('+', '')}` : undefined" :aria-disabled="!whatsapp" :title="whatsapp ? undefined : 'Geen toestemming voor WhatsApp'"><Icoon naam="MessageCircle" />WhatsApp</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !navigeer }" :href="navigeer ?? undefined" :aria-disabled="!navigeer" :title="navigeer ? undefined : 'Geen adres'" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
    </div>

    <ReisgeschiedenisFlyout v-if="a.kan.geschiedenis" :open="geschiedenisOpen" :account-id="a.id" :naam="a.naam" @sluit="geschiedenisOpen = false" />
    <ZetNeeFlyout v-if="a.kan.nee" :open="neeOpen" :account="{ id: a.id, naam: a.naam }" :concurrenten="a.concurrenten" @sluit="neeOpen = false" @klaar="klaar" />
    <ReisHandelingFlyout v-if="handeling" :open="!!handeling" :soort="handeling" :account="a" @sluit="handeling = null" @klaar="klaar" />
    <InfoFlyout :open="infoOpen" :account="a" @sluit="infoOpen = false" @gewijzigd="refresh" @verwijder="verwijderOpen = true" />
    <ContactenFlyout :open="contactenOpen" :account="{ id: a.id, naam: a.naam }" :contacten="a.contacten" @sluit="contactenOpen = false" @gewijzigd="refresh" />
    <BevestigVenster :open="verwijderOpen" :titel="`${a.naam} verwijderen?`" tekst="Het account en zijn contacten worden verwijderd. De activiteitenlog blijft bewaard." bevestig="Verwijderen" @geannuleerd="verwijderOpen = false" @bevestigd="verwijder" />
  </div>
</template>
