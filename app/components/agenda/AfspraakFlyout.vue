<script setup lang="ts">
// Afspraakvenster in de opzet van DealDrive (/bezoeken): kicker met de kleur van de meetingsoort en de
// status, de titel, klant en contact met links naar hun kaart, een definitielijst (wanneer, toegewezen
// aan, klant, contactpersoon, beschrijving, locatie, meeting, uitgenodigd, herhaling, herinnering),
// klant in context, wie zit erbij, doel en voorbereiding, de Pitstop en het blok "Transcript en
// gespreksverslag": een transcript uploaden of plakken, het verslag schrijven of inspreken en de
// analyse van de Notulist (samenvatting, actiepunten als concepttaak, koopsignalen als inzicht). Na
// afloop "Rond af" (uitkomst, per agendapunt besproken, vervolgstap; een eerste afspraak met vervolg
// opent Overdragen). Verplaatsen, Niet verschenen en Annuleer in de voet. Op de telefoon een
// schuifvenster met de actiebalk Bellen, Mail, WhatsApp, Navigeer.
import { NEE_REDENEN } from '~~/shared/nbStatus'
import { spreekBriefing } from '~~/shared/spreek'
const props = defineProps<{ open: boolean; afspraakId: string | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const route = useRoute()
const { voegToe } = useSyncQueue()
const a = ref<any>(null)
const ov = ref<{ accountId: string; naam: string; vervolgstap: string } | null>(null)
const afronden = ref(false)
const verplaatsen = ref(false)
const bezig = ref(false)
const f = reactive({ uitkomst: '', laterOp: '', reden: '', toelichting: '', vervolgstap: '', punten: [] as { punt: string; besproken: boolean }[] })
const vp = reactive({ datum: '', start: '', duurMin: 30, titel: '' })
// Het gespreksverslag (blok Transcript en gespreksverslag); het gaat mee bij Rond af.
const verslag = ref('')

async function laad() { a.value = props.afspraakId ? await $fetch<any>(`/api/afspraken/${props.afspraakId}`).catch(() => null) : null }
watch(() => [props.open, props.afspraakId], async ([o]) => {
  if (!o) return
  afronden.value = false; verplaatsen.value = false
  Object.assign(f, { uitkomst: '', laterOp: '', reden: '', toelichting: '', vervolgstap: '' })
  await laad()
  verslag.value = a.value?.verslag?.tekst ?? ''
  f.punten = (a.value?.soort.agenda ?? []).map((p: any) => ({ punt: p.punt, besproken: false }))
}, { immediate: true })

const STATUS: Record<string, string> = { gepland: 'GEPLAND', afgerond: 'AFGEROND', niet_verschenen: 'NIET VERSCHENEN', geannuleerd: 'GEANNULEERD' }
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const HERHALING: Record<string, string> = { wekelijks: 'Wekelijks', tweewekelijks: 'Om de week', maandelijks: 'Maandelijks' }
const KLEUR: Record<string, string> = { geel: 'var(--yellow)', paars: 'var(--purple)', blauw: 'var(--blue)', groen: 'var(--green)', oranje: 'var(--orange)', grijs: 'var(--muted-light)' }
const TZ = 'Europe/Amsterdam'
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const gekozen = computed(() => a.value?.soort.uitkomsten.find((u: any) => u.code === f.uitkomst))
const nee = computed(() => gekozen.value?.gevolg?.type === 'nee')
const later = computed(() => gekozen.value?.gevolg?.type === 'later')
const ongeldig = computed(() => (a.value?.soort.type === 'klant' && !f.uitkomst) || (nee.value && (!f.reden || (f.reden === 'Anders' && !f.toelichting.trim()))))
const duurMin = computed(() => a.value ? Math.round((Date.parse(a.value.eind) - Date.parse(a.value.start)) / 60_000) : 0)
const duurLabel = computed(() => duurMin.value >= 60 ? `${Math.floor(duurMin.value / 60)} uur${duurMin.value % 60 ? ` ${duurMin.value % 60} min` : ''}` : `${duurMin.value} min`)
const wanneer = computed(() => a.value ? `${new Date(a.value.start).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })}, ${tijd(a.value.start)} tot ${tijd(a.value.eind)}` : '')
const eigenaar = computed(() => String(a.value?.eigenaar?.naam ?? '').replace(/^Testgebruiker /, ''))
const initialen = computed(() => String(a.value?.account?.naam ?? '').split(/\s+/).filter((w) => /^[\p{L}\d]/u.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''))
const kicker = computed(() => a.value ? `${a.value.soort.naam.toUpperCase()} · ${STATUS[a.value.status]}` : 'Afspraak')
const opKlantkaart = computed(() => !!a.value?.account && route.path === `/accounts/${a.value.account.id}`)
const tekstVan = (fout: unknown) => foutTekst(fout)

async function rondAf() {
  if (ongeldig.value || !a.value) return
  bezig.value = true
  const body = { uitkomst: f.uitkomst || 'gehouden', verslag: verslag.value.trim() || null, agendapunten: f.punten, laterOp: f.laterOp || null, reden: f.reden || null, toelichting: f.toelichting || null, vervolgstap: f.vervolgstap || null }
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'appointments', op: 'patch', recordId: a.value.id, patch: { soort: 'afspraak.afronden', ...body, op: new Date().toISOString() } })
      toast.toon('Afgerond. Wordt verstuurd zodra je weer verbinding hebt.')
    } else {
      const r: any = await $fetch(`/api/afspraken/${a.value.id}/afronden`, { method: 'POST', body })
      // P17: een eerste afspraak met vervolg opent meteen "Overdragen?".
      if (r.overdragen && a.value.account?.id) { ov.value = { accountId: a.value.account.id, naam: a.value.account.naam, vervolgstap: f.vervolgstap }; emit('gewijzigd'); return }
      toast.toon(r.tekst)
    }
    emit('gewijzigd'); emit('sluit')
  } catch (e) { toast.toon(tekstVan(e), 'fout') } finally { bezig.value = false }
}
async function zetStatus(status: 'niet_verschenen' | 'geannuleerd') {
  try { await $fetch(`/api/afspraken/${a.value.id}/status`, { method: 'POST', body: { status } }); toast.toon(status === 'geannuleerd' ? 'Afspraak geannuleerd.' : 'Vastgelegd: niet verschenen.'); emit('gewijzigd'); await laad() } catch (e) { toast.toon(tekstVan(e), 'fout') }
}

