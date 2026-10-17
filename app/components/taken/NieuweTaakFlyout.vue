<script setup lang="ts">
// Nieuwe taak ("Wat moet er gebeuren?") in de opzet van DealDrive (NieuweTaakFlyout): kicker met de
// prioriteit, klant en contactpersoon als zoekvelden (het contact gefilterd op de klant; een contact
// zonder klant neemt zijn klant mee), titel, prioriteit als vier knoppen, vervaldatum en tijd, type als
// knoppen met icoon, toegewezen aan (alleen met teamleden), aanleiding, Taak herhalen en Herinnering
// instellen (uitklapbaar). Beginner: klant, contactpersoon, titel, type en vervaldatum (F06).
import { nlMoment, nlTijdstip, volgendWerkmoment } from '~~/shared/datum'
import { HERHALING_LABEL, PRIORITEITEN, PRIO_LABEL, PRIO_STIP, TAAK_TYPES, herhalingAantal, taakTypesVoor } from '~~/shared/taken'
import type { Contact, Klant } from './KlantContactKiezer.vue'
const props = defineProps<{
  open: boolean
  account?: Klant | null
  teamleden?: { id: string; naam: string }[]
  actiesoort?: string
  /** Vooraf ingevulde titel en aanleiding (bv. "+ Bel taak" op Prospectplanning); anders dan voorgevuld geen herkomst assistent. */
  titel?: string
  aanleiding?: string
  voorgevuld?: { accountId?: string | null; titel?: string; actiesoort?: string; aanleiding?: string } | null
  contact?: Contact | null
  /** Geopend vanuit de AI-assistent: ligt dan boven de assistent. */
  bovenop?: boolean
}>()
const emit = defineEmits<{ sluit: []; gemaakt: [] }>()
const { functie } = useMe()
const toast = useToast()
const gevorderd = computed(() => !!functie('taken.herhaling')?.beschikbaar)

const drieMaanden = () => { const d = new Date(); d.setMonth(d.getMonth() + 3); return nlMoment(d).datum }
function leeg() {
  const m = nlMoment(volgendWerkmoment(new Date()))
  return {
    title: '', actionType: 'taak', priority: 'middel', datum: m.datum, tijd: `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}`,
    ownerId: '', aanleiding: '', beschrijving: '', herhalen: false, herhaling: 'wekelijks', herhalingTot: drieMaanden(),
    herinneren: false, herinneringMin: 30, herinneringKanaal: 'in-app',
  }
}
const f = reactive(leeg())
const klant = ref<Klant | null>(null)
const contact = ref<Contact | null>(null)
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot Maak taak opslaat; sluiten vraagt dan eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [f, klant.value?.id ?? null, contact.value?.id ?? null])
const ai = computed(() => ({ accountId: klant.value?.id ?? null, label: klant.value?.naam ?? 'Nieuwe taak', vraag: f.aanleiding.trim() ? `Maak een korte titel voor een taak met deze aanleiding: ${f.aanleiding.trim()}` : '', voorstellen: ['Maak een titel uit de aanleiding', 'Wanneer kan ik het beste bellen?', 'Welk type taak past hier?'] }))
const bezig = ref(false)
const fout = ref('')
// De taakkiezer; komt er een voorgevuld bezoek binnen (oude koppeling), dan staat Bezoek er ook bij.
const typeKeuzes = ref(TAAK_TYPES)

watch(() => props.open, async (o) => {
  if (!o) return
  const v = props.voorgevuld
  Object.assign(f, leeg(), props.actiesoort ? { actionType: props.actiesoort } : {}, props.titel ? { title: props.titel } : {}, props.aanleiding ? { aanleiding: props.aanleiding } : {}, v?.titel ? { title: v.titel } : {}, v?.actiesoort ? { actionType: v.actiesoort } : {}, v?.aanleiding ? { aanleiding: v.aanleiding } : {})
  typeKeuzes.value = taakTypesVoor(f.actionType)
  klant.value = props.account ? { ...props.account } : null
  contact.value = props.contact ? { accountId: props.account?.id ?? null, ...props.contact } : null
  fout.value = ''; bezig.value = false
  // Voorgevuld vanuit de AI-assistent: account, titel en aanleiding; pas "Maak taak" maakt de taak.
  if (v?.accountId && !klant.value) { try { const a: any = await ($fetch as any)(`/api/accounts/${v.accountId}`); klant.value = { id: a.id, naam: a.naam } } catch { klant.value = null } }
  await nextTick(); opslag.basis()
}, { immediate: true })

