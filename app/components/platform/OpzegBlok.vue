<script setup lang="ts">
// Klantflyout, blok Organisatie opzeggen (F23, pakket C). Twee stappen in de flyout zelf, nooit een
// browservenster: eerst zie je wat er gebeurt en vul je de laatste dag en de reden in, dan typ je de naam
// van de organisatie over en bevestig je. De server vraagt daarna je authenticator-code als de laatste
// bevestiging ouder is dan 15 minuten. Een opzegging trek je met een tweede klik weer in.
import { BEWAREN_NA_OPZEGGEN_DAGEN, plusDagen, standaardEinddatum, valideerOpzegging } from '~~/shared/platformAvg'

const props = defineProps<{
  klant: { id: string; naam: string; vandaag: string; contract: { status?: string; start?: string; looptijdMaanden?: number; opzegtermijnMaanden?: number; einddatum?: string; opgezegdOp?: string; opzegReden?: string; verwijderenOp?: string } }
}>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const { metHerbevestiging } = useHerbevestig()
const stap = ref<'dicht' | 'invullen' | 'intrekken'>('dicht')
const f = reactive({ einddatum: '', reden: '', naam: '' })
const bezig = ref(false)
const opgezegd = computed(() => props.klant.contract.status === 'opgezegd')
watch(() => props.klant.id, () => { stap.value = 'dicht' })

function begin() {
  Object.assign(f, { einddatum: standaardEinddatum(props.klant.contract, props.klant.vandaag), reden: '', naam: '' })
  stap.value = 'invullen'
}
const fouten = computed(() => valideerOpzegging(f, props.klant.naam, props.klant.vandaag))
const naamKlopt = computed(() => f.naam.trim() === props.klant.naam.trim())
const datum = (d?: string) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d.slice(0, 10)}T12:00:00Z`)) : '')

async function bevestig() {
  if (fouten.value.length) { toast.toon(fouten.value[0]!, 'fout'); return }
  bezig.value = true
  try {
    await metHerbevestiging(() => $fetch(`/api/platform/klanten/${props.klant.id}/status`, { method: 'PUT', body: { status: 'opgezegd', einddatum: f.einddatum, reden: f.reden, naam: f.naam } }))
    stap.value = 'dicht'
    toast.toon(`${props.klant.naam} is opgezegd per ${datum(f.einddatum)}.`)
    emit('gewijzigd')
  } catch (e) { const t = foutTekst(e); if (t) toast.toon(t, 'fout') } finally { bezig.value = false }
}
async function trekIn() {
  bezig.value = true
  try {
    await $fetch(`/api/platform/klanten/${props.klant.id}/status`, { method: 'PUT', body: { status: 'actief' } })
    stap.value = 'dicht'
    toast.toon('De opzegging is ingetrokken.')
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <article class="fo-blok" :class="{ 'fo-blok--gevaar': stap === 'invullen' || opgezegd }" data-test="klant-opzeggen">
    <header class="fo-blok-kop"><h3 class="fo-blok-titel">Organisatie opzeggen</h3><Label soort="contract" :waarde="klant.contract.status ?? 'actief'" /></header>

    <template v-if="opgezegd">
      <p class="fo-tekst" data-test="opzeg-stand">Opgezegd op {{ datum(klant.contract.opgezegdOp) }}. Dealtrace werkt tot en met {{ datum(klant.contract.einddatum) }}; na {{ datum(klant.contract.verwijderenOp) }} mogen de gegevens weg.<template v-if="klant.contract.opzegReden"> Reden: {{ klant.contract.opzegReden }}</template></p>
      <div v-if="stap === 'intrekken'" class="opzeg-vraag" role="group" aria-label="Opzegging intrekken">
        <p class="fo-tekst"><strong>Opzegging intrekken?</strong> Het contract staat dan weer op actief en de beheerders krijgen een melding.</p>
        <div class="dd-acties"><button type="button" class="dd-act" data-test="opzeg-intrekken-nee" @click="stap = 'dicht'">Nee, laat staan</button><button type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="opzeg-intrekken-ja" @click="trekIn">Ja, trek in</button></div>
      </div>
      <button v-else type="button" class="dd-act" data-test="opzeg-intrekken" @click="stap = 'intrekken'">Opzegging intrekken</button>
    </template>

    <template v-else-if="stap === 'invullen'">
      <p class="fo-tekst">Wat er gebeurt:</p>
      <ul class="fo-tekst opzeg-gevolgen">
        <li>De klant werkt door tot en met de laatste dag; het contract staat direct op opgezegd.</li>
        <li>De beheerders krijgen een melding met de vraag hun gegevens te exporteren via Instellingen, Privacy.</li>
        <li>{{ BEWAREN_NA_OPZEGGEN_DAGEN }} dagen na de laatste dag mogen de gegevens weg<template v-if="f.einddatum && !fouten.some((x) => x.includes('laatste dag'))">: na {{ datum(plusDagen(f.einddatum, BEWAREN_NA_OPZEGGEN_DAGEN)) }}</template>.</li>
        <li>Tot die tijd trek je de opzegging hier weer in.</li>
      </ul>
      <div class="formulier-raster">
        <label class="veld"><span class="veld-label">Laatste dag</span><input v-model="f.einddatum" class="invoer" type="date" :min="klant.vandaag" data-test="opzeg-einddatum"></label>
        <label class="veld"><span class="veld-label">Reden</span><input v-model="f.reden" class="invoer" maxlength="300" placeholder="Bijvoorbeeld: stopt met buitendienst" data-test="opzeg-reden"></label>
      </div>
      <label class="veld mt-16"><span class="veld-label">Typ ter bevestiging de naam: {{ klant.naam }}</span>
        <input v-model="f.naam" class="invoer" autocomplete="off" spellcheck="false" data-test="opzeg-naam"></label>
      <p class="veld-uitleg">Na bevestigen vraagt Dealtrace je authenticator-code als je die het afgelopen kwartier niet gaf.</p>
      <div class="dd-acties mt-8">
        <button type="button" class="dd-act" data-test="opzeg-annuleer" @click="stap = 'dicht'">Annuleren</button>
        <button type="button" class="dd-act dd-act--gevaar" :disabled="bezig || !naamKlopt || !!fouten.length" data-test="opzeg-bevestig" @click="bevestig">Opzeggen bevestigen</button>
      </div>
    </template>

    <template v-else>
      <p class="fo-tekst">Zeg het abonnement van deze klant op met een laatste dag. Je bevestigt het hier in twee stappen.</p>
      <button type="button" class="dd-act" data-test="opzeg-begin" @click="begin">Organisatie opzeggen</button>
    </template>
  </article>
</template>

<style scoped>
.opzeg-gevolgen { margin: 0 0 12px; padding-left: 18px; }
.opzeg-vraag { margin-top: 8px; }
</style>