// Verplaatsen: datum, start, duur en titel; de server rekent in UTC.
function startVerplaatsen() {
  const d = new Date(a.value.start)
  vp.datum = d.toLocaleDateString('sv-SE', { timeZone: TZ }); vp.start = tijd(a.value.start); vp.duurMin = duurMin.value; vp.titel = a.value.eigenTitel ? a.value.titel : ''
  afronden.value = false; verplaatsen.value = true
}
function startIso(datum: string, start: string) {
  const proef = new Date(`${datum}T${start}:00Z`)
  const verschil = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(proef)) - proef.getUTCHours()
  return new Date(proef.getTime() - ((verschil + 24) % 24) * 3600_000).toISOString()
}
async function bewaarVerplaatsen() {
  if (!vp.datum || !vp.start) return
  bezig.value = true
  try {
    const r: any = await $fetch(`/api/afspraken/${a.value.id}/verplaats`, { method: 'POST', body: { start: startIso(vp.datum, vp.start), duurMin: vp.duurMin, titel: vp.titel } })
    toast.toon(r.tekst); verplaatsen.value = false; emit('gewijzigd'); await laad()
  } catch (e) { toast.toon(tekstVan(e), 'fout') } finally { bezig.value = false }
}

// De voorgestelde uitkomst van de Notulist; de mens kiest bij Rond af.
const voorgesteld = computed(() => { const v = a.value?.analyse?.voorgesteldeUitkomst; if (!v || a.value?.status !== 'gepland') return null; return `Voorgestelde uitkomst: ${a.value.soort.uitkomsten.find((u: any) => u.code === v)?.label ?? v}. Jij kiest bij Rond af.` })

