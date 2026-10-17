<script setup lang="ts">
// Bezoek afronden (P30, 8.5.3): uitkomst als grote tegels in twee kolommen (uit de meetingsoort),
// verslag met de microfoon als primaire invoer en typen als terugval, foto, volgende stap (of bij een
// eerste afspraak met vervolg de vraag "Overdragen?" met de keuzes, P17), nieuwe contactpersoon en de plakkende knop
// "Bewaar bezoek". Alles via de wachtrij, dus ook offline; 5 seconden "Ongedaan maken".
import { NEE_REDENEN } from '~~/shared/nbStatus'
const props = defineProps<{ open: boolean; afspraak: { id: string; accountId?: string | null; accountNaam?: string | null; start: string; eind: string; eerste?: boolean; uitkomsten: { code: string; label: string; gevolg: { type: string } }[] } | null }>()
const emit = defineEmits<{ sluit: []; bewaard: [id: string] }>()
const toast = useToast()
const { voegToe, trekIn } = useSyncQueue()
const bijlagen = useBijlagen()
const leeg = () => ({ uitkomst: '', verslag: '', reden: '', toelichting: '', laterOp: '', vervolgstap: '', stapTitel: '', stapDatum: '', stapSoort: 'bellen', contactNaam: '', contactFunctie: '', contactTelefoon: '' })
const f = reactive(leeg())
const fotos = ref<{ id: string; url: string }[]>([])
const opname = ref<{ id: string; seconden: number } | null>(null)
const contactOpen = ref(false)
const kaartje = ref(false)
const { functie } = useMe()
const bewaard = ref(false)
const overdracht = ref<any>(null)
watch(() => props.open, (o) => { if (o) { Object.assign(f, leeg()); overdracht.value = null; fotos.value = []; opname.value = null; contactOpen.value = false; bewaard.value = false } })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const gekozen = computed(() => props.afspraak?.uitkomsten.find((u) => u.code === f.uitkomst))
const nee = computed(() => gekozen.value?.gevolg.type === 'nee')
const overdragen = computed(() => gekozen.value?.gevolg.type === 'gehouden' && props.afspraak?.eerste)
const werkdagen = (n: number) => { const d = new Date(); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) k++ } return d.toLocaleDateString('sv-SE') }
// De voorgestelde volgende stap uit het gevolg van de uitkomst; aan te passen met datum en soort.
watch(() => f.uitkomst, () => {
  const t = gekozen.value?.gevolg.type
  if (t === 'later') Object.assign(f, { stapTitel: '', stapDatum: '', laterOp: werkdagen(20) })
  else if (t === 'contactpersoon') { contactOpen.value = true; Object.assign(f, { stapTitel: `Nieuwe contactpersoon bellen bij ${props.afspraak?.accountNaam ?? 'de prospect'}`, stapDatum: werkdagen(1) }) }
  else if (t === 'gehouden' && !props.afspraak?.eerste) Object.assign(f, { stapTitel: `Terugbellen ${props.afspraak?.accountNaam ?? ''}`.trim(), stapDatum: werkdagen(3) })
  else Object.assign(f, { stapTitel: '', stapDatum: '' })
})
const ongeldig = computed(() => !f.uitkomst || (nee.value && (!f.reden || (f.reden === 'Anders' && !f.toelichting.trim()))) || (overdragen.value && !!overdracht.value && (!overdracht.value.vervolgstap.omschrijving || (overdracht.value.naar === 'collega' && !overdracht.value.naarGebruikerId))))

async function foto(e: Event) {
  const bestand = (e.target as HTMLInputElement).files?.[0]
  if (!bestand) return
  const klein = await verkleinFoto(bestand)
  const id = await bijlagen.voegToe(klein, 'foto', { soort: 'appointments', id: props.afspraak!.id })
  fotos.value.push({ id, url: URL.createObjectURL(klein) })
  ;(e.target as HTMLInputElement).value = ''
}

async function bewaar() {
  if (ongeldig.value || !props.afspraak) return
  const a = props.afspraak
  const patch = {
    soort: 'bezoek.afronden', uitkomst: f.uitkomst, verslag: f.verslag || null, reden: f.reden || null, toelichting: f.toelichting || null, laterOp: f.laterOp || null, vervolgstap: overdracht.value?.vervolgstap.omschrijving || f.vervolgstap || null,
    overdracht: overdragen.value && overdracht.value ? JSON.parse(JSON.stringify(overdracht.value)) : null,
    bijlagen: [...fotos.value.map((x) => x.id), ...(opname.value ? [opname.value.id] : [])],
    volgendeStap: f.stapTitel.trim() && f.stapDatum ? { titel: f.stapTitel.trim(), datum: f.stapDatum, soort: f.stapSoort } : null,
    nieuwContact: f.contactNaam.trim() ? { naam: f.contactNaam.trim(), functie: f.contactFunctie || null, telefoon: f.contactTelefoon || null } : null,
    op: new Date().toISOString(),
  }
  const sleutel = await voegToe({ tabel: 'appointments', op: 'patch', recordId: a.id, patch }, { uitstelMs: 5000 })
  bewaard.value = true
  const offline = !navigator.onLine
  toast.toon(offline ? 'Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt.' : overdragen.value && overdracht.value ? 'Bezoek vastgelegd en overgedragen.' : overdragen.value ? 'Bezoek vastgelegd. Overdragen? Er staat een overdrachtstaak klaar.' : 'Bezoek vastgelegd.', 'succes', undefined, {
    tekst: 'Ongedaan maken', doe: async () => { if (await trekIn(sleutel)) toast.toon('Teruggezet. Het bezoek staat weer open.'); else toast.toon('Al verstuurd; ongedaan maken lukt niet meer.', 'let-op') },
  })
  emit('bewaard', a.id)
  setTimeout(() => emit('sluit'), 1200)
}
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot de hoofdactie opslaat; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [f])
</script>

