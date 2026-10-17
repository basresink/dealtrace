<script setup lang="ts">
// Doelgroep (F05, salesmanager): naam, branches uit het leesmodel (primair eerst),
// SBI, klassen, omvang, postcodes, bron, prioriteit en de ambitietoets, met een
// live teller hoeveel accounts erin vallen en hoeveel al in een andere reis.
const props = defineProps<{ open: boolean; doelgroep: any | null; branches: { id: string; naam: string; focus: string }[]; klassen: { id: string; naam: string }[]; ambitie: string | null }>()
const emit = defineEmits<{ sluit: []; bewaard: [] }>()
const toast = useToast()
const leeg = () => ({ naam: '', status: 'actief', prioriteit: 1, data: { omschrijving: '', brancheIds: [] as string[], sbi: [] as string[], klassen: [] as string[], omvang: { min: null as number | null, max: null as number | null }, postcodes: [] as string[], bron: null as string | null, ambitieToets: undefined as string | undefined } })
const f = ref(leeg())
const sbiTekst = ref('')
const pcTekst = ref('')
const telling = ref<{ aantal: number; inAndereReis: number } | null>(null)
const bezig = ref(false)
watch(() => props.open, (o) => {
  if (!o) return
  f.value = props.doelgroep ? JSON.parse(JSON.stringify({ ...leeg(), ...props.doelgroep, data: { ...leeg().data, ...props.doelgroep.data } })) : leeg()
  sbiTekst.value = (f.value.data.sbi ?? []).join(', ')
  pcTekst.value = (f.value.data.postcodes ?? []).join(', ')
}, { immediate: true })
const lijst = (t: string) => t.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)
let timer: any
watch([f, sbiTekst, pcTekst], () => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try { telling.value = await $fetch<any>('/api/doelgroepen/telling', { method: 'POST', body: { id: props.doelgroep?.id, data: { ...f.value.data, sbi: lijst(sbiTekst.value), postcodes: lijst(pcTekst.value) } } }) } catch { telling.value = null }
  }, 300)
}, { deep: true, immediate: true })
async function bewaar() {
  bezig.value = true
  const body = { ...f.value, data: { ...f.value.data, sbi: lijst(sbiTekst.value), postcodes: lijst(pcTekst.value) } }
  try {
    if (props.doelgroep?.id) await $fetch(`/api/doelgroepen/${props.doelgroep.id}`, { method: 'PUT', body })
    else await $fetch('/api/doelgroepen', { method: 'POST', body })
    toast.toon(`${f.value.naam} is bewaard.`); emit('bewaard')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
function wissel(lijstNaam: 'brancheIds' | 'klassen', id: string) {
  const l = f.value.data[lijstNaam]
  f.value.data[lijstNaam] = l.includes(id) ? l.filter((x: string) => x !== id) : [...l, id]
}
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot de hoofdactie opslaat; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [f.value, sbiTekst.value, pcTekst.value])
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="dg-titel" data-test="doelgroep-flyout" :opslag="opslag" @sluit="emit('sluit')" @bewaar="bewaar">
      <template #kop><span class="fo-kicker">Doelgroep</span><h2 id="dg-titel" class="fo-titel">{{ doelgroep ? doelgroep.naam : 'Nieuwe doelgroep' }}</h2></template>
        <form id="dg-form" class="fs-form" @submit.prevent="bewaar">
        <div class="fo-body fo-body--formulier">
          <p v-if="telling" class="kaart kaart--geel" role="status" data-test="doelgroep-teller"><strong class="tnum">{{ telling.aantal }}</strong> accounts vallen in deze doelgroep, waarvan <strong class="tnum">{{ telling.inAndereReis }}</strong> al in een andere reis.</p>
          <article class="fo-blok">
            <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="f.naam" class="invoer" required data-test="dg-naam"></label>
            <label class="veld mt-16"><span class="veld-label">Omschrijving</span><textarea v-model="f.data.omschrijving" class="invoer" rows="2" /></label>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Status</span><select v-model="f.status" class="invoer"><option value="concept">Concept</option><option value="actief">Actief</option><option value="gearchiveerd">Gearchiveerd</option></select></label>
              <label class="veld"><span class="veld-label">Prioriteit</span><input v-model.number="f.prioriteit" type="number" min="1" max="99" class="invoer" data-test="dg-prioriteit"><span class="veld-uitleg">1 gaat voor bij overlap.</span></label>
              <label class="veld"><span class="veld-label">Bron</span><select v-model="f.data.bron" class="invoer"><option :value="null">Alle bronnen</option><option value="koud">Koud</option><option value="warm">Warm</option><option value="referral">Referral</option><option value="winback">Winback</option></select></label>
            </div>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Wie hoort erbij</h3></header>
            <fieldset v-if="branches.length" class="veld"><legend class="veld-label">Branches</legend>
              <label v-for="b in branches" :key="b.id" class="schakel-naam"><input type="checkbox" :checked="f.data.brancheIds.includes(b.id)" :data-test="`dg-branche-${b.id}`" @change="wissel('brancheIds', b.id)"> {{ b.naam }} <span class="meta">{{ b.focus }}</span></label>
            </fieldset>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">SBI-codes</span><input v-model="sbiTekst" class="invoer" placeholder="4321, 4322"></label>
              <label class="veld"><span class="veld-label">Postcodes</span><input v-model="pcTekst" class="invoer" placeholder="38, 3700-3799"></label>
              <label class="veld"><span class="veld-label">Omvang vanaf</span><input v-model.number="f.data.omvang.min" type="number" min="0" class="invoer"></label>
              <label class="veld"><span class="veld-label">Omvang tot</span><input v-model.number="f.data.omvang.max" type="number" min="0" class="invoer"></label>
            </div>
            <fieldset v-if="klassen.length" class="veld mt-16"><legend class="veld-label">Klassen</legend>
              <label v-for="k in klassen" :key="k.id" class="schakel-naam"><input type="checkbox" :checked="f.data.klassen.includes(k.id)" @change="wissel('klassen', k.id)"> {{ k.naam }}</label>
            </fieldset>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Past deze doelgroep bij onze ambitie?</h3></header>
            <p v-if="ambitie" class="veld-uitleg">{{ ambitie }}</p>
            <div class="reis-knoppen mt-8">
              <label v-for="w in ['ja', 'deels', 'nee']" :key="w" class="nee-reden" :class="{ 'nee-reden--actief': f.data.ambitieToets === w }"><input v-model="f.data.ambitieToets" type="radio" :value="w" class="sr-only">{{ w.charAt(0).toUpperCase() + w.slice(1) }}</label>
            </div>
          </article>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="dg-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !f.naam.trim()" data-test="dg-bewaar"><Icoon naam="Check" :grootte="16" />Bewaren</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>
