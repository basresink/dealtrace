<script setup lang="ts">
// Inzichtflyout (F06): wat er gebeurde, waarom het relevant is, bewijs, voorgestelde
// taak; "Maak taak" (geel), "Markeer als gelezen" en "Wijs af" met een vaste of een eigen reden (Gevorderd).
// Historie: binnengekomen, gelezen, omgezet of afgewezen met de reden. Het winpunt staat er met zijn titel.
import { AFWIJS_REDENEN, ACTIE_LABEL } from '~~/shared/taken'
import { EIGEN_REDEN, EIGEN_REDEN_MAX, EIGEN_REDEN_MIN } from '~~/shared/inzichten'
const props = defineProps<{ open: boolean; inzicht: any | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const { functie } = useMe()
const { openen: openAi } = useAssistent()
const AGENT_NAAM: Record<string, string> = { waarnemer: 'Waarnemer', verrijker: 'Verrijker', profielbouwer: 'Profielbouwer', notulist: 'Notulist', handmatig: 'Handmatig' }
function vraagAi() { openAi({ accountId: props.inzicht?.account?.id ?? null, label: props.inzicht?.account?.naam ?? undefined, vraag: `Wat betekent "${props.inzicht?.title}" voor mijn aanpak?` }); emit('sluit') }
const toast = useToast()
const reden = ref('')
const eigenTekst = ref('')
watch(() => props.open, (o) => { if (o) { reden.value = ''; eigenTekst.value = '' } })
const afgewezen = computed(() => props.inzicht?.status === 'afgewezen')
const kanAfwijzen = computed(() => !!reden.value && (reden.value !== EIGEN_REDEN || eigenTekst.value.trim().length >= EIGEN_REDEN_MIN))
const historie = computed<{ soort: string; op: string | null; tekst: string; reden?: string | null }[]>(() => props.inzicht?.historie?.length ? props.inzicht.historie : props.inzicht?.createdAt ? [{ soort: 'binnen', op: props.inzicht.createdAt, tekst: 'Binnengekomen' }] : [])
const moment = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '') : '')
async function maakTaak() {
  try { await $fetch(`/api/signals/${props.inzicht.id}/omzetten`, { method: 'POST', body: {} }); toast.toon('Taak gemaakt uit het inzicht.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function gelezen() {
  try { await $fetch(`/api/signals/${props.inzicht.id}/gelezen`, { method: 'POST' }); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function wijsAf() {
  try { await $fetch(`/api/signals/${props.inzicht.id}/afwijzen`, { method: 'POST', body: { reden: reden.value, ...(reden.value === EIGEN_REDEN ? { toelichting: eigenTekst.value.trim() } : {}) } }); toast.toon('Inzicht afgewezen.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && inzicht" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="if-titel" data-test="inzicht-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">{{ inzicht.bron === 'extern' ? 'Extern' : 'Intern' }} · relevantie {{ inzicht.relevantie }}<template v-if="inzicht.agent"> · {{ AGENT_NAAM[inzicht.agent] ?? inzicht.agent }}</template></span><h2 id="if-titel" class="fo-titel">{{ inzicht.title }}</h2>
            <p v-if="inzicht.account" class="taak-meta"><NuxtLink :to="`/accounts/${inzicht.account.id}`">{{ inzicht.account.naam }}</NuxtLink></p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Wat is er gebeurd?</h3></header><p>{{ inzicht.title }}</p></article>
          <article v-if="inzicht.waarom" class="fo-blok aanleiding-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Waarom is dit relevant?</h3><span class="pil pil--leeg">beoordeling</span></header><p>{{ inzicht.waarom }}</p></article>
          <article v-if="inzicht.evidence?.length" class="fo-blok" data-test="inzicht-bewijs"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Bewijs</h3><span v-if="inzicht.specifiekeBron" class="pil pil--leeg">{{ inzicht.specifiekeBron }}</span></header>
            <blockquote v-for="(e, n) in inzicht.evidence" :key="n" class="inzicht-citaat">"{{ e.citaat }}"<footer class="taak-meta">{{ e.bron }}<template v-if="e.datum"> · {{ e.datum }}</template><template v-if="e.url"> · <a :href="e.url" target="_blank" rel="noopener noreferrer">Open bron</a></template></footer></blockquote></article>
          <article v-else-if="inzicht.bewijs?.length" class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Bewijs</h3></header><ul class="schakel-lijst"><li v-for="b in inzicht.bewijs" :key="b" class="schakel-rij">{{ b }}</li></ul></article>
          <article v-if="inzicht.winpuntVoorstel" class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Voorgesteld winpunt</h3></header><p data-test="inzicht-winpunt">{{ inzicht.winpuntTitel ?? inzicht.winpuntVoorstel }}</p></article>
          <article v-if="inzicht.voorstel" class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Voorgestelde taak</h3></header><p><span class="pil pil--leeg">{{ ACTIE_LABEL[inzicht.voorstel.actionType] ?? 'TAAK' }}</span> {{ inzicht.voorstel.title }}</p></article>
          <p v-if="functie('agents.waaromNiet')?.beschikbaar && (inzicht.ruleId || inzicht.agent)" class="taak-meta" data-test="inzicht-expert">
            <template v-if="inzicht.ruleId">Regel {{ inzicht.ruleId }}</template><template v-if="inzicht.ruleId && inzicht.agent"> · </template><template v-if="inzicht.agent">mandaat A</template><template v-if="inzicht.zekerheid != null"> · zekerheid {{ inzicht.zekerheid }}</template></p>
          <article v-if="functie('inzichten.afwijzen')?.beschikbaar && !afgewezen" class="fo-blok">
            <label class="veld"><span class="veld-label">Wijs af met reden</span><select v-model="reden" class="invoer" data-test="afwijs-reden"><option value="" disabled>Kies een reden</option><option v-for="r in AFWIJS_REDENEN" :key="r" :value="r">{{ r }}</option><option :value="EIGEN_REDEN">{{ EIGEN_REDEN }}</option></select></label>
            <label v-if="reden === EIGEN_REDEN" class="veld mt-8"><span class="veld-label">Jouw reden</span>
              <textarea v-model="eigenTekst" class="invoer" rows="2" :maxlength="EIGEN_REDEN_MAX" placeholder="Bijvoorbeeld: dit project loopt al via een collega" data-test="afwijs-eigen" />
              <span class="veld-uitleg">Je reden staat in de historie van dit inzicht en telt mee in de afwijsredenen bij Analyse, Regels en agents.</span>
            </label>
            <button type="button" class="dd-act mt-8" :disabled="!kanAfwijzen" data-test="wijs-af" @click="wijsAf">Wijs af</button>
          </article>
          <article v-if="historie.length" class="fo-blok" data-test="inzicht-historie"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Historie</h3></header>
            <ol class="ifo-historie">
              <li v-for="(h, n) in historie" :key="n" class="ifo-stap" :data-test="`historie-${h.soort}`">
                <span class="ifo-stap-tekst">{{ h.tekst }}<template v-if="h.reden">: <strong>{{ h.reden }}</strong></template></span>
                <time v-if="h.op" class="taak-meta tnum" :datetime="h.op">{{ moment(h.op) }}</time>
              </li>
            </ol>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button v-if="!afgewezen" type="button" class="dd-act" data-test="markeer-gelezen" @click="gelezen">Markeer als gelezen</button>
          <button type="button" class="dd-act" data-test="vraag-ai" @click="vraagAi">Vraag AI</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button v-if="!afgewezen" type="button" class="dd-act dd-act--primair" data-test="maak-taak" @click="maakTaak">Maak taak</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.ifo-historie { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ifo-stap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; padding-left: 12px; border-left: 2px solid var(--border-strong); font-size: 13px; color: var(--ink); }
.ifo-stap-tekst { min-width: 0; overflow-wrap: anywhere; }
</style>