<template>
  <FlyoutShell v-if="open && afspraak" open titel-id="ba-titel" paneel-klasse="ba-venster" data-test="bezoek-afronden" :opslag="opslag" @sluit="emit('sluit')" @bewaar="bewaar">
      <template #kop><span class="fo-kicker">Bezoek afronden</span><h2 id="ba-titel" class="fo-titel">{{ afspraak.accountNaam ?? 'Bezoek' }} · {{ tijd(afspraak.start) }} tot {{ tijd(afspraak.eind) }}</h2></template>
        <form id="ba-form" class="fs-form" @submit.prevent="bewaar">
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Uitkomst</h3></header>
            <div class="uitkomst-raster ba-tegels">
              <button v-for="u in afspraak.uitkomsten" :key="u.code" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': f.uitkomst === u.code }" :aria-pressed="f.uitkomst === u.code" :data-test="`ba-uitkomst-${u.code}`" @click="f.uitkomst = u.code">{{ u.label }}</button>
            </div>
            <template v-if="nee">
              <label class="veld mt-16"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span><select v-model="f.reden" class="invoer" data-test="ba-reden"><option value="" disabled>Kies een reden</option><option v-for="r in NEE_REDENEN" :key="r" :value="r">{{ r }}</option></select></label>
              <label v-if="f.reden === 'Anders'" class="veld mt-8"><span class="veld-label">Toelichting <span class="veld-verplicht">*</span></span><textarea v-model="f.toelichting" class="invoer" rows="2" /></label>
            </template>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Verslag</h3></header>
            <VerslagVeld v-model="f.verslag" :record="{ soort: 'appointments', id: afspraak.id }" groot placeholder="Of typ je verslag" @opname="(id) => (opname = { id, seconden: 0 })" />
            <p v-if="opname" class="meta mt-8">Opname bewaard bij dit bezoek.</p>

            <label class="dd-act mt-8 ba-foto"><Icoon naam="Camera" />Foto<input type="file" accept="image/*" capture="environment" class="sr-only" data-test="ba-foto" @change="foto"></label>
            <div v-if="fotos.length" class="ba-fotos"><img v-for="x in fotos" :key="x.id" :src="x.url" alt="Foto bij dit bezoek"></div>
          </article>
          <article v-if="f.uitkomst" class="fo-blok" data-test="ba-volgende">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">{{ overdragen ? 'Overdragen?' : 'Volgende stap' }}</h3></header>
            <template v-if="overdragen">
              <p>De eerste afspraak is gehouden. Kies naar wie je overdraagt; doe je dat later, dan staat er een overdrachtstaak klaar met je verslag.</p>
              <OverdrachtKeuze v-if="afspraak.accountId" v-model="overdracht" :account-id="afspraak.accountId" class="mt-8" />
              <label v-else class="veld mt-8"><span class="veld-label">Afgesproken vervolgstap</span><input v-model="f.vervolgstap" class="invoer" placeholder="Bijvoorbeeld: projectschouw op locatie"></label>
            </template>
            <label v-else-if="gekozen?.gevolg.type === 'later'" class="veld"><span class="veld-label">Terugkomen op</span><input v-model="f.laterOp" type="date" class="invoer"></label>
            <template v-else-if="!nee">
              <label class="veld"><span class="veld-label">Wat</span><input v-model="f.stapTitel" class="invoer" placeholder="Bijvoorbeeld: Terugbellen"></label>
              <div class="formulier-raster mt-8">
                <label class="veld"><span class="veld-label">Wanneer</span><input v-model="f.stapDatum" type="date" class="invoer"></label>
                <label class="veld"><span class="veld-label">Soort</span><select v-model="f.stapSoort" class="invoer"><option value="bellen">Bellen</option><option value="mailen">Mailen</option><option value="bezoek">Bezoek</option><option value="taak">Taak</option></select></label>
              </div>
            </template>
            <p v-else class="meta">Het account gaat naar nee, met de afkoelperiode per kanaal.</p>
          </article>
          <details class="fo-blok" :open="contactOpen" @toggle="contactOpen = ($event.target as HTMLDetailsElement).open">
            <summary class="fo-blok-titel">Nieuwe contactpersoon</summary>
            <label class="veld mt-8"><span class="veld-label">Naam</span><input v-model="f.contactNaam" class="invoer" autocomplete="off"></label>
            <div class="formulier-raster mt-8">
              <label class="veld"><span class="veld-label">Functie</span><input v-model="f.contactFunctie" class="invoer"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.contactTelefoon" class="invoer" type="tel" inputmode="tel"></label>
            </div>
            <button v-if="afspraak.accountId && functie('contact.visitekaartje')?.beschikbaar" type="button" class="dd-act mt-8" data-test="ba-visitekaartje" @click="kaartje = true"><Icoon naam="Camera" />Scan visitekaartje</button>
          </details>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet ba-voet">
          <button type="submit" form="ba-form" class="dd-actie dd-actie--zwart fs-hoofdactie ba-bewaar" :disabled="ongeldig || bewaard" data-test="ba-bewaar"><Icoon naam="Check" :grootte="16" />{{ bewaard ? 'Bewaard' : 'Bewaar bezoek' }}</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
  <VisitekaartjeVenster :open="kaartje" :account="afspraak?.accountId ? { id: afspraak.accountId, naam: afspraak.accountNaam ?? '' } : null" @sluit="kaartje = false" />
</template>