// Voorlezen (P31): de briefing voor het oor, hooguit een minuut.
const { functie } = useMe()
const vl = useVoorlezen()
const kanVoorlezen = ref(false)
onMounted(() => { kanVoorlezen.value = !!vl.kan() })
function leesBriefing() {
  if (vl.spreekt.value) { vl.stop(); return }
  vl.lees(spreekBriefing({ accountNaam: a.value.account?.naam ?? a.value.soort.naam, tijd: tijd(a.value.start), contact: a.value.contact?.naam ?? a.value.wieZitErbij[0]?.naam ?? null, doel: a.value.soort.doel, punten: [a.value.briefing ?? a.value.aanleiding, ...a.value.soort.agenda.map((p: any) => p.punt)] }))
}
const morgen = computed(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="af-titel" data-test="afspraak-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker af-kicker" data-test="af-kicker"><span v-if="a" class="af-stip" :style="{ background: KLEUR[a.soort.kleur] ?? 'var(--ink)' }" aria-hidden="true" />{{ kicker }}</span>
            <h2 id="af-titel" class="fo-titel" data-test="af-titel">{{ a ? a.titel : 'Laden…' }}</h2>
            <p v-if="a?.account" class="taak-meta af-kop-links">
              <NuxtLink :to="`/accounts/${a.account.id}`" class="tekst-link" data-test="af-kop-account" @click="emit('sluit')">{{ a.account.naam }}</NuxtLink><template v-if="a.contact"> · <NuxtLink :to="`/contacten/${a.contact.id}`" class="tekst-link" data-test="af-kop-contact" @click="emit('sluit')">{{ a.contact.naam }}</NuxtLink></template>
            </p>
            <p v-if="a" class="taak-meta">{{ wanneer }} · {{ VORM[a.vorm] }} · {{ eigenaar }}</p>
            <p v-if="a?.geplandDoor" class="taak-meta"><span class="pil pil--leeg" data-test="af-gepland-door">Gepland door {{ a.geplandDoor.replace(/^Testgebruiker /, '') }}</span></p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>

        <div v-if="a" class="fo-body fo-body--formulier">
          <!-- Verplaatsen: nieuw moment, duur en titel. -->
          <article v-if="verplaatsen" class="fo-blok fo-blok--accent" data-test="af-verplaats-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Verplaats de afspraak</h3></header>
            <label class="veld"><span class="veld-label">Titel</span><input v-model="vp.titel" class="invoer" :placeholder="a.titel" data-test="af-vp-titel"></label>
            <div class="af-rij3 mt-16">
              <label class="veld"><span class="veld-label">Datum <span class="veld-verplicht">*</span></span><input v-model="vp.datum" type="date" class="invoer" required data-test="af-vp-datum"></label>
              <label class="veld"><span class="veld-label">Start <span class="veld-verplicht">*</span></span><input v-model="vp.start" type="time" step="900" class="invoer" required data-test="af-vp-start"></label>
              <label class="veld"><span class="veld-label">Duur</span><select v-model.number="vp.duurMin" class="invoer"><option v-for="d in [10, 15, 30, 45, 60, 90, 120, 180]" :key="d" :value="d">{{ d >= 60 ? `${d / 60} uur`.replace('.5', ',5') : `${d} min` }}</option><option v-if="![10, 15, 30, 45, 60, 90, 120, 180].includes(vp.duurMin)" :value="vp.duurMin">{{ vp.duurMin }} min</option></select></label>
            </div>
          </article>

          <dl class="af-defs" data-test="af-defs">
            <div class="af-def"><dt>Wanneer</dt><dd class="tnum">{{ wanneer }} <span class="meta">· {{ duurLabel }}</span></dd></div>
            <div class="af-def"><dt>Toegewezen aan</dt><dd>{{ eigenaar }}</dd></div>
            <div v-if="a.account" class="af-def"><dt>Prospect</dt><dd><NuxtLink :to="`/accounts/${a.account.id}`" class="tekst-link" data-test="af-account" @click="emit('sluit')">{{ a.account.naam }}</NuxtLink></dd></div>
            <div v-if="a.account" class="af-def"><dt>Contactpersoon</dt><dd><NuxtLink v-if="a.contact" :to="`/contacten/${a.contact.id}`" class="tekst-link" data-test="af-contact" @click="emit('sluit')">{{ a.contact.naam }}</NuxtLink><span v-if="a.contact && (a.contact.functie || a.contact.rol)" class="meta">&nbsp;· {{ a.contact.functie ?? a.contact.rol }}</span><span v-if="!a.contact" class="meta">Geen contactpersoon gekoppeld</span></dd></div>
            <div v-if="a.beschrijving" class="af-def"><dt>Beschrijving</dt><dd class="af-pre">{{ a.beschrijving }}</dd></div>
            <div v-if="a.locatie" class="af-def"><dt>Locatie</dt><dd>{{ a.locatie }}</dd></div>
            <div v-if="a.meetinglink" class="af-def"><dt>Meeting</dt><dd><a :href="a.meetinglink" target="_blank" rel="noopener" class="tekst-link">Open de meetinglink</a></dd></div>
            <div v-if="a.uitgenodigd?.length" class="af-def"><dt>Uitgenodigd</dt><dd data-test="af-uitgenodigd">{{ a.uitgenodigd.map((u: any) => u.naam).join(', ') }}</dd></div>
            <div v-if="a.herhaling?.reeksId" class="af-def"><dt>Herhaling</dt><dd>{{ HERHALING[a.herhaling.soort] ?? 'Reeks' }} · {{ a.herhaling.aantal }} afspraken</dd></div>
            <div v-if="a.herinneringMin" class="af-def"><dt>Herinnering</dt><dd>{{ a.herinneringMin >= 1440 ? '1 dag' : a.herinneringMin >= 60 ? `${a.herinneringMin / 60} uur` : `${a.herinneringMin} minuten` }} vooraf</dd></div>
          </dl>

          <article v-if="a.account" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Prospect in context</h3></header>
            <div class="af-account">
              <span class="af-account-merk" aria-hidden="true">{{ initialen }}</span>
              <div>
                <NuxtLink :to="`/accounts/${a.account.id}`" class="af-account-naam tekst-link" @click="emit('sluit')">{{ a.account.naam }}</NuxtLink>
                <p class="meta">{{ [a.account.plaats, a.account.status].filter(Boolean).join(' · ') }}</p>
                <p v-if="a.aanleiding" class="af-aanleiding">{{ a.aanleiding }}</p>
              </div>
            </div>
          </article>

          <article v-if="a.wieZitErbij.length" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Wie zit erbij</h3></header>
            <ul class="schakel-lijst">
              <li v-for="c in a.wieZitErbij" :key="c.id" class="schakel-rij">
                <NuxtLink :to="`/contacten/${c.id}`" class="tekst-link" @click="emit('sluit')">{{ c.naam }}</NuxtLink>
                <span class="meta">{{ [c.id === a.contact?.id ? 'gekoppeld' : null, c.rol, c.functie].filter(Boolean).join(' · ') }}</span>
              </li>
            </ul>
          </article>

          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Doel en voorbereiding</h3></header>
            <p v-if="a.soort.doel">{{ a.soort.doel }}</p>
            <ol v-if="a.soort.agenda.length" class="mt-8"><li v-for="p in a.soort.agenda" :key="p.punt">{{ p.punt }}<span v-if="p.verplicht" class="meta"> · verplicht</span></li></ol>
            <ul v-if="a.soort.voorbereiding.length" class="mt-8 af-voorbereiding"><li v-for="v in a.soort.voorbereiding" :key="v">{{ v }}</li></ul>
          </article>

          <article v-if="a.briefing || (a.aanleiding && !a.account)" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Briefing</h3><button v-if="kanVoorlezen" type="button" class="dd-act" @click="leesBriefing"><Icoon :naam="vl.spreekt.value ? 'VolumeX' : 'Volume2'" />{{ vl.spreekt.value ? 'Stop' : 'Lees voor' }}</button></header>
            <p>{{ a.briefing ?? a.aanleiding }}</p>
          </article>

          <article class="fo-blok fo-blok--agent" data-test="af-pitstop">
            <header class="fo-blok-kop"><div><span class="fo-blok-kicker">AI-agent</span><h3 class="fo-blok-titel">Pitstop</h3></div></header>
            <BriefingPaneel v-if="functie('briefing.lezen')?.beschikbaar && a.account" onderwerp="afspraak" :id="a.id" />
            <p v-else class="meta">Een briefing hoort bij een afspraak met een prospect.</p>
          </article>

          <!-- Transcript en gespreksverslag: drie wegen (bestand, plakken, inspreken) naar één analyse. -->
          <GespreksverslagBlok
            v-model="verslag" :api="`/api/afspraken/${a.id}`" :record="{ soort: 'appointments', id: a.id }" prefix="af" onderwerp="afspraak"
            :verslag="a.verslag" :transcript="a.transcript" :analyse="a.analyse" :account="a.account" :heeft-contact="!!a.contact" :herlaad="laad" :uitkomst-tekst="voorgesteld"
            @patch="(p) => (a = { ...a, ...p })" @gewijzigd="emit('gewijzigd')" @sluit="emit('sluit')"
          />

          <article v-if="afronden" class="fo-blok" data-test="rond-af">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Rond af</h3></header>
            <div v-if="a.soort.uitkomsten.length" class="uitkomst-raster">
              <button v-for="u in a.soort.uitkomsten" :key="u.code" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': f.uitkomst === u.code }" :data-test="`af-uitkomst-${u.code}`" @click="f.uitkomst = u.code">{{ u.label }}</button>
            </div>
            <p v-else class="meta">Intern overleg heeft geen gespreksuitkomst.</p>
            <label v-if="later" class="veld mt-16"><span class="veld-label">Wanneer terug?</span><input v-model="f.laterOp" type="date" class="invoer" :min="morgen"></label>
            <template v-if="nee">
              <label class="veld mt-16"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span><select v-model="f.reden" class="invoer" data-test="af-reden"><option value="" disabled>Kies een reden</option><option v-for="r in NEE_REDENEN" :key="r" :value="r">{{ r }}</option></select></label>
              <label v-if="f.reden === 'Anders'" class="veld mt-8"><span class="veld-label">Toelichting <span class="veld-verplicht">*</span></span><textarea v-model="f.toelichting" class="invoer" rows="2" /></label>
            </template>
            <p class="meta mt-16">{{ verslag.trim() ? 'Het gespreksverslag hierboven gaat mee.' : 'Nog geen verslag: schrijf of spreek het in bij Transcript en gespreksverslag.' }}</p>
            <div v-if="f.punten.length" class="mt-16"><span class="veld-label">Agendapunten</span>
              <ul class="schakel-lijst"><li v-for="p in f.punten" :key="p.punt" class="schakel-rij"><span>{{ p.punt }}</span><Schakelaar :aan="p.besproken" :label="p.besproken ? 'besproken' : 'niet besproken'" @wissel="p.besproken = $event" /></li></ul>
            </div>
            <label v-if="gekozen?.gevolg?.type === 'gehouden'" class="veld mt-16"><span class="veld-label">Afgesproken vervolgstap</span><input v-model="f.vervolgstap" class="invoer" placeholder="Bijvoorbeeld: offerte via DealDrive" data-test="af-vervolgstap"></label>
          </article>
        </div>
        <p v-else class="fo-body meta">Laden…</p>

        <nav v-if="a" class="actiebalk actiebalk--flyout" data-test="af-actiebalk" aria-label="Contact">
          <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !a.actiebalk.bellen }" :href="a.actiebalk.bellen ?? undefined" :aria-disabled="!a.actiebalk.bellen" :title="a.actiebalk.bellen ? undefined : 'Geen telefoonnummer bekend'"><Icoon naam="Phone" />Bellen</a>
          <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !a.actiebalk.mail }" :href="a.actiebalk.mail ?? undefined" :aria-disabled="!a.actiebalk.mail" :title="a.actiebalk.mail ? undefined : 'Geen e-mailadres bekend'"><Icoon naam="Mail" />Mail</a>
          <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !a.actiebalk.whatsapp }" :href="a.actiebalk.whatsapp ?? undefined" :aria-disabled="!a.actiebalk.whatsapp" :title="a.actiebalk.whatsapp ? undefined : 'Geen mobiel nummer bekend'" target="_blank" rel="noopener"><Icoon naam="MessageCircle" />WhatsApp</a>
          <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !a.actiebalk.navigeer }" :href="a.actiebalk.navigeer ?? undefined" :aria-disabled="!a.actiebalk.navigeer" :title="a.actiebalk.navigeer ? undefined : 'Geen adres bekend'" target="_blank" rel="noopener" data-test="af-navigeer"><Icoon naam="Navigation" />Navigeer</a>
        </nav>

        <footer v-if="a && a.status === 'gepland' && verplaatsen" class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="verplaatsen = false">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act dd-act--geel" :disabled="bezig || !vp.datum || !vp.start" data-test="af-verplaats-bewaar" @click="bewaarVerplaatsen">Bewaar nieuw moment</button>
        </footer>
        <footer v-else-if="a && a.status === 'gepland'" class="fo-foot dd-acties af-foot">
          <template v-if="!afronden">
            <button type="button" class="dd-act" data-test="af-verplaats" @click="startVerplaatsen"><Icoon naam="CalendarRange" />Verplaats</button>
            <button type="button" class="dd-act" data-test="af-niet-verschenen" @click="zetStatus('niet_verschenen')">Niet verschenen</button>
            <button type="button" class="dd-act dd-act--gevaar" data-test="af-annuleer" @click="zetStatus('geannuleerd')">Annuleer</button>
          </template>
          <button v-else type="button" class="dd-act" @click="afronden = false">Terug</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <NuxtLink v-if="a.account && !opKlantkaart && !afronden" :to="`/accounts/${a.account.id}`" class="dd-act dd-act--icoon af-naar-kaart" title="Open kaart" aria-label="Open kaart" @click="emit('sluit')"><Icoon naam="ArrowRight" /></NuxtLink>
          <button v-if="!afronden" type="button" class="dd-act dd-act--geel af-hoofd" data-test="af-rond-af" @click="afronden = true; verplaatsen = false">Rond af</button>
          <button v-else type="button" class="dd-act dd-act--primair af-hoofd" :disabled="bezig || ongeldig" data-test="af-bewaar" @click="rondAf">Bewaar</button>
        </footer>
        <footer v-else-if="a?.account && !opKlantkaart" class="fo-foot dd-acties">
          <span class="dd-acties-vul fo-foot-vul" />
          <NuxtLink :to="`/accounts/${a.account.id}`" class="dd-act" @click="emit('sluit')">Open kaart<Icoon naam="ArrowRight" /></NuxtLink>
        </footer>
      </aside>
    </div>
    <OverdrachtVenster :open="!!ov" :account-id="ov?.accountId ?? null" :account-naam="ov?.naam ?? ''" :vervolgstap="ov?.vervolgstap" @sluit="ov = null; emit('sluit')" @overgedragen="emit('gewijzigd')" />
  </Teleport>
