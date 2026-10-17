<script setup lang="ts">
// Instellingen, Terugkomen, tabblad Hercontactritme: de stappen na de terugkomdatum (dag en kanaal, wat de
// accountmanager doet), parkeren na de laatste stap, een nieuw ritme maken. Rechts het ritme als tijdlijn
// met echte datums en wat de accountmanager dan in Taken ziet. Salesmanager en beheerder (ritme.beheer).
// Lopende ritmes houden hun stappen; nieuwe starts volgen het bewaarde ritme.
import { KANAAL_LABEL_RITME, valideerRitme } from '~~/shared/hercontact'
import { OPPAKKER_LABEL, ritmeTijdlijn, terugDagKort, terugDagLang, type Oppakker } from '~~/shared/terugkomBeheer'

const props = defineProps<{ data: any }>()
const emit = defineEmits<{ bewaard: [] }>()
const toast = useToast()
const mag = computed(() => !!props.data.kan?.ritme)
const ritmes = computed<any[]>(() => props.data.ritmes ?? [])
const ritmeId = ref<string>('')
const concept = ref<{ naam: string; stappen: { dagOffset: number; kanaal: string; instructie?: string }[]; parkeerDagen: number } | null>(null)

function kies(id: string) {
  ritmeId.value = id
  const r = ritmes.value.find((x) => x.id === id)
  concept.value = r
    ? { naam: r.naam, stappen: r.stappen.map((s: any) => ({ dagOffset: s.dagOffset, kanaal: s.kanaal, instructie: s.instructie ?? '' })), parkeerDagen: r.parkeerDagen }
    : { naam: '', stappen: [{ dagOffset: 0, kanaal: 'bellen', instructie: 'Bel met de aanpak van de regel' }, { dagOffset: 3, kanaal: 'mail', instructie: 'Mail met een klantverhaal' }], parkeerDagen: 180 }
}
watch(ritmes, (l) => {
  if (ritmeId.value === 'nieuw') return
  const voorkeur = (props.data.regels ?? []).find((r: any) => r.hercontactritmeId)?.hercontactritmeId
  kies(l.some((x) => x.id === ritmeId.value) ? ritmeId.value : l.find((x) => x.id === voorkeur)?.id ?? l.find((x) => x.bron === 'winback')?.id ?? l[0]?.id ?? 'nieuw')
}, { immediate: true })

const gebruik = computed(() => ritmes.value.find((x) => x.id === ritmeId.value)?.gebruiktDoor ?? [])
const gesorteerd = computed(() => [...(concept.value?.stappen ?? [])].map((s) => ({ ...s, dagOffset: Number(s.dagOffset) })).sort((a, b) => a.dagOffset - b.dagOffset))
const fouten = computed(() => (concept.value ? valideerRitme({ naam: concept.value.naam, stappen: gesorteerd.value.map((s, i) => ({ ...s, volgnummer: i + 1 })) as any, parkeerDagen: Number(concept.value.parkeerDagen) }) : []))
const origineel = computed(() => { const r = ritmes.value.find((x) => x.id === ritmeId.value); return r ? JSON.stringify([r.naam, r.stappen.map((s: any) => [s.dagOffset, s.kanaal, s.instructie ?? '']), r.parkeerDagen]) : '' })
const gewijzigd = computed(() => ritmeId.value === 'nieuw' || (!!concept.value && JSON.stringify([concept.value.naam, concept.value.stappen.map((s) => [Number(s.dagOffset), s.kanaal, s.instructie ?? '']), Number(concept.value.parkeerDagen)]) !== origineel.value))

function stapErbij() {
  const l = concept.value!.stappen.at(-1)
  concept.value!.stappen.push({ dagOffset: Number(l?.dagOffset ?? 0) + 7, kanaal: 'bellen', instructie: 'Bel en vraag naar het juiste moment' })
}

// Voorbeeld: een wachtende prospect met een regel die dit ritme gebruikt, anders vandaag.
const vb = computed(() => props.data.ritmeVoorbeeld?.[ritmeId.value] ?? null)
const start = computed(() => (vb.value && vb.value.terugOp > props.data.vandaag ? vb.value.terugOp : props.data.vandaag))
const tijdlijn = computed(() => (concept.value && gesorteerd.value.length ? ritmeTijdlijn(gesorteerd.value, Number(concept.value.parkeerDagen) || 1, start.value) : null))
const vbRegel = computed(() => (props.data.regels ?? []).find((r: any) => r.id === vb.value?.regelId) ?? (props.data.regels ?? []).find((r: any) => r.hercontactritmeId === ritmeId.value) ?? null)
const ICOON: Record<string, { naam: string; klas: string }> = {
  bellen: { naam: 'Phone', klas: 'item-icoon--call' }, mail: { naam: 'Mail', klas: 'item-icoon--email' }, bezoek: { naam: 'MapPin', klas: 'item-icoon--visit' },
  linkedin: { naam: 'Linkedin', klas: '' }, whatsapp: { naam: 'MessageCircle', klas: '' },
}
const kanaal = (k: string) => KANAAL_LABEL_RITME[k] ?? k
const groot = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

