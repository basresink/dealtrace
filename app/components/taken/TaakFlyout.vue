<script setup lang="ts">
// Taakvenster (F06) in de opzet van DealDrive (TaakFlyout op /taken): kicker met prioriteitsstip,
// prioriteit en status, de gegevens (type, vervaldatum, toegewezen aan, klant en contactpersoon met links,
// herinnering, herhaling, beschrijving), de aanleiding met "Waarom krijg ik dit?", Volgende stap, belscript,
// agent, Briefing en Pitstop, concept, bij een beltaak het blok Transcript en gespreksverslag (gedeeld met het
// afspraakvenster), klant in context, het uitkomstraster uit 7.3 en de voet. Bewerken
// vervangt de inhoud door het formulier van Nieuwe taak. Offline gaat afronden via de wachtrij.
// De voet is in elk taakvenster gelijk (opzet van DealDrive): links "Afronden" (zwart met gele tekst), rechts
// icoonknoppen van 44 px: Vraag AI (de assistent met de taak als context), Uitstellen (keuzemenu met een
// werkdag, een week, Plan een afspraak en Annuleer met reden), Bewerken, Verwijderen (met bevestiging) en
// Volgende (de volgende taak uit `lijst`; zonder lijst de volgende van je eigen open taken).
import { NEE_REDENEN } from '~~/shared/nbStatus'
import { UITKOMST_CODES, UITKOMST_LABEL } from '~~/shared/hercontact'
import { nlMoment, nlTijdstip } from '~~/shared/datum'
import { CONTACT_ACTIES, HERHALING_LABEL, HERINNERING_KANAAL, HERKOMST_LABEL, PRIORITEITEN, PRIO_LABEL, PRIO_STIP, STATUS_LABEL, TAAK_TYPES, isAchterstallig, vervalLabel, volgendeStap } from '~~/shared/taken'
import { fasePil, telLink } from '~/utils/accountWeergave'
import { agentDef } from '~~/shared/mandaat'
import type { Contact, Klant } from './KlantContactKiezer.vue'
const props = defineProps<{ open: boolean; taakId: string | null; basis?: any; volgende?: boolean; teamleden?: { id: string; naam: string }[]; lijst?: string[] }>()
const emit = defineEmits<{ sluit: []; klaar: [volgende: boolean, id: string]; gewijzigd: [] }>()
const { functie, me } = useMe()
const { openen: openAi } = useAssistent()
const EXECUTOR_LABEL: Record<string, string> = { 'concept-klaar': 'concept wacht op je goedkeuring', goedgekeurd: 'goedgekeurd, wordt verstuurd', uitgevoerd: 'uitgevoerd', tegengehouden: 'tegengehouden door de Bewaker' }
async function keurGoed() {
  try { const r: any = await $fetch(`/api/tasks/${t.value.id}/goedkeuren`, { method: 'POST', body: {} }); toast.toon(r.executorStatus === 'uitgevoerd' ? 'Goedgekeurd en verstuurd.' : `Goedgekeurd. ${r.reden ?? 'Hij gaat later de deur uit.'}`); emit('gewijzigd'); t.value = await $fetch(`/api/tasks/${t.value.id}`) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const toast = useToast()
const { rondAf } = useAfronden()
const t = ref<any>(null)
const laden = ref(false)
const uitkomst = ref<string>('')
const laterOp = ref('')
const reden = ref('')
const toelichting = ref('')
// F7: na Voicemail of Gesproken, later kan een opvolgreeks starten (ReeksNaUitkomst).
const reeksSjabloon = ref('')
const reeksKan = computed(() => !!t.value?.account && (uitkomst.value === 'voicemail' || uitkomst.value === 'later') && !!functie('prospects.volgen')?.beschikbaar)
const bewerken = ref(false)
const belpaneel = ref<any>(null)
async function laadBelpaneel() { if (!belpaneel.value && t.value) belpaneel.value = await $fetch(`/api/bellen/taak/${t.value.id}`).catch(() => ({ item: null })) }
const annuleren = ref(false)
const annuleerReden = ref('')
const bezig = ref(false)
const gevorderd = computed(() => !!functie('taken.herhaling')?.beschikbaar)
// Beltaak: het gespreksverslag (blok Transcript en gespreksverslag, alleen bij het type Bellen).
const belVerslag = ref('')
const isBeltaak = computed(() => t.value?.actionType === 'bellen')
async function herlaadTaak() { if (t.value) t.value = await $fetch(`/api/tasks/${t.value.id}`) }
const uitstelOpen = ref(false)
const verwijderVraag = ref(false)
// De taak in beeld: begint bij taakId van de ouder; Volgende schuift door zonder dat de ouder iets hoeft.
const huidig = ref<string | null>(props.taakId)
watch(() => [props.open, props.taakId], () => { huidig.value = props.taakId }, { flush: 'sync' })
watch(() => [props.open, huidig.value], async ([o]) => {
  if (!o || !huidig.value) return
  const id = huidig.value
  uitkomst.value = ''; laterOp.value = ''; reden.value = ''; toelichting.value = ''; reeksSjabloon.value = ''; bewerken.value = false; annuleren.value = false; belpaneel.value = null; uitstelOpen.value = false; verwijderVraag.value = false
  laden.value = true
  let taak: any = null
  try { taak = await $fetch(`/api/tasks/${id}`) } catch { taak = props.basis && props.basis.id === id ? { ...props.basis, kan: { afronden: true }, account: props.basis.account ?? null } : null }
  if (id !== huidig.value) return
  t.value = taak; laden.value = false
  belVerslag.value = t.value?.verslag?.tekst ?? ''
}, { immediate: true })
const contact = computed(() => t.value && CONTACT_ACTIES.has(t.value.actionType))
const ongeldig = computed(() => (contact.value && !uitkomst.value) || (uitkomst.value === 'later' && !laterOp.value) || (uitkomst.value === 'geen_interesse' && (!reden.value || (reden.value === 'Anders' && !toelichting.value.trim()))))
const mobiel = () => import.meta.client && window.matchMedia('(max-width: 767px)').matches
async function doeAfronden(volgende: boolean) {
  if (ongeldig.value || !t.value) return
  bezig.value = true
  const body = { uitkomst: uitkomst.value || (contact.value ? null : 'gedaan'), laterOp: laterOp.value || null, reden: reden.value || null, toelichting: toelichting.value || null }
  const id = t.value.id
  const reeks = reeksKan.value && reeksSjabloon.value ? { accountId: t.value.account.id as string, sjabloonId: reeksSjabloon.value, contactId: (t.value.contact?.id ?? null) as string | null, aanleiding: UITKOMST_LABEL[uitkomst.value as keyof typeof UITKOMST_LABEL] ?? null } : null
  // Een nog niet bewaard belverslag gaat eerst mee, zodat het bij de belactiviteit staat.
  if (isBeltaak.value && belVerslag.value.trim() !== String(t.value.verslag?.tekst ?? '').trim() && (!import.meta.client || navigator.onLine)) await $fetch(`/api/tasks/${id}/verslag`, { method: 'PUT', body: { tekst: belVerslag.value } }).catch(() => null)
  emit('sluit')
  const ok = await rondAf(id, body, { mobiel: mobiel() })
  bezig.value = false
  if (ok && reeks) {
    try { const r = await $fetch<any>(`/api/volgen/${reeks.accountId}/reeks`, { method: 'POST', body: { sjabloonId: reeks.sjabloonId, contactId: reeks.contactId, aanleiding: reeks.aanleiding } }); toast.toon(`Opvolgreeks ${r?.naam ?? ''} gestart.`) } catch (e) { toast.toon(foutTekst(e), 'fout') }
  }
  if (ok) emit('klaar', volgende, id)
}
async function stelUit(periode: 'werkdag' | 'week') {
  uitstelOpen.value = false
  try { await $fetch(`/api/tasks/${t.value.id}/uitstellen`, { method: 'POST', body: { periode } }); toast.toon(periode === 'week' ? 'Uitgesteld met een week.' : 'Uitgesteld met een werkdag.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Gegevens in de leesstand.
const nu = new Date()
const typeVan = (id: string) => TAAK_TYPES.find((x) => x.id === id) ?? TAAK_TYPES[0]!
const overTijd = computed(() => !!t.value?.dueDate && t.value.status !== 'klaar' && isAchterstallig(t.value, nu))
const vervalDatum = computed(() => (t.value?.dueDate ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(t.value.dueDate)) : null))
const herinneringTekst = computed(() => {
  const h = t.value?.herinnering
  if (!h) return null
  const m = h.minuten
  const duur = m >= 1440 ? `${m / 1440} ${m === 1440 ? 'dag' : 'dagen'}` : m >= 60 ? `${m / 60} uur` : `${m} minuten`
  return `${duur} vooraf · ${(HERINNERING_KANAAL[h.kanaal] ?? 'In de app').toLowerCase()}`
})
const stap = computed(() => (t.value ? volgendeStap(t.value, nu) : ''))
const initialen = computed(() => (t.value?.account?.naam ?? '').split(/\s+/).filter((w: string) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w: string) => w[0]!.toUpperCase()).join(''))

// Bewerken: dezelfde velden als Nieuwe taak.
const bewerk = reactive({ title: '', priority: 'middel', datum: '', tijd: '', actionType: 'taak', ownerId: '', aanleiding: '', beschrijving: '', herinneren: false, herinneringMin: 30, herinneringKanaal: 'in-app' })
const bKlant = ref<Klant | null>(null)
const bContact = ref<Contact | null>(null)
function startBewerken() {
  const m = t.value.dueDate ? nlMoment(new Date(t.value.dueDate)) : null
  Object.assign(bewerk, {
    title: t.value.title, priority: t.value.priority, datum: m?.datum ?? '', tijd: m ? `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` : '',
    actionType: t.value.actionType, ownerId: t.value.ownerId ?? '', aanleiding: t.value.aanleiding ?? '', beschrijving: t.value.beschrijving ?? '',
    herinneren: !!t.value.herinnering, herinneringMin: t.value.herinnering?.minuten ?? 30, herinneringKanaal: t.value.herinnering?.kanaal ?? 'in-app',
  })
  bKlant.value = t.value.account ? { id: t.value.account.id, naam: t.value.account.naam, plaats: t.value.account.plaats } : null
  bContact.value = t.value.contact ? { id: t.value.contact.id, naam: t.value.contact.naam, functie: t.value.contact.functie, accountId: t.value.account?.id ?? null } : null
  bewerken.value = true
}
const kanBewaren = computed(() => bewerk.title.trim().length >= 3 && !bezig.value)
async function bewaar() {
  if (!kanBewaren.value) return
  bezig.value = true
  try {
    await $fetch(`/api/tasks/${t.value.id}`, {
      method: 'PUT',
      body: {
        title: bewerk.title, actionType: bewerk.actionType, accountId: bKlant.value?.id ?? null, contactId: bContact.value?.id ?? null,
        dueDate: bewerk.datum ? nlTijdstip(bewerk.datum, bewerk.tijd ? Number(bewerk.tijd.slice(0, 2)) : 9, bewerk.tijd ? Number(bewerk.tijd.slice(3, 5)) : 0).toISOString() : undefined,
        aanleiding: bewerk.aanleiding, beschrijving: bewerk.beschrijving,
        ...(gevorderd.value ? { priority: bewerk.priority, ownerId: bewerk.ownerId || undefined, herinnering: bewerk.herinneren ? { minuten: bewerk.herinneringMin, kanaal: bewerk.herinneringKanaal } : null } : {}),
      },
    })
    toast.toon('Taak bijgewerkt.'); emit('gewijzigd'); t.value = await $fetch(`/api/tasks/${t.value.id}`); bewerken.value = false
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function doeAnnuleren() {
  try { await $fetch(`/api/tasks/${t.value.id}/annuleren`, { method: 'POST', body: { reden: annuleerReden.value } }); toast.toon('Taak geannuleerd.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijder() {
  verwijderVraag.value = false
  try { await $fetch(`/api/tasks/${t.value.id}`, { method: 'DELETE' }); toast.toon('Taak verwijderd.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Voet: Vraag AI, het uitstelmenu, verwijderen met bevestiging en Volgende.
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
function vraagAi() {
  if (!t.value) return
  const x = t.value
  const wanneer = vervalDatum.value ? `, vervalt ${vervalDatum.value}` : ''
  const bij = x.account ? ` bij ${x.account.naam}` : ''
  const met = x.contact ? ` met ${x.contact.naam}` : ''
  openAi({ accountId: x.account?.id ?? null, label: x.account?.naam ?? `taak ${x.title}`, vraag: `Help me met mijn taak "${x.title}" (${typeVan(x.actionType).label.toLowerCase()}${bij}${met}${wanneer})${x.aanleiding ? `. Aanleiding: ${x.aanleiding}` : ''}. Wat is de beste aanpak?` })
  emit('sluit')
}
const uitstelHouder = ref<HTMLElement | null>(null)
function kiesAnnuleren() { uitstelOpen.value = false; annuleren.value = true; nextTick(() => document.querySelector<HTMLElement>('[data-test="annuleer-reden"]')?.focus()) }
function kiesAfspraak() { uitstelOpen.value = false; planOpen.value = true }
function buitenUitstel(e: MouseEvent) { if (uitstelOpen.value && uitstelHouder.value && !uitstelHouder.value.contains(e.target as Node)) uitstelOpen.value = false }
const eigenLijst = ref<string[] | null>(null)
const volgendeId = computed(() => {
  if (!props.lijst) return null
  const i = props.lijst.indexOf(huidig.value ?? '')
  return (i >= 0 ? props.lijst[i + 1] : props.lijst.find((x) => x !== huidig.value)) ?? null
})
const geenVolgende = computed(() => !!props.lijst && !volgendeId.value)
async function naarVolgende() {
  let v = volgendeId.value
  if (!props.lijst) {
    if (!eigenLijst.value) eigenLijst.value = await $fetch<any>('/api/tasks', { query: { eigenaar: 'mij' } }).then((r) => (r.groepen ?? []).flatMap((g: any) => g.taken.map((x: any) => x.id as string))).catch(() => [])
    const l = eigenLijst.value ?? []
    const i = l.indexOf(huidig.value ?? '')
    v = (i >= 0 ? l[i + 1] : l.find((x) => x !== huidig.value)) ?? null
  }
  if (v) huidig.value = v
  else toast.toon('Er is geen volgende taak.')
}
watch(() => props.open, (o) => { if (!o) eigenLijst.value = null })
// P13: plannen vanuit de taak; de taak wordt aan de afspraak gekoppeld en sluit bij afronden (gat 32).
const planOpen = ref(false)
const kanPlannen = computed(() => !!functie('agenda.basis')?.beschikbaar && !!t.value?.account)
function gepland(id: string) { planOpen.value = false; emit('gewijzigd'); emit('sluit'); navigateTo(`/agenda?afspraak=${id}`) }
const morgen = computed(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10))
function toets(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open || planOpen.value || verwijderVraag.value) return
  if (uitstelOpen.value) { uitstelOpen.value = false; return }
  emit('sluit')
}
onMounted(() => { document.addEventListener('keydown', toets); document.addEventListener('click', buitenUitstel) })
onBeforeUnmount(() => { document.removeEventListener('keydown', toets); document.removeEventListener('click', buitenUitstel) })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="tf-titel" data-test="taak-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker" data-test="tf-kicker"><span v-if="t" class="prio-stip" :class="PRIO_STIP[t.priority]" aria-hidden="true" /> {{ t ? `${PRIO_LABEL[t.priority] ?? t.priority} · ${STATUS_LABEL[t.status] ?? t.status}` : 'Taak' }}</span>
            <h2 id="tf-titel" class="fo-titel">{{ t?.title ?? 'Laden…' }}</h2>
            <p v-if="t?.account" class="taak-meta"><NuxtLink :to="`/accounts/${t.account.id}`" class="tf-tik" @click="emit('sluit')">{{ t.account.naam }}</NuxtLink><template v-if="t.account.plaats"> · {{ t.account.plaats }}</template> <span v-if="t.account.fase" class="pil" :class="fasePil(t.account.fase.kleur)">{{ t.account.fase.label }}</span></p>
            <p v-if="t?.poging" class="taak-meta" data-test="pogingregel">poging {{ t.poging.n }} van {{ t.poging.van }}<template v-if="t.poging.kanaal"> · {{ t.poging.kanaal }}</template><template v-if="t.poging.vorige"> · vorige: {{ t.poging.vorige }}</template></p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')">×</button>
        </header>

        <!-- Bewerken: de velden van Nieuwe taak. -->
        <form v-if="t && bewerken" id="tf-bewerk" class="fo-body fo-body--formulier" data-test="tf-bewerken" @submit.prevent="bewaar">
          <KlantContactKiezer v-model:klant="bKlant" v-model:contact="bContact" prefix="tf" />
          <label class="veld"><span class="veld-label">Titel <span class="veld-verplicht">*</span></span><input v-model="bewerk.title" class="invoer" minlength="3" required data-test="tf-titel"></label>
          <fieldset v-if="gevorderd" class="veld">
            <legend class="veld-label tf-legend">Prioriteit</legend>
            <div class="keuzeraster keuzeraster--prio" role="group" aria-label="Prioriteit">
              <button v-for="p in PRIORITEITEN" :key="p" type="button" class="prio-knop" :class="{ 'prio-knop--aan': bewerk.priority === p }" :aria-pressed="bewerk.priority === p" :data-test="`tf-prio-${p}`" @click="bewerk.priority = p"><span class="prio-stip" :class="PRIO_STIP[p]" />{{ PRIO_LABEL[p] }}</button>
            </div>
          </fieldset>
          <div class="tf-rij">
            <label class="veld"><span class="veld-label">Vervaldatum</span><input v-model="bewerk.datum" type="date" class="invoer"></label>
            <label class="veld"><span class="veld-label">Tijd</span><input v-model="bewerk.tijd" type="time" class="invoer"></label>
          </div>
          <fieldset class="veld">
            <legend class="veld-label tf-legend">Type</legend>
            <div class="keuzeraster tf-typen" role="group" aria-label="Type">
              <button v-for="x in TAAK_TYPES" :key="x.id" type="button" class="keuzeraster-knop" :class="{ 'keuzeraster-knop--aan': bewerk.actionType === x.id }" :aria-pressed="bewerk.actionType === x.id" :data-test="`tf-type-${x.id}`" @click="bewerk.actionType = x.id"><Icoon :naam="x.icoon" :grootte="16" /><span>{{ x.label }}</span></button>
            </div>
          </fieldset>
          <label v-if="gevorderd && teamleden?.length" class="veld"><span class="veld-label">Toegewezen aan</span><select v-model="bewerk.ownerId" class="invoer"><option :value="me?.gebruiker.id ?? ''">Mij</option><option v-for="u in teamleden" :key="u.id" :value="u.id">{{ u.naam }}</option></select></label>
          <label class="veld"><span class="veld-label">Aanleiding</span><input v-model="bewerk.aanleiding" class="invoer" maxlength="500"></label>
          <fieldset v-if="gevorderd" class="veld veld-klap" :class="{ 'veld-klap--open': bewerk.herinneren }">
            <legend class="tf-legend"><label class="vink vink--kapitaal tf-toggle"><input v-model="bewerk.herinneren" type="checkbox"> Herinnering instellen</label></legend>
            <div v-if="bewerk.herinneren" class="tf-rij">
              <label class="veld"><span class="veld-uitleg">Voor de vervaldatum</span><select v-model.number="bewerk.herinneringMin" class="invoer"><option :value="5">5 minuten</option><option :value="15">15 minuten</option><option :value="30">30 minuten</option><option :value="60">1 uur</option><option :value="240">4 uur</option><option :value="1440">1 dag</option><option :value="2880">2 dagen</option></select></label>
              <label class="veld"><span class="veld-uitleg">Versturen via</span><select v-model="bewerk.herinneringKanaal" class="invoer"><option value="in-app">Melding in de app</option><option value="email">E-mail</option><option value="beide">Beide</option></select></label>
            </div>
          </fieldset>
          <label class="veld"><span class="veld-label">Beschrijving</span><textarea v-model="bewerk.beschrijving" class="invoer" rows="3" /></label>
        </form>

        <div v-else-if="t" class="fo-body fo-body--formulier">
          <dl class="defs tf-defs" data-test="tf-gegevens">
            <div class="def-rij"><dt>Type</dt><dd><span class="tf-type-pil"><Icoon :naam="typeVan(t.actionType).icoon" :grootte="14" />{{ typeVan(t.actionType).label }}</span></dd></div>
            <div class="def-rij"><dt>Vervaldatum</dt><dd :class="{ 'fo-over-tijd': overTijd }"><span class="tnum">{{ vervalDatum ?? 'geen' }}</span><span v-if="t.dueDate" class="tf-delta"> ({{ vervalLabel(t.dueDate, nu) }})</span></dd></div>
            <div v-if="t.eigenaar" class="def-rij"><dt>Toegewezen aan</dt><dd>{{ t.eigenaar.replace(/^Testgebruiker /, '') }}</dd></div>
            <div v-if="t.account" class="def-rij"><dt>Prospect</dt><dd><NuxtLink :to="`/accounts/${t.account.id}`" class="fo-link tf-tik" data-test="tf-account" @click="emit('sluit')">{{ t.account.naam }}</NuxtLink></dd></div>
            <div v-if="t.contact" class="def-rij"><dt>Contactpersoon</dt><dd><NuxtLink :to="`/contacten/${t.contact.id}`" class="fo-link tf-tik" data-test="tf-contact" @click="emit('sluit')">{{ t.contact.naam }}<template v-if="t.contact.functie"> · {{ t.contact.functie }}</template></NuxtLink></dd></div>
            <div v-if="herinneringTekst" class="def-rij"><dt>Herinnering</dt><dd>{{ herinneringTekst }}</dd></div>
            <div v-if="t.herhaling" class="def-rij"><dt>Herhaling</dt><dd>{{ HERHALING_LABEL[t.herhaling.soort] ?? t.herhaling.soort }} · {{ t.herhaling.teller }} van {{ t.herhaling.max }}</dd></div>
            <div v-if="t.beschrijving" class="def-rij"><dt>Beschrijving</dt><dd>{{ t.beschrijving }}</dd></div>
          </dl>
          <article v-if="t.aanleiding || t.waarom" class="fo-blok aanleiding-blok" data-test="aanleiding">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Aanleiding</h3><span class="pil pil--leeg">{{ HERKOMST_LABEL[t.herkomst] ?? 'Handmatig' }}</span></header>
            <p v-if="t.aanleiding">{{ t.aanleiding }}</p>
            <p v-if="t.waarom" class="mt-8" data-test="waarom"><strong>Waarom krijg ik dit?</strong> {{ t.waarom }}<template v-if="t.regel"> <NuxtLink v-if="functie('regels.lezen')?.beschikbaar" :to="`/instellingen/regels`" class="tekst-link">Bekijk de regel</NuxtLink></template></p>
          </article>
          <article v-if="t.status !== 'klaar'" class="fo-blok fo-blok--accent" data-test="tf-volgende-stap">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Volgende stap</h3></header>
            <p class="fo-tekst">{{ stap }}</p>
          </article>
          <details v-if="t.actionType === 'bellen' && functie('belscript.kiezen')?.beschikbaar" class="fo-blok" data-test="belpaneel" @toggle="laadBelpaneel">
            <summary class="fo-blok-titel">Belscript</summary>
            <BelScript v-if="belpaneel?.item" :scripts="belpaneel.scripts" :voorstel="belpaneel.item.voorstel" :waarden="belpaneel.item.waarden" :extra-bezwaren="belpaneel.item.extraBezwaren" :meldingen="belpaneel.item.meldingen" :account-id="belpaneel.item.accountId" :contact-id="belpaneel.item.contactId" :ai-aan="belpaneel.kan.ai" :prospect-versie="belpaneel.item.prospectVersie" compact />
            <p v-else-if="belpaneel" class="meta">Geen script voor deze taak.</p>
          </details>
          <GespreksverslagBlok
            v-if="isBeltaak" v-model="belVerslag" :api="`/api/tasks/${t.id}`" :record="{ soort: 'tasks', id: t.id }" prefix="tf" onderwerp="beltaak"
            :verslag="t.verslag" :transcript="t.transcript" :analyse="t.analyse" :account="t.account" :heeft-contact="!!t.contact" :herlaad="herlaadTaak"
            @patch="(p) => (t = { ...t, ...p })" @gewijzigd="emit('gewijzigd')" @sluit="emit('sluit')"
          />
          <article v-if="t.agent" class="fo-blok fo-blok--agent" data-test="agent-blok">
            <p class="taak-meta">Door {{ agentDef(t.agent)?.naam ?? t.agent }}<template v-if="me?.gebruiker.niveau === 'expert' && t.mandaat"> · mandaat <span class="pil" :class="`pil--mandaat-${t.mandaat}`">{{ t.mandaat }}</span></template><template v-if="t.executorStatus"> · {{ EXECUTOR_LABEL[t.executorStatus] }}</template></p>
          </article>
          <article v-if="t.account && functie('briefing.lezen')?.beschikbaar && t.status !== 'klaar'" class="fo-blok fo-blok--agent" data-test="taak-pitstop"><header class="fo-blok-kop"><div><span class="fo-blok-kicker">Pitstop · AI-agent</span><h3 class="fo-blok-titel">Briefing en Pitstop</h3></div></header><BriefingPaneel onderwerp="taak" :id="t.id" ingeklapt /></article>
          <article v-if="t.concept" class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Concept</h3></header><p v-if="t.concept.onderwerp"><strong>{{ t.concept.onderwerp }}</strong></p><p>{{ t.concept.tekst }}</p>
            <button v-if="t.executorStatus === 'concept-klaar'" type="button" class="dd-act dd-act--primair mt-8" data-test="concept-goedkeuren" @click="keurGoed">Goedkeuren en versturen</button>
          </article>
          <article v-if="t.account" class="fo-blok" data-test="tf-klant">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Prospect in context</h3></header>
            <div class="tf-klant">
              <span class="tf-merk" aria-hidden="true">{{ initialen }}</span>
              <div class="tf-klant-tekst">
                <NuxtLink :to="`/accounts/${t.account.id}`" class="tf-klant-naam" @click="emit('sluit')">{{ t.account.naam }}</NuxtLink>
                <p class="taak-meta">Score <strong class="tnum">{{ t.account.score }}</strong><template v-if="t.account.fase?.accent"> · {{ t.account.fase.accent }}</template></p>
              </div>
            </div>
            <ul v-if="t.account.laatste?.length" class="schakel-lijst mt-8"><li v-for="(x, i) in t.account.laatste.slice(0, 3)" :key="i" class="schakel-rij"><span>{{ x.soort }}<template v-if="x.uitkomst"> · {{ x.uitkomst }}</template></span><span class="meta">{{ new Date(x.op).toLocaleDateString('nl-NL') }}</span></li></ul>
            <template v-for="p in [t.contact ?? t.account.primair].filter(Boolean)" :key="p.id ?? p.naam">
              <p class="mt-8 tf-persoon"><strong>{{ p.naam }}</strong>
                <a v-if="p.telefoon && !p.belMeNiet" class="dd-act" :href="telLink(p.telefoon)">Bel</a>
                <a v-if="p.email" class="dd-act" :href="`mailto:${p.email}`">Mail</a></p>
            </template>
          </article>
          <article v-if="t.status !== 'klaar' && t.kan?.afronden" class="fo-blok" data-test="uitkomst">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">{{ contact ? 'Uitkomst' : 'Afronden' }}</h3></header>
            <div v-if="contact" class="uitkomst-raster">
              <button v-for="u in UITKOMST_CODES" :key="u" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': uitkomst === u }" :data-test="`uitkomst-${u}`" @click="uitkomst = u">{{ UITKOMST_LABEL[u] }}</button>
            </div>
            <p v-else class="taak-meta">Deze taak heeft geen uitkomst nodig.</p>
            <button v-if="uitkomst === 'afspraak' && kanPlannen" type="button" class="dd-act dd-act--primair mt-16" data-test="taak-plan-afspraak" @click="planOpen = true">Plan de afspraak</button>
            <label v-if="uitkomst === 'later'" class="veld mt-16"><span class="veld-label">Wanneer terug? <span class="veld-verplicht">*</span></span><input v-model="laterOp" type="date" class="invoer" :min="morgen" data-test="later-op"></label>
            <ReeksNaUitkomst v-if="reeksKan" v-model="reeksSjabloon" class="mt-16" :account-id="t.account.id" :uitkomst="uitkomst" />
            <template v-if="uitkomst === 'geen_interesse'">
              <label class="veld mt-16"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span><select v-model="reden" class="invoer" data-test="uitkomst-reden"><option value="" disabled>Kies een reden</option><option v-for="r in NEE_REDENEN.filter((x) => x !== 'Niet geschikt')" :key="r" :value="r">{{ r }}</option></select></label>
              <label v-if="reden === 'Anders'" class="veld mt-8"><span class="veld-label">Toelichting <span class="veld-verplicht">*</span></span><textarea v-model="toelichting" class="invoer" rows="2" /></label>
            </template>
            <button v-if="volgende && functie('taken.horizon')?.beschikbaar" type="button" class="dd-act mt-16" :disabled="bezig || ongeldig" data-test="afronden-volgende" @click="doeAfronden(true)"><Icoon naam="Check" :grootte="14" />Afronden en volgende</button>
          </article>
          <article v-if="annuleren" class="fo-blok fo-blok--gevaar" data-test="tf-annuleer-blok">
            <label class="veld"><span class="veld-label">Waarom annuleer je deze taak?</span><input v-model="annuleerReden" class="invoer" data-test="annuleer-reden"></label>
            <div class="tf-annuleer-knoppen mt-8">
              <button type="button" class="dd-act" @click="annuleren = false">Terug</button>
              <button type="button" class="dd-act dd-act--gevaar" :disabled="!annuleerReden.trim()" data-test="annuleer-bevestig" @click="doeAnnuleren">Annuleer taak</button>
            </div>
          </article>
        </div>
        <p v-else-if="laden" class="fo-body meta">Laden…</p>

        <footer v-if="t && bewerken" class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="bewerken = false">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" form="tf-bewerk" class="dd-act dd-act--primair" :disabled="!kanBewaren" data-test="tf-opslaan">{{ bezig ? 'Opslaan…' : '✓ Opslaan' }}</button>
        </footer>
        <footer v-else-if="t" class="fo-foot tf-voet" data-test="tf-voet">
          <button v-if="t.status !== 'klaar' && t.kan?.afronden" type="button" class="dd-actie dd-actie--zwart tf-afronden" :disabled="bezig || ongeldig" data-test="afronden" @click="doeAfronden(false)"><Icoon naam="Check" :grootte="16" />Afronden</button>
          <span class="fo-foot-vul" />
          <div class="tf-iconen">
            <button v-if="aiAan" type="button" class="dd-actie dd-actie--icoon tf-ibtn" title="Vraag AI" aria-label="Vraag AI" data-test="tf-vraag-ai" @click="vraagAi"><Icoon naam="Sparkles" :grootte="18" /></button>
            <div v-if="t.status !== 'klaar' && t.kan?.afronden" ref="uitstelHouder" class="keuzemenu-houder">
              <button type="button" class="dd-actie dd-actie--icoon tf-ibtn" title="Uitstellen" aria-label="Uitstellen" aria-haspopup="menu" :aria-expanded="uitstelOpen" data-test="uitstellen" @click.stop="uitstelOpen = !uitstelOpen"><Icoon naam="Clock" :grootte="18" /></button>
              <ul v-if="uitstelOpen" class="keuzemenu tf-uitstel" role="menu" data-test="tf-uitstel-menu">
                <li role="none"><button type="button" role="menuitem" class="keuzemenu-item" data-test="uitstellen-werkdag" @click="stelUit('werkdag')"><Icoon naam="Clock" :grootte="16" />Een werkdag later</button></li>
                <li role="none"><button type="button" role="menuitem" class="keuzemenu-item" data-test="uitstellen-week" @click="stelUit('week')"><Icoon naam="CalendarClock" :grootte="16" />Een week later</button></li>
                <li v-if="kanPlannen" role="none"><button type="button" role="menuitem" class="keuzemenu-item" data-test="taak-afspraak" @click="kiesAfspraak"><Icoon naam="Plus" :grootte="16" />Plan een afspraak</button></li>
                <li role="none"><button type="button" role="menuitem" class="keuzemenu-item" data-test="tf-annuleren" @click="kiesAnnuleren"><Icoon naam="Ban" :grootte="16" />Annuleer met reden</button></li>
              </ul>
            </div>
            <button v-if="t.status !== 'klaar' && t.kan?.afronden" type="button" class="dd-actie dd-actie--icoon tf-ibtn" title="Bewerken" aria-label="Bewerken" data-test="tf-bewerk" @click="startBewerken"><Icoon naam="Pencil" :grootte="18" /></button>
            <button v-if="t.kan?.verwijderen" type="button" class="dd-actie dd-actie--icoon tf-ibtn tf-weg" title="Verwijderen" aria-label="Verwijderen" data-test="tf-verwijder" @click="verwijderVraag = true"><Icoon naam="Trash2" :grootte="18" /></button>
            <button type="button" class="dd-actie dd-actie--icoon tf-ibtn" title="Volgende taak" aria-label="Volgende taak" data-test="tf-volgende" :disabled="geenVolgende" @click="naarVolgende"><Icoon naam="ArrowRight" :grootte="18" /></button>
          </div>
        </footer>
      </aside>
    </div>
  </Teleport>
  <BevestigVenster :open="verwijderVraag" titel="Taak verwijderen?" :tekst="`${t?.title ?? 'Deze taak'} verdwijnt helemaal, ook uit de historie van de prospect. Wil je hem alleen niet meer doen? Annuleer hem dan met een reden.`" bevestig="Verwijderen" gevaar @bevestigd="verwijder" @geannuleerd="verwijderVraag = false" />
  <PlanAfspraakFlyout v-if="t?.account" :open="planOpen" :account="{ id: t.account.id, naam: t.account.naam }" :task-id="t.id" :aanleiding="t.title" @sluit="planOpen = false" @gepland="gepland" />
</template>

<style scoped>
.tf-defs { margin: 0; }
.tf-defs .def-rij { grid-template-columns: 124px 1fr; }
/* Tekstlinks houden hun opmaak; het tikvlak loopt boven en onder door tot 44 px. */
.tf-tik { position: relative; }
.tf-tik::after { content: ''; position: absolute; inset: -14px 0; }
/* De voet (opzet van DealDrive): Afronden links, icoonknoppen van 44 px rechts; het uitstelmenu opent omhoog. */
.tf-voet { gap: 8px; }
.tf-afronden { flex-shrink: 0; }
.tf-iconen { display: flex; align-items: center; gap: 8px; }
.tf-ibtn { width: var(--touch-target-min); height: var(--touch-target-min); min-height: var(--touch-target-min); flex-shrink: 0; }
.tf-ibtn.tf-weg { color: var(--red); }
.tf-ibtn:disabled { opacity: 0.4; cursor: default; }
.tf-uitstel { top: auto; bottom: calc(100% + 4px); min-width: 230px; }
.tf-annuleer-knoppen { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 767px) {
  .tf-voet { padding-left: 12px; padding-right: 12px; gap: 6px; }
  .tf-iconen { gap: 4px; }
  .tf-afronden { padding: 0 12px; }
}
.tf-delta { font-size: var(--fs-label); color: var(--muted); }
.tf-type-pil { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--ink); color: var(--yellow); border-radius: var(--radius); font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.tf-klant { display: flex; gap: 12px; align-items: flex-start; }
.tf-merk { flex: 0 0 44px; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; background: var(--ink); color: var(--yellow); font-family: var(--font-serif); font-weight: 700; font-size: 16px; }
.tf-klant-tekst { min-width: 0; }
.tf-klant-naam { font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.tf-klant-naam:hover { text-decoration: underline; text-underline-offset: 4px; }
.tf-persoon { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.tf-legend { padding: 0; margin-bottom: 6px; }
.tf-typen { grid-template-columns: repeat(3, 1fr); }
.tf-toggle { min-height: var(--touch-target-min); }
.veld-klap:not(.veld-klap--open) { padding: 0; }
/* Datum en tijd naast elkaar, ook op de telefoon; de prioriteit blijft vier kolommen. */
.tf-rij { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.keuzeraster--prio { grid-template-columns: repeat(4, 1fr); }
.fo-body > :deep(*) { flex-shrink: 0; }
</style>
