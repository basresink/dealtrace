<script setup lang="ts">
// Briefing en Pitstop (F11): de soort als kicker, blokken met herkomst (Berekend, Door AI geschreven,
// Eigen tekst), eigen tekst per blok (Gevorderd), soort vastzetten (Expert), "Bereid voor" (Pitstop,
// concept ter goedkeuring) en na het gesprek "Doel gehaald?". Werkt zonder AI-credits. Op /briefings kan bij een
// account een contactpersoon mee (contactId): zijn gegevens, laatste contactmomenten en open gesprekken staan erboven.
import { BRIEFING_SOORTEN, HERKOMST_LABEL, SOORT_LABEL, type BriefingSoort } from '~~/shared/briefing'
const props = defineProps<{ onderwerp: 'afspraak' | 'taak' | 'account'; id: string; ingeklapt?: boolean; contactId?: string | null }>()
const emit = defineEmits<{ geladen: [data: any]; gesprek: [g: { onderwerp: 'afspraak' | 'taak'; id: string; titel: string }] }>()
const toast = useToast()
const { voegToe } = useSyncQueue()
const { toon: toonUitleg } = useNietAangezet()
const sleutel = computed(() => props.onderwerp)
const gesprek = computed(() => props.onderwerp !== 'account')
const { data, refresh, error } = useFetch<any>('/api/briefing', { query: computed(() => ({ [sleutel.value]: props.id, contact: props.onderwerp === 'account' && props.contactId ? props.contactId : undefined })), default: () => null })
watch(data, (d) => { if (d) emit('geladen', d) }, { immediate: true })
const ROL: Record<string, string> = { beslisser: 'Beslisser', beinvloeder: 'Beïnvloeder', champion: 'Champion', gebruiker: 'Gebruiker', receptie: 'Receptie' }
const MOMENT: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', afspraak: 'Afspraak', bezoek: 'Bezoek', linkedin: 'LinkedIn', notitie: 'Notitie' }
const kort = (iso: string | null) => (iso ? new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : 'Geen datum')
const dag = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' })
const { data: concepten, refresh: ververs } = useFetch<any>('/api/concepten', { query: { status: 'alle' }, immediate: gesprek.value, default: () => ({ concepten: [] }) })
const mijnConcept = computed(() => (concepten.value?.concepten ?? []).find((c: any) => (props.onderwerp === 'taak' ? c.taskId : c.afspraakId) === props.id))
const open = ref(!props.ingeklapt)
const bewerk = ref<string | null>(null)
const tekst = ref('')
async function bewaar(blok: string) {
  if (props.onderwerp === 'account') return
  try {
    if (import.meta.client && !navigator.onLine) await voegToe({ tabel: 'briefing_teksten', op: 'patch', recordId: `${props.onderwerp}:${props.id}:${blok}`, patch: { soort: 'briefing.tekst', tekst: tekst.value } })
    else await $fetch('/api/briefing/tekst', { method: 'PUT', body: { onderwerp: props.onderwerp, id: props.id, blok, tekst: tekst.value } })
    bewerk.value = null; await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function zetSoort(s: string) {
  try { await $fetch('/api/briefing/tekst', { method: 'PUT', body: { onderwerp: props.onderwerp, id: props.id, blok: '_soort', tekst: s } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const bereidt = ref(false)
async function bereidVoor() {
  bereidt.value = true
  try {
    const r = await $fetch<any>('/api/agent/prepare', { method: 'POST', body: props.onderwerp === 'taak' ? { taskId: props.id } : { appointmentId: props.id } })
    toast.toon(r.status === 'klaar' ? 'Het concept staat klaar ter goedkeuring.' : `Voorbereiden lukte niet: ${r.reden ?? 'onbekend'}.`, r.status === 'klaar' ? 'succes' : 'fout')
    await Promise.all([ververs(), refresh()])
  } catch (e: any) {
    if (e?.data?.data?.reden === 'niveau' || e?.data?.data?.reden === 'pakket') toonUitleg(e.data.data.functie)
    else toast.toon(foutTekst(e), 'fout')
  } finally { bereidt.value = false }
}
const stap = ref('')
async function doel(d: 'ja' | 'deels' | 'nee') {
  try { await $fetch('/api/briefing/uitkomst', { method: 'POST', body: { onderwerp: props.onderwerp, id: props.id, doel: d, volgendeStap: stap.value || null } }); toast.toon('Bewaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const vl = useVoorlezen()
const { functie } = useMe()
</script>

<template>
  <section v-if="data" class="bf" data-test="briefing">
    <header class="bf-kop">
      <span class="fo-kicker" data-test="briefing-soort">{{ data.soortLabel }}</span>
      <button v-if="functie('spraak.voorlezen')?.beschikbaar && vl.kan()" type="button" class="dd-act" :aria-pressed="vl.spreekt.value" data-test="briefing-lees-voor" @click="vl.spreekt.value ? vl.stop() : vl.lees(data.drieRegels.join('. '))"><Icoon :naam="vl.spreekt.value ? 'VolumeX' : 'Volume2'" />{{ vl.spreekt.value ? 'Stop' : 'Lees voor' }}</button>
      <button v-if="ingeklapt" type="button" class="dd-tekstknop" :aria-expanded="open" @click="open = !open">{{ open ? 'Minder' : 'Hele briefing' }}</button>
    </header>
    <article v-if="data.contact" class="bf-contact" data-test="briefing-contact">
      <header class="bf-contact-kop">
        <div>
          <h4 class="bf-blok-titel"><NuxtLink :to="`/contacten/${data.contact.id}`" data-test="briefing-contact-naam">{{ data.contact.naam }}</NuxtLink></h4>
          <p class="meta">{{ [data.contact.functie, ROL[data.contact.rol] ?? null].filter(Boolean).join(' · ') || 'Geen functie bekend' }}</p>
        </div>
        <span v-if="data.contact.belMeNiet" class="pil pil--rood">Bel me niet</span>
        <span v-if="data.contact.vertrokken" class="pil">Vertrokken</span>
      </header>
      <ul class="bf-contact-gegevens">
        <li v-if="data.contact.telefoon"><Icoon naam="Phone" :grootte="14" /><a :href="`tel:${data.contact.telefoon}`">{{ data.contact.telefoon }}</a></li>
        <li v-if="data.contact.mobiel"><Icoon naam="Smartphone" :grootte="14" /><a :href="`tel:${data.contact.mobiel}`">{{ data.contact.mobiel }}</a></li>
        <li v-if="data.contact.email"><Icoon naam="Mail" :grootte="14" /><a :href="`mailto:${data.contact.email}`">{{ data.contact.email }}</a></li>
      </ul>
      <p class="veld-label mt-8">Laatste contact</p>
      <ul v-if="data.contact.momenten.length" class="bf-regels" data-test="briefing-contact-momenten">
        <li v-for="m in data.contact.momenten" :key="m.op">{{ dag(m.op) }} · {{ MOMENT[m.soort] ?? m.soort }}<template v-if="m.uitkomst"> · {{ m.uitkomst.replace(/_/g, ' ') }}</template><template v-if="m.tekst">: {{ m.tekst }}</template></li>
      </ul>
      <p v-else class="meta">Nog geen contactmoment met {{ data.contact.naam }}.</p>
      <template v-if="data.contact.gesprekken.length">
        <p class="veld-label mt-8">Komende gesprekken</p>
        <ul class="bf-contact-gesprekken">
          <li v-for="g in data.contact.gesprekken" :key="g.id"><button type="button" class="dd-act" :data-test="`briefing-gesprek-${g.id}`" @click="emit('gesprek', g)">{{ g.onderwerp === 'afspraak' ? 'Afspraak' : 'Taak' }} · {{ g.titel }} · {{ kort(g.wanneer) }}</button></li>
        </ul>
      </template>
    </article>
    <ul v-if="!open" class="bf-regels" data-test="briefing-regels"><li v-for="r in data.drieRegels" :key="r">{{ r }}</li></ul>
    <template v-else>
      <div v-if="data.kan.vastzetten && gesprek" class="bf-soort"><label class="veld"><span class="veld-label">Soort</span>
        <select class="invoer" :value="data.vastgezet ? data.soort : ''" data-test="briefing-soortkiezer" @change="zetSoort(($event.target as HTMLSelectElement).value)"><option value="">Automatisch ({{ data.soortLabel }})</option><option v-for="s in BRIEFING_SOORTEN" :key="s" :value="s">{{ SOORT_LABEL[s as BriefingSoort] }}</option></select></label></div>
      <article v-for="b in data.blokken" :key="b.sleutel" class="bf-blok" :data-test="`blok-${b.sleutel}`">
        <header class="bf-blok-kop"><h4 class="bf-blok-titel">{{ b.titel }}</h4><span class="bf-herkomst" :class="`bf-herkomst--${b.herkomst}`">{{ HERKOMST_LABEL[b.herkomst as 'berekend'] }}</span>
          <button v-if="data.kan.bewerken && gesprek && bewerk !== b.sleutel" type="button" class="dd-tekstknop" :data-test="`bewerk-${b.sleutel}`" @click="bewerk = b.sleutel; tekst = b.tekst">Bewerken</button></header>
        <template v-if="bewerk === b.sleutel">
          <textarea v-model="tekst" class="invoer" rows="3" :data-test="`tekst-${b.sleutel}`" />
          <div class="dd-acties mt-8"><button type="button" class="dd-act dd-act--primair" :data-test="`bewaar-${b.sleutel}`" @click="bewaar(b.sleutel)">Bewaar</button><button type="button" class="dd-act" @click="bewerk = null">Annuleren</button></div>
        </template>
        <p v-else class="bf-tekst">{{ b.tekst }}</p>
        <p v-if="b.bron" class="meta">Bron: {{ b.bron }}</p>
        <p v-if="b.gat" class="meta meta--oranje">{{ b.gat }}</p>
      </article>
    </template>
    <div v-if="gesprek" class="bf-pitstop">
      <ConceptKaart v-if="mijnConcept" :concept="mijnConcept" compact @gewijzigd="ververs()" />
      <button v-if="data.kan.pitstop && (!mijnConcept || data.kan.opnieuw)" type="button" class="dd-act" :disabled="bereidt" data-test="bereid-voor" @click="bereidVoor">{{ bereidt ? 'Bezig…' : mijnConcept ? 'Maak opnieuw' : 'Bereid voor' }}</button>
      <button v-else-if="!data.kan.pitstop" type="button" class="dd-act knop-slot" data-test="bereid-voor-slot" @click="toonUitleg('pitstop.maken')"><Icoon naam="Lock" :grootte="14" /> Bereid voor</button>
    </div>
    <div v-if="gesprek" class="bf-doel" data-test="doel-gehaald">
      <span class="veld-label">Doel gehaald?</span>
      <div class="dd-acties"><button v-for="d in (['ja', 'deels', 'nee'] as const)" :key="d" type="button" class="dd-act" :class="{ 'dd-act--primair': data.uitkomst?.doel === d }" :data-test="`doel-${d}`" @click="doel(d)">{{ d === 'ja' ? 'Ja' : d === 'deels' ? 'Deels' : 'Nee' }}</button></div>
      <input v-model="stap" class="invoer mt-8" placeholder="Volgende stap (optioneel)" aria-label="Volgende stap">
    </div>
  </section>
  <p v-else-if="error" class="meta" data-test="briefing-fout">{{ foutTekst(error) }}</p>
</template>

<style scoped>
.bf-contact { padding: 12px 0; border-top: 1px solid var(--border); }
.bf-contact-kop { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; justify-content: space-between; }
.bf-contact-kop .meta { margin: 2px 0 0; }
.bf-contact-gegevens { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: var(--fs-meta); }
.bf-contact-gegevens li { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; }
.bf-contact-gegevens a { overflow-wrap: anywhere; }
.bf-contact-gesprekken { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 6px; }
.bf-contact-gesprekken .dd-act { width: 100%; justify-content: flex-start; text-align: left; white-space: normal; height: auto; min-height: 36px; }
@media (max-width: 720px) { .bf-contact-gegevens li { min-height: var(--touch-target-min); } .bf-contact-gesprekken .dd-act { min-height: var(--touch-target-min); } }
</style>
