<script setup lang="ts">
// De briefing in de flyout op /briefings. Twee tabbladen: Drie regels (wat je in de auto of tussen twee gesprekken
// nodig hebt) en Hele briefing: de soort als pillen met de reden waarom hij automatisch zo staat (vastzetten vanaf
// Expert), de contactpersoon bij een gekozen contact, genummerde blokken met herkomst (Berekend, Door AI geschreven,
// Eigen tekst) en bron, bewerken per blok of alle blokken tegelijk met de opslaan-status in de kop, de Pitstop met
// het concept en waar het op gebaseerd is, en na het gesprek "Doel gehaald?". De voet volgt de flyoutstandaard:
// links de hoofdactie (Open afspraak, Open taak of Open accountkaart), rechts Vraag AI, Lees voor, alle blokken
// bewerken, afdrukken (de volledige briefing als document) en de accountkaart.
import { BRIEFING_SOORTEN, HERKOMST_LABEL, type BriefingSoort } from '~~/shared/briefing'
import { SOORT_KLEUR, SOORT_KORT } from '~~/shared/briefingOverzicht'
const props = defineProps<{ onderwerp: 'afspraak' | 'taak' | 'account'; id: string; contactId?: string | null; tab?: 'drie' | 'hele'; pitstop?: boolean }>()
const emit = defineEmits<{ sluit: []; gewijzigd: []; wisContact: []; gesprek: [g: { onderwerp: 'afspraak' | 'taak'; id: string }]; openItem: [g: { onderwerp: 'afspraak' | 'taak'; id: string }] }>()
const toast = useToast()
const { functie } = useMe()
const { toon: toonUitleg } = useNietAangezet()
const { openen: openAi } = useAssistent()
const gesprek = computed(() => props.onderwerp !== 'account')
const { data, refresh, error } = useFetch<any>('/api/briefing', { query: computed(() => ({ [props.onderwerp]: props.id, contact: props.onderwerp === 'account' && props.contactId ? props.contactId : undefined })), default: () => null })
const { data: concepten, refresh: ververs } = useFetch<any>('/api/concepten', { query: { status: 'alle' }, immediate: gesprek.value, default: () => ({ concepten: [] }) })
const concept = computed(() => (concepten.value?.concepten ?? []).find((c: any) => (props.onderwerp === 'taak' ? c.taskId : c.afspraakId) === props.id) ?? null)
const tab = ref<'drie' | 'hele'>(props.tab ?? (gesprek.value ? 'drie' : 'hele'))
const gemonteerd = ref(false)
const nu = ref(0)
onMounted(() => { gemonteerd.value = true; nu.value = Date.now(); if (props.pitstop) bereidVoor() })

const TZ = 'Europe/Amsterdam'
const wanneerTekst = computed(() => {
  const w = data.value?.wanneer
  if (!w) return 'zonder datum'
  const d = new Date(w).toLocaleDateString('sv-SE', { timeZone: TZ })
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: TZ })
  const morgen = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: TZ })
  const uur = new Date(w).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  const dagTekst = d === vandaag ? 'vandaag' : d === morgen ? 'morgen' : d < vandaag ? `over tijd (${new Date(w).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: TZ })})` : new Date(w).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })
  return `${dagTekst} ${uur}`
})
const voorbij = computed(() => !!data.value?.wanneer && nu.value > 0 && Date.parse(data.value.wanneer) < nu.value)

