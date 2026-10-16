<script setup lang="ts">
// Het venster van een document uit de kennisbank (opzet van DealDrive DocumentDetailFlyout): kicker
// "Kennisbank · <type>", de naam en de beschrijving; Datavelden (type, versie, bestand, bijgewerkt, wie het
// uploadde en de gekoppelde klanten en contacten als chips met link), die als context naar de AI gaan; de preview
// (afbeelding, pdf in een frame of de uitgelezen tekst, anders de melding dat er geen voorbeeld is); "Vraag de
// AI over dit document" met drie voorgestelde vragen en een eigen vraag, beantwoord in het venster zelf. Voet:
// Verwijderen (rood, met bevestiging, voor wie het uploadde en de beheerder) en Openen (zwart, het bestand).
import { TYPE_LABEL, bestandSoort, grootteLabel, previewSoort, voorgesteldeVragen, type DocumentType } from '~~/shared/kennisbank'

const props = defineProps<{ documentId: string | null }>()
const emit = defineEmits<{ sluit: []; verwijderd: [id: string] }>()
const toast = useToast()
const { functie } = useMe()
const doc = ref<any>(null)
const laden = ref(false)
const vraagVerwijder = ref(false)
const eigenOpen = ref(false)
const eigenVraag = ref('')
const bezig = ref(false)
const antwoorden = ref<{ vraag: string; antwoord: string; bronnen: { label: string; citaat?: string | null }[]; metInhoud: boolean }[]>([])
const kanAi = computed(() => !!functie('assistent.chat')?.beschikbaar)

async function laad() {
  antwoorden.value = []; eigenOpen.value = false; eigenVraag.value = ''
  if (!props.documentId) { doc.value = null; return }
  laden.value = true
  try { doc.value = await $fetch(`/api/documenten/${props.documentId}`) } catch (e) { toast.toon(foutTekst(e), 'fout'); emit('sluit') } finally { laden.value = false }
}
watch(() => props.documentId, laad, { immediate: true })

const typeLabel = computed(() => (doc.value ? TYPE_LABEL[doc.value.type as DocumentType] ?? 'Document' : 'Document'))
const bestandUrl = computed(() => (doc.value ? `/api/documenten/${doc.value.id}/bestand` : ''))
const preview = computed(() => (doc.value ? previewSoort(doc.value.mime, !!doc.value.tekst) : 'geen'))
const previewTekst = computed(() => { const t = String(doc.value?.tekst ?? '').trim(); return t.length > 4000 ? `${t.slice(0, 4000)}\n…` : t })
const heeftTekst = computed(() => !!doc.value?.tekst)
const vragen = computed(() => (doc.value ? voorgesteldeVragen(doc.value.type) : []))
const datum = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '')

