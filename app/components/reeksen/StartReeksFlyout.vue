<script setup lang="ts">
// Start reeks (F7) vanaf /opvolgreeksen: kies een prospect, dan een sjabloon, de contactpersoon en het mandaat. Een
// prospect met een lopende reeks, op nee, overgedragen of gedeactiveerd krijgt geen nieuwe reeks; de server zegt
// waarom. Na het starten opent de reeks in de detailkolom.
import { REEKS_KANAAL_LABEL, REEKS_MANDAAT_LABEL } from '~~/shared/opvolgreeks'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ sluit: []; gestart: [id: string] }>()
const toast = useToast()
const gekozen = ref<{ id: string; naam: string } | null>(null)
const v = ref<any>(null)
const laadt = ref(false)
const bezig = ref(false)
const start = reactive({ sjabloonId: '', contactId: '', mandaat: 'C' as 'B' | 'C' })
watch(() => props.open, (o) => { if (o) { gekozen.value = null; v.value = null; Object.assign(start, { sjabloonId: '', contactId: '', mandaat: 'C' }) } })
const zoek = (q: string) => zoekAccounts(q, 'prospect')
async function kies(a: { id: string; naam: string }) {
  gekozen.value = { id: a.id, naam: a.naam }
  laadt.value = true
  try {
    v.value = await $fetch<any>(`/api/volgen/${a.id}`)
    start.sjabloonId = v.value.sjablonen[0]?.id ?? ''
    start.contactId = v.value.contacten.find((c: any) => c.rol === 'beslisser')?.id ?? v.value.contacten[0]?.id ?? ''
  } catch (e) { toast.toon(foutTekst(e), 'fout'); gekozen.value = null } finally { laadt.value = false }
}
const lopend = computed(() => v.value?.reeks && ['loopt', 'gepauzeerd'].includes(v.value.reeks.status) ? v.value.reeks : null)
function stappenTekst(s: { stappen: { dag: number; kanaal: string }[]; einde: { dag: number } }) {
  return `${s.stappen.map((x) => `Dag ${x.dag} ${(REEKS_KANAAL_LABEL[x.kanaal as keyof typeof REEKS_KANAAL_LABEL] ?? x.kanaal).toLowerCase()}`).join(' · ')} · dag ${s.einde.dag} terug naar het ritme`
}
async function doeStart() {
  if (!gekozen.value || !start.sjabloonId) return
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/volgen/${gekozen.value.id}/reeks`, { method: 'POST', body: { sjabloonId: start.sjabloonId, contactId: start.contactId || null, mandaat: start.mandaat } })
    toast.toon(`Reeks ${r?.naam ?? ''} gestart voor ${gekozen.value.naam}.`)
    emit('gestart', r.id)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')" @keydown.esc="emit('sluit')">
      <form class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="sr-start-titel" data-test="reeks-start-flyout" @submit.prevent="doeStart">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Opvolgreeks</span><h2 id="sr-start-titel" class="fo-titel">Start reeks</h2><p class="fo-meta">Kies een prospect en een sjabloon. De reeks stopt vanzelf zodra de prospect reageert.</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <div class="veld">
            <span class="veld-label">Prospect</span>
            <div v-if="gekozen" class="rsf-gekozen" data-test="rsf-gekozen">
              <span>{{ gekozen.naam }}</span>
              <button type="button" class="dd-act dd-act--icoon" aria-label="Andere prospect kiezen" @click="gekozen = null; v = null"><Icoon naam="X" :grootte="14" /></button>
            </div>
            <ZoekKiezer v-else :zoek="zoek" placeholder="Zoek een prospect op naam" label="Zoek een prospect" data-test="rsf-zoek" :optie-test="(t) => `rsf-kies-${t.id}`" :sub="(t) => t.plaats" leeg="Geen prospect gevonden." @kies="kies" />
          </div>
          <p v-if="laadt" class="meta mt-16">Laden…</p>
          <template v-else-if="v">
            <p v-if="lopend" class="kaart kaart--geel mt-16" data-test="rsf-lopend">Op {{ gekozen?.naam }} loopt al de reeks {{ lopend.naam }} ({{ lopend.stand.label.toLowerCase() }}). Stop die eerst; één reeks per prospect.</p>
            <p v-else-if="!v.kan.wijzigen" class="meta mt-16">Alleen de eigenaar van deze prospect, zijn salesmanager of de beheerder start hier een reeks.</p>
            <template v-else>
              <fieldset class="veld mt-16">
                <legend class="veld-label">Sjabloon</legend>
                <label v-for="s in v.sjablonen" :key="s.id" class="rsf-sjabloon" :class="{ 'rsf-sjabloon--aan': start.sjabloonId === s.id }" :data-test="`rsf-sjabloon-${s.sleutel}`">
                  <input v-model="start.sjabloonId" type="radio" name="rsf-sjabloon" :value="s.id">
                  <span><b>{{ s.naam }}</b><span v-if="s.na" class="item-meta"> · na "{{ s.na }}"</span><span class="rsf-stappen">{{ stappenTekst(s) }}</span></span>
                </label>
              </fieldset>
              <label class="veld mt-16"><span class="veld-label">Contactpersoon</span>
                <select v-model="start.contactId" class="invoer" data-test="rsf-contact"><option v-for="c in v.contacten" :key="c.id" :value="c.id">{{ c.naam }}{{ c.email ? '' : ' (geen e-mailadres)' }}</option></select>
              </label>
              <div class="veld mt-16"><span class="veld-label">Mandaat</span>
                <div class="keuzegroep keuzegroep--klein" role="group" aria-label="Mandaat">
                  <button v-for="m in (['C', 'B'] as const)" :key="m" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': start.mandaat === m }" :aria-pressed="start.mandaat === m" :disabled="!v.mandaten.includes(m)" :data-test="`rsf-mandaat-${m}`" @click="start.mandaat = m">{{ REEKS_MANDAAT_LABEL[m] }}</button>
                </div>
              </div>
              <p class="meta mt-8">Mail en LinkedIn krijgen een concept van de Schrijver (AI-credits); je keurt elk concept goed. Bij "Binnen kader" verstuurt de reeks een mail op de dag zelf, langs de Bewaker.</p>
            </template>
          </template>
        </div>
        <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button><button type="submit" class="dd-act dd-act--geel" :disabled="bezig || !gekozen || !v || !!lopend || !v.kan.wijzigen || !start.sjabloonId" data-test="rsf-start">Start reeks</button></footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.rsf-gekozen { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 0 0 12px; border: 1px solid var(--border-strong); font-weight: 600; }
.rsf-sjabloon { display: flex; align-items: flex-start; gap: 10px; margin-top: 8px; padding: 10px 12px; border: 1px solid var(--border); cursor: pointer; font-size: var(--fs-klein); line-height: 1.45; }
.rsf-sjabloon--aan { border-color: var(--ink); background: var(--yellow-zacht, var(--surface)); }
.rsf-sjabloon input { margin-top: 3px; }
.rsf-stappen { display: block; color: var(--muted); }
@media (max-width: 719px) { .rsf-sjabloon, .keuzegroep-knop { min-height: var(--touch-target-min); } }
</style>
