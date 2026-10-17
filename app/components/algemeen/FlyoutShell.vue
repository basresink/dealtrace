<script setup lang="ts">
// Eén opzet voor elke flyout (UI-standaard Flyouts). Kop op een grijs vlak: kicker, titel en een regel met
// klant of contactpersoon; rechts de opslaan-status (Gewijzigd, Opslaan…, Opgeslagen om 10:42 of Kon niet
// opslaan, probeer opnieuw; in een aria-live regio), Vraag AI (sterretjes, opent de AI-assistent met de
// context van de flyout) en sluiten. Daaronder de inhoud (slot, met een eigen .fo-body) en de voet (slot
// voet): links de hoofdactie in zwart met gele tekst, rechts icoonknoppen van 44 px (.fs-ibtn).
// Sluiten met wijzigingen die nog niet zijn opgeslagen, vraagt boven de voet wat je wilt. Een flyout zonder
// bewerkbare velden geeft geen opslag mee en toont dus geen status.
// Toegankelijk: role=dialog met aria-labelledby, focus gaat naar binnen en bij sluiten terug, Tab blijft
// in de flyout, Escape sluit alleen de bovenste flyout. Op de telefoon is de flyout schermvullend.
import type { FlyoutOpslag } from '~/composables/useFlyoutOpslag'

export interface FlyoutAi { accountId?: string | null; label?: string; vraag?: string; voorstellen?: string[] }
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  open: boolean
  kicker?: string
  titel?: string
  meta?: string | null
  titelId?: string
  breedte?: 'smal' | 'normaal' | 'breed' | 'analyse' | 'vol' | 'hulp' | 'editor'
  opslag?: FlyoutOpslag | null
  ai?: FlyoutAi | null | false
  aiInVoet?: boolean
  overlayKlasse?: unknown
  paneelKlasse?: unknown
  sluitTest?: string
  statusTest?: string
  bovenop?: boolean
}>(), { statusTest: 'fs-status', kicker: '', titel: '', meta: null, titelId: '', breedte: 'normaal', opslag: null, ai: null, aiInVoet: false, sluitTest: undefined, bovenop: false })
const emit = defineEmits<{ sluit: []; bewaar: []; vraagAi: [] }>()
const slots = useSlots()
const { functie } = useMe()
const { openen: openAi } = useAssistent()
const eigenId = useId()
const kopId = computed(() => props.titelId || `fs-${eigenId}`)
const overlay = ref<HTMLElement | null>(null)
const paneel = ref<HTMLElement | null>(null)
const vraag = ref(false)
const bezig = ref(false)
let terug: HTMLElement | null = null

const aiZichtbaar = computed(() => !!props.ai && !props.aiInVoet && !!functie('assistent.chat')?.beschikbaar)
const stand = computed(() => props.opslag?.stand ?? 'leeg')
const inst = getCurrentInstance()
const kanBewaren = computed(() => !!inst?.vnode.props?.onBewaar || !!props.opslag?.gepland)

// Een flyout met een eigen AI-vak (zoals het document) vangt vraagAi zelf op; anders opent de assistent.
function vraagAi() {
  if (inst?.vnode.props?.onVraagAi) { emit('vraagAi'); return }
  if (!props.ai) return
  openAi({ accountId: props.ai.accountId ?? null, label: props.ai.label, vraag: props.ai.vraag, voorstellen: props.ai.voorstellen })
}

// Sluiten: een geplande opslag gaat eerst de deur uit; blijft er iets open, dan vraagt de flyout het.
async function vraagSluiten() {
  if (bezig.value) return
  const o = props.opslag
  if (o?.gepland) { bezig.value = true; try { await o.flush() } finally { bezig.value = false } }
  if (o?.open) { vraag.value = true; await nextTick(); paneel.value?.querySelector<HTMLElement>('[data-test="fs-bewaar"], [data-test="fs-weggooien"]')?.focus(); return }
  emit('sluit')
}
function weggooien() { vraag.value = false; props.opslag?.reset(); emit('sluit') }
// Opslaan in de bevestiging: de geplande opslag, opnieuw na een fout, of de hoofdactie van de flyout
// (event bewaar). Lukt het, dan sluit de flyout; anders blijft hij open met de status in de kop.
async function bewaarEnSluit() {
  const o = props.opslag
  vraag.value = false
  if (o?.gepland) await o.flush()
  else if (o?.stand === 'fout') await o.opnieuw()
  else { emit('bewaar'); await nextTick() }
  if (!o) { if (props.open) emit('sluit'); return }
  if (o.stand === 'bezig') await new Promise<void>((klaar) => { const stop = watch(() => o.stand, (s) => { if (s !== 'bezig') { stop(); klaar() } }) })
  if (!o.open && props.open) emit('sluit')
}