async function vraag(tekst: string) {
  const v = tekst.trim()
  if (!v || bezig.value || !doc.value) return
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/documenten/${doc.value.id}/vraag`, { method: 'POST', body: { vraag: v } })
    antwoorden.value.push({ vraag: r.vraag, antwoord: r.antwoord, bronnen: r.bronnen ?? [], metInhoud: r.metInhoud })
    eigenVraag.value = ''
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function verwijder() {
  vraagVerwijder.value = false
  const id = doc.value?.id
  if (!id) return
  try { await $fetch(`/api/documenten/${id}`, { method: 'DELETE' }); toast.toon('Document verwijderd.'); emit('verwijderd', id) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && props.documentId && !vraagVerwijder.value) emit('sluit') }
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', opEscape))
</script>

<template>
  <Teleport to="body">
    <div v-if="documentId" class="fo-overlay fo-overlay--donker" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--breed" role="dialog" aria-modal="true" aria-labelledby="ddf-titel" data-test="document-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker" data-test="ddf-kicker"><Icoon naam="FileText" :grootte="12" /> Kennisbank · {{ typeLabel }}</span>
            <h2 id="ddf-titel" class="fo-titel" data-test="ddf-naam">{{ doc?.naam ?? 'Document' }}</h2>
            <p v-if="doc?.beschrijving" class="fo-meta">{{ doc.beschrijving }}</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>

        <div class="fo-body">
          <p v-if="laden && !doc" class="fo-leeg">Laden...</p>
          <template v-else-if="doc">
            <article class="fo-blok" data-test="ddf-velden">
              <div class="ddf-blokkop"><h3 class="ddf-bloktitel">Datavelden</h3><span class="ddf-bloksub">Deze velden gaan automatisch mee als context naar de AI-chat.</span></div>
              <dl class="defs">
                <div class="def-rij"><dt>Type</dt><dd>{{ typeLabel }}</dd></div>
                <div class="def-rij"><dt>Versie</dt><dd class="tnum">v{{ doc.versie }}</dd></div>
                <div class="def-rij"><dt>Bestand</dt><dd class="tnum">{{ grootteLabel(doc.grootte) }} · {{ bestandSoort(doc.mime) }}</dd></div>
                <div class="def-rij"><dt>Bijgewerkt</dt><dd class="tnum">{{ datum(doc.bijgewerktOp) }}</dd></div>
                <div class="def-rij"><dt>Geüpload door</dt><dd>{{ doc.eigenaar?.naam ?? '–' }}</dd></div>
                <div class="def-rij"><dt>Gekoppelde klanten</dt>
                  <dd><template v-if="doc.accounts.length"><NuxtLink v-for="a in doc.accounts" :key="a.id" :to="`/accounts/${a.id}`" class="ddf-chip" data-test="ddf-klant" @click="emit('sluit')">{{ a.naam }}</NuxtLink></template><span v-else class="meta">Geen</span></dd>
                </div>
                <div class="def-rij"><dt>Gekoppelde contacten</dt>
                  <dd><template v-if="doc.contacten.length"><NuxtLink v-for="c in doc.contacten" :key="c.id" :to="`/contacten/${c.id}`" class="ddf-chip" data-test="ddf-contact" @click="emit('sluit')">{{ c.naam }}</NuxtLink></template><span v-else class="meta">Geen</span></dd>
                </div>
              </dl>
            </article>

            <article class="fo-blok ddf-grijs" data-test="ddf-preview">
              <div class="ddf-blokkop"><h3 class="ddf-bloktitel">Preview van het document</h3>
                <span class="ddf-bloksub">{{ preview === 'afbeelding' || preview === 'pdf' ? 'Het bestand zoals het is opgeslagen.' : preview === 'tekst' ? 'De uitgelezen tekst van het bestand.' : 'Van dit document is geen voorbeeld te tonen. Met Openen zie je het bestand zelf.' }}</span>
              </div>
              <img v-if="preview === 'afbeelding'" :src="bestandUrl" :alt="doc.naam" class="ddf-afbeelding" data-test="ddf-preview-afbeelding">
              <iframe v-else-if="preview === 'pdf'" :src="bestandUrl" :title="`Preview van ${doc.naam}`" class="ddf-frame" data-test="ddf-preview-pdf" />
              <pre v-else-if="preview === 'tekst'" class="ddf-tekst" data-test="ddf-preview-tekst">{{ previewTekst }}</pre>
              <p v-else class="ddf-geen" data-test="ddf-preview-geen"><Icoon naam="File" :grootte="16" /> Geen voorbeeld beschikbaar.</p>
            </article>

            <article class="fo-blok ddf-grijs" data-test="ddf-ai">
              <div class="ddf-blokkop"><h3 class="ddf-bloktitel">Vraag de AI over dit document</h3>
                <span v-if="heeftTekst" class="ddf-bloksub" data-test="ddf-ai-inhoud">De tekst van dit document gaat mee naar de AI. Stel vragen over de inhoud en je krijgt antwoord uit het document zelf.</span>
                <span v-else-if="doc.mime.startsWith('image/')" class="ddf-bloksub" data-test="ddf-ai-zonder">Een afbeelding heeft geen tekst die de AI kan lezen. Stel vragen over de datavelden; de AI kent hier titel, type en koppelingen.</span>
                <span v-else class="ddf-bloksub" data-test="ddf-ai-zonder">Het lezen van dit bestand is mislukt, bijvoorbeeld omdat het een scan zonder tekstlaag is of omdat het beveiligd of beschadigd is. De AI kent daarom alleen titel, type en koppelingen, niet de inhoud.</span>
              </div>
              <p v-if="!kanAi" class="meta">De AI-assistent staat voor jou nog niet aan.</p>
              <template v-else>
                <ol v-if="antwoorden.length" class="ddf-antwoorden" data-test="ddf-antwoorden">
                  <li v-for="(a, i) in antwoorden" :key="i" class="ddf-antwoord">
                    <p class="ddf-vraag"><Icoon naam="MessageSquare" :grootte="12" /> {{ a.vraag }}</p>
                    <p class="ddf-antwoord-tekst" data-test="ddf-antwoord">{{ a.antwoord }}</p>
                    <p class="ddf-basis"><span class="ddf-basis-label">Gebaseerd op</span>
                      <span v-for="(b, j) in a.bronnen" :key="j" class="ddf-bron" :title="b.citaat ?? undefined">{{ b.label }}</span>
                      <span class="ddf-bron ddf-bron--stil">{{ a.metInhoud ? 'inhoud en datavelden' : 'alleen de datavelden' }}</span>
                    </p>
                  </li>
                </ol>
                <div class="ddf-vragen">
                  <button v-for="v in vragen" :key="v" type="button" class="ddf-vraagknop" :disabled="bezig" data-test="ddf-vraag" @click="vraag(v)"><Icoon naam="MessageSquare" :grootte="14" />{{ v }}</button>
                  <button v-if="!eigenOpen" type="button" class="ddf-vraagknop ddf-vraagknop--eigen" data-test="ddf-eigen" @click="eigenOpen = true"><Icoon naam="Sparkles" :grootte="14" />Stel je eigen vraag</button>
                  <form v-else class="ddf-eigen" @submit.prevent="vraag(eigenVraag)">
                    <label class="sr-only" for="ddf-eigen-invoer">Je vraag over dit document</label>
                    <textarea id="ddf-eigen-invoer" v-model="eigenVraag" class="invoer" rows="2" maxlength="2000" placeholder="Wat wil je weten over dit document?" data-test="ddf-eigen-invoer" @keydown.enter.exact.prevent="vraag(eigenVraag)" />
                    <button type="submit" class="dd-act dd-act--geel" :disabled="bezig || !eigenVraag.trim()" data-test="ddf-eigen-stuur">Vraag</button>
                  </form>
                  <p v-if="bezig" class="meta" role="status">De AI leest mee...</p>
                </div>
              </template>
            </article>
          </template>
        </div>

        <footer v-if="doc" class="fo-foot dd-acties ddf-voet">
          <button v-if="doc.magVerwijderen" type="button" class="dd-actie dd-actie--gevaar" data-test="ddf-verwijder" @click="vraagVerwijder = true"><Icoon naam="Trash2" :grootte="14" />Verwijderen</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <a :href="bestandUrl" target="_blank" rel="noopener" class="dd-actie dd-actie--zwart" data-test="ddf-open"><Icoon naam="ExternalLink" :grootte="14" />Openen</a>
        </footer>
      </aside>
    </div>
    <BevestigVenster :open="vraagVerwijder" titel="Document verwijderen?" :tekst="`${doc?.naam ?? 'Dit document'} verdwijnt uit de kennisbank en van elke account- en contactkaart.`" bevestig="Verwijderen" gevaar @bevestigd="verwijder" @geannuleerd="vraagVerwijder = false" />
  </Teleport>
</template>

<style scoped>
.ddf-blokkop { margin-bottom: 12px; }
.ddf-bloktitel { margin: 0; font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); }
.ddf-bloksub { display: block; margin-top: 2px; font-size: 12px; line-height: 1.45; color: var(--muted); }
.ddf-grijs { background: var(--surface); }
.ddf-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 2px 10px; margin: 0 6px 6px 0; background: var(--wit); border: 1px solid var(--border-strong); border-radius: 2px; font-size: 12px; font-weight: 700; color: var(--ink); text-decoration: none; }
.ddf-chip:hover { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.ddf-afbeelding { display: block; width: 100%; max-height: 360px; object-fit: contain; background: var(--wit); border: 1px solid var(--border); }
.ddf-frame { display: block; width: 100%; height: 360px; background: var(--wit); border: 1px solid var(--border); }
.ddf-tekst { margin: 0; max-height: 280px; overflow: auto; padding: 12px; background: var(--wit); border: 1px solid var(--border); font-family: inherit; font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
.ddf-geen { display: flex; align-items: center; gap: 8px; margin: 0; padding: 16px; background: var(--wit); border: 1px dashed var(--border-strong); font-size: 13px; color: var(--muted); }
.ddf-vragen { display: grid; gap: 6px; }
.ddf-vraagknop { display: flex; align-items: center; gap: 8px; min-height: var(--touch-target-min); padding: 8px 12px; background: var(--wit); border: 1px solid var(--border-strong); border-radius: 2px; font: inherit; font-size: 13px; text-align: left; color: var(--ink); cursor: pointer; }
.ddf-vraagknop:hover:not(:disabled) { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.ddf-vraagknop:disabled { opacity: 0.6; cursor: default; }
.ddf-vraagknop--eigen { font-weight: 700; }
.ddf-eigen { display: flex; gap: 8px; align-items: flex-end; }
.ddf-eigen .invoer { flex: 1; min-height: 64px; }
.ddf-antwoorden { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 10px; }
.ddf-antwoord { padding: 12px 14px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--purple, var(--ink)); }
.ddf-vraag { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--muted); }
.ddf-antwoord-tekst { margin: 0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; color: var(--ink); }
.ddf-basis { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 10px 0 0; }
.ddf-basis-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.ddf-bron { padding: 2px 8px; background: var(--surface); border-radius: 2px; font-size: 11px; font-weight: 600; color: var(--ink-soft); }
.ddf-bron--stil { background: transparent; border: 1px solid var(--border); color: var(--muted); }
@media (max-width: 719px) {
  .ddf-chip { min-height: var(--touch-target-min); }
  .ddf-frame { height: 280px; }
  .ddf-eigen { flex-direction: column; align-items: stretch; }
  .ddf-eigen .dd-act { min-height: var(--touch-target-min); }
}
</style>
