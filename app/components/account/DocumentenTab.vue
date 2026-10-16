<script setup lang="ts">
// Het tabblad Documenten van de accountkaart en de contactkaart (opzet van DealDrive /accounts/:id?tab=documenten):
// kop "Documenten (N)", de uitleg dat ze gedeeld zijn met de kennisbank, "Document uploaden" (koppelt aan dit
// account of contact) en "Naar Kennisbank", en de lijst met icoon, naam, grootte, datum en versie. Een klik opent
// het venster met de datavelden, de preview en de AI-vragen. Foto's en opnames uit afspraken staan eronder.
import { TYPE_LABEL, grootteLabel, type DocumentType } from '~~/shared/kennisbank'

const props = defineProps<{
  account: { id: string; naam: string }
  contact?: { id: string; naam: string } | null
  documenten: any[]
  afspraakBijlagen?: any[]
}>()
const emit = defineEmits<{ ververs: [] }>()
const toast = useToast()
const { functie } = useMe()
const kennisbank = computed(() => !!functie('nav.kennisbank')?.beschikbaar)
const uploadOpen = ref(false)
const openId = ref<string | null>(null)
const weg = ref<any | null>(null)
const dit = computed(() => (props.contact ? 'dit contact' : 'dit account'))
const datum = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '') : '–')
const icoon = (mime: string) => (mime.startsWith('image/') ? 'Image' : mime === 'application/pdf' ? 'FileText' : 'File')

async function verwijder() {
  const d = weg.value
  weg.value = null
  if (!d) return
  try { await $fetch(`/api/documenten/${d.id}`, { method: 'DELETE' }); toast.toon('Document verwijderd.'); emit('ververs') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <div data-test="documenten-tab">
    <div class="ak-tabkop dt-kop">
      <h2 class="ak-tabtitel">Documenten ({{ documenten.length }})</h2>
      <div class="dt-acties">
        <button type="button" class="dd-actie dd-actie--primair" data-test="document-uploaden" @click="uploadOpen = true"><Icoon naam="Upload" class="dd-actie-icoon" />Document uploaden</button>
        <NuxtLink v-if="kennisbank" to="/kennisbank" class="dd-actie dd-actie--secundair" data-test="naar-kennisbank">Naar Kennisbank →</NuxtLink>
      </div>
    </div>
    <p class="meta ak-hint">Documenten zijn gedeeld met de kennisbank: wat hier verschijnt is ook zoekbaar onder <NuxtLink v-if="kennisbank" to="/kennisbank" class="tekst-link">Kennisbank</NuxtLink><template v-else>Kennisbank</template>. Klik een document voor de AI-bevraging.</p>
    <p v-if="!documenten.length" class="ak-leeg" data-test="documenten-leeg">Nog geen documenten voor {{ dit }}. Klik <strong>Document uploaden</strong>. Het document verschijnt dan hier en in de kennisbank.</p>
    <ul v-else class="ak-rijen">
      <li v-for="d in documenten" :key="d.id" class="ak-doc">
        <button type="button" class="ak-rij" :data-test="`ak-document-${d.id}`" @click="openId = d.id">
          <span class="ak-doc-icoon"><Icoon :naam="icoon(d.mime)" :grootte="18" /></span>
          <span class="ak-rij-info"><span class="ak-rij-titel">{{ d.naam }}</span><span class="meta tnum">{{ grootteLabel(d.grootte) }} · {{ datum(d.bijgewerktOp) }} · v{{ d.versie }}<template v-if="!contact && d.contacten?.length"> · {{ d.contacten.map((c: any) => c.naam).join(', ') }}</template></span></span>
          <span class="pil pil--grijs dt-type">{{ TYPE_LABEL[d.type as DocumentType] ?? 'Overig' }}</span>
          <span class="ak-rij-cta">Vraag AI →</span>
        </button>
        <button v-if="d.magVerwijderen" type="button" class="dd-act dd-act--icoon dd-act--gevaar" :aria-label="`${d.naam} verwijderen`" data-test="document-verwijder" @click="weg = d"><Icoon naam="Trash2" :grootte="14" /></button>
      </li>
    </ul>

    <template v-if="afspraakBijlagen?.length">
      <h3 class="dt-subkop">Uit afspraken</h3>
      <ul class="ak-rijen">
        <li v-for="d in afspraakBijlagen" :key="d.id" class="ak-doc">
          <a :href="`/api/bijlagen/${d.id}`" target="_blank" rel="noopener" class="ak-rij" :data-test="`ak-bijlage-${d.id}`">
            <span class="ak-doc-icoon"><Icoon :naam="d.soort === 'opname' ? 'Mic' : 'Image'" :grootte="18" /></span>
            <span class="ak-rij-info"><span class="ak-rij-titel">{{ d.naam }}</span><span class="meta tnum">{{ grootteLabel(d.grootte) }} · {{ datum(d.op) }}<template v-if="d.door"> · {{ d.door }}</template></span></span>
            <span class="ak-rij-cta">Open →</span>
          </a>
        </li>
      </ul>
    </template>

    <KennisbankUploadFlyout :open="uploadOpen" :account="contact ? null : account" :contact="contact ?? null" @sluit="uploadOpen = false" @bewaard="uploadOpen = false; emit('ververs')" />
    <DocumentDetailFlyout :document-id="openId" @sluit="openId = null" @verwijderd="openId = null; emit('ververs')" />
    <BevestigVenster :open="!!weg" titel="Document verwijderen?" :tekst="`${weg?.naam ?? 'Dit document'} verdwijnt uit de kennisbank en van elke account- en contactkaart.`" bevestig="Verwijderen" gevaar @bevestigd="verwijder" @geannuleerd="weg = null" />
  </div>
</template>

<style scoped>
.ak-tabkop { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 20px; }
.ak-tabtitel { margin: 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
.ak-hint { margin: -8px 0 16px; }
.ak-leeg { padding: 32px; background: var(--wit); border: 1px solid var(--border); text-align: center; font-size: 14px; color: var(--muted); }
.dt-acties { display: flex; flex-wrap: wrap; gap: 8px; }
.dt-type { flex-shrink: 0; }
.dt-subkop { margin: 24px 0 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.ak-rijen { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; background: var(--wit); border: 1px solid var(--border); }
.ak-rijen > li { border-bottom: 1px solid var(--border); }
.ak-rijen > li:last-child { border-bottom: 0; }
.ak-rij { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; width: 100%; min-height: var(--touch-target-min); padding: 14px 18px; background: none; border: 0; color: inherit; font-family: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.ak-rij:hover { background: var(--surface); }
.ak-rij-info { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; flex: 1; min-width: 180px; }
.ak-rij-titel { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.ak-rij-cta { margin-left: auto; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); }
.ak-doc { display: flex; align-items: center; gap: 8px; padding-right: 12px; }
.ak-doc-icoon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: var(--surface); color: var(--ink); }
@media (max-width: 719px) {
  .dt-acties { width: 100%; }
  .dt-acties > * { flex: 1 1 auto; }
  .ak-rij-info { min-width: 0; flex-basis: calc(100% - 48px); }
  .ak-doc .dd-act--icoon { width: 44px; height: 44px; min-height: 44px; }
}
</style>