// De bovenste overlay op het scherm: hoogste z-index, bij gelijke de laatste in de pagina.
const OVERLAYS = '.fo-overlay, .cd-overlay, .venster-overlay, .zoek-overlay'
function bovenste(): Element | null {
  let beste: Element | null = null
  let z = -Infinity
  for (const el of document.querySelectorAll(OVERLAYS)) {
    const w = Number.parseInt(getComputedStyle(el).zIndex, 10)
    const n = Number.isNaN(w) ? 0 : w
    if (n >= z) { z = n; beste = el }
  }
  return beste
}
function toets(e: KeyboardEvent) {
  if (!props.open || !overlay.value || bovenste() !== overlay.value) return
  if (e.key === 'Escape') {
    if (e.defaultPrevented) return
    e.preventDefault()
    if (vraag.value) { vraag.value = false; return }
    void vraagSluiten()
    return
  }
  if (e.key !== 'Tab' || !paneel.value) return
  const lijst = [...paneel.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x === document.activeElement)
  if (!lijst.length) { e.preventDefault(); paneel.value.focus(); return }
  const eerste = lijst[0]!
  const laatste = lijst[lijst.length - 1]!
  const actief = document.activeElement as HTMLElement | null
  if (!paneel.value.contains(actief)) { e.preventDefault(); eerste.focus() }
  else if (e.shiftKey && (actief === eerste || actief === paneel.value)) { e.preventDefault(); laatste.focus() }
  else if (!e.shiftKey && actief === laatste) { e.preventDefault(); eerste.focus() }
}

watch(() => props.open, async (o) => {
  if (o) {
    vraag.value = false
    terug = (document.activeElement as HTMLElement | null) ?? null
    props.opslag?.reset()
    await nextTick()
    props.opslag?.basis()
    // De flyout zelf mag een veld focussen; anders gaat de focus naar het venster.
    setTimeout(() => { if (props.open && paneel.value && !paneel.value.contains(document.activeElement)) paneel.value.focus() }, 30)
  } else herstelFocus()
}, { immediate: true, flush: 'post' })
function herstelFocus() {
  const t = terug
  terug = null
  if (t && t.isConnected && typeof t.focus === 'function') nextTick(() => { if (!document.querySelector('.fo-overlay [role="dialog"]:focus-within')) t.focus() })
}
onMounted(() => document.addEventListener('keydown', toets))
onBeforeUnmount(() => { document.removeEventListener('keydown', toets); if (props.open) herstelFocus() })
defineExpose({ vraagSluiten })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" ref="overlay" class="fo-overlay fs-overlay" :class="[{ 'fo-overlay--boven': bovenop }, overlayKlasse]" @click.self="vraagSluiten">
      <aside
        ref="paneel" v-bind="$attrs" class="fo-panel fo-panel--schuif fs-paneel"
        :class="[{ 'fo-panel--smal': breedte === 'smal', 'fo-panel--breed': breedte === 'breed', 'fo-panel--analyse': breedte === 'analyse', 'fo-panel--vol': breedte === 'vol', 'fo-panel--hulp': breedte === 'hulp', 'fo-panel--editor': breedte === 'editor' }, paneelKlasse]"
        role="dialog" aria-modal="true" :aria-labelledby="kopId" tabindex="-1"
        @pointerdown.capture="opslag?.interactie()" @keydown.capture="opslag?.interactie()" @input.capture="opslag?.interactie()"
      >
        <header class="fo-head fs-kop">
          <div class="fo-head-tekst fs-kop-tekst">
            <slot name="kop">
              <span v-if="kicker || slots.kicker" class="fo-kicker"><slot name="kicker">{{ kicker }}</slot></span>
              <h2 :id="kopId" class="fo-titel"><slot name="titel">{{ titel }}</slot></h2>
              <slot name="meta"><p v-if="meta" class="fo-meta">{{ meta }}</p></slot>
            </slot>
          </div>
          <span v-if="opslag" class="fs-status" role="status" aria-live="polite" :data-test="statusTest" :data-stand="stand">
            <span v-if="stand === 'gewijzigd'" class="fs-stand fs-stand--gewijzigd">Gewijzigd</span>
            <span v-else-if="stand === 'bezig'" class="fs-stand fs-stand--bezig"><Icoon naam="RefreshCw" :grootte="14" />Opslaan…</span>
            <span v-else-if="stand === 'klaar'" class="fs-stand fs-stand--klaar"><Icoon naam="Check" :grootte="14" />Opgeslagen om {{ opslag.tijd }}</span>
            <span v-else-if="stand === 'fout'" class="fs-stand fs-stand--fout"><Icoon naam="CircleAlert" :grootte="14" /><span>Kon niet opslaan, <button type="button" class="fs-opnieuw" data-test="fs-opnieuw" @click="opslag.opnieuw()">probeer opnieuw</button></span></span>
          </span>
          <button v-if="aiZichtbaar" type="button" class="fs-ibtn fs-ai" title="Vraag AI" aria-label="Vraag AI" data-test="fs-vraag-ai" @click="vraagAi"><Icoon naam="Sparkles" :grootte="18" /></button>
          <button type="button" class="fo-sluit fs-sluit" aria-label="Sluiten" :data-test="sluitTest" @click="vraagSluiten"><Icoon naam="X" /></button>
        </header>
        <slot />
        <div v-if="vraag" class="fs-wijzig" role="alert" data-test="fs-wijzig">
          <span>Je wijzigingen zijn nog niet opgeslagen.</span>
          <button type="button" class="dd-actie dd-actie--secundair dd-actie--klein" data-test="fs-weggooien" @click="weggooien">Weggooien</button>
          <button v-if="kanBewaren || opslag?.stand === 'fout'" type="button" class="dd-actie dd-actie--zwart dd-actie--klein" data-test="fs-bewaar" @click="bewaarEnSluit">Opslaan</button>
          <button v-else type="button" class="dd-actie dd-actie--secundair dd-actie--klein" data-test="fs-blijf" @click="vraag = false">Verder bewerken</button>
        </div>
        <slot name="voet" />
      </aside>
    </div>
  </Teleport>