const bezig = ref(false)
async function bewaar() {
  if (!concept.value || fouten.value.length) return
  bezig.value = true
  const body = { naam: concept.value.naam.trim(), stappen: gesorteerd.value, parkeerDagen: Number(concept.value.parkeerDagen) }
  try {
    if (ritmeId.value === 'nieuw') {
      const r: any = await $fetch('/api/ritmes', { method: 'POST', body })
      ritmeId.value = r.id
      toast.toon(`Ritme ${body.naam} gemaakt. Kies het bij een regel op het tabblad Regels.`)
    } else {
      await $fetch(`/api/ritmes/${ritmeId.value}`, { method: 'PUT', body })
      toast.toon(`Ritme ${body.naam} bewaard. Lopende ritmes houden hun stappen; nieuwe starts volgen dit ritme.`)
    }
    emit('bewaard')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <div class="trm">
    <form v-if="concept" class="kaart trm-form" aria-labelledby="tk-ritme-titel" data-test="tk-ritmeform" @submit.prevent="bewaar">
      <span class="kicker">Hercontactritme</span>
      <h2 id="tk-ritme-titel" class="trm-titel">Stappen na de terugkomdatum</h2>
      <div class="trm-kies mt-16">
        <label class="veld"><span class="veld-label">Ritme</span>
          <select :value="ritmeId" class="invoer" data-test="tk-ritmekeuze" @change="kies(($event.target as HTMLSelectElement).value)">
            <option v-for="r in ritmes" :key="r.id" :value="r.id">{{ r.naam }}</option>
            <option v-if="ritmeId === 'nieuw'" value="nieuw">Nieuw ritme</option>
          </select>
        </label>
        <button v-if="mag && ritmeId !== 'nieuw'" type="button" class="dd-act" data-test="tk-ritme-nieuw" @click="kies('nieuw')"><Icoon naam="Plus" />Nieuw ritme</button>
      </div>
      <p class="meta mt-8" data-test="tk-ritme-gebruik">{{ ritmeId === 'nieuw' ? 'Een nieuw ritme kies je daarna bij een regel.' : gebruik.length ? `Gebruikt door de ${gebruik.length === 1 ? 'regel' : 'regels'} ${gebruik.join(' en ')}.` : 'Nog door geen enkele regel gekozen. Zonder keuze volgt een regel het standaard winbackritme.' }}</p>
      <p v-if="!mag" class="meta mt-8">Je kunt dit ritme bekijken; aanpassen doet je salesmanager of beheerder.</p>
      <label v-if="ritmeId === 'nieuw' || mag" class="veld mt-16"><span class="veld-label">Naam van het ritme</span><input v-model="concept.naam" class="invoer" maxlength="80" :disabled="!mag" data-test="tk-ritme-naam"></label>
      <div class="mt-16">
        <div v-for="(s, i) in concept.stappen" :key="i" class="trm-stap" :data-test="`tk-stap-${i}`">
          <label class="veld"><span class="veld-label">Stap {{ i + 1 }}: dag</span><input v-model.number="s.dagOffset" class="invoer tnum" type="number" min="0" max="365" :disabled="!mag"></label>
          <label class="veld"><span class="veld-label">Kanaal</span><select v-model="s.kanaal" class="invoer" :disabled="!mag"><option v-for="(l, k) in KANAAL_LABEL_RITME" :key="k" :value="k">{{ groot(l) }}</option></select></label>
          <label class="veld trm-wat"><span class="veld-label">Wat hij dan doet</span><input v-model="s.instructie" class="invoer" maxlength="200" :disabled="!mag"></label>
          <button v-if="mag" type="button" class="dd-act dd-act--icoon trm-weg" :aria-label="`Stap ${i + 1} verwijderen`" :disabled="concept.stappen.length < 2" @click="concept.stappen.splice(i, 1)"><Icoon naam="Trash2" /></button>
        </div>
      </div>
      <button v-if="mag" type="button" class="dd-act mt-8" data-test="tk-stap-erbij" @click="stapErbij"><Icoon naam="Plus" />Stap toevoegen</button>
      <label class="veld mt-16"><span class="veld-label">Geen reactie na de laatste stap: parkeren voor (dagen)</span><input v-model.number="concept.parkeerDagen" class="invoer tnum" type="number" min="1" max="730" :disabled="!mag" data-test="tk-park"></label>
      <p v-if="fouten.length && mag" class="meta mt-8">Nog nodig: {{ fouten.join(', ').toLowerCase() }}.</p>
      <div v-if="mag" class="trm-voet">
        <button type="submit" class="dd-actie dd-actie--primair" :disabled="bezig || !gewijzigd || !!fouten.length" data-test="tk-ritme-bewaar">{{ ritmeId === 'nieuw' ? 'Maak ritme' : 'Bewaar ritme' }}</button>
        <button type="button" class="dd-actie dd-actie--secundair" :disabled="!gewijzigd" @click="ritmeId === 'nieuw' ? kies(ritmes[0]?.id ?? 'nieuw') : kies(ritmeId)">Annuleer</button>
      </div>
    </form>

    <div>
      <div class="kaart trm-vb" data-test="tk-tijdlijn">
        <span class="kicker">Voorbeeld</span>
        <h3 class="trm-vb-titel">{{ vb ? `${vb.naam}, gestart op ${terugDagKort(tijdlijn?.stappen[0]?.datum ?? start)}` : `Gestart op ${terugDagKort(tijdlijn?.stappen[0]?.datum ?? start)}` }}</h3>
        <p class="meta mt-8">Dag 0 is de dag waarop de accountmanager het hercontact start. Een stap in het weekend of op een feestdag schuift naar de volgende werkdag.</p>
        <ol v-if="tijdlijn" class="trm-lijn mt-16">
          <li v-for="s in tijdlijn.stappen" :key="s.nr"><span class="trm-dag">dag {{ s.dag }}<span>{{ terugDagKort(s.datum) }}</span></span><div class="trm-blok"><strong>{{ s.nr }}. {{ groot(kanaal(s.kanaal)) }}</strong><p v-if="s.tekst" class="meta">{{ s.tekst }}</p></div></li>
          <li><span class="trm-dag">daarna<span>{{ terugDagKort(tijdlijn.parkeren.vanaf) }}</span></span><div class="trm-blok trm-blok--park"><strong>Geen reactie: parkeren</strong><p class="meta">Terug na {{ concept?.parkeerDagen }} dagen, op {{ terugDagLang(tijdlijn.parkeren.terugOp) }}. Een reactie of afspraak stopt het ritme meteen.</p></div></li>
        </ol>
      </div>
      <div v-if="tijdlijn && tijdlijn.stappen[0]" class="kaart trm-am mt-16" data-test="tk-am-voorbeeld">
        <p class="trm-am-kop"><Icoon naam="ListTodo" :grootte="16" />Wat de accountmanager dan ziet</p>
        <div class="item-rij">
          <span class="item-tijd">{{ terugDagKort(tijdlijn.stappen[0].datum) }}<small>09:00</small></span>
          <span class="item-icoon" :class="ICOON[tijdlijn.stappen[0].kanaal]?.klas"><Icoon :naam="ICOON[tijdlijn.stappen[0].kanaal]?.naam ?? 'ListTodo'" /></span>
          <span class="item-body">
            <span class="item-naam">Poging 1 van {{ tijdlijn.stappen.length }}: {{ vb?.naam ?? 'een verloren prospect' }}</span>
            <span class="item-meta">{{ tijdlijn.stappen[0].tekst || groot(kanaal(tijdlijn.stappen[0].kanaal)) }}.<template v-if="vbRegel"> Aanpak: {{ vbRegel.aanpak }}</template></span>
            <span v-if="vbRegel" class="item-meta">Regel {{ vbRegel.reden }} · {{ OPPAKKER_LABEL[vbRegel.oppakker as Oppakker] }}</span>
            <span class="item-meta">Hierna: {{ tijdlijn.stappen.slice(1).map((s) => `${kanaal(s.kanaal)} op ${terugDagKort(s.datum)}`).join(', ') || 'geen volgende stap' }}.</span>
            <span class="pil-tags"><span class="pil">{{ groot(kanaal(tijdlijn.stappen[0].kanaal)) }}</span><span class="pil">Terugkomregel</span></span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trm { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 24px; align-items: start; }
@media (max-width: 1023px) { .trm { grid-template-columns: minmax(0, 1fr); } }
.trm-form, .trm-vb, .trm-am { padding: var(--kaart-padding); }
.trm-titel { margin: 6px 0 0; font-family: var(--font-serif); font-size: 22px; line-height: 1.2; }
.trm-kies { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
.trm-kies .veld { flex: 1 1 220px; }
.trm-stap { display: grid; grid-template-columns: 96px 140px minmax(0, 1fr) auto; gap: 8px; align-items: end; padding: 8px 0; border-bottom: 1px solid var(--border); }
@media (max-width: 599px) {
  .trm-stap { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
  .trm-wat { grid-column: 1 / -1; grid-row: 2; }
  .trm-weg { grid-column: 3; grid-row: 1; }
}
.trm-voet { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.trm-vb-titel { margin: 6px 0 0; font-size: 18px; overflow-wrap: anywhere; }
.trm-lijn { list-style: none; margin: 0; padding: 0; }
.trm-lijn li { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 12px; padding: 8px 0; border-left: 2px solid var(--border); margin-left: 6px; padding-left: 12px; }
.trm-dag { font-weight: 700; font-size: var(--fs-klein); }
.trm-dag span { display: block; font-weight: 400; color: var(--muted); }
.trm-blok { padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); }
.trm-blok p { margin: 2px 0 0; }
.trm-blok--park { border-style: dashed; background: transparent; }
.trm-am-kop { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-weight: 700; }
</style>
