<script setup lang="ts">
// Afspraakflyout (F09): kicker met soort en status, wanneer, wie, locatie of link, klant in context,
// wie zit erbij, doel en agenda, Pitstop (P18) en verslag. Na afloop "Rond af": uitkomst (raster van
// 56 px), verslag, per agendapunt besproken of niet, en de volgende stap. Op de telefoon een
// schuifvenster met de plakkende actiebalk Bellen, Mail, WhatsApp, Navigeer.
import { NEE_REDENEN } from '~~/shared/nbStatus'
const props = defineProps<{ open: boolean; afspraakId: string | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const { voegToe } = useSyncQueue()
const a = ref<any>(null)
const afronden = ref(false)
const bezig = ref(false)
const f = reactive({ uitkomst: '', verslag: '', laterOp: '', reden: '', toelichting: '', vervolgstap: '', punten: [] as { punt: string; besproken: boolean }[] })
async function laad() { a.value = props.afspraakId ? await $fetch(`/api/afspraken/${props.afspraakId}`).catch(() => null) : null }
watch(() => [props.open, props.afspraakId], async ([o]) => {
  if (!o) return
  afronden.value = false; Object.assign(f, { uitkomst: '', verslag: '', laterOp: '', reden: '', toelichting: '', vervolgstap: '' })
  await laad()
  f.punten = (a.value?.soort.agenda ?? []).map((p: any) => ({ punt: p.punt, besproken: false }))
}, { immediate: true })
const STATUS: Record<string, string> = { gepland: 'GEPLAND', afgerond: 'AFGEROND', niet_verschenen: 'NIET VERSCHENEN', geannuleerd: 'GEANNULEERD' }
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const gekozen = computed(() => a.value?.soort.uitkomsten.find((u: any) => u.code === f.uitkomst))
const nee = computed(() => gekozen.value?.gevolg?.type === 'nee')
const later = computed(() => gekozen.value?.gevolg?.type === 'later')
const ongeldig = computed(() => (a.value?.soort.type === 'klant' && !f.uitkomst) || (nee.value && (!f.reden || (f.reden === 'Anders' && !f.toelichting.trim()))))
const wanneer = computed(() => a.value ? `${new Date(a.value.start).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })}, ${new Date(a.value.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })} tot ${new Date(a.value.eind).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}` : '')
async function rondAf() {
  if (ongeldig.value || !a.value) return
  bezig.value = true
  const body = { uitkomst: f.uitkomst || 'gehouden', verslag: f.verslag || null, agendapunten: f.punten, laterOp: f.laterOp || null, reden: f.reden || null, toelichting: f.toelichting || null, vervolgstap: f.vervolgstap || null }
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'appointments', op: 'patch', recordId: a.value.id, patch: { soort: 'afspraak.afronden', ...body, op: new Date().toISOString() } })
      toast.toon('Afgerond. Wordt verstuurd zodra je weer verbinding hebt.')
    } else {
      const r: any = await $fetch(`/api/afspraken/${a.value.id}/afronden`, { method: 'POST', body })
      toast.toon(r.tekst)
    }
    emit('gewijzigd'); emit('sluit')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function zetStatus(status: 'niet_verschenen' | 'geannuleerd') {
  try { await $fetch(`/api/afspraken/${a.value.id}/status`, { method: 'POST', body: { status } }); toast.toon(status === 'geannuleerd' ? 'Afspraak geannuleerd.' : 'Vastgelegd: niet verschenen.'); emit('gewijzigd'); await laad() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const morgen = computed(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="af-titel" data-test="afspraak-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker" data-test="af-kicker">{{ a ? `${a.soort.naam.toUpperCase()} · ${STATUS[a.status]}` : 'Afspraak' }}</span>
            <h2 id="af-titel" class="fo-titel">{{ a ? (a.account?.naam ?? a.soort.naam) : 'Laden…' }}</h2>
            <p v-if="a" class="taak-meta">{{ wanneer }} · {{ VORM[a.vorm] }} · {{ a.eigenaar.naam.replace(/^Testgebruiker /, '') }}</p>
            <p v-if="a?.geplandDoor" class="taak-meta"><span class="pil pil--leeg" data-test="af-gepland-door">Gepland door {{ a.geplandDoor.replace(/^Testgebruiker /, '') }}</span></p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div v-if="a" class="fo-body fo-body--formulier">
          <article v-if="a.locatie || a.meetinglink" class="fo-blok">
            <p v-if="a.locatie"><Icoon naam="MapPin" /> {{ a.locatie }}</p>
            <p v-if="a.meetinglink"><a :href="a.meetinglink" target="_blank" rel="noopener" class="tekst-link">Open de meetinglink</a></p>
          </article>
          <article v-if="a.briefing || a.aanleiding" class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Briefing</h3></header><p>{{ a.briefing ?? a.aanleiding }}</p></article>
          <article v-if="a.account" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Klant in context</h3></header>
            <p class="taak-meta"><NuxtLink :to="`/accounts/${a.account.id}`" class="tekst-link">{{ a.account.naam }}</NuxtLink><template v-if="a.account.plaats"> · {{ a.account.plaats }}</template><template v-if="a.account.status"> · {{ a.account.status }}</template></p>
          </article>
          <article v-if="a.wieZitErbij.length" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Wie zit erbij</h3></header>
            <ul class="schakel-lijst"><li v-for="c in a.wieZitErbij" :key="c.id" class="schakel-rij"><span>{{ c.naam }}</span><span class="meta">{{ [c.rol, c.functie].filter(Boolean).join(' · ') }}</span></li></ul>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Doel en agenda</h3></header>
            <p v-if="a.soort.doel">{{ a.soort.doel }}</p>
            <ol class="mt-8"><li v-for="p in a.soort.agenda" :key="p.punt">{{ p.punt }}<span v-if="p.verplicht" class="meta"> · verplicht</span></li></ol>
          </article>
          <article class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Pitstop</h3></header><p class="meta">Pitstop volgt.</p></article>
          <article v-if="a.verslag?.tekst" class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Verslag</h3></header><p>{{ a.verslag.tekst }}</p></article>
          <article v-if="afronden" class="fo-blok" data-test="rond-af">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Rond af</h3></header>
            <div v-if="a.soort.uitkomsten.length" class="uitkomst-raster">
              <button v-for="u in a.soort.uitkomsten" :key="u.code" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': f.uitkomst === u.code }" :data-test="`af-uitkomst-${u.code}`" @click="f.uitkomst = u.code">{{ u.label }}</button>
            </div>
            <p v-else class="meta">Intern overleg heeft geen klantuitkomst.</p>
            <label v-if="later" class="veld mt-16"><span class="veld-label">Wanneer terug?</span><input v-model="f.laterOp" type="date" class="invoer" :min="morgen"></label>
            <template v-if="nee">
              <label class="veld mt-16"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span><select v-model="f.reden" class="invoer" data-test="af-reden"><option value="" disabled>Kies een reden</option><option v-for="r in NEE_REDENEN" :key="r" :value="r">{{ r }}</option></select></label>
              <label v-if="f.reden === 'Anders'" class="veld mt-8"><span class="veld-label">Toelichting <span class="veld-verplicht">*</span></span><textarea v-model="f.toelichting" class="invoer" rows="2" /></label>
            </template>
            <label class="veld mt-16"><span class="veld-label">Verslag</span><textarea v-model="f.verslag" class="invoer" rows="4" placeholder="Typ of plak je aantekeningen" data-test="af-verslag" /></label>
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
        <footer v-if="a && a.status === 'gepland'" class="fo-foot dd-acties">
          <button v-if="!afronden" type="button" class="dd-act" data-test="af-niet-verschenen" @click="zetStatus('niet_verschenen')">Niet verschenen</button>
          <button v-if="!afronden" type="button" class="dd-act" data-test="af-annuleer" @click="zetStatus('geannuleerd')">Annuleer</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button v-if="!afronden" type="button" class="dd-act dd-act--geel" data-test="af-rond-af" @click="afronden = true">Rond af</button>
          <button v-else type="button" class="dd-act dd-act--primair" :disabled="bezig || ongeldig" data-test="af-bewaar" @click="rondAf">Bewaar</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
