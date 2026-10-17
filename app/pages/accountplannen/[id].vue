<script setup lang="ts">
// Eén accountplan (opzet van DealDrive /accountplannen/[id]): kop met kruimel, status, account, geldigheid,
// eigenaar, titel en de voortgang van het actieplan; rechts + Actie, Markeer als afgerond (of Heropenen) en
// Verwijderen. Tabbladen (in de URL, ?tab=): Plan (de zes blokken met potlood en een voorzet van de Pitstop,
// het actieplan waarin elke actie een echte taak op het account wordt; opzij Kerngegevens met eigenaar,
// Contactpersonen en Extra velden), Contactpersonen (wie beslist mee, met hun rol), Taken en Afspraken van het
// account, en Notities.
import { ACCOUNTPLAN_SECTIES, ACTIEPLAN_LEEG, ACTIEPLAN_UITLEG, WEERGAVE_LABEL, afrondVraag, dagKort, geldigheidLabel, metHoofdletter, type AccountplanSectie } from '~~/shared/accountplannen'
import { nlMoment } from '~~/shared/datum'
const route = useRoute()
const router = useRouter()
const { functie } = useMe()
const aan = !!functie('nav.accountplannen')?.beschikbaar
const toast = useToast()
const id = computed(() => String(route.params.id))
const { data: p, refresh, error } = await useFetch<any>(() => `/api/accountplannen/${id.value}`, { immediate: aan })
const kan = computed(() => !!p.value?.kan.bewerken)
const dag = (iso: string | null) => (iso ? dagKort(nlMoment(new Date(iso)).datum) : 'geen datum')
const dagTijd = (iso: string | null) => { if (!iso) return ''; const m = nlMoment(new Date(iso)); return `${dagKort(m.datum)} ${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }
const vandaag = nlMoment(new Date()).datum
const telaat = (a: any) => !a.klaar && a.dueDate && nlMoment(new Date(a.dueDate)).datum < vandaag
useHead({ title: computed(() => `${p.value?.titel ?? 'Accountplan'} · Dealtrace`) })

// Tabbladen
type Tab = 'plan' | 'contacten' | 'taken' | 'afspraken' | 'notities'
const TABS = computed<{ id: Tab; label: string; tel?: number }[]>(() => [
  { id: 'plan', label: 'Plan' },
  { id: 'contacten', label: 'Contactpersonen', tel: p.value?.beslissers.length ?? 0 },
  { id: 'taken', label: 'Taken', tel: p.value?.taken.length ?? 0 },
  { id: 'afspraken', label: 'Afspraken', tel: p.value?.afspraken.length ?? 0 },
  { id: 'notities', label: 'Notities', tel: p.value?.notities.length ?? 0 },
])
const tab = computed<Tab>(() => (['plan', 'contacten', 'taken', 'afspraken', 'notities'].includes(String(route.query.tab)) ? route.query.tab as Tab : 'plan'))
function kiesTab(t: Tab) { router.replace({ query: { ...route.query, tab: t === 'plan' ? undefined : t } }) }

async function zet(body: Record<string, unknown>, tekst?: string) {
  try { await $fetch(`/api/accountplannen/${id.value}`, { method: 'PUT', body }); if (tekst) toast.toon(tekst); await refresh(); return true } catch (e) { toast.toon(foutTekst(e), 'fout'); return false }
}

// Kerngegevens
const kernOpen = ref(false)
const kern = reactive({ titel: '', eigenaarId: '', geldigVan: '', geldigTot: '' })
function startKern() { Object.assign(kern, { titel: p.value.titel, eigenaarId: p.value.eigenaar?.id ?? '', geldigVan: p.value.geldigVan ?? '', geldigTot: p.value.geldigTot ?? '' }); kernOpen.value = true }
async function bewaarKern() { if (await zet({ titel: kern.titel, ...(kern.eigenaarId ? { eigenaarId: kern.eigenaarId } : {}), geldigVan: kern.geldigVan || null, geldigTot: kern.geldigTot || null }, 'Kerngegevens bewaard.')) kernOpen.value = false }

// Extra velden
const veldenOpen = ref(false)
const velden = ref<Record<string, unknown>>({})
function startVelden() { velden.value = Object.fromEntries(p.value.velden.map((v: any) => [v.sleutel, v.waarde])); veldenOpen.value = true }
async function bewaarVelden() { if (await zet({ velden: velden.value }, 'Extra velden bewaard.')) veldenOpen.value = false }

// Blokken: één potlood tegelijk.
const open = ref<AccountplanSectie | null>(null)
const tekst = ref('')
function startBlok(s: AccountplanSectie) { open.value = s; tekst.value = p.value.secties[s] ?? '' }
async function bewaarBlok() { if (open.value && await zet({ secties: { [open.value]: tekst.value } }, 'Bewaard.')) open.value = null }

// Contactpersonen
const contactIds = computed({ get: () => (p.value?.beslissers ?? []).map((b: any) => b.id), set: (ids: string[]) => { zet({ contactIds: ids }, 'Contactpersonen bijgewerkt.') } })

// Actieplan
const nieuw = reactive({ titel: '', datum: '', contactId: '' })
const toevoegen = ref(false)
async function voegToe(invoer = nieuw) {
  toevoegen.value = true
  try {
    await $fetch(`/api/accountplannen/${id.value}/acties`, { method: 'POST', body: { titel: invoer.titel, datum: invoer.datum || null, contactId: invoer.contactId || null } })
    toast.toon('Actie toegevoegd. Hij staat als taak op het account.')
    if (invoer === nieuw) Object.assign(nieuw, { titel: '', datum: '', contactId: '' })
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { toevoegen.value = false }
}
async function neemActiesOver(lijst: { titel: string; datum: string }[]) { for (const a of lijst) await voegToe({ titel: a.titel, datum: a.datum, contactId: '' }) }
async function zetActie(a: any, klaar: boolean) {
  try { await $fetch(`/api/accountplannen/${id.value}/acties/${a.id}`, { method: 'PUT', body: { klaar } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout'); await refresh() }
}
const weg = ref<any>(null)
async function haalWeg() {
  const a = weg.value; weg.value = null
  try { await $fetch(`/api/accountplannen/${id.value}/acties/${a.id}`, { method: 'DELETE' }); toast.toon('Actie uit het plan gehaald; de taak is geannuleerd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Notities
const notitie = ref('')
async function bewaarNotitie() {
  try { await $fetch(`/api/accountplannen/${id.value}/notities`, { method: 'POST', body: { tekst: notitie.value } }); notitie.value = ''; toast.toon('Notitie bewaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijderNotitie(n: any) {
  try { await $fetch(`/api/accountplannen/${id.value}/notities/${n.id}`, { method: 'DELETE' }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Taken en afspraken van het account
const taak = ref<string | null>(null)
const afspraak = ref<string | null>(null)
const nieuweTaak = ref(false)
const nieuweAfspraak = ref(false)

// Afronden en verwijderen
const vraagAfronden = ref<string | null>(null)
function wisselStatus() {
  if (p.value.status === 'afgerond') return zet({ status: 'actueel' }, 'Plan heropend.')
  const v = afrondVraag(p.value)
  if (v) vraagAfronden.value = v
  else zet({ status: 'afgerond' }, 'Plan afgerond.')
}
async function rondAf() { vraagAfronden.value = null; await zet({ status: 'afgerond' }, 'Plan afgerond.') }
const verwijderOpen = ref(false)
async function verwijder() {
  verwijderOpen.value = false
  try { await $fetch(`/api/accountplannen/${id.value}`, { method: 'DELETE' }); toast.toon('Accountplan verwijderd. De acties staan nog als taak op het account.'); await navigateTo('/accountplannen') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function naarActie() { if (tab.value !== 'plan') kiesTab('plan'); nextTick(() => document.getElementById('actieplan')?.scrollIntoView({ behavior: 'smooth' })) }
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.accountplannen" />
    <section v-else-if="error || !p" class="section">
      <div class="container container--smal">
        <span class="kicker kicker--streep">Onbekend accountplan</span>
        <h1 class="title title--groot">Dit accountplan bestaat niet (meer).</h1>
        <p class="subtitle">Misschien is het verwijderd.</p>
        <NuxtLink to="/accountplannen" class="dd-actie dd-actie--secundair mt-16">Terug naar alle accountplannen</NuxtLink>
      </div>
    </section>
    <template v-else>
      <header class="apd-kop">
        <div class="container">
          <div class="apd-kop-binnen">
            <div class="apd-kop-info">
              <NuxtLink to="/accountplannen" class="apd-kruimel" data-test="apd-terug"><Icoon naam="ArrowLeft" :grootte="12" /> Alle accountplannen</NuxtLink>
              <p class="apd-eyebrow">
                <Label soort="plan" :waarde="p.weergave" :tekst="WEERGAVE_LABEL[p.weergave as 'actueel']" data-test="apd-status" />
                <Label v-if="p.account" soort="account" :waarde="p.account.soort === 'klant' ? 'klant' : 'prospect'" />
                <NuxtLink v-if="p.account" :to="`/accounts/${p.account.id}`" class="apd-account" data-test="apd-account">{{ p.account.naam }}</NuxtLink>
                <span class="tnum">{{ metHoofdletter(geldigheidLabel(p)) }}</span>
                <span>{{ p.eigenaar?.naam ?? 'Niet toegewezen' }}</span>
              </p>
              <h1 class="apd-titel" data-test="apd-titel">{{ p.titel }}</h1>
              <div class="apd-voortgang" data-test="apd-voortgang">
                <div class="apd-cijfers tnum"><span><strong>{{ p.voortgang.klaar }}</strong> van {{ p.voortgang.totaal }} acties klaar</span><span>{{ p.voortgang.percentage }}%</span></div>
                <div class="apd-balk" role="progressbar" :aria-valuenow="p.voortgang.percentage" aria-valuemin="0" aria-valuemax="100" aria-label="Voortgang van het actieplan"><div class="apd-vul" :style="{ width: `${p.voortgang.percentage}%` }" /></div>
              </div>
            </div>
            <div class="toolbar-buttons apd-knoppen" data-test="kop-knoppen">
              <KopIconen artikel="accountplannen" :ai="p.account ? { accountId: p.account.id, label: p.account.naam } : undefined" />
              <template v-if="kan">
                <button type="button" class="dd-actie dd-actie--primair" data-test="apd-naar-actie" @click="naarActie"><Icoon naam="Plus" class="dd-actie-icoon" />Actie</button>
                <button type="button" class="dd-actie dd-actie--secundair" data-test="apd-afronden" @click="wisselStatus">{{ p.status === 'afgerond' ? 'Heropenen' : 'Markeer als afgerond' }}</button>
                <button type="button" class="dd-actie dd-actie--gevaar" data-test="apd-verwijder" @click="verwijderOpen = true">Verwijderen</button>
              </template>
            </div>
          </div>
          <nav class="tabbalk tabbalk--schuif apd-tabs" aria-label="Tabbladen van het accountplan">
            <button v-for="t in TABS" :key="t.id" type="button" class="tab" :class="{ 'tab--actief': tab === t.id }" :aria-current="tab === t.id ? 'page' : undefined" :data-test="`apd-tab-${t.id}`" @click="kiesTab(t.id)">{{ t.label }}<span v-if="t.tel" class="tab-teller tnum">{{ t.tel }}</span></button>
          </nav>
        </div>
      </header>

      <section class="section section--laatste">
        <!-- Tab Plan -->
        <div v-if="tab === 'plan'" class="container apd-raster">
          <div class="apd-hoofd">
            <article v-for="(s, i) in ACCOUNTPLAN_SECTIES" :key="s.sleutel" class="kaart apd-blok" :data-test="`apd-blok-${s.sleutel}`">
              <header class="kaart-kop">
                <h2 class="kaart-titel"><span class="apd-nr tnum">{{ i + 1 }}</span>{{ s.titel }}</h2>
                <button v-if="kan && open !== s.sleutel" type="button" class="dd-act dd-act--icoon" :aria-label="`Bewerk ${s.titel}`" :title="`Bewerk ${s.titel}`" :data-test="`apd-bewerk-${s.sleutel}`" @click="startBlok(s.sleutel)"><Icoon naam="Pencil" :grootte="14" /></button>
              </header>
              <form v-if="open === s.sleutel" class="apd-editor" @submit.prevent="bewaarBlok">
                <textarea v-model="tekst" class="invoer apd-tekstvak" rows="7" :placeholder="s.uitleg" :aria-label="s.titel" :data-test="`apd-tekst-${s.sleutel}`" />
                <AccountplanVoorzet :doel="s.sleutel" :plan-id="p.id" :concept="{ [s.sleutel]: tekst }" :heeft-tekst="!!tekst.trim()" @tekst="(t) => (tekst = t)" />
                <div class="dd-acties"><button type="submit" class="dd-act dd-act--geel" :data-test="`apd-bewaar-${s.sleutel}`">Opslaan</button><button type="button" class="dd-act" @click="open = null">Annuleren</button><span class="meta">Leeg opslaan wist dit blok.</span></div>
              </form>
              <template v-else>
                <p v-if="p.secties[s.sleutel]" class="apd-tekst">{{ p.secties[s.sleutel] }}</p>
                <p v-else class="apd-uitleg">{{ s.uitleg }}</p>
              </template>
            </article>

            <article id="actieplan" class="kaart apd-blok apd-actieplan" data-test="apd-actieplan">
              <header class="kaart-kop"><h2 class="kaart-titel"><span class="apd-nr tnum">7</span>Actieplan</h2><span class="apd-teller tnum">{{ p.voortgang.klaar }}/{{ p.voortgang.totaal }}</span></header>
              <p class="apd-uitleg">{{ ACTIEPLAN_UITLEG }}</p>
              <ul v-if="p.acties.length" class="apd-acties" role="list">
                <li v-for="a in p.acties" :key="a.id" class="apd-actie" :data-test="`apd-actie-${a.id}`">
                  <label class="apd-vink"><input type="checkbox" :checked="a.klaar" :disabled="!kan" :aria-label="`Markeer ${a.titel} als klaar`" data-test="apd-vink" @change="zetActie(a, ($event.target as HTMLInputElement).checked)"></label>
                  <span class="apd-actie-tekst">
                    <button type="button" class="apd-actie-titel apd-linkknop" :class="{ 'apd-actie-titel--klaar': a.klaar }" :title="`Open taak ${a.titel}`" @click="taak = a.id">{{ a.titel }}</button>
                    <span class="apd-actie-meta tnum"><span :class="{ 'apd-telaat': telaat(a) }">{{ dag(a.dueDate) }}</span><template v-if="a.contactNaam"> · <NuxtLink :to="`/contacten/${a.contactId}`" class="apd-link">{{ a.contactNaam }}</NuxtLink></template></span>
                  </span>
                  <button v-if="kan" type="button" class="dd-act dd-act--icoon apd-weg" :aria-label="`Verwijder actie ${a.titel}`" title="Verwijder actie" @click="weg = a"><Icoon naam="Trash2" :grootte="14" /></button>
                </li>
              </ul>
              <p v-else class="apd-uitleg apd-leeg">{{ ACTIEPLAN_LEEG }}</p>
              <form v-if="kan" class="apd-nieuw" data-test="apd-actie-nieuw" @submit.prevent="voegToe()">
                <label class="veld apd-nieuw-titel"><span class="veld-label">Nieuwe actie</span><input v-model="nieuw.titel" class="invoer" maxlength="200" placeholder="Begin met een werkwoord, bijvoorbeeld Plan het jaargesprek" data-test="apd-actie-titel"></label>
                <label class="veld"><span class="veld-label">Datum</span><input v-model="nieuw.datum" type="date" class="invoer tnum" data-test="apd-actie-datum"></label>
                <label class="veld"><span class="veld-label">Contactpersoon</span>
                  <select v-model="nieuw.contactId" class="invoer" data-test="apd-actie-contact"><option value="">Geen</option><option v-for="c in p.contacten.filter((x: any) => !x.vertrokken)" :key="c.id" :value="c.id">{{ c.naam }}{{ c.functie ? ` · ${c.functie}` : '' }}</option></select>
                </label>
                <button type="submit" class="dd-act dd-act--geel apd-nieuw-knop" :disabled="toevoegen || nieuw.titel.trim().length < 3" data-test="apd-actie-toevoegen"><Icoon naam="Plus" :grootte="14" />Toevoegen</button>
              </form>
              <AccountplanVoorzet v-if="kan" doel="actieplan" :plan-id="p.id" @acties="neemActiesOver" />
            </article>
          </div>

          <aside class="apd-zij">
            <article class="kaart apd-blok" data-test="apd-kern">
              <header class="kaart-kop"><h2 class="kaart-titel">Kerngegevens</h2>
                <button v-if="kan && !kernOpen" type="button" class="dd-act dd-act--icoon" aria-label="Bewerk kerngegevens" title="Bewerk kerngegevens" data-test="apd-bewerk-kern" @click="startKern"><Icoon naam="Pencil" :grootte="14" /></button>
              </header>
              <form v-if="kernOpen" class="apd-editor" @submit.prevent="bewaarKern">
                <label class="veld"><span class="veld-label">Titel</span><input v-model="kern.titel" class="invoer" maxlength="160" required data-test="apd-kern-titel"></label>
                <label v-if="p.eigenaren.length > 1" class="veld"><span class="veld-label">Eigenaar</span><select v-model="kern.eigenaarId" class="invoer" data-test="apd-kern-eigenaar"><option v-for="e in p.eigenaren" :key="e.id" :value="e.id">{{ e.naam }}</option></select></label>
                <label class="veld"><span class="veld-label">Geldig van</span><input v-model="kern.geldigVan" type="date" class="invoer tnum" data-test="apd-kern-van"></label>
                <label class="veld"><span class="veld-label">Geldig tot</span><input v-model="kern.geldigTot" type="date" class="invoer tnum" data-test="apd-kern-tot"></label>
                <div class="dd-acties"><button type="submit" class="dd-act dd-act--geel" data-test="apd-kern-bewaar">Opslaan</button><button type="button" class="dd-act" @click="kernOpen = false">Annuleren</button></div>
              </form>
              <dl v-else class="defs apd-defs">
                <div class="def-rij"><dt>Prospect</dt><dd><NuxtLink v-if="p.account" :to="`/accounts/${p.account.id}`" class="apd-link">{{ p.account.naam }}</NuxtLink></dd></div>
                <div class="def-rij"><dt>Eigenaar</dt><dd data-test="apd-eigenaar">{{ p.eigenaar?.naam ?? 'Niet toegewezen' }}</dd></div>
                <div class="def-rij"><dt>Geldigheid</dt><dd class="tnum">{{ metHoofdletter(geldigheidLabel(p)) }}</dd></div>
                <div class="def-rij"><dt>Status</dt><dd>{{ WEERGAVE_LABEL[p.weergave as 'actueel'] }}</dd></div>
                <div class="def-rij"><dt>Actieplan</dt><dd class="tnum">{{ p.voortgang.klaar }} van {{ p.voortgang.totaal }} klaar</dd></div>
              </dl>
            </article>

            <article class="kaart apd-blok" data-test="apd-beslissers">
              <header class="kaart-kop"><h2 class="kaart-titel">Contactpersonen</h2></header>
              <AccountplanContacten v-model="contactIds" :contacten="p.contacten" :bewerk="kan" prefix="apd" />
            </article>

            <article v-if="p.velden.length" class="kaart apd-blok" data-test="apd-velden">
              <header class="kaart-kop"><h2 class="kaart-titel">Extra velden</h2>
                <button v-if="kan && !veldenOpen" type="button" class="dd-act dd-act--icoon" aria-label="Bewerk extra velden" title="Bewerk extra velden" data-test="apd-bewerk-velden" @click="startVelden"><Icoon naam="Pencil" :grootte="14" /></button>
              </header>
              <form v-if="veldenOpen" class="apd-editor" @submit.prevent="bewaarVelden">
                <AccountplanVelden v-model="velden" :velden="p.velden" bewerk prefix="apd" />
                <div class="dd-acties"><button type="submit" class="dd-act dd-act--geel" data-test="apd-velden-bewaar">Opslaan</button><button type="button" class="dd-act" @click="veldenOpen = false">Annuleren</button></div>
              </form>
              <AccountplanVelden v-else :velden="p.velden" prefix="apd" />
            </article>
          </aside>
        </div>

        <!-- Tab Contactpersonen -->
        <div v-else-if="tab === 'contacten'" class="container container--smal">
          <article class="kaart apd-blok" data-test="apd-tab-contacten-inhoud">
            <header class="kaart-kop"><h2 class="kaart-titel">Wie beslist er mee?</h2></header>
            <p class="apd-uitleg">Zet hier iedereen die aan tafel zit: de beslisser, wie hem adviseert en wie ermee moet werken. Zo zie je in één oogopslag of je de hele beslissingsketen kent. De rol is dezelfde als op de contactkaart en de invloedskaart.</p>
            <div class="mt-16"><AccountplanContacten v-model="contactIds" :contacten="p.contacten" :bewerk="kan" :rol-kiezen="kan" prefix="apdc" leeg-tekst="Nog geen contactpersonen aan dit plan gekoppeld." @rol="refresh()" /></div>
            <p v-if="kan && !p.contacten.some((c: any) => !c.vertrokken && !p.beslissers.some((b: any) => b.id === c.id))" class="meta mt-8">Alle contactpersonen van deze prospect staan al bij het plan. Nieuwe mensen voeg je toe op de accountkaart.</p>
          </article>
        </div>

        <!-- Tab Taken -->
        <div v-else-if="tab === 'taken'" class="container container--smal">
          <article class="kaart apd-blok" data-test="apd-tab-taken-inhoud">
            <header class="kaart-kop"><h2 class="kaart-titel">Open taken bij deze prospect</h2><button type="button" class="dd-actie dd-actie--primair" data-test="apd-nieuwe-taak" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button></header>
            <p class="apd-uitleg">Taken buiten het actieplan. De acties van het plan staan op het tabblad Plan.</p>
            <ul v-if="p.taken.length" class="apd-rijen" role="list">
              <li v-for="t in p.taken" :key="t.id"><button type="button" class="item-rij" :data-test="`apd-taak-${t.id}`" @click="taak = t.id">
                <span class="item-tijd" :class="{ 'item-tijd--rood': t.dueDate && nlMoment(new Date(t.dueDate)).datum < vandaag }">{{ t.dueDate ? dag(t.dueDate) : '' }}</span>
                <span class="item-icoon" :class="{ 'item-icoon--call': t.soort === 'bellen', 'item-icoon--visit': t.soort === 'bezoek', 'item-icoon--email': t.soort === 'mailen' }"><Icoon :naam="t.soort === 'bellen' ? 'Phone' : t.soort === 'mailen' ? 'Mail' : 'ClipboardCheck'" :grootte="16" /></span>
                <span class="item-body"><span class="item-naam">{{ t.titel }}</span><span class="item-meta">{{ [t.contactNaam, t.eigenaar].filter(Boolean).join(' · ') }}</span></span>
              </button></li>
            </ul>
            <p v-else class="apd-uitleg apd-leeg">Geen open taken bij deze prospect.</p>
          </article>
        </div>

        <!-- Tab Afspraken -->
        <div v-else-if="tab === 'afspraken'" class="container container--smal">
          <article class="kaart apd-blok" data-test="apd-tab-afspraken-inhoud">
            <header class="kaart-kop"><h2 class="kaart-titel">Afspraken bij deze prospect</h2><button type="button" class="dd-actie dd-actie--zwart" data-test="apd-nieuwe-afspraak" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button></header>
            <ul v-if="p.afspraken.length" class="apd-rijen" role="list">
              <li v-for="a in p.afspraken" :key="a.id"><button type="button" class="item-rij" :data-test="`apd-afspraak-${a.id}`" @click="afspraak = a.id">
                <span class="item-tijd">{{ dagTijd(a.start) }}</span>
                <span class="item-icoon item-icoon--visit"><Icoon naam="Calendar" :grootte="16" /></span>
                <span class="item-body"><span class="item-naam">{{ a.titel }}</span><span class="item-meta">{{ [a.contactNaam, a.locatie, a.status].filter(Boolean).join(' · ') }}</span></span>
              </button></li>
            </ul>
            <p v-else class="apd-uitleg apd-leeg">Nog geen afspraken met deze prospect.</p>
          </article>
        </div>

        <!-- Tab Notities -->
        <div v-else class="container container--smal">
          <article class="kaart apd-blok" data-test="apd-tab-notities-inhoud">
            <header class="kaart-kop"><h2 class="kaart-titel">Notities ({{ p.notities.length }})</h2></header>
            <form v-if="kan" class="apd-editor" @submit.prevent="bewaarNotitie">
              <textarea v-model="notitie" class="invoer apd-tekstvak apd-notitievak" rows="3" placeholder="Wat wil je onthouden over dit plan?" aria-label="Nieuwe notitie" data-test="apd-notitie-tekst" />
              <div class="dd-acties"><button type="submit" class="dd-act dd-act--geel" :disabled="!notitie.trim()" data-test="apd-notitie-bewaar"><Icoon naam="Plus" :grootte="14" />Notitie</button></div>
            </form>
            <ul v-if="p.notities.length" class="apd-notities" role="list">
              <li v-for="n in p.notities" :key="n.id" class="apd-notitie" :data-test="`apd-notitie-${n.id}`">
                <div class="apd-notitie-kop"><span class="tnum">{{ dagTijd(n.op) }}</span><span v-if="n.doorNaam"> · {{ n.doorNaam }}</span>
                  <button v-if="n.kanWeg" type="button" class="dd-act dd-act--icoon apd-weg" aria-label="Verwijder notitie" title="Verwijder notitie" @click="verwijderNotitie(n)"><Icoon naam="Trash2" :grootte="14" /></button>
                </div>
                <p class="apd-tekst">{{ n.tekst }}</p>
              </li>
            </ul>
            <p v-else class="apd-uitleg apd-leeg">Nog geen notities. Schrijf op wat je onderweg leert: dat maakt de evaluatie straks makkelijker.</p>
          </article>
        </div>
      </section>

      <TaakFlyout :open="!!taak" :taak-id="taak" @sluit="taak = null" @klaar="taak = null; refresh()" @gewijzigd="refresh()" />
      <AfspraakFlyout :open="!!afspraak" :afspraak-id="afspraak" @sluit="afspraak = null" @gewijzigd="refresh()" />
      <NieuweTaakFlyout v-if="p.account" :open="nieuweTaak" :account="{ id: p.account.id, naam: p.account.naam }" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; refresh()" />
      <PlanAfspraakFlyout v-if="p.account" :open="nieuweAfspraak" :account="{ id: p.account.id, naam: p.account.naam }" @sluit="nieuweAfspraak = false" @gepland="nieuweAfspraak = false; refresh()" />
      <BevestigVenster :open="verwijderOpen" titel="Accountplan verwijderen?" :tekst="`${p.titel} verdwijnt, met alle blokken en notities. De acties blijven als taak op het account staan.`" bevestig="Verwijderen" gevaar @bevestigd="verwijder" @geannuleerd="verwijderOpen = false" />
      <BevestigVenster :open="!!vraagAfronden" titel="Toch afronden?" :tekst="vraagAfronden ?? ''" bevestig="Afronden" @bevestigd="rondAf" @geannuleerd="vraagAfronden = null" />
      <BevestigVenster :open="!!weg" titel="Actie uit het plan halen?" :tekst="`${weg?.titel ?? ''}: de taak wordt geannuleerd.`" bevestig="Uit het plan halen" gevaar @bevestigd="haalWeg" @geannuleerd="weg = null" />
    </template>
  </div>
</template>

<style scoped>
.apd-kop { padding: 28px 0 0; background: var(--wit); border-bottom: 1px solid var(--border); }
.apd-kop-binnen { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
.apd-kop-info { flex: 1 1 420px; min-width: 0; }
.apd-kruimel { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; font-size: 12px; font-weight: 600; color: var(--muted); text-decoration: none; }
.apd-kruimel:hover { color: var(--ink); }
.apd-eyebrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin: 4px 0 0; font-size: 13px; color: var(--ink-soft); }
.apd-account { font-weight: 700; color: var(--ink); }
.apd-titel { margin: 10px 0 0; font-family: var(--font-serif); font-size: clamp(26px, 3.5vw, 38px); line-height: 1.15; overflow-wrap: anywhere; }
.apd-voortgang { max-width: 520px; margin-top: 14px; }
.apd-cijfers { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink-soft); }
.apd-balk { margin-top: 6px; height: 6px; background: var(--surface); }
.apd-vul { height: 100%; background: var(--green); transition: width var(--transition-base); }
.apd-knoppen { justify-content: flex-end; }
.apd-tabs { margin-top: 20px; border-bottom: 0; }
/* Vanaf 720 px twee kolommen: de knoppen rechts op de hoogte van de titel (onder kruimel en
   eyebrow); de info loopt nooit onder de knoppen door. */
@media (min-width: 720px) {
  .apd-kop-binnen { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; column-gap: var(--pagina-marge); }
  .apd-knoppen { max-width: min(620px, 52vw); margin-top: 68px; }
}
.apd-raster { display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); align-items: start; }
@media (min-width: 1024px) { .apd-raster { grid-template-columns: minmax(0, 1fr) 340px; } }
.apd-hoofd, .apd-zij { display: flex; flex-direction: column; gap: var(--kaart-gap); min-width: 0; }
.apd-nr { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-right: 8px; background: var(--ink); color: var(--yellow); font-family: var(--font-sans, inherit); font-size: 11px; font-weight: 800; vertical-align: 3px; }
.apd-tekst { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.apd-uitleg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.apd-editor { display: flex; flex-direction: column; gap: 10px; }
.apd-tekstvak { width: 100%; resize: vertical; min-height: 140px; }
.apd-notitievak { min-height: 80px; }
.apd-teller { font-size: 12px; font-weight: 700; color: var(--muted); }
.apd-acties, .apd-rijen, .apd-notities { list-style: none; margin: 10px 0 0; padding: 0; }
.apd-actie { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.apd-actie:last-child { border-bottom: 0; }
.apd-vink { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; min-height: 36px; cursor: pointer; }
.apd-vink input { width: 18px; height: 18px; accent-color: var(--ink); }
.apd-actie-tekst { display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0; }
.apd-actie-titel { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.apd-linkknop { padding: 0; background: none; border: 0; color: var(--ink); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.apd-linkknop:hover { text-decoration: underline; }
.apd-actie-titel--klaar { text-decoration: line-through; color: var(--muted); }
.apd-actie-meta { font-size: 12px; color: var(--muted); }
.apd-telaat { color: var(--red); font-weight: 700; }
.apd-link { color: var(--ink); font-weight: 600; }
.apd-leeg { margin-top: 10px; }
.apd-nieuw { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.apd-nieuw-titel { grid-column: 1 / -1; }
.apd-nieuw-knop { min-height: 40px; }
.apd-defs { margin: 0; }
.apd-notitie { padding: 10px 0; border-bottom: 1px solid var(--border); }
.apd-notitie:last-child { border-bottom: 0; }
.apd-notitie-kop { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 12px; color: var(--muted); }
.apd-notitie-kop .apd-weg { margin-left: auto; }
@media (max-width: 719px) {
  .apd-kop { padding: 20px 0 0; }
  .apd-nieuw { grid-template-columns: 1fr; }
  .apd-vink, .apd-weg, .apd-kruimel, .apd-nieuw-knop { min-width: var(--touch-target-min); min-height: var(--touch-target-min); }
  .apd-linkknop { min-height: var(--touch-target-min); }
  .apd-knoppen { width: 100%; justify-content: flex-start; }
  .apd-tabs .tab { min-height: var(--touch-target-min); }
}
</style>
