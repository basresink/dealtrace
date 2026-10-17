<script setup lang="ts">
// Nieuwe regel (opzet van DealDrive, "Welke regel voeg je toe?"): vraagt alleen wat het bewerkpaneel daarna
// niet meer of niet makkelijk zet. Naam, categorie en subcategorie (met een waarschuwing als er al een regel
// met die naam is), bron, cadans, prioriteit, uitvoerder, verwacht resultaat (ligt daarna vast), omschrijving,
// de prospectreis en fases waarin hij geldt, en Direct actief. Triggerpatroon, winpunten en de rest stel je
// in het paneel in, waar de nieuwe regel meteen opent. De server zet de scope bij je rol.
import { CADANSEN, CATEGORIEEN, PRIORITEITEN, UITVOERDERROLLEN } from '~~/shared/regelPatronen'

const props = defineProps<{ open: boolean; regels: any[]; reizen: any[] }>()
const emit = defineEmits<{ sluit: []; gemaakt: [id: string] }>()
const toast = useToast()
const ROL_LABEL: Record<string, string> = { binnendienst: 'Binnendienst', buitendienst: 'Buitendienst', eigenaar: 'Eigenaar van het account', salesmanager: 'Salesmanager van het team' }
const PRIO_LABEL: Record<string, string> = { hoog: 'Hoog', middel: 'Middel', laag: 'Laag' }
const leeg = () => ({ naam: '', categorie: 'Bewerken', subcategorie: '', bron: 'intern', specifiekeBron: '', cadansDagen: 7, prioriteit: 'middel', uitvoerderrol: 'eigenaar', verwachtResultaat: '', omschrijving: '', reisId: '', faseIds: [] as string[], actief: true })
const f = ref(leeg())
const bezig = ref(false)
const fout = ref('')
watch(() => props.open, (aan) => { if (aan) { f.value = leeg(); fout.value = '' } })
const reis = computed(() => props.reizen.find((r) => r.id === f.value.reisId) ?? props.reizen[0] ?? null)
const bestaand = computed(() => {
  const n = f.value.naam.trim().toLowerCase()
  return n ? props.regels.find((r) => r.naam.trim().toLowerCase() === n) ?? null : null
})
const kanMaken = computed(() => !!f.value.naam.trim() && !bezig.value)
function wisselFase(id: string) { f.value.faseIds = f.value.faseIds.includes(id) ? f.value.faseIds.filter((x) => x !== id) : [...f.value.faseIds, id] }