</template>

<style scoped>
.af-kicker { display: inline-flex; align-items: center; gap: 8px; }
.af-stip { width: 8px; height: 8px; border-radius: var(--radius); flex-shrink: 0; }
.af-defs { margin: 0 0 14px; padding: 0; display: grid; gap: 0; border-top: 1px solid var(--border); }
.af-def { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-klein); }
.af-def dt { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding-top: 2px; }
.af-def dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.af-pre { white-space: pre-wrap; }
.af-account { display: flex; gap: 12px; align-items: flex-start; }
.af-account-merk { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex-shrink: 0; background: var(--ink); color: var(--yellow); font-weight: 800; font-size: 13px; border-radius: var(--radius); }
.af-account-naam { font-weight: 700; }
.af-aanleiding { margin: 6px 0 0; font-size: var(--fs-klein); }
.af-voorbereiding { padding-left: 18px; font-size: var(--fs-klein); color: var(--ink-soft); }
.af-rij3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 720px) {
  .af-def { grid-template-columns: 1fr; gap: 2px; }
  .af-rij3 { grid-template-columns: 1fr 1fr; }
  .af-def dd a, .af-account-naam { display: inline-block; padding: 13px 0; border-bottom: 0; text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 2px; text-underline-offset: 3px; }
  .af-kop-links { display: none; }
  .af-foot { flex-wrap: wrap; }
  .af-foot .fo-foot-vul, .af-foot .af-naar-kaart { display: none; }
  .af-foot .af-hoofd { flex: 1 1 100%; order: 9; }
}
</style>
