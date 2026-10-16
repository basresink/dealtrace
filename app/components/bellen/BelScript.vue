<script setup lang="ts">
// Het belpaneel met script (F08): keuzelijst met het voorstel voorgeselecteerd, de blokken in de
// volgorde van het script, variabelen ingevuld (onbekend geel met de terugvalzin), AI-zinnen met bron,
// vragen afvinkbaar met een invulveld, bezwaren uitklapbaar. Zonder AI de vaste tekst.
// Met `stappen` (de belmodus, Belscript Studio): het huidige blok groot, de rest ingeklapt op één
// regel, "Volgende blok". Met een bewaarde versie per prospect staat die bovenaan en is hij gekozen.
import { BLOK_LABEL, prospectVersieAlsScript, vragenUit, vulScript, type Belscript, type Herkomst, type ProspectScriptData, type ScriptBezwaar, type ScriptStaat } from '~~/shared/belscripts'

interface ProspectVersie { id: string; versie: number; belscriptId: string; scriptVersie: number; data: ProspectScriptData }
const props = defineProps<{
  scripts: (Belscript & { conversie?: string | null })[]
  voorstel: { scriptId: string; reden: string } | null
  waarden: Record<string, string | null>
  extraBezwaren?: ScriptBezwaar[]
  meldingen?: string[]
  accountId: string
  contactId?: string | null
  aiAan?: boolean
  compact?: boolean
  stappen?: boolean
  prospectVersie?: ProspectVersie | null
}>()
const staat = defineModel<ScriptStaat | null>('staat', { default: null })
const pvSleutel = computed(() => (props.prospectVersie ? `pv:${props.prospectVersie.id}` : ''))
const pv = computed(() => (props.prospectVersie ? prospectVersieAlsScript(props.prospectVersie) : null))
const startKeuze = () => pvSleutel.value || props.voorstel?.scriptId || props.scripts[0]?.id || ''
const gekozen = ref(startKeuze())
const isPv = computed(() => !!pv.value && gekozen.value === pvSleutel.value)
const script = computed<Belscript | null>(() => (isPv.value ? pv.value!.script : props.scripts.find((s) => s.id === gekozen.value) ?? null))
const toonCodes = ref(false)
const ai = ref<Record<string, { tekst: string; bronnen?: any[] }>>({})
const aiStatus = ref<'uit' | 'laden' | 'klaar' | 'terugval'>('uit')
const aiReden = ref('')
const open = ref<Set<string>>(new Set())
const vragen = reactive<Record<string, { vink: boolean; antwoord: string }>>({})
const nu = ref(0)
const gebruikt = ref<Set<string>>(new Set())

async function laadAi() {
  ai.value = {}
  if (isPv.value || !props.aiAan || !script.value || !script.value.data.blokken.some((b) => b.invulwijze !== 'vast')) { aiStatus.value = 'uit'; return }
  aiStatus.value = 'laden'
  try {
    const r = await $fetch<any>('/api/belscripts/invullen', { method: 'POST', body: { scriptId: script.value.id, versie: script.value.versie, accountId: props.accountId, contactId: props.contactId } })
    if (r.ok) { ai.value = r.ai ?? {}; aiStatus.value = 'klaar' } else { aiStatus.value = 'terugval'; aiReden.value = r.reden ?? '' }
  } catch { aiStatus.value = 'terugval' }
}
const ingevuld = computed(() => {
  if (!script.value) return null
  const r = vulScript(script.value, { waarden: props.waarden, ai: ai.value })
  if (!isPv.value) return r
  // Een bewaarde versie: de beoordeelde AI-zinnen houden hun label en herkomst.
  const aiIds = new Set(pv.value!.aiBlokIds)
  return { ...r, blokken: r.blokken.map((b) => (aiIds.has(b.id) ? { ...b, vanAi: true, bronnen: (pv.value!.herkomst[b.id] ?? []).map((h: Herkomst) => ({ soort: h.label })) } : b)) }
})
const zichtbaar = computed(() => (ingevuld.value?.blokken ?? []).filter((x) => x.soort !== 'bezwaren' && x.soort !== 'opvolgmail'))
const bezwaren = computed<ScriptBezwaar[]>(() => {
  const eigen = ingevuld.value?.bezwaren ?? []
  return [...(props.extraBezwaren ?? []).filter((z) => !eigen.some((e) => e.argumentRef && e.argumentRef === z.argumentRef)), ...eigen]
})