// Opslaan-status in de kop: Gewijzigd, Opslaan..., Opgeslagen om 09:12.
const status = ref<null | 'gewijzigd' | 'bezig' | 'klaar' | 'fout'>(null)
const opgeslagenOm = ref('')
const bewerk = ref<string | null>(null)
const alles = ref(false)
const teksten = reactive<Record<string, string>>({})
const kanBewerken = computed(() => !!data.value?.kan?.bewerken && gesprek.value)
async function bewaarBlok(blok: string, tekst: string) {
  status.value = 'bezig'
  try {
    await $fetch('/api/briefing/tekst', { method: 'PUT', body: { onderwerp: props.onderwerp, id: props.id, blok, tekst } })
    opgeslagenOm.value = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    status.value = 'klaar'
    emit('gewijzigd')
  } catch (e) { status.value = 'fout'; toast.toon(foutTekst(e), 'fout') }
}
function startBewerk(b: any) { bewerk.value = b.sleutel; teksten[b.sleutel] = b.tekst === 'Nog niet bekend.' ? '' : b.tekst; nextTick(() => document.querySelector<HTMLTextAreaElement>(`[data-test="tekst-${b.sleutel}"]`)?.focus()) }
async function bewaar(sleutel: string) { await bewaarBlok(sleutel, teksten[sleutel] ?? ''); bewerk.value = null; await refresh() }
function annuleer() { bewerk.value = null; if (status.value === 'gewijzigd') status.value = null }
const timers: Record<string, ReturnType<typeof setTimeout>> = {}
function typ(sleutel: string) {
  status.value = 'gewijzigd'
  if (!alles.value) return
  clearTimeout(timers[sleutel])
  timers[sleutel] = setTimeout(() => bewaarBlok(sleutel, teksten[sleutel] ?? ''), 1200)
}
async function wisselAlles() {
  if (!alles.value) {
    for (const b of data.value?.blokken ?? []) teksten[b.sleutel] = b.tekst === 'Nog niet bekend.' ? '' : b.tekst
    alles.value = true; bewerk.value = null; tab.value = 'hele'
    return
  }
  // Klaar met bewerken: wat nog wacht meteen bewaren.
  for (const [k, t] of Object.entries(timers)) { clearTimeout(t); delete timers[k]; await bewaarBlok(k, teksten[k] ?? '') }
  alles.value = false
  await refresh()
}

async function zetSoort(s: string) {
  if (!data.value?.kan?.vastzetten) { toonUitleg('briefing.soortVastzetten'); return }
  // Dezelfde soort als de automatische keuze: niet vastzetten maar terug naar automatisch.
  const tekst = s === data.value.automatischeSoort ? '' : s
  await bewaarBlok('_soort', tekst); await refresh()
}

// Pitstop: Bereid voor zet een concept klaar ter goedkeuring (2 credits).
const bereidt = ref(false)
async function bereidVoor() {
  if (!gesprek.value || bereidt.value) return
  tab.value = 'hele'
  if (data.value && !data.value.kan?.pitstop) { toonUitleg('pitstop.maken'); return }
  bereidt.value = true
  try {
    const r = await $fetch<any>('/api/agent/prepare', { method: 'POST', body: props.onderwerp === 'taak' ? { taskId: props.id } : { appointmentId: props.id } })
    toast.toon(r.status === 'klaar' ? 'Het concept staat klaar ter goedkeuring.' : `Voorbereiden lukte niet: ${r.reden ?? 'onbekend'}.`, r.status === 'klaar' ? 'succes' : 'fout')
    await Promise.all([ververs(), refresh()]); emit('gewijzigd')
  } catch (e: any) {
    if (e?.data?.data?.reden === 'niveau' || e?.data?.data?.reden === 'pakket') toonUitleg(e.data.data.functie)
    else toast.toon(foutTekst(e), 'fout')
  } finally { bereidt.value = false }
}

const stap = ref('')
async function doel(d: 'ja' | 'deels' | 'nee') {
  status.value = 'bezig'
  try {
    await $fetch('/api/briefing/uitkomst', { method: 'POST', body: { onderwerp: props.onderwerp, id: props.id, doel: d, volgendeStap: stap.value || null } })
    opgeslagenOm.value = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); status.value = 'klaar'
    await refresh(); emit('gewijzigd')
  } catch (e) { status.value = 'fout'; toast.toon(foutTekst(e), 'fout') }
}

const vl = useVoorlezen()
const kanLezen = computed(() => gemonteerd.value && !!functie('spraak.voorlezen')?.beschikbaar && vl.kan())
function leesVoor() { if (vl.spreekt.value) vl.stop(); else vl.lees((data.value?.drieRegels ?? []).join('. ')) }
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
async function drukAf() {
  tab.value = 'hele'; alles.value = false; bewerk.value = null
  await nextTick()
  document.body.classList.add('druk-flyout')
  const weg = () => { document.body.classList.remove('druk-flyout'); window.removeEventListener('afterprint', weg) }
  window.addEventListener('afterprint', weg)
  window.print()
  setTimeout(weg, 1000)
}
const ROL: Record<string, string> = { beslisser: 'Beslisser', beinvloeder: 'Beïnvloeder', champion: 'Champion', gebruiker: 'Gebruiker', receptie: 'Receptie' }
const MOMENT: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', afspraak: 'Afspraak', bezoek: 'Bezoek', linkedin: 'LinkedIn', notitie: 'Notitie' }
const dag = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: TZ })
const kort = (iso: string | null) => (iso ? new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : 'Geen datum')
const soort = computed(() => data.value?.soort as BriefingSoort | undefined)
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape') emit('sluit') }
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => { window.removeEventListener('keydown', opEscape); for (const t of Object.values(timers)) clearTimeout(t); vl.stop() })
</script>

