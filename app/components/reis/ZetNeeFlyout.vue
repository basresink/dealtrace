<script setup lang="ts">
// "Zet nee" (7.2, F03): vaste reden, bij "Tevreden met huidige leverancier" de vraag
// "Bij wie?", een voorgestelde terugkomdatum volgens de terugkomregel en de
// afkoelperiode per kanaal (voorgevuld). Offline gaat het via de wachtrij (8.8).
const props = defineProps<{ open: boolean; account: { id: string; naam: string }; concurrenten: { id: string; naam: string }[] }>()
const emit = defineEmits<{ sluit: []; klaar: [tekst: string] }>()
const toast = useToast()
const { voegToe } = useSyncQueue()
const { data: inst } = await useFetch<any>('/api/reis/instellingen', { default: () => ({ redenen: [], kanalen: [], voorstellen: {} }) })
const reden = ref('')
const toelichting = ref('')
const verlorenAan = ref('')
const terugOp = ref('')
const afkoeling = reactive<Record<string, number>>({})
const bezig = ref(false)
watch(() => props.open, (o) => {
  if (!o) return
  reden.value = ''; toelichting.value = ''; verlorenAan.value = ''; terugOp.value = ''
  for (const k of inst.value.kanalen) afkoeling[k.id] = k.dagen
})
watch(reden, (r) => {
  const v = inst.value.voorstellen?.[r]
  if (v) terugOp.value = v.datum
  for (const k of inst.value.kanalen) afkoeling[k.id] = r === 'Niet geschikt' ? 365 : k.dagen
})
const voorstel = computed(() => inst.value.voorstellen?.[reden.value] ?? null)
const ongeldig = computed(() => !reden.value || (reden.value === 'Anders' && !toelichting.value.trim()))
const langeDatum = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))
async function bewaar() {
  if (ongeldig.value) return
  bezig.value = true
  const body = { reden: reden.value, toelichting: toelichting.value.trim() || undefined, verlorenAan: verlorenAan.value || undefined, terugOp: terugOp.value || undefined, afkoeling: { ...afkoeling } }
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'accounts', op: 'patch', recordId: props.account.id, patch: { soort: 'account.nee', ...body, op: new Date().toISOString() } })
      emit('klaar', `${props.account.naam} gaat op nee zodra je weer online bent (terug op ${langeDatum(terugOp.value)}).`)
      return
    }
    const r = await opslag.bewaar(() => $fetch<any>(`/api/accounts/${props.account.id}/nee`, { method: 'POST', body }))
    emit('klaar', `${props.account.naam} staat op nee tot ${langeDatum(r.terugOp)}.`)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot de hoofdactie opslaat; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [reden.value, toelichting.value, verlorenAan.value, terugOp.value])
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="nee-titel" breedte="smal" data-test="zet-nee" :opslag="opslag" :ai="{ accountId: account.id, label: account.naam, voorstellen: ['Is nee nu de juiste keuze?', 'Wanneer probeer ik het opnieuw?', 'Wat leer ik hiervan?'] }" @sluit="emit('sluit')" @bewaar="bewaar">
      <template #kop><span class="fo-kicker">Zet nee</span><h2 id="nee-titel" class="fo-titel">{{ account.naam }}</h2></template>
        <form id="nee-form" class="fs-form" @submit.prevent="bewaar">
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <fieldset class="nee-redenen">
              <legend class="veld-label">Reden <span class="veld-verplicht">*</span></legend>
              <label v-for="r in inst.redenen" :key="r" class="nee-reden" :class="{ 'nee-reden--actief': reden === r }">
                <input v-model="reden" type="radio" name="reden" :value="r" class="sr-only" :data-test="`reden-${r}`"><span>{{ r }}</span>
              </label>
            </fieldset>
            <label v-if="reden === 'Anders'" class="veld mt-16"><span class="veld-label">Toelichting <span class="veld-verplicht">*</span></span><textarea v-model="toelichting" class="invoer" rows="2" data-test="nee-toelichting" /></label>
            <label v-else-if="reden" class="veld mt-16"><span class="veld-label">Toelichting</span><textarea v-model="toelichting" class="invoer" rows="2" /></label>
            <label v-if="reden === 'Tevreden met huidige leverancier' && concurrenten.length" class="veld mt-16">
              <span class="veld-label">Bij wie?</span>
              <select v-model="verlorenAan" class="invoer" data-test="nee-bij-wie"><option value="">Weet ik niet</option><option v-for="c in concurrenten" :key="c.id" :value="c.id">{{ c.naam }}</option></select>
            </label>
          </article>
          <article v-if="reden" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Terugkomen</h3></header>
            <label class="veld"><span class="veld-label">Terug op</span><input v-model="terugOp" type="date" class="invoer" data-test="nee-terug-op"></label>
            <p v-if="voorstel?.regel" class="veld-uitleg mt-8">Volgens de regel "{{ voorstel.regel.reden }}": {{ voorstel.regel.aanpak }}</p>
            <p v-else class="veld-uitleg mt-8">Geen terugkomregel voor deze reden; de afkoelperiode geldt.</p>
            <p v-if="voorstel?.opgeschoven" class="veld-uitleg">Opgeschoven naar het einde van de afkoelperiode.</p>
            <details class="mt-16">
              <summary>Afkoelperiode per kanaal</summary>
              <div class="formulier-raster mt-8">
                <label v-for="k in inst.kanalen" :key="k.id" class="veld"><span class="veld-label">{{ k.label }} (dagen)</span><input v-model.number="afkoeling[k.id]" type="number" min="0" max="730" class="invoer" :disabled="reden === 'Niet geschikt'"></label>
              </div>
            </details>
          </article>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="nee-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || ongeldig" data-test="zet-op-nee"><Icoon naam="Check" :grootte="16" />Zet op nee</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>