function schrijfStaat() {
  if (!script.value) { staat.value = null; return }
  const s = script.value
  const basisId = isPv.value ? props.prospectVersie!.belscriptId : s.id
  staat.value = {
    scriptId: basisId, versie: s.versie, gekozenDoor: isPv.value || s.id === props.voorstel?.scriptId ? 'voorstel' : 'gebruiker', gewisseld: !isPv.value && s.id !== props.voorstel?.scriptId,
    bezwaren: bezwaren.value.filter((z) => open.value.has(z.id)).map((z) => ({ id: z.id, bezwaar: z.bezwaar, argumentRef: z.argumentRef ?? null })),
    vragen: s.data.blokken.filter((b) => b.soort === 'vragen').flatMap((b) => vragenUit(b.tekst).map((v, i) => ({ k: `${b.id}:${i}`, b, v, i })))
      .filter((x) => vragen[x.k]?.vink || vragen[x.k]?.antwoord?.trim())
      .map((x) => ({ blokId: x.b.id, vraag: x.v, antwoord: vragen[x.k]?.antwoord?.trim() || 'ja', veld: x.i === 0 ? x.b.veldKoppeling ?? null : null })),
    ...(props.stappen ? { blokkenGebruikt: [...gebruikt.value] } : {}),
    ...(isPv.value ? { prospectVersieId: props.prospectVersie!.id, prospectVersie: props.prospectVersie!.versie } : {}),
  }
}
function wisselBezwaar(id: string) {
  const n = new Set(open.value)
  n.has(id) ? n.delete(id) : n.add(id)
  open.value = n
  schrijfStaat()
}
function naarBlok(i: number) {
  nu.value = Math.max(0, Math.min(i, zichtbaar.value.length - 1))
  const b = zichtbaar.value[nu.value]
  if (b) gebruikt.value = new Set([...gebruikt.value, b.id])
  schrijfStaat()
}
function volgendBlok() { naarBlok(nu.value + 1 >= zichtbaar.value.length ? 0 : nu.value + 1) }
watch(() => props.voorstel?.scriptId, (id) => { if (id && !pvSleutel.value) gekozen.value = id })
watch(() => props.accountId, () => { open.value = new Set(); for (const k of Object.keys(vragen)) delete vragen[k]; gekozen.value = startKeuze() })
watch([gekozen, () => props.accountId], () => { nu.value = 0; gebruikt.value = new Set(zichtbaar.value[0] ? [zichtbaar.value[0].id] : []); void laadAi(); schrijfStaat() }, { immediate: true })
watch(vragen, schrijfStaat, { deep: true })
const code = (v: string) => '{' + v + '}'
const vraagSleutel = (blokId: string, i: number) => { const k = `${blokId}:${i}`; vragen[k] ??= { vink: false, antwoord: '' }; return vragen[k]! }
const platteTekst = (b: { segmenten: { tekst: string }[] }) => b.segmenten.map((x) => x.tekst).join('')
</script>