<template>
  <Teleport to="body">
    <div class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--breed bfd" role="dialog" aria-modal="true" aria-labelledby="bfd-titel" :data-test="onderwerp === 'account' ? 'briefing-gekozen' : 'briefing-venster'">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker"><span v-if="soort" class="bfd-stip" :class="`bfd-stip--${SOORT_KLEUR[soort]}`" />Briefing<template v-if="data"> · {{ data.soortLabel }}<template v-if="data.vastgezet"> · vastgezet</template></template></span>
            <h2 id="bfd-titel" class="fo-titel">{{ data?.account?.naam ?? 'Briefing' }}</h2>
            <p v-if="data" class="fo-meta">
              <template v-if="data.contact"><NuxtLink :to="`/contacten/${data.contact.id}`" class="fo-link">{{ data.contact.naam }}</NuxtLink> · </template>
              <template v-if="gesprek">{{ onderwerp === 'afspraak' ? 'Afspraak' : 'Taak' }} {{ wanneerTekst }}<template v-if="data.titel"> · {{ data.titel }}</template></template>
              <template v-else>{{ data.account.soort === 'klant' ? 'Klant' : 'Prospect' }} · briefing voor je volgende contact</template>
            </p>
          </div>
          <span class="bfd-opslag" aria-live="polite" data-test="briefing-opslag">
            <template v-if="status === 'gewijzigd'"><span class="bfd-opslag--gewijzigd">Gewijzigd</span></template>
            <template v-else-if="status === 'bezig'">Opslaan…</template>
            <template v-else-if="status === 'klaar'"><Icoon naam="Check" :grootte="14" />Opgeslagen om {{ opgeslagenOm }}</template>
            <template v-else-if="status === 'fout'"><span class="bfd-opslag--fout">Niet opgeslagen</span></template>
          </span>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>

        <div class="fo-body">
          <p v-if="error" class="meta" data-test="briefing-fout">{{ foutTekst(error) }}</p>
          <p v-else-if="!data" class="fo-leeg">Laden...</p>
          <section v-else class="bf" data-test="briefing">
            <span class="sr-only" data-test="briefing-soort">{{ data.soortLabel }}</span>
            <div class="bfd-tabs" role="tablist" aria-label="Weergave van de briefing">
              <button type="button" role="tab" class="bfd-tab" :aria-selected="tab === 'drie'" data-test="briefing-tab-drie" @click="tab = 'drie'">Drie regels</button>
              <button type="button" role="tab" class="bfd-tab" :aria-selected="tab === 'hele'" data-test="briefing-tab-hele" @click="tab = 'hele'">Hele briefing</button>
            </div>

            <ol v-if="tab === 'drie'" class="bfd-drie" data-test="briefing-regels"><li v-for="r in data.drieRegels" :key="r">{{ r }}</li></ol>

            <template v-else>
              <div v-if="gesprek" class="bfd-soort" data-test="briefing-soortkeus">
                <span class="veld-label">Soort briefing</span>
                <div class="bfd-pillen" role="group" aria-label="Soort briefing">
                  <button v-for="s in BRIEFING_SOORTEN" :key="s" type="button" class="filter-pil bfd-soortpil" :class="[`bfd-soortpil--${SOORT_KLEUR[s]}`, { 'bfd-soortpil--aan': data.soort === s }]" :aria-pressed="data.soort === s" :disabled="!data.kan.vastzetten && data.soort !== s" :data-test="`briefing-soort-${s}`" @click="data.soort !== s && zetSoort(s)">{{ SOORT_KORT[s] }}</button>
                </div>
                <p class="meta" data-test="briefing-soortreden">
                  <template v-if="data.vastgezet">Vastgezet door jou. <button type="button" class="dd-tekstknop" data-test="briefing-soort-auto" @click="zetSoort(data.automatischeSoort)">Terug naar automatisch</button></template>
                  <template v-else>Automatisch gekozen: {{ data.soortReden }}.<template v-if="!data.kan.vastzetten"> Vastzetten kan vanaf Expert.</template></template>
                </p>
              </div>

              <article v-if="data.contact" class="bf-contact" data-test="briefing-contact">
                <header class="bf-contact-kop">
                  <div>
                    <h3 class="bf-blok-titel"><NuxtLink :to="`/contacten/${data.contact.id}`" data-test="briefing-contact-naam">{{ data.contact.naam }}</NuxtLink></h3>
                    <p class="meta">{{ [data.contact.functie, ROL[data.contact.rol] ?? null].filter(Boolean).join(' · ') || 'Geen functie bekend' }}</p>
                  </div>
                  <span v-if="data.contact.belMeNiet" class="pil pil--rood">Bel me niet</span>
                  <span v-if="data.contact.vertrokken" class="pil">Vertrokken</span>
                  <button type="button" class="dd-act" data-test="briefing-wis-contact" @click="emit('wisContact')">Wis contactpersoon</button>
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
                  <p class="veld-label mt-8">Volgende gesprekken</p>
                  <ul class="bf-contact-gesprekken">
                    <li v-for="g in data.contact.gesprekken" :key="g.id"><button type="button" class="dd-act" :data-test="`briefing-gesprek-${g.id}`" @click="emit('gesprek', { onderwerp: g.onderwerp, id: g.id })">{{ g.onderwerp === 'afspraak' ? 'Afspraak' : 'Taak' }} · {{ g.titel }} · {{ kort(g.wanneer) }}</button></li>
                  </ul>
                </template>
              </article>

              <p v-if="alles" class="bfd-allesbalk meta">Alle blokken staan open. Je wijzigingen slaan vanzelf op. <button type="button" class="dd-act" data-test="briefing-alles-klaar" @click="wisselAlles">Klaar met bewerken</button></p>

              <article v-for="(b, i) in data.blokken" :key="b.sleutel" class="bfd-blok" :class="{ 'bfd-blok--accent': b.sleutel === 'doel' }" :data-test="`blok-${b.sleutel}`">
                <header class="bfd-blok-kop">
                  <span class="bfd-nr tnum">{{ i + 1 }}</span>
                  <h3 class="bfd-blok-titel">{{ b.titel }}</h3>
                  <span class="bf-herkomst" :class="`bf-herkomst--${b.herkomst}`">{{ HERKOMST_LABEL[b.herkomst as 'berekend'] }}</span>
                  <button v-if="kanBewerken && !alles && bewerk !== b.sleutel" type="button" class="dd-act dd-act--icoon" :aria-label="`Bewerk ${b.titel}`" title="Bewerken" :data-test="`bewerk-${b.sleutel}`" @click="startBewerk(b)"><Icoon naam="Pencil" :grootte="14" /></button>
                </header>
                <template v-if="alles || bewerk === b.sleutel">
                  <textarea v-model="teksten[b.sleutel]" class="invoer bfd-tekstvak" rows="3" :aria-label="b.titel" :data-test="`tekst-${b.sleutel}`" @input="typ(b.sleutel)" />
                  <div v-if="!alles" class="dd-acties mt-8"><button type="button" class="dd-act dd-act--primair" :data-test="`bewaar-${b.sleutel}`" @click="bewaar(b.sleutel)">Bewaar</button><button type="button" class="dd-act" @click="annuleer">Annuleren</button></div>
                </template>
                <p v-else-if="b.tekst === 'Nog niet bekend.'" class="bfd-gat" data-test="briefing-gat">Nog niet bekend. Vraag het in het gesprek<template v-if="kanBewerken"> of vul het zelf aan</template>.</p>
                <p v-else class="bf-tekst">{{ b.tekst }}</p>
                <p v-if="b.bron && b.herkomst !== 'eigen' && bewerk !== b.sleutel" class="meta">Bron: {{ b.bron }}</p>
                <p v-if="b.gat" class="meta meta--oranje">{{ b.gat }}</p>
              </article>

              <section v-if="gesprek" class="bfd-pitstop" data-test="briefing-pitstop">
                <h3 class="bfd-blok-titel"><Icoon naam="Sparkles" :grootte="16" /> Pitstop: bereid voor</h3>
                <p v-if="bereidt" class="meta" role="status">Pitstop zet een concept klaar…</p>
                <template v-else-if="concept">
                  <div v-if="concept.concept?.bronnen?.length" class="bfd-herkomst" data-test="briefing-pitstop-herkomst">
                    <span class="meta">Gebaseerd op</span>
                    <span class="pil pil--leeg">Deze briefing</span>
                    <span v-for="b in concept.concept.bronnen" :key="b.titel" class="pil pil--leeg">{{ b.soort === 'winpunt' ? `Winpunt: ${b.titel}` : b.soort === 'aanleiding' ? 'Aanleiding' : b.titel }}</span>
                  </div>
                  <ConceptKaart :concept="concept" compact @gewijzigd="ververs(); emit('gewijzigd')" />
                </template>
                <p v-else class="meta">Laat Pitstop een belscript, mail of bezoekbriefing klaarzetten op basis van deze briefing. Het concept wacht op jouw goedkeuring.</p>
                <div v-if="!bereidt" class="dd-acties">
                  <button v-if="data.kan.pitstop && (!concept || data.kan.opnieuw)" type="button" class="dd-act" data-test="bereid-voor" @click="bereidVoor"><Icoon naam="Sparkles" :grootte="14" />{{ concept ? 'Maak opnieuw' : 'Bereid voor' }}</button>
                  <button v-else-if="!data.kan.pitstop" type="button" class="dd-act knop-slot" data-test="bereid-voor-slot" @click="toonUitleg('pitstop.maken')"><Icoon naam="Lock" :grootte="14" /> Bereid voor</button>
                </div>
              </section>

              <section v-if="gesprek && (voorbij || data.uitkomst)" class="bf-doel" data-test="doel-gehaald">
                <span class="veld-label">Doel gehaald?</span>
                <div class="dd-acties"><button v-for="d in (['ja', 'deels', 'nee'] as const)" :key="d" type="button" class="dd-act" :class="{ 'dd-act--primair': data.uitkomst?.doel === d }" :aria-pressed="data.uitkomst?.doel === d" :data-test="`doel-${d}`" @click="doel(d)">{{ d === 'ja' ? 'Ja' : d === 'deels' ? 'Deels' : 'Nee' }}</button></div>
                <input v-model="stap" class="invoer mt-8" placeholder="Volgende stap (optioneel)" aria-label="Volgende stap">
              </section>
              <p v-else-if="gesprek" class="meta">Na het gesprek vraagt de briefing hier: Doel gehaald? Ja, deels of nee, met de volgende stap.</p>
            </template>
          </section>
        </div>

        <footer v-if="data" class="fo-foot dd-acties bfd-voet">
          <button v-if="gesprek" type="button" class="dd-act dd-act--primair" data-test="briefing-open-item" @click="emit('openItem', { onderwerp: onderwerp as 'afspraak' | 'taak', id })"><Icoon :naam="onderwerp === 'afspraak' ? 'Calendar' : 'Phone'" :grootte="14" />{{ onderwerp === 'afspraak' ? 'Open afspraak' : 'Open taak' }}</button>
          <NuxtLink v-else :to="`/accounts/${data.account.id}`" class="dd-act dd-act--primair" data-test="briefing-open-account">Open accountkaart</NuxtLink>
          <span class="dd-acties-vul fo-foot-vul" />
          <button v-if="aiAan" type="button" class="dd-act dd-act--icoon" aria-label="Vraag AI" title="Vraag AI" data-test="briefing-ai" @click="openAi({ accountId: data.account.id, label: data.account.naam })"><Icoon naam="Sparkles" :grootte="16" /></button>
          <button v-if="kanLezen" type="button" class="dd-act dd-act--icoon" :aria-label="vl.spreekt.value ? 'Stop met voorlezen' : 'Lees voor'" :title="vl.spreekt.value ? 'Stop' : 'Lees voor'" :aria-pressed="vl.spreekt.value" data-test="briefing-lees-voor" @click="leesVoor"><Icoon :naam="vl.spreekt.value ? 'VolumeX' : 'Volume2'" :grootte="16" /></button>
          <button v-if="kanBewerken" type="button" class="dd-act dd-act--icoon" aria-label="Alle blokken bewerken" title="Alle blokken bewerken" :aria-pressed="alles" data-test="briefing-alles" @click="wisselAlles"><Icoon naam="Pencil" :grootte="16" /></button>
          <button type="button" class="dd-act dd-act--icoon" aria-label="Volledige briefing afdrukken" title="Afdrukken" data-test="briefing-afdrukken" @click="drukAf"><Icoon naam="FileText" :grootte="16" /></button>
          <NuxtLink v-if="gesprek" :to="`/accounts/${data.account.id}`" class="dd-act dd-act--icoon" aria-label="Open accountkaart" title="Open accountkaart" data-test="briefing-open-account"><Icoon naam="ChevronRight" :grootte="16" /></NuxtLink>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.bfd-stip { display: inline-block; width: 8px; height: 8px; margin-right: 6px; vertical-align: 1px; background: var(--ink); }
