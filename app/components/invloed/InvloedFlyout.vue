<script setup lang="ts">
// Invloedskaart (F8) in een breed venster, vanaf de accountkaart en de contactkaart (knop Invloed). Het
// organigram (SVG; op de telefoon een lijst) toont per persoon de rol in het buying committee, de houding of het
// aantal contactmomenten als kleur, en wie aan wie rapporteert. Rollen die de Profielbouwer vermoedt maar waar
// nog geen naam bij is, staan als "Naam onbekend". Rechts de dekking (vaste regel: beslisser en minstens één
// beïnvloeder gesproken), het grootste risico en één voorgestelde stap met Maak taak. Een klik op een persoon
// opent de details (InvloedPersoonFlyout). De Notulist stelt houdingen voor uit de verslagen; jij bevestigt.
import { labelDef } from '~~/shared/labels'
import { HOUDINGEN, HOUDING_LABEL, KNOOP_B, KNOOP_H, indeling, rolLabel, type Houding } from '~~/shared/invloed'
const props = defineProps<{ open: boolean; accountId: string | null; contactId?: string | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const data = ref<any>(null)
const laden = ref(false)
const modus = ref<'houding' | 'contact'>('houding')
const gekozen = ref<string | null>(null)
const bezig = ref<null | 'houding' | 'rollen' | 'taak'>(null)

async function laad() {
  if (!props.accountId) return
  laden.value = true
  try { data.value = await $fetch(`/api/accounts/${props.accountId}/invloed`) } catch (e) { toast.toon(foutTekst(e), 'fout'); emit('sluit') } finally { laden.value = false }
}
watch(() => [props.open, props.accountId], async ([o]) => {
  if (!o) { gekozen.value = null; return }
  await laad()
  // Vanaf de contactkaart: dat contact staat meteen open.
  if (props.contactId && data.value?.personen.some((p: any) => p.id === props.contactId)) gekozen.value = props.contactId
}, { immediate: true })

const personen = computed<any[]>(() => data.value?.personen ?? [])
const kaart = computed(() => indeling(personen.value))
const persoon = computed(() => personen.value.find((p) => p.id === gekozen.value) ?? null)
const naamVan = (id: string | null) => personen.value.find((p) => p.id === id)?.naam ?? null

const HOUDING_KLEUR: Record<Houding, string> = { voor: 'groen', neutraal: 'grijs', tegen: 'rood', onbekend: 'leeg' }
const contactKlasse = (n: number) => (n >= 2 ? 'groen' : n === 1 ? 'oranje' : 'rood')
/** Houding in het organigram: het icoon uit het labelregister (duim, streep, verbod, vraag) in de tint. */
const houdingIcoon = (h: string) => labelDef('houding', h || 'onbekend')?.icoon ?? 'CircleHelp'
const houdingKlas = (h: string) => { const d = labelDef('houding', h || 'onbekend'); return d?.stijl === 'zacht' ? ['lbl--zacht', `lbl--${d.tint}`] : ['lbl--leeg'] }
const kleur = (p: any) => (modus.value === 'houding' ? HOUDING_KLEUR[p.houding as Houding] : contactKlasse(p.momenten))
const contactTekst = (n: number) => (n === 0 ? 'nooit' : n === 1 ? '1 keer' : `${n} keer`)
const kort = (s: string | null, n = 22) => (!s ? '' : s.length > n ? `${s.slice(0, n - 1)}…` : s)
const labelVan = (p: any) => `${p.functie ?? p.naam}, ${rolLabel(p.rol)}, houding ${HOUDING_LABEL[p.houding as Houding].toLowerCase()}, contact ${contactTekst(p.momenten)}${p.onbekend ? ', naam onbekend' : ''}`

async function houdingUitVerslagen() {
  bezig.value = 'houding'
  try {
    const r = await $fetch<any>(`/api/accounts/${props.accountId}/houding-voorstel`, { method: 'POST' })
    toast.toon(!r.ok ? r.reden : r.voorstellen ? `De Notulist stelt ${r.voorstellen} ${r.voorstellen === 1 ? 'houding' : 'houdingen'} voor. Bevestig ze per persoon.` : 'De Notulist vond geen nieuwe houding in de verslagen.')
    await laad()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
async function rollenVoorstellen() {
  bezig.value = 'rollen'
  try {
    const r = await $fetch<any>(`/api/accounts/${props.accountId}/committee`, { method: 'POST' })
    toast.toon(r.voorstellen?.length ? 'De Profielbouwer stelde de rollen voor. Rollen zonder naam staan als Naam onbekend.' : r.reden ?? 'Nog te weinig functies bekend om een voorstel te doen.')
    await laad()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
async function maakTaak(titel: string, contactId: string | null, aanleiding: string) {
  bezig.value = 'taak'
  try {
    await $fetch('/api/tasks', { method: 'POST', body: { title: titel, accountId: props.accountId, contactId, actionType: 'taak', aanleiding } })
    toast.toon(`Taak gemaakt: ${titel}`)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
async function gewijzigd() { await laad(); emit('gewijzigd') }
function sluit() { gekozen.value = null; emit('sluit') }
</script>

<template>
  <Teleport to="body">
    <FlyoutShell v-if="open && accountId" open titel-id="inv-titel" breedte="vol" overlay-klasse="fo-overlay--donker" data-test="invloed-flyout" :ai="{ accountId, label: data?.account?.naam, voorstellen: ['Wie ontbreekt er?', 'Hoe bereik ik de beslisser?', 'Wie is de blokkeerder?'] }" @sluit="sluit">
      <template #kop>
            <span class="fo-kicker"><Icoon naam="Network" :grootte="12" /> Invloedskaart<template v-if="data"> · {{ data.account.naam }}</template></span>
            <h2 id="inv-titel" class="fo-titel" data-test="inv-titel">{{ data?.dekking.titel ?? 'Invloedskaart' }}</h2>
            <p v-if="data" class="fo-meta">{{ personen.filter((p) => !p.onbekend).length }} {{ personen.filter((p) => !p.onbekend).length === 1 ? 'contact' : 'contacten' }}<template v-if="personen.some((p) => p.onbekend)"> · {{ personen.filter((p) => p.onbekend).length }} zonder naam</template> · {{ data.verslagen }} {{ data.verslagen === 1 ? 'verslag' : 'verslagen' }}</p></template>

        <div class="fo-body">
          <p v-if="laden && !data" class="fo-leeg">Laden...</p>
          <template v-else-if="data">
            <div class="inv-balk">
              <div class="keuzegroep keuzegroep--klein" role="group" aria-label="Kleur van de kaart" data-test="inv-modus">
                <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': modus === 'houding' }" :aria-pressed="modus === 'houding'" data-test="inv-modus-houding" @click="modus = 'houding'">Kleur op houding</button>
                <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': modus === 'contact' }" :aria-pressed="modus === 'contact'" data-test="inv-modus-contact" @click="modus = 'contact'">Kleur op contact</button>
              </div>
              <span class="inv-vul" />
              <button v-if="data.kan.houdingVoorstel && data.verslagen" type="button" class="dd-act" :disabled="!!bezig" data-test="inv-houding-ai" @click="houdingUitVerslagen"><Icoon naam="Sparkles" class="dd-act-icoon" />Houding uit verslagen</button>
              <button v-if="data.kan.profielbouwer" type="button" class="dd-act" :disabled="!!bezig" data-test="inv-rollen-ai" @click="rollenVoorstellen"><Icoon naam="Sparkles" class="dd-act-icoon" />{{ data.committeeOp ? 'Rollen opnieuw voorstellen' : 'Rollen voorstellen' }}</button>
            </div>

            <div class="inv-raster">
              <section class="kaart inv-kaart" aria-label="Organigram">
                <div v-if="!personen.length" class="inv-leeg" data-test="inv-leeg">
                  <p><strong>Nog niemand in kaart.</strong> Voeg contacten toe met hun rol, of laat de Profielbouwer de rollen voorstellen uit de functies en verslagen.</p>
                </div>
                <template v-else>
                  <!-- Laptop: het organigram als SVG. -->
                  <div class="inv-svg-vak">
                    <svg class="inv-svg" :viewBox="`0 0 ${kaart.breedte} ${kaart.hoogte}`" :style="kaart.breedte > 600 ? { minWidth: `${Math.round(kaart.breedte * 0.85)}px` } : undefined" role="group" :aria-label="`Organigram van ${data.account.naam}`" data-test="inv-svg">
                      <path v-for="l in kaart.lijnen" :key="`${l.van}-${l.naar}`" class="inv-lijn" :d="l.d" />
                      <g
                        v-for="k in kaart.knopen" :key="k.persoon.id" class="inv-knoop" :class="{ 'inv-knoop--gekozen': gekozen === k.persoon.id, 'inv-knoop--vermoedelijk': k.persoon.onbekend || k.persoon.vermoedelijk }"
                        tabindex="0" role="button" :aria-label="labelVan(k.persoon)" :data-test="`inv-knoop-${k.persoon.id}`"
                        @click="gekozen = k.persoon.id" @keydown.enter.prevent="gekozen = k.persoon.id" @keydown.space.prevent="gekozen = k.persoon.id"
                      >
                        <rect class="inv-kader" :x="k.x - KNOOP_B / 2" :y="k.y - KNOOP_H / 2" :width="KNOOP_B" :height="KNOOP_H" rx="2" />
                        <rect :class="`inv-strook inv-strook--${kleur(k.persoon)}`" :x="k.x - KNOOP_B / 2 + 1" :y="k.y + KNOOP_H / 2 - 6" :width="KNOOP_B - 2" height="5" />
                        <foreignObject :x="k.x - KNOOP_B / 2 + 6" :y="k.y - KNOOP_H / 2 + 6" :width="KNOOP_B - 12" height="22">
                          <div class="inv-fo-rij">
                            <Label soort="rol" :waarde="k.persoon.rol || 'onbekend'" :vermoedelijk="k.persoon.onbekend || k.persoon.vermoedelijk" />
                            <span v-if="modus === 'houding'" class="lbl inv-houding-ico" :class="houdingKlas(k.persoon.houding)" :title="`Houding ${HOUDING_LABEL[k.persoon.houding as Houding].toLowerCase()}`" :data-test="`inv-houding-${k.persoon.id}`"><Icoon :naam="houdingIcoon(k.persoon.houding)" :grootte="12" /></span>
                          </div>
                        </foreignObject>
                        <text :x="k.x - KNOOP_B / 2 + 9" :y="k.y - KNOOP_H / 2 + 43" class="inv-t-functie">{{ kort(k.persoon.functie ?? k.persoon.naam) }}</text>
                        <text :x="k.x - KNOOP_B / 2 + 9" :y="k.y - KNOOP_H / 2 + 57" class="inv-t-naam" :class="{ 'inv-t-naam--onbekend': k.persoon.onbekend }">{{ kort(k.persoon.functie ? k.persoon.naam : contactTekst(k.persoon.momenten), 24) }}</text>
                        <circle v-if="k.persoon.voorstel" class="inv-stip" :cx="k.x + KNOOP_B / 2 - 9" :cy="k.y - KNOOP_H / 2 + 17" r="4"><title>Voorstel van de Notulist</title></circle>
                      </g>
                    </svg>
                  </div>
                  <!-- Telefoon: dezelfde kaart als lijst. -->
                  <ul class="inv-lijst" role="list" data-test="inv-lijst">
                    <li v-for="k in kaart.knopen" :key="k.persoon.id">
                      <button type="button" class="inv-rij" :style="{ paddingLeft: `${12 + Math.min(k.laag, 3) * 14}px` }" :data-test="`inv-rij-${k.persoon.id}`" @click="gekozen = k.persoon.id">
                        <span :class="`inv-staaf inv-strook--${kleur(k.persoon)}`" aria-hidden="true" />
                        <span class="inv-rij-tekst">
                          <Label soort="rol" :waarde="k.persoon.rol || 'onbekend'" :vermoedelijk="k.persoon.onbekend || k.persoon.vermoedelijk" />
                          <strong>{{ k.persoon.functie ?? k.persoon.naam }}</strong>
                          <span class="meta">{{ k.persoon.functie ? k.persoon.naam : '' }}<template v-if="k.persoon.rapporteertAan"> · onder {{ naamVan(k.persoon.rapporteertAan) }}</template></span>
                        </span>
                        <Label v-if="modus === 'houding'" class="inv-rij-rechts" soort="houding" :waarde="k.persoon.houding || 'onbekend'" />
                        <span v-else class="inv-rij-rechts meta">{{ contactTekst(k.persoon.momenten) }}</span>
                      </button>
                    </li>
                  </ul>
                  <p class="inv-legenda meta" data-test="inv-legenda">
                    <template v-if="modus === 'houding'"><Label v-for="h in HOUDINGEN" :key="h" soort="houding" :waarde="h" /></template>
                    <template v-else><span><i class="inv-strook--groen" />Vaak gesproken</span><span><i class="inv-strook--oranje" />1 keer</span><span><i class="inv-strook--rood" />Nooit</span></template>
                    <span>Een vraagteken: vermoedelijke rol. Klik op een persoon voor details.</span>
                  </p>
                </template>
              </section>

              <div class="inv-zijkant">
                <article class="kaart inv-blok" data-test="inv-dekking">
                  <div class="inv-blok-kop"><h3 class="inv-blok-titel">Dekking</h3><strong class="tnum">{{ data.dekking.gesprokenRollen }} van {{ data.dekking.totaalRollen }}</strong></div>
                  <div class="inv-meter" role="meter" :aria-valuenow="data.dekking.procent" aria-valuemin="0" aria-valuemax="100" :aria-label="`${data.dekking.gesprokenRollen} van ${data.dekking.totaalRollen} rollen gesproken`"><i :class="data.dekking.gehaald ? 'inv-meter--groen' : 'inv-meter--oranje'" :style="{ width: `${data.dekking.procent}%` }" /></div>
                  <p class="inv-klein">Voor een overdracht naar DealDrive: beslisser en minstens één beïnvloeder gesproken.</p>
                  <p class="inv-regel" :class="data.dekking.gehaald ? 'inv-regel--ok' : 'inv-regel--nee'" data-test="inv-dekking-regel">
                    <Icoon :naam="data.dekking.gehaald ? 'CircleCheck' : 'TriangleAlert'" :grootte="14" />{{ data.dekking.gehaald ? 'Klaar voor een overdracht.' : data.dekking.waarschuwing }}
                  </p>
                </article>
                <article class="kaart inv-blok" :class="{ 'kaart--geel': data.risico }" data-test="inv-risico">
                  <div class="inv-blok-kop"><h3 class="inv-blok-titel">Grootste risico</h3><Label v-if="data.risico" soort="urgentie" waarde="risico" :tekst="data.risico.label" data-test="inv-risico-label" /></div>
                  <p class="inv-klein inv-klein--ink">{{ data.risico?.tekst ?? 'Geen groot risico: je sprak meerdere mensen en niemand met invloed staat tegen.' }}</p>
                </article>
                <article class="kaart inv-blok" data-test="inv-stap">
                  <div class="inv-blok-kop"><h3 class="inv-blok-titel">Voorgestelde stap</h3></div>
                  <p class="inv-klein inv-klein--ink" data-test="inv-stap-tekst">{{ data.stap.tekst }}</p>
                  <button v-if="data.kan.taak" type="button" class="dd-act dd-act--primair" :disabled="bezig === 'taak'" data-test="inv-maak-taak" @click="maakTaak(data.stap.taakTitel, data.stap.contactId, `Invloedskaart: ${data.risico?.label ?? 'dekking'}`)"><Icoon naam="Plus" class="dd-act-icoon" />Maak taak</button>
                </article>
              </div>
            </div>
          </template>
        </div>
    </FlyoutShell>
    <InvloedPersoonFlyout
      :persoon="persoon" :personen="personen" :account-id="accountId" :kan="data?.kan ?? {}"
      @sluit="gekozen = null" @gewijzigd="gewijzigd" @taak="(t: { titel: string; contactId: string | null }) => maakTaak(t.titel, t.contactId, 'Invloedskaart')"
    />
  </Teleport>
</template>

<style scoped>
.inv-balk { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.inv-vul { flex: 1; }
.inv-raster { display: grid; gap: var(--kaart-gap, 16px); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 860px) { .inv-raster { grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); } }
.inv-kaart { min-width: 0; padding: 16px; }
.inv-zijkant { display: grid; gap: 12px; align-content: start; }
.inv-svg-vak { overflow-x: auto; }
.inv-svg { display: block; width: 100%; height: auto; }
.inv-lijn { fill: none; stroke: var(--border-strong); stroke-width: 1.5; }
.inv-knoop { cursor: pointer; outline: none; }
.inv-kader { fill: var(--wit); stroke: var(--ink); stroke-width: 1; }
.inv-knoop--vermoedelijk .inv-kader { stroke: var(--muted); stroke-dasharray: 4 3; }
.inv-knoop:hover .inv-kader, .inv-knoop:focus-visible .inv-kader { stroke-width: 2; }
.inv-knoop:focus-visible .inv-kader { stroke: var(--blue); }
.inv-knoop--gekozen .inv-kader { stroke: var(--ink); stroke-width: 3; }
.inv-fo-rij { display: flex; align-items: center; justify-content: space-between; gap: 4px; height: 22px; overflow: hidden; }
.inv-houding-ico { padding: 0 3px; }
.inv-t-functie { font-size: 12px; font-weight: 700; fill: var(--ink); }
.inv-t-naam { font-size: 11px; fill: var(--muted); }
.inv-t-naam--onbekend { font-style: italic; }
.inv-stip { fill: var(--purple); }
.inv-strook--groen { fill: var(--lbl-groen-tekst); background: var(--lbl-groen-tekst); }
.inv-strook--grijs { fill: var(--lbl-grijs-rand); background: var(--lbl-grijs-rand); }
.inv-strook--oranje { fill: var(--orange); background: var(--orange); }
.inv-strook--rood { fill: var(--lbl-rood-tekst); background: var(--lbl-rood-tekst); }
.inv-strook--leeg { fill: none; background: transparent; }
.inv-lijst { display: none; margin: 0; padding: 0; list-style: none; }
.inv-rij { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 8px 12px; background: var(--wit); border: 0; border-bottom: 1px solid var(--border); font: inherit; text-align: left; color: var(--ink); cursor: pointer; }
.inv-rij:hover { background: var(--surface); }
.inv-staaf { flex-shrink: 0; width: 6px; align-self: stretch; }
.inv-rij-tekst { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; flex: 1; }
/* Het rollabel houdt zijn eigen breedte en staat met dezelfde ruimte boven de functie als in het organigram. */
.inv-rij-tekst > .lbl { margin-bottom: 2px; }
.inv-rij-rechts { flex-shrink: 0; }
.inv-legenda { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 10px 0 0; }
.inv-legenda > span:not(.lbl) { display: inline-flex; align-items: center; gap: 6px; }
.inv-legenda i { display: inline-block; width: 14px; height: 6px; }
.inv-leeg { padding: 24px 8px; color: var(--ink-soft); }
.inv-blok { padding: 16px; }
.inv-blok-kop { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.inv-blok-titel { margin: 0; font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--ink); }
.inv-meter { height: 8px; background: var(--surface); border: 1px solid var(--border); }
.inv-meter i { display: block; height: 100%; }
.inv-meter--groen { background: var(--green); }
.inv-meter--oranje { background: var(--orange); }
.inv-klein { margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: var(--muted); }
.inv-klein--ink { margin: 0 0 12px; font-size: 13px; color: var(--ink); }
.inv-regel { display: flex; gap: 6px; align-items: flex-start; margin: 8px 0 0; font-size: 12px; font-weight: 600; line-height: 1.5; }
.inv-regel--ok { color: var(--green); }
.inv-regel--nee { color: var(--ink); }
@media (max-width: 719px) {
  .inv-svg-vak { display: none; }
  .inv-lijst { display: block; }
  .inv-kaart { padding: 0; }
  .inv-legenda { padding: 0 12px 12px; }
  .inv-balk .dd-act, .inv-balk .keuzegroep-knop { min-height: 44px; }
  .inv-blok .dd-act { min-height: 44px; }
}
</style>