<template>
  <div :class="{ 'toon-codes': toonCodes, 'bs-stappen': stappen }" data-test="belscript">
    <div class="kop-rij">
      <label class="veld"><span class="veld-label">Script</span>
        <select v-model="gekozen" class="invoer" aria-label="Script" data-test="script-keuze">
          <option v-if="prospectVersie && pv" :value="pvSleutel" data-test="script-keuze-prospect">{{ pv.script.naam }}</option>
          <option v-for="s in scripts" :key="s.id" :value="s.id">{{ s.naam }}{{ s.isPersoonlijk ? ' (mijn variant)' : '' }}{{ s.conversie ? ` · ${s.conversie}` : '' }}</option>
        </select>
      </label>
      <span v-if="script" class="meta">versie {{ script.versie }}<template v-if="isPv"> · persoonlijk voor dit prospect</template><template v-else-if="voorstel && gekozen === voorstel.scriptId"> · {{ voorstel.reden }}</template></span>
      <button v-if="!compact" type="button" class="dd-act" @click="toonCodes = !toonCodes">{ } {{ toonCodes ? 'Toon tekst' : 'Toon variabelen' }}</button>
    </div>
    <p v-for="m in meldingen ?? []" :key="m" class="kaart kaart--geel mt-8" data-test="script-melding">{{ m }}</p>
    <p v-if="aiStatus === 'terugval'" class="meta mt-8" data-test="ai-terugval">{{ aiReden || 'Zonder AI: de vaste teksten en terugvalzinnen.' }}</p>
    <div v-if="ingevuld">
      <template v-if="stappen">
        <div class="rijtje bs-stap-kop mt-8">
          <span class="meta" data-test="blok-teller">Blok {{ Math.min(nu + 1, zichtbaar.length) }} van {{ zichtbaar.length }}</span>
          <button type="button" class="dd-act" data-test="volgende-blok" @click="volgendBlok">Volgende blok <Icoon naam="ArrowRight" :grootte="14" /></button>
        </div>
        <div v-for="(b, i) in zichtbaar" :key="b.id" class="scriptblok bs-blok" :class="{ 'bs-blok--nu': i === nu }" :data-test="`blok-${b.soort}`">
          <button type="button" class="bs-blok-kop" :aria-expanded="i === nu" :data-test="`stap-${b.soort}`" @click="naarBlok(Number(i))">
            <span class="bloklabel">{{ b.titel || BLOK_LABEL[b.soort] }}</span>
            <span v-if="b.vanAi" class="pil pil--paars">AI</span>
            <Icoon v-if="gebruikt.has(b.id) && i !== nu" naam="Check" :grootte="14" class="bs-gehad" />
          </button>
          <template v-if="b.soort === 'vragen' && i === nu">
            <div v-for="(v, j) in vragenUit(platteTekst(b))" :key="j" class="mt-4">
              <label class="vink bs-vraag"><input v-model="vraagSleutel(b.id, Number(j)).vink" type="checkbox"> {{ v }} <span v-if="Number(j) === 0 && b.veldKoppeling" class="codes">{{ b.veldKoppeling.bron }}.{{ b.veldKoppeling.sleutel }}</span></label>
              <input v-if="vraagSleutel(b.id, Number(j)).vink" v-model="vraagSleutel(b.id, Number(j)).antwoord" class="invoer mt-4" :aria-label="`Antwoord: ${v}`" placeholder="Kort antwoord">
            </div>
          </template>
          <p v-else :class="i === nu ? 'bs-tekst-nu' : 'bs-tekst-kort'">
            <template v-for="(s, j) in b.segmenten" :key="j"><span v-if="s.onbekend" class="var var--onbekend" data-test="var-onbekend"><span class="var-tekst">{{ s.tekst || '…' }}</span><span class="var-code">{{ code(s.onbekend) }}</span></span><template v-else>{{ s.tekst }}</template></template>
          </p>
          <p v-if="i === nu && b.bronnen?.length" class="meta">Gebaseerd op: {{ b.bronnen.map((x: any) => [x.soort, x.citaat, x.datum?.slice(0, 10)].filter(Boolean).join(', ')).join(' · ') }}</p>
        </div>
      </template>
      <template v-else>
        <div v-for="b in zichtbaar" :key="b.id" class="scriptblok" :data-test="`blok-${b.soort}`">
          <div class="scriptblok-kop"><span class="bloklabel">{{ b.titel || BLOK_LABEL[b.soort] }}</span><span v-if="b.vanAi" class="ai-label">AI</span><span v-else class="meta">{{ b.invulwijze === 'vast' ? 'vast' : aiStatus === 'laden' ? 'AI vult in…' : 'vaste tekst' }}</span></div>
          <template v-if="b.soort === 'vragen'">
            <div v-for="(v, i) in vragenUit(platteTekst(b))" :key="i" class="mt-4">
              <label class="vink"><input v-model="vraagSleutel(b.id, Number(i)).vink" type="checkbox"> {{ v }} <span v-if="Number(i) === 0 && b.veldKoppeling" class="codes">{{ b.veldKoppeling.bron }}.{{ b.veldKoppeling.sleutel }}</span></label>
              <input v-if="vraagSleutel(b.id, Number(i)).vink" v-model="vraagSleutel(b.id, Number(i)).antwoord" class="invoer mt-4" :aria-label="`Antwoord: ${v}`" placeholder="Kort antwoord">
            </div>
          </template>
          <p v-else :class="{ 'tekst--groot': compact && b.soort === 'opening' }">
            <template v-for="(s, i) in b.segmenten" :key="i"><span v-if="s.onbekend" class="var var--onbekend" data-test="var-onbekend"><span class="var-tekst">{{ s.tekst || '…' }}</span><span class="var-code">{{ code(s.onbekend) }}</span></span><template v-else>{{ s.tekst }}</template></template>
          </p>
          <p v-if="b.bronnen?.length" class="meta">Bron: {{ b.bronnen.map((x: any) => [x.soort, x.citaat, x.datum?.slice(0, 10)].filter(Boolean).join(', ')).join(' · ') }}</p>
        </div>
      </template>
      <div v-if="bezwaren.length" class="scriptblok" data-test="bezwaren">
        <div class="scriptblok-kop"><span class="bloklabel">Bezwaren</span><span class="meta">klik voor het antwoord</span></div>
        <template v-for="z in bezwaren" :key="z.id">
          <button type="button" class="bezwaar-knop" :aria-expanded="open.has(z.id)" :data-test="`bezwaar-${z.id}`" @click="wisselBezwaar(z.id)">"{{ z.bezwaar.replace(/^"|"$/g, '') }}"</button>
          <div v-if="open.has(z.id)" class="bezwaar-antwoord"><strong>Antwoord:</strong> {{ z.antwoord }}<template v-if="z.wedervraag"><br><span class="meta">{{ z.argumentRef?.startsWith('cc-') ? 'Zo zeg je het' : 'Wedervraag' }}: {{ z.wedervraag }}</span></template></div>
        </template>
      </div>
    </div>
    <p v-else class="meta">Er is nog geen actief script voor je team.</p>
  </div>
</template>

<style scoped>
.bs-stap-kop { justify-content: space-between; }
.bs-blok { padding: 0; border: 1px solid var(--border); border-radius: var(--radius); margin-top: 8px; background: var(--wit); }
.bs-blok:last-child { border-bottom: 1px solid var(--border); }
.bs-blok--nu { border-color: var(--ink); border-left: 4px solid var(--yellow); background: var(--yellow-zacht); }
.bs-blok-kop { display: flex; align-items: center; gap: 8px; width: 100%; min-height: var(--touch-target-min); padding: 6px 12px; background: transparent; border: 0; font: inherit; text-align: left; cursor: pointer; color: var(--ink); }
.bs-blok-kop:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
.bs-gehad { margin-left: auto; color: var(--green); }
.bs-blok p { padding: 0 12px 12px; margin: 0; }
.bs-tekst-kort { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: var(--muted) !important; font-size: var(--fs-klein) !important; }
.bs-tekst-nu { font-size: 20px !important; line-height: 1.45 !important; }
.bs-blok .mt-4 { padding: 0 12px; }
.bs-vraag { font-size: var(--fs-lees); min-height: var(--touch-target-min); align-items: center; }
</style>
