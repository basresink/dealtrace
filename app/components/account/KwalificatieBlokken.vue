<script setup lang="ts">
// Kwalificatie van een account (venster Kwalificatie onder Meer, op de accountkaart en de contactkaart):
// BAND met Kwalificeer, het buying committee met "Stel voor met AI" (Profielbouwer, 3 credits),
// contactpersonen zoeken via Datacollectief en de contactpersonen met hun rol. Op de contactkaart staat
// bovenaan de rol van dat contact in het committee.
import { CONTACTROL_LABEL, type ContactRol } from '~~/shared/contactgegevens'
const props = defineProps<{ account: any; contact?: { naam: string; roepnaam?: string; rol: string; functie?: string | null } | null }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const { functie } = useMe()
const a = computed(() => props.account)
const BAND = ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak'] as const
const bandJa = computed(() => BAND.filter((k) => a.value.band?.[k]?.ja).length)
const magBand = computed(() => !!a.value.kan?.kwalificeer || (!!a.value.kan?.reis && a.value.status === 'nieuw'))
const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1)
async function zetBand(letter: string, ja: boolean) {
  try {
    const r = await $fetch<any>(`/api/accounts/${a.value.id}/band`, { method: 'PUT', body: { letter, ja } })
    if (r.gemeld?.gewisseld) toast.toon('BAND 3 van 4: gekwalificeerd.')
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function kwalificeer() {
  try {
    const r = await $fetch<any>('/api/reis/gebeurtenis', { method: 'POST', body: { accountId: a.value.id, gebeurtenis: 'gekwalificeerd' } })
    toast.toon(r.gewisseld ? 'Gekwalificeerd; het account staat in de reis.' : 'Geen wissel.'); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// P19: de Profielbouwer stelt het buying committee voor (3 credits).
const committee = ref<any[] | null>(null)
const committeeBezig = ref(false)
async function stelCommitteeVoor() {
  committeeBezig.value = true
  try { const r = await $fetch<any>(`/api/accounts/${a.value.id}/committee`, { method: 'POST' }); committee.value = r.voorstellen; if (!r.voorstellen.length) toast.toon(r.reden ?? 'Nog te weinig functies bekend om een voorstel te doen.') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { committeeBezig.value = false }
}
// P15: contactpersonen zoeken via Datacollectief, met bevestiging van de kosten.
const dcBezig = ref(false)
const online = ref(true)
function zetOnline() { online.value = navigator.onLine }
onMounted(() => { zetOnline(); window.addEventListener('online', zetOnline); window.addEventListener('offline', zetOnline) })
onBeforeUnmount(() => { window.removeEventListener('online', zetOnline); window.removeEventListener('offline', zetOnline) })
async function zoekContacten() {
  if (!confirm('Contactpersonen zoeken via Datacollectief? Dit kost tot 5 records van jullie tegoed.')) return
  dcBezig.value = true
  try { const r: any = await ($fetch as any)(`/api/accounts/${a.value.id}/verrijk-contacten`, { method: 'POST', body: { max: 5 } }); toast.toon(r.tekst); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { dcBezig.value = false }
}
const ontbrekend = computed(() => ((a.value.ontbrekendeRollen ?? []) as string[]).map((r) => CONTACTROL_LABEL[r as ContactRol] ?? r).join(', '))
</script>

<template>
  <article v-if="contact" class="kaart" data-test="kwalificatie-contact">
    <header class="kaart-kop"><h2 class="kaart-titel">{{ contact.roepnaam ?? contact.naam }} in het buying committee</h2></header>
    <p class="kaart-meta">Rol: <strong>{{ CONTACTROL_LABEL[contact.rol as ContactRol] ?? contact.rol }}</strong><template v-if="contact.functie"> · {{ contact.functie }}</template></p>
    <p v-if="a.ontbrekendeRollen?.length" class="kaart-meta mt-8">Nog niet bekend bij {{ a.naam }}: {{ ontbrekend }}.</p>
  </article>
  <article class="kaart" data-test="band">
    <header class="kaart-kop"><h2 class="kaart-titel">Kwalificatie BAND {{ bandJa }}/4</h2></header>
    <ul class="kaart-meta band-lijst">
      <li v-for="k in BAND" :key="k" class="band-rij">
        <label v-if="magBand" class="schakel-naam kb-vink"><input type="checkbox" :checked="!!a.band?.[k]?.ja" :data-test="`band-${k}`" @change="zetBand(k, ($event.target as HTMLInputElement).checked)"> {{ label(k) }}</label>
        <template v-else>{{ label(k) }}: {{ a.band?.[k]?.ja ? `ja (${a.band[k].bron ?? 'bron onbekend'})` : 'nog niet' }}</template>
      </li>
    </ul>
    <button v-if="a.kan?.kwalificeer" type="button" class="dd-act dd-act--primair mt-16" data-test="kwalificeer" @click="kwalificeer">Kwalificeer</button>
  </article>
  <section class="kb-committee">
    <div class="sec-head"><span class="kicker kicker--streep">Buying committee</span><button type="button" class="dd-act" :disabled="committeeBezig" data-test="committee-ai" @click="stelCommitteeVoor"><Icoon naam="Sparkles" class="dd-actie-icoon" />Stel voor met AI</button></div>
    <BuyingCommittee class="mt-16" :contacten="a.contacten ?? []" :ontbrekend="a.ontbrekendeRollen ?? []" />
    <ul v-if="committee?.length" class="schakel-lijst kaart mt-16" data-test="committee-voorstel">
      <li v-for="v in committee" :key="v.functie" class="schakel-rij"><span><strong>{{ v.functie }}</strong>: {{ v.rol }} <span v-if="v.vermoedelijk" class="pil pil--leeg">vermoedelijk</span><br><span class="meta">{{ v.bron }} · zekerheid {{ v.zekerheid }}</span></span></li>
    </ul>
    <div v-if="functie('datacollectief.verrijken')?.beschikbaar" class="kaart kaart--vlak dc-zoek mt-16" data-test="dc-zoek-blok">
      <button type="button" class="dd-act dc-knop" :disabled="dcBezig || !online" data-test="dc-zoek" @click="zoekContacten">{{ online ? 'Zoek contactpersonen' : 'Niet beschikbaar zonder verbinding' }}</button>
      <span class="meta">Datacollectief · kost tot 5 records</span>
    </div>
    <ul v-if="a.contacten?.length" class="schakel-lijst kaart mt-16"><li v-for="c in a.contacten" :key="c.id" class="schakel-rij"><NuxtLink :to="`/contacten/${c.id}`">{{ c.naam }}</NuxtLink><span class="meta">{{ CONTACTROL_LABEL[c.rol as ContactRol] }}<template v-if="c.functie"> · {{ c.functie }}</template><template v-if="c.status === 'vertrokken'"> · vertrokken</template><template v-if="c.herkomst?.bron === 'datacollectief'"> · Datacollectief · {{ c.herkomst.op.slice(0, 10) }}</template></span></li></ul>
  </section>
</template>

<style scoped>
.kb-vink { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
.kb-committee { margin-top: 8px; }
</style>
