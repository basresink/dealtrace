<script setup lang="ts">
// Taakflyout (F06): aanleiding met "Waarom krijg ik dit?", concept, klant in context,
// het uitkomstraster uit 7.3 en de voet. Op de telefoon een schuifvenster met de
// knoppen onderaan en "Afronden" rechts. Offline gaat afronden via de wachtrij.
import { NEE_REDENEN } from '~~/shared/nbStatus'
import { UITKOMST_CODES, UITKOMST_LABEL } from '~~/shared/hercontact'
import { ACTIE_LABEL, CONTACT_ACTIES, HERKOMST_LABEL, vervalLabel } from '~~/shared/taken'
import { fasePil, telLink } from '~/utils/accountWeergave'
import { agentDef } from '~~/shared/mandaat'
const props = defineProps<{ open: boolean; taakId: string | null; basis?: any; volgende?: boolean }>()
const emit = defineEmits<{ sluit: []; klaar: [volgende: boolean, id: string]; gewijzigd: [] }>()
const { functie, me } = useMe()
const STATUS_LABEL: Record<string, string> = { 'concept-klaar': 'concept wacht op je goedkeuring', goedgekeurd: 'goedgekeurd, wordt verstuurd', uitgevoerd: 'uitgevoerd', tegengehouden: 'tegengehouden door de Bewaker' }
async function keurGoed() {
  try { const r: any = await $fetch(`/api/tasks/${t.value.id}/goedkeuren`, { method: 'POST', body: {} }); toast.toon(r.executorStatus === 'uitgevoerd' ? 'Goedgekeurd en verstuurd.' : `Goedgekeurd. ${r.reden ?? 'Hij gaat later de deur uit.'}`); emit('gewijzigd'); t.value = await $fetch(`/api/tasks/${t.value.id}`) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const toast = useToast()
const { rondAf } = useAfronden()
const t = ref<any>(null)
const laden = ref(false)
const uitkomst = ref<string>('')
const laterOp = ref('')
const reden = ref('')
const toelichting = ref('')
const bewerken = ref(false)
const belpaneel = ref<any>(null)
async function laadBelpaneel() { if (!belpaneel.value && t.value) belpaneel.value = await $fetch(`/api/bellen/taak/${t.value.id}`).catch(() => ({ item: null })) }
const annuleren = ref(false)
const annuleerReden = ref('')
const bezig = ref(false)
const bewerk = reactive({ title: '', priority: 'middel', dueDate: '', actionType: 'taak', beschrijving: '' })
watch(() => [props.open, props.taakId], async ([o]) => {
  if (!o || !props.taakId) return
  uitkomst.value = ''; laterOp.value = ''; reden.value = ''; toelichting.value = ''; bewerken.value = false; annuleren.value = false; belpaneel.value = null
  laden.value = true
  try { t.value = await $fetch(`/api/tasks/${props.taakId}`) } catch { t.value = props.basis ? { ...props.basis, kan: { afronden: true }, account: props.basis.account ?? null } : null } finally { laden.value = false }
}, { immediate: true })
const contact = computed(() => t.value && CONTACT_ACTIES.has(t.value.actionType))
const ongeldig = computed(() => (contact.value && !uitkomst.value) || (uitkomst.value === 'later' && !laterOp.value) || (uitkomst.value === 'geen_interesse' && (!reden.value || (reden.value === 'Anders' && !toelichting.value.trim()))))
const mobiel = () => import.meta.client && window.matchMedia('(max-width: 767px)').matches
async function doeAfronden(volgende: boolean) {
  if (ongeldig.value || !t.value) return
  bezig.value = true
  const body = { uitkomst: uitkomst.value || (contact.value ? null : 'gedaan'), laterOp: laterOp.value || null, reden: reden.value || null, toelichting: toelichting.value || null }
  const id = t.value.id
  emit('sluit')
  const ok = await rondAf(id, body, { mobiel: mobiel() })
  bezig.value = false
  if (ok) emit('klaar', volgende, id)
}
async function stelUit(periode: 'werkdag' | 'week') {
  try { await $fetch(`/api/tasks/${t.value.id}/uitstellen`, { method: 'POST', body: { periode } }); toast.toon(periode === 'week' ? 'Uitgesteld met een week.' : 'Uitgesteld met een werkdag.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function startBewerken() { Object.assign(bewerk, { title: t.value.title, priority: t.value.priority, dueDate: t.value.dueDate?.slice(0, 16) ?? '', actionType: t.value.actionType, beschrijving: t.value.beschrijving ?? '' }); bewerken.value = true }
async function bewaar() {
  try { await $fetch(`/api/tasks/${t.value.id}`, { method: 'PUT', body: { ...bewerk, dueDate: bewerk.dueDate ? new Date(bewerk.dueDate).toISOString() : undefined } }); toast.toon('Taak bijgewerkt.'); emit('gewijzigd'); t.value = await $fetch(`/api/tasks/${t.value.id}`); bewerken.value = false } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function doeAnnuleren() {
  try { await $fetch(`/api/tasks/${t.value.id}/annuleren`, { method: 'POST', body: { reden: annuleerReden.value } }); toast.toon('Taak geannuleerd.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijder() {
  try { await $fetch(`/api/tasks/${t.value.id}`, { method: 'DELETE' }); toast.toon('Taak verwijderd.'); emit('gewijzigd'); emit('sluit') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const PRIO_STIP: Record<string, string> = { hoog: 'prio-stip--high', middel: 'prio-stip--medium', laag: 'prio-stip--low' }
const morgen = computed(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="tf-titel" data-test="taak-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker"><span v-if="t" class="prio-stip" :class="PRIO_STIP[t.priority]" /> {{ t ? `${ACTIE_LABEL[t.actionType] ?? 'TAAK'} · ${t.status}` : 'Taak' }}</span>
            <h2 id="tf-titel" class="fo-titel">{{ t?.title ?? 'Laden…' }}</h2>
            <p v-if="t?.account" class="taak-meta"><NuxtLink :to="`/accounts/${t.account.id}`">{{ t.account.naam }}</NuxtLink> <span v-if="t.account.fase" class="pil" :class="fasePil(t.account.fase.kleur)">{{ t.account.fase.label }}</span></p>
            <p v-if="t?.poging" class="taak-meta" data-test="pogingregel">poging {{ t.poging.n }} van {{ t.poging.van }}<template v-if="t.poging.kanaal"> · {{ t.poging.kanaal }}</template><template v-if="t.poging.vorige"> · vorige: {{ t.poging.vorige }}</template></p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div v-if="t" class="fo-body fo-body--formulier">
          <article v-if="t.aanleiding || t.waarom" class="fo-blok aanleiding-blok" data-test="aanleiding">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Aanleiding</h3><span class="pil pil--leeg">{{ HERKOMST_LABEL[t.herkomst] ?? 'Handmatig' }}</span></header>
            <p v-if="t.aanleiding">{{ t.aanleiding }}</p>
            <p v-if="t.waarom" class="mt-8" data-test="waarom"><strong>Waarom krijg ik dit?</strong> {{ t.waarom }}<template v-if="t.regel"> <NuxtLink v-if="functie('regels.lezen')?.beschikbaar" :to="`/instellingen/regels`" class="tekst-link">Bekijk de regel</NuxtLink></template></p>
          </article>
          <details v-if="t.actionType === 'bellen' && functie('belscript.kiezen')?.beschikbaar" class="fo-blok" data-test="belpaneel" @toggle="laadBelpaneel">
            <summary class="fo-blok-titel">Belscript</summary>
            <BelScript v-if="belpaneel?.item" :scripts="belpaneel.scripts" :voorstel="belpaneel.item.voorstel" :waarden="belpaneel.item.waarden" :extra-bezwaren="belpaneel.item.extraBezwaren" :meldingen="belpaneel.item.meldingen" :account-id="belpaneel.item.accountId" :contact-id="belpaneel.item.contactId" :ai-aan="belpaneel.kan.ai" compact />
            <p v-else-if="belpaneel" class="meta">Geen script voor deze taak.</p>
          </details>
          <article v-if="t.agent" class="fo-blok" data-test="agent-blok">
            <p class="taak-meta">Door {{ agentDef(t.agent)?.naam ?? t.agent }}<template v-if="me?.gebruiker.niveau === 'expert' && t.mandaat"> · mandaat <span class="pil" :class="`pil--mandaat-${t.mandaat}`">{{ t.mandaat }}</span></template><template v-if="t.executorStatus"> · {{ STATUS_LABEL[t.executorStatus] }}</template></p>
          </article>
          <article v-if="t.concept" class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Concept</h3></header><p v-if="t.concept.onderwerp"><strong>{{ t.concept.onderwerp }}</strong></p><p>{{ t.concept.tekst }}</p>
            <button v-if="t.executorStatus === 'concept-klaar'" type="button" class="dd-act dd-act--primair mt-8" data-test="concept-goedkeuren" @click="keurGoed">Goedkeuren en versturen</button>
          </article>
          <article v-if="t.account" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Klant in context</h3></header>
            <p class="taak-meta">Score {{ t.account.score }}<template v-if="t.account.fase?.accent"> · {{ t.account.fase.accent }}</template></p>
            <ul v-if="t.account.laatste?.length" class="schakel-lijst"><li v-for="(x, i) in t.account.laatste.slice(0, 3)" :key="i" class="schakel-rij"><span>{{ x.soort }}<template v-if="x.uitkomst"> · {{ x.uitkomst }}</template></span><span class="meta">{{ new Date(x.op).toLocaleDateString('nl-NL') }}</span></li></ul>
            <p v-if="t.account.primair" class="mt-8"><strong>{{ t.account.primair.naam }}</strong>
              <a v-if="t.account.primair.telefoon && !t.account.primair.belMeNiet" class="dd-act" :href="telLink(t.account.primair.telefoon)">Bel</a>
              <a v-if="t.account.primair.email" class="dd-act" :href="`mailto:${t.account.primair.email}`">Mail</a></p>
          </article>
          <article v-if="!bewerken && t.status !== 'klaar' && t.kan?.afronden" class="fo-blok" data-test="uitkomst">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">{{ contact ? 'Uitkomst' : 'Afronden' }}</h3></header>
            <div v-if="contact" class="uitkomst-raster">
              <button v-for="u in UITKOMST_CODES" :key="u" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': uitkomst === u }" :data-test="`uitkomst-${u}`" @click="uitkomst = u">{{ UITKOMST_LABEL[u] }}</button>
            </div>
            <p v-else class="taak-meta">Deze taak heeft geen uitkomst nodig.</p>
            <label v-if="uitkomst === 'later'" class="veld mt-16"><span class="veld-label">Wanneer terug? <span class="veld-verplicht">*</span></span><input v-model="laterOp" type="date" class="invoer" :min="morgen" data-test="later-op"></label>
            <template v-if="uitkomst === 'geen_interesse'">
              <label class="veld mt-16"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span><select v-model="reden" class="invoer" data-test="uitkomst-reden"><option value="" disabled>Kies een reden</option><option v-for="r in NEE_REDENEN.filter((x) => x !== 'Niet geschikt')" :key="r" :value="r">{{ r }}</option></select></label>
              <label v-if="reden === 'Anders'" class="veld mt-8"><span class="veld-label">Toelichting <span class="veld-verplicht">*</span></span><textarea v-model="toelichting" class="invoer" rows="2" /></label>
            </template>
          </article>
          <article v-if="bewerken" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Bewerken</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Titel</span><input v-model="bewerk.title" class="invoer"></label>
              <label class="veld"><span class="veld-label">Prioriteit</span><select v-model="bewerk.priority" class="invoer"><option value="hoog">Hoog</option><option value="middel">Middel</option><option value="laag">Laag</option></select></label>
              <label class="veld"><span class="veld-label">Vervaldatum en tijd</span><input v-model="bewerk.dueDate" type="datetime-local" class="invoer"></label>
              <label class="veld"><span class="veld-label">Actiesoort</span><select v-model="bewerk.actionType" class="invoer"><option v-for="(l, k) in ACTIE_LABEL" :key="k" :value="k">{{ l }}</option></select></label>
            </div>
            <label class="veld mt-16"><span class="veld-label">Beschrijving</span><textarea v-model="bewerk.beschrijving" class="invoer" rows="2" /></label>
            <button type="button" class="dd-act dd-act--primair mt-16" @click="bewaar">Bewaren</button>
          </article>
          <article v-if="annuleren" class="fo-blok">
            <label class="veld"><span class="veld-label">Waarom annuleer je deze taak?</span><input v-model="annuleerReden" class="invoer" data-test="annuleer-reden"></label>
            <button type="button" class="dd-act mt-8" :disabled="!annuleerReden.trim()" @click="doeAnnuleren">Annuleer taak</button>
          </article>
          <p class="taak-meta">Vervalt {{ vervalLabel(t.dueDate, new Date()) }}<template v-if="t.eigenaar"> · {{ t.eigenaar.replace(/^Testgebruiker /, '') }}</template></p>
        </div>
        <p v-else-if="laden" class="fo-body meta">Laden…</p>
        <footer v-if="t && t.status !== 'klaar' && t.kan?.afronden" class="fo-foot dd-acties">
          <button type="button" class="dd-act dd-act--icoon" title="Uitstellen 1 werkdag" aria-label="Uitstellen 1 werkdag" data-test="uitstellen" @click="stelUit('werkdag')"><Icoon naam="Clock" /></button>
          <button type="button" class="dd-act dd-act--icoon" title="Bewerken" aria-label="Bewerken" @click="startBewerken"><Icoon naam="Pencil" /></button>
          <button type="button" class="dd-act dd-act--icoon" title="Annuleren" aria-label="Annuleren" @click="annuleren = !annuleren"><Icoon naam="Ban" /></button>
          <button v-if="t.kan?.verwijderen" type="button" class="dd-act dd-act--icoon" title="Verwijderen" aria-label="Verwijderen" @click="verwijder"><Icoon naam="Trash2" /></button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button v-if="volgende && functie('taken.horizon')?.beschikbaar" type="button" class="dd-act" :disabled="bezig || ongeldig" data-test="afronden-volgende" @click="doeAfronden(true)">Afronden en volgende</button>
          <button type="button" class="dd-act dd-act--primair" :disabled="bezig || ongeldig" data-test="afronden" @click="doeAfronden(false)">Afronden</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