async function maak() {
  if (!kanMaken.value) return
  bezig.value = true
  fout.value = ''
  const x = f.value
  try {
    const r = await $fetch<any>('/api/regels', {
      method: 'POST',
      body: {
        naam: x.naam.trim(), categorie: x.categorie, cadansDagen: x.cadansDagen, prioriteit: x.prioriteit, actief: x.actief, reisId: x.reisId || null,
        data: {
          subcategorie: x.subcategorie || undefined, omschrijving: x.omschrijving, activiteit: 'taak', bron: x.bron, specifiekeBron: x.specifiekeBron || undefined,
          trigger: { patroon: 'inactiviteit', parameters: {} }, afbakening: { accounttypes: ['prospect'], faseIds: x.faseIds },
          gevolg: { actiesoort: 'bellen', uitvoerderrol: x.uitvoerderrol, termijnWerkdagen: 3, taaksjabloon: 'Bel {account}', verwachtResultaat: x.verwachtResultaat || null },
        },
      },
    })
    toast.toon(`Regel "${r.naam}" toegevoegd.`)
    emit('gemaakt', r.id)
  } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
</script>

<template>
  <FlyoutShell :open="open" titel-id="nr-titel" data-test="nieuwe-regel" @sluit="emit('sluit')">
    <template #kop>
      <span class="fo-kicker">Regels · Nieuwe regel</span>
      <h2 id="nr-titel" class="fo-titel">Welke regel voeg je toe?</h2>
      <p class="fo-meta">De regel komt in de lijst en opent meteen in het bewerkpaneel. Triggerpatroon, winpunten, actiesoort en klassen stel je daar in.</p>
    </template>
    <form id="nr-form" class="fo-body fo-body--formulier" @submit.prevent="maak">
      <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="f.naam" class="invoer" maxlength="120" required data-test="nr-naam" placeholder="Bijvoorbeeld: Na gekwalificeerd binnen een dag bellen"></label>
      <p v-if="bestaand" class="kaart kaart--geel nr-let" data-test="nr-dubbel">Er is al een regel "{{ bestaand.naam }}"<template v-if="bestaand.code"> ({{ bestaand.code }})</template>. Deze komt er als tweede naast.</p>
      <div class="nr-twee">
        <label class="veld"><span class="veld-label">Categorie</span><select v-model="f.categorie" class="invoer"><option v-for="c in CATEGORIEEN" :key="c" :value="c">{{ c }}</option></select></label>
        <label class="veld"><span class="veld-label">Subcategorie</span><input v-model="f.subcategorie" class="invoer" maxlength="60"></label>
        <label class="veld"><span class="veld-label">Bron</span><select v-model="f.bron" class="invoer"><option value="intern">Intern</option><option value="extern">Extern</option></select></label>
        <label class="veld"><span class="veld-label">Specifieke bron</span><input v-model="f.specifiekeBron" class="invoer" maxlength="80" placeholder="Bijvoorbeeld: Dealtrace: reis"></label>
        <label class="veld"><span class="veld-label">Cadans</span><select v-model.number="f.cadansDagen" class="invoer"><option v-for="c in CADANSEN" :key="c.dagen" :value="c.dagen">{{ c.label }}</option></select></label>
        <label class="veld"><span class="veld-label">Prioriteit</span><select v-model="f.prioriteit" class="invoer"><option v-for="p in PRIORITEITEN" :key="p" :value="p">{{ PRIO_LABEL[p] }}</option></select></label>
      </div>
      <label class="veld"><span class="veld-label">Uitvoerder</span><select v-model="f.uitvoerderrol" class="invoer"><option v-for="u in UITVOERDERROLLEN" :key="u" :value="u">{{ ROL_LABEL[u] }}</option></select></label>
      <label class="veld"><span class="veld-label">Verwacht resultaat</span><input v-model="f.verwachtResultaat" class="invoer" maxlength="120" placeholder="Bijvoorbeeld: eerste afspraak"><span class="veld-uitleg">Ligt na het aanmaken vast.</span></label>
      <label class="veld"><span class="veld-label">Omschrijving</span><textarea v-model="f.omschrijving" class="invoer" rows="3" maxlength="500" placeholder="Komt in &quot;Waarom krijg ik dit?&quot;" /></label>
      <label class="veld"><span class="veld-label">Prospectreis</span><select v-model="f.reisId" class="invoer" data-test="nr-reis"><option value="">Elke reis</option><option v-for="r in reizen" :key="r.id" :value="r.id">{{ r.naam }}</option></select></label>
      <fieldset v-if="reis" class="veld nr-fases">
        <legend class="veld-label">Fases waarin de regel geldt</legend>
        <div class="nr-vinkjes"><label v-for="x in reis.fases" :key="x.id" class="nr-vinkje"><input type="checkbox" :checked="f.faseIds.includes(x.id)" :data-test="`nr-fase-${x.id}`" @change="wisselFase(x.id)"> {{ x.label }}</label></div>
        <span class="veld-uitleg">Zonder vinkjes geldt hij in elke fase.</span>
      </fieldset>
      <label class="nr-vinkje"><input v-model="f.actief" type="checkbox" data-test="nr-actief"> Direct actief: de motor neemt hem bij de volgende run mee</label>
      <p v-if="fout" class="veld-fout" role="alert">{{ fout }}</p>
    </form>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="submit" form="nr-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!kanMaken" data-test="nr-maak"><Icoon naam="Plus" :grootte="16" />{{ bezig ? 'Opslaan…' : 'Regel toevoegen' }}</button>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.nr-twee { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
.nr-let { margin: 0; }
.nr-fases { border: 0; padding: 0; margin: 0; min-width: 0; }
.nr-vinkjes { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.nr-vinkje { display: inline-flex; align-items: center; gap: 8px; min-height: var(--touch-target-min); font-size: 14px; }
@media (max-width: 767px) { .nr-twee { grid-template-columns: 1fr; } }
</style>