const dueIso = computed(() => (f.datum ? nlTijdstip(f.datum, f.tijd ? Number(f.tijd.slice(0, 2)) : 9, f.tijd ? Number(f.tijd.slice(3, 5)) : 0).toISOString() : undefined))
const aantal = computed(() => (f.herhalen && dueIso.value ? herhalingAantal(dueIso.value, f.herhaling, f.herhalingTot) : 1))
const kanMaken = computed(() => f.title.trim().length >= 3 && !bezig.value)

async function maak() {
  if (!kanMaken.value) return
  bezig.value = true; fout.value = ''
  try {
    await opslag.bewaar(() => $fetch('/api/tasks', {
      method: 'POST',
      body: {
        title: f.title.trim(), actionType: f.actionType, dueDate: dueIso.value, accountId: klant.value?.id, contactId: contact.value?.id,
        ...(gevorderd.value ? {
          priority: f.priority, ownerId: f.ownerId || undefined, beschrijving: f.beschrijving || undefined,
          herhaling: f.herhalen ? f.herhaling : undefined, herhalingMax: f.herhalen ? aantal.value : undefined,
          herinnering: f.herinneren ? { minuten: f.herinneringMin, kanaal: f.herinneringKanaal } : undefined,
        } : {}),
        aanleiding: f.aanleiding.trim() || props.voorgevuld?.aanleiding || undefined,
        ...(props.voorgevuld ? { herkomst: 'assistent' } : {}),
      },
    }))
    toast.toon(f.herhalen && aantal.value > 1 ? `Taak gemaakt. Na afronden staat de volgende klaar, ${aantal.value} in totaal.` : 'Taak gemaakt.')
    emit('gemaakt')
  } catch (e) { fout.value = foutTekst(e); toast.toon(fout.value, 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <FlyoutShell :open="open" titel-id="nt-titel-kop" :opslag="opslag" :ai="ai" :overlay-klasse="{ 'fs-overlay--top': bovenop }" data-test="nieuwe-taak" @sluit="emit('sluit')" @bewaar="maak">
    <template #kop>
            <span class="fo-kicker" data-test="nt-kicker">Nieuwe taak · {{ PRIO_LABEL[f.priority] }}</span>
            <h2 id="nt-titel-kop" class="fo-titel">Wat moet er gebeuren?</h2>
    </template>
        <form id="nt-form" class="fo-body fo-body--formulier" @submit.prevent="maak">
          <KlantContactKiezer v-model:klant="klant" v-model:contact="contact" prefix="nt" />

          <label class="veld">
            <span class="veld-label">Titel <span class="veld-verplicht">*</span></span>
            <input v-model="f.title" class="invoer" minlength="3" required placeholder="bv. Bel Petra Testbeek terug over de nieuwe vestiging" data-test="nt-titel">
          </label>

          <fieldset v-if="gevorderd" class="veld">
            <legend class="veld-label nt-legend">Prioriteit</legend>
            <div class="keuzeraster keuzeraster--prio" role="group" aria-label="Prioriteit">
              <button v-for="p in PRIORITEITEN" :key="p" type="button" class="prio-knop" :class="{ 'prio-knop--aan': f.priority === p }" :aria-pressed="f.priority === p" :data-test="`nt-prio-${p}`" @click="f.priority = p"><span class="prio-stip" :class="PRIO_STIP[p]" />{{ PRIO_LABEL[p] }}</button>
            </div>
          </fieldset>

          <div class="nt-rij">
            <label class="veld"><span class="veld-label">Vervaldatum</span><input v-model="f.datum" type="date" class="invoer" data-test="nt-datum"></label>
            <label class="veld"><span class="veld-label">Tijd</span><input v-model="f.tijd" type="time" class="invoer" data-test="nt-tijd"></label>
          </div>

          <fieldset class="veld">
            <legend class="veld-label nt-legend">Type</legend>
            <div class="keuzeraster nt-typen" role="group" aria-label="Type">
              <button v-for="t in typeKeuzes" :key="t.id" type="button" class="keuzeraster-knop" :class="{ 'keuzeraster-knop--aan': f.actionType === t.id }" :aria-pressed="f.actionType === t.id" :data-test="`nt-type-${t.id}`" @click="f.actionType = t.id"><Icoon :naam="t.icoon" :grootte="16" /><span>{{ t.label }}</span></button>
            </div>
            <span class="veld-uitleg" data-test="nt-type-uitleg">Een bezoek plan je met + Afspraak.</span>
          </fieldset>

          <template v-if="gevorderd">
            <label v-if="teamleden?.length" class="veld">
              <span class="veld-label">Toegewezen aan</span>
              <select v-model="f.ownerId" class="invoer" data-test="nt-eigenaar"><option value="">Mij</option><option v-for="u in teamleden" :key="u.id" :value="u.id">{{ u.naam }}</option></select>
            </label>

            <label class="veld">
              <span class="veld-label">Aanleiding</span>
              <input v-model="f.aanleiding" class="invoer" maxlength="500" placeholder="bv. Inzicht nieuwe vestiging · LinkedIn-bericht 12 mei" data-test="nt-aanleiding">
            </label>

            <fieldset class="veld veld-klap" :class="{ 'veld-klap--open': f.herhalen }">
              <legend class="nt-legend"><label class="vink vink--kapitaal nt-toggle"><input v-model="f.herhalen" type="checkbox" data-test="nt-herhalen"> Taak herhalen</label></legend>
              <template v-if="f.herhalen">
                <div class="nt-rij">
                  <label class="veld"><span class="veld-uitleg">Frequentie</span><select v-model="f.herhaling" class="invoer" data-test="nt-herhaling"><option v-for="(l, k) in HERHALING_LABEL" :key="k" :value="k">{{ l }}</option></select></label>
                  <label class="veld"><span class="veld-uitleg">Herhalen tot</span><input v-model="f.herhalingTot" type="date" class="invoer" :min="f.datum"></label>
                </div>
                <p class="veld-uitleg nt-telling" data-test="nt-herhaal-telling">{{ aantal }} {{ aantal === 1 ? 'taak' : 'taken' }} in totaal. Na afronden staat de volgende klaar.</p>
              </template>
            </fieldset>

            <fieldset class="veld veld-klap" :class="{ 'veld-klap--open': f.herinneren }">
              <legend class="nt-legend"><label class="vink vink--kapitaal nt-toggle"><input v-model="f.herinneren" type="checkbox" data-test="nt-herinneren"> Herinnering instellen</label></legend>
              <div v-if="f.herinneren" class="nt-rij">
                <label class="veld"><span class="veld-uitleg">Voor de vervaldatum</span><select v-model.number="f.herinneringMin" class="invoer" data-test="nt-herinnering"><option :value="5">5 minuten</option><option :value="15">15 minuten</option><option :value="30">30 minuten</option><option :value="60">1 uur</option><option :value="240">4 uur</option><option :value="1440">1 dag</option><option :value="2880">2 dagen</option></select></label>
                <label class="veld"><span class="veld-uitleg">Versturen via</span><select v-model="f.herinneringKanaal" class="invoer"><option value="in-app">Melding in de app</option><option value="email">E-mail</option><option value="beide">Beide</option></select></label>
              </div>
            </fieldset>

            <label class="veld">
              <span class="veld-label">Beschrijving</span>
              <textarea v-model="f.beschrijving" class="invoer" rows="3" placeholder="Optioneel: wat er precies nodig is." />
            </label>
          </template>
          <p v-if="fout" class="veld-fout">{{ fout }}</p>
        </form>
    <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="nt-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!kanMaken" data-test="nt-maak"><Icoon naam="Check" :grootte="16" />{{ bezig ? 'Opslaan…' : 'Maak taak' }}</button>
          <span class="fo-foot-vul" />
        </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.nt-legend { padding: 0; margin-bottom: 6px; }
.nt-typen { grid-template-columns: repeat(3, 1fr); }
.nt-toggle { min-height: var(--touch-target-min); }
.nt-telling { margin: 8px 0 0; }
.veld-klap:not(.veld-klap--open) { padding: 0; }
/* Datum en tijd naast elkaar, ook op de telefoon; de prioriteit blijft vier kolommen. */
.nt-rij { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.keuzeraster--prio { grid-template-columns: repeat(4, 1fr); }
.fo-body > :deep(*) { flex-shrink: 0; }
</style>
