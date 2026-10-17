<script setup lang="ts">
// Start hercontact (Terug in beeld): kies hoe je begint. De opvolgreeks is het hercontactritme van de regel (zonder
// regel het standaard winbackritme) met elke stap op zijn datum; één taak met de aanpak als aanleiding; of een
// beltaak in het eerstvolgende koude belblok (alleen als de regel bellen zegt). De datums staan er vooraf bij. Binnen
// de afkoeling kan starten niet; de server zegt waarom.
import { KANAAL_LABEL, type Kanaal } from '~~/shared/nbStatus'
import { herkomstTekst, startToast, type StartSoort, type TerugRij } from '~~/shared/terugInBeeld'
import { terugDagKort } from '~~/shared/terugkomBeheer'

const props = defineProps<{ open: boolean; rij: TerugRij | null }>()
const emit = defineEmits<{ sluit: []; gestart: [tekst: string] }>()
const toast = useToast()
const v = ref<any>(null)
const laadt = ref(false)
const bezig = ref(false)
const soort = ref<StartSoort>('reeks')
watch(() => [props.open, props.rij?.id] as const, async ([o]) => {
  if (!o || !props.rij) return
  v.value = null
  laadt.value = true
  try {
    v.value = await $fetch<any>(`/api/terug-in-beeld/${props.rij.id}/start`)
    soort.value = v.value.reeks ? 'reeks' : 'taak'
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { laadt.value = false }
}, { immediate: true })
const kanaal = (k: string) => KANAAL_LABEL[k as Kanaal] ?? k
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const dagVan = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
async function start() {
  if (!props.rij || !v.value?.mag.mag) return
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/terug-in-beeld/${props.rij.id}/start`, { method: 'POST', body: { soort: soort.value } })
    emit('gestart', r?.tekst ?? startToast(soort.value, props.rij.naam))
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <FlyoutShell
    v-if="open && rij" open titel-id="tib-start-titel" data-test="tib-start-flyout"
    :ai="{ accountId: rij.id, label: rij.naam, voorstellen: ['Hoe open ik het gesprek na dit verlies?', 'Welke nieuwe aanleiding kan ik noemen?', 'Wat zeg ik als hij nog steeds nee zegt?'] }"
    @sluit="emit('sluit')"
  >
    <template #kop>
      <span class="fo-kicker">Start hercontact</span>
      <h2 id="tib-start-titel" class="fo-titel">{{ rij.naam }}</h2>
      <p class="fo-meta">{{ herkomstTekst(rij) }}. {{ rij.regel ? `Regel ${rij.regel.naam}.` : 'Geen regel.' }}</p>
    </template>
    <form id="tib-start-form" class="fs-form" @submit.prevent="start">
      <div class="fo-body">
        <p class="tib-aanpak"><b>Aanpak:</b> {{ rij.aanpak }}</p>
        <p v-if="laadt" class="meta mt-16">Laden…</p>
        <template v-else-if="v">
          <p v-if="!v.mag.mag" class="kaart kaart--geel mt-16" data-test="tib-start-dicht">{{ v.mag.reden }}</p>
          <fieldset class="tib-keuzes mt-16">
            <legend class="veld-label">Hoe wil je beginnen?</legend>
            <label v-if="v.reeks" class="tib-keuze" :class="{ 'tib-keuze--aan': soort === 'reeks' }" data-test="tib-keuze-reeks">
              <input v-model="soort" type="radio" name="tib-soort" value="reeks" :disabled="!v.mag.mag">
              <span>
                <b>Opvolgreeks: {{ v.reeks.naam }}</b>
                <span class="meta tib-blok">{{ v.reeks.vanRegel ? 'Aanbevolen door de regel.' : rij.regel ? 'De regel heeft geen eigen ritme; dit is het standaard winbackritme.' : 'Het standaard winbackritme.' }} Elke stap wordt een taak op zijn dag; stopt vanzelf bij een reactie of afspraak.</span>
                <ul class="tib-stappen" data-test="tib-reeks-stappen">
                  <li v-for="s in v.reeks.stappen" :key="s.nr"><b>{{ terugDagKort(s.datum) }}</b><span>{{ s.nr }}. {{ kanaal(s.kanaal) }}{{ s.tekst ? `: ${s.tekst}` : '' }}</span></li>
                  <li><b>daarna</b><span>Geen reactie: geparkeerd voor {{ v.reeks.parkeerDagen }} dagen</span></li>
                </ul>
              </span>
            </label>
            <label class="tib-keuze" :class="{ 'tib-keuze--aan': soort === 'taak' }" data-test="tib-keuze-taak">
              <input v-model="soort" type="radio" name="tib-soort" value="taak" :disabled="!v.mag.mag">
              <span>
                <b>Eén taak</b>
                <span class="meta tib-blok">{{ kanaal(v.taak.kanaal) }} op {{ terugDagKort(dagVan(v.taak.op)) }} {{ tijd(v.taak.op) }}, met de aanpak als aanleiding. Daarna beslis je zelf.</span>
              </span>
            </label>
            <label class="tib-keuze" :class="{ 'tib-keuze--aan': soort === 'belblok', 'tib-keuze--uit': !v.belblok.mag }" data-test="tib-keuze-belblok">
              <input v-model="soort" type="radio" name="tib-soort" value="belblok" :disabled="!v.belblok.mag || !v.mag.mag">
              <span>
                <b>In een belblok</b>
                <span class="meta tib-blok" data-test="tib-belblok-uitleg">{{ v.belblok.mag ? `Eerstvolgend koud blok: ${v.belblok.label} (${v.belblok.vrij} ${v.belblok.vrij === 1 ? 'plek' : 'plekken'} vrij).` : v.belblok.reden }}</span>
              </span>
            </label>
          </fieldset>
          <p class="meta mt-8">Starten zet de prospect terug in de reis. De taak staat daarna in Taken, op Vandaag op zijn dag en op de prospect.</p>
        </template>
      </div>
    </form>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="submit" form="tib-start-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !v || !v.mag.mag" data-test="tib-start-bevestig"><Icoon naam="CirclePlay" :grootte="16" />Start hercontact</button>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.tib-aanpak { margin: 0; padding: 8px 12px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: 13px; }
.tib-keuzes { display: flex; flex-direction: column; gap: 8px; margin-inline: 0; padding: 0; border: 0; }
.tib-keuzes legend { margin-bottom: 8px; }
.tib-keuze { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: start; gap: 10px; padding: 12px 14px; border: 1px solid var(--border-strong); border-radius: var(--radius); cursor: pointer; }
.tib-keuze input { width: 16px; height: 16px; margin: 3px 0 0; accent-color: var(--ink); }
.tib-keuze--aan { border-color: var(--ink); box-shadow: inset 4px 0 0 var(--yellow); }
.tib-keuze--uit { cursor: not-allowed; opacity: 0.75; }
.tib-blok { display: block; margin-top: 2px; }
.tib-stappen { margin: 8px 0 0; padding: 0; list-style: none; font-size: 12px; }
.tib-stappen li { display: flex; gap: 8px; padding: 3px 0; }
.tib-stappen b { min-width: 74px; }
@media (max-width: 719px) { .tib-keuze { min-height: var(--touch-target-min); } }
</style>