</template>

<style>
/* Een flyout die vanuit de AI-assistent opent, ligt boven de assistent. */
.fo-overlay.fs-overlay--top { z-index: calc(var(--z-modal-boven) + 2); }

/* Kop: tekst, status, Vraag AI en sluiten op één regel; op de telefoon de status onder de titel. */
.fo-head.fs-kop { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: start; column-gap: 8px; row-gap: 4px; }
.fs-kop .fs-kop-tekst { grid-column: 1; grid-row: 1; }
.fs-kop .fs-status { grid-column: 2; grid-row: 1; align-self: center; }
.fs-kop .fs-ai { grid-column: 3; grid-row: 1; }
.fs-kop .fs-sluit { grid-column: 4; grid-row: 1; }
.fs-status { display: inline-flex; align-items: center; min-height: 28px; font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.fs-status:empty { display: none; }
.fs-stand { display: inline-flex; align-items: center; gap: 6px; }
.fs-stand--gewijzigd { color: var(--orange-dark, var(--orange)); }
.fs-stand--gewijzigd::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--orange); }
.fs-stand--klaar { color: var(--green); }
.fs-stand--fout { color: var(--red); white-space: normal; }
.fs-opnieuw { min-height: 28px; padding: 0 2px; background: none; border: 0; font: inherit; font-weight: 700; color: var(--red); text-decoration: underline; cursor: pointer; }
@media (prefers-reduced-motion: no-preference) {
  .fs-stand--bezig .icoon { animation: fs-draai 1s linear infinite; }
}
@keyframes fs-draai { to { transform: rotate(360deg); } }

/* Icoonknop van 44 px: Vraag AI in de kop en de acties in de voet. */
.fs-ibtn { display: inline-flex; flex: none; align-items: center; justify-content: center; width: var(--touch-target-min); height: var(--touch-target-min); padding: 0; background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); color: var(--ink); font: inherit; text-decoration: none; cursor: pointer; }
.fs-ibtn:hover:not(:disabled) { border-color: var(--ink); }
.fs-ibtn:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.fs-ibtn:disabled { opacity: 0.4; cursor: default; }
.fs-ibtn--rood { color: var(--red); border-color: var(--red); }
.fs-kop .fs-ai { color: var(--purple); border-color: var(--purple); }
.fs-kop .fs-ai:hover { background: var(--purple-zacht, var(--surface)); }

/* Een formulier om de inhoud: de inhoud blijft het deel dat scrolt. */
.fs-form { display: contents; }

/* Voet: hoofdactie links, icoonknoppen rechts. */
.fs-voet { gap: 8px; }
.fs-voet .fs-hoofdactie { flex: none; }

/* Bevestiging bij sluiten met wijzigingen, boven de voet. */
.fs-wijzig { display: flex; flex-wrap: wrap; flex-shrink: 0; align-items: center; gap: 8px; padding: 10px 28px; background: var(--orange-zacht, var(--surface)); border-top: 1px solid var(--orange); font-size: 13px; color: var(--ink); }
.fs-wijzig > span { flex: 1 1 200px; }

@media print { .fs-status, .fs-ai, .fs-wijzig { display: none !important; } }

/* Telefoon: schermvullend, de kop blijft staan en elk tikdoel is minstens 44 px. */
@media (max-width: 767px) {
  .fo-overlay .fo-panel.fs-paneel { top: 0; bottom: 0; left: 0; right: 0; width: 100%; max-width: none; height: 100%; max-height: none; border-radius: 0; border-left: 0; }
  .fo-overlay .fo-panel.fs-paneel .fo-head { padding-top: calc(14px + env(safe-area-inset-top, 0px)); }
  .fo-overlay .fo-panel.fs-paneel .fo-head::before { display: none; }
  .fo-head.fs-kop { grid-template-columns: minmax(0, 1fr) auto auto; }
  .fs-kop .fs-ai { grid-column: 2; }
  .fs-kop .fs-sluit { grid-column: 3; }
  .fs-kop .fs-status { grid-column: 1 / -1; grid-row: 2; }
  .fs-paneel .fo-foot .dd-act, .fs-paneel .fo-foot .dd-actie, .fs-paneel .fo-foot button, .fs-paneel .fo-foot a.dd-act { min-height: var(--touch-target-min); }
  .fs-wijzig { padding: 10px 16px; }
  .fs-wijzig .dd-actie { min-height: var(--touch-target-min); }
}
</style>