.bfd-stip--blauw { background: var(--blue); }
.bfd-stip--paars { background: var(--purple); }
.bfd-stip--oranje { background: var(--orange); }
.bfd-stip--groen { background: var(--green); }
.bfd-opslag { display: inline-flex; align-items: center; gap: 4px; align-self: center; margin-left: auto; font-size: 12px; color: var(--muted); white-space: nowrap; }
.bfd-opslag--gewijzigd { color: var(--orange-dark); font-weight: 700; }
.bfd-opslag--fout { color: var(--red); font-weight: 700; }
.bfd-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
.bfd-tab { min-height: 40px; padding: 0 14px; background: none; border: 0; border-bottom: 3px solid transparent; color: var(--muted); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.bfd-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--yellow); }
.bfd-drie { margin: 0; padding-left: 20px; display: grid; gap: 10px; font-size: 15px; line-height: 1.5; }
.bfd-soort { display: grid; gap: 6px; margin-bottom: 16px; }
.bfd-pillen { display: flex; flex-wrap: wrap; gap: 6px; }
.bfd-soortpil { border-left-width: 4px; }
.bfd-soortpil--blauw { border-left-color: var(--blue); }
.bfd-soortpil--zwart { border-left-color: var(--ink); }
.bfd-soortpil--paars { border-left-color: var(--purple); }
.bfd-soortpil--oranje { border-left-color: var(--orange); }
.bfd-soortpil--groen { border-left-color: var(--green); }
.bfd-soortpil--aan { background: var(--ink); color: var(--yellow); }
.bfd-soortpil:disabled { opacity: .55; cursor: not-allowed; }
.bfd-soort .meta { margin: 0; }
.bfd-allesbalk { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: var(--yellow-zacht); }
.bfd-blok { padding: 14px 0; border-top: 1px solid var(--border); }
.bfd-blok--accent { padding-left: 12px; border-left: 3px solid var(--yellow); }
.bfd-blok-kop { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.bfd-nr { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: var(--ink); color: var(--yellow); font-size: 11px; font-weight: 800; }
.bfd-blok-titel { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; margin: 0; font-size: 14px; font-weight: 700; }
.bfd-blok .bf-tekst { margin: 0; white-space: pre-line; }
.bfd-tekstvak { width: 100%; min-height: 80px; resize: vertical; }
.bfd-gat { margin: 0; padding: 8px 12px; background: var(--orange-zacht); border-left: 3px solid var(--orange); font-size: 13px; }
.bfd-pitstop { display: grid; gap: 8px; margin-top: 8px; padding: 14px; background: var(--surface); border: 1px solid var(--border); }
.bfd-herkomst { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.bf-doel { margin-top: 16px; }
.bf-contact { padding: 12px 0; border-top: 1px solid var(--border); }
.bf-contact-kop { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; justify-content: space-between; }
.bf-contact-kop .meta { margin: 2px 0 0; }
.bf-contact-gegevens { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: var(--fs-meta); }
.bf-contact-gegevens li { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; }
.bf-contact-gegevens a { overflow-wrap: anywhere; }
.bf-contact-gesprekken { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 6px; }
.bf-contact-gesprekken .dd-act { width: 100%; justify-content: flex-start; text-align: left; white-space: normal; height: auto; min-height: 36px; }
.bfd-voet { flex-wrap: wrap; row-gap: 8px; }
@media (max-width: 719px) {
  .bfd-tab, .bf-contact-gegevens li, .bf-contact-gesprekken .dd-act, .bfd-voet .dd-act--icoon { min-height: var(--touch-target-min); }
  .bfd-voet .dd-act--icoon { min-width: var(--touch-target-min); }
  .bfd-opslag { order: 3; width: 100%; margin-left: 0; }
}
@media print {
  .bfd-tabs, .bfd-soort .bfd-pillen, .bfd-pitstop, .bf-doel, .bfd-opslag, .bfd-blok-kop .dd-act { display: none !important; }
}
</style>
