<script setup lang="ts">
// Het belpaneel met script (F08): keuzelijst met het voorstel voorgeselecteerd, de blokken in
// vaste volgorde, variabelen ingevuld (onbekend geel met de terugvalzin), AI-zinnen met bron,
// vragen afvinkbaar met een invulveld, bezwaren uitklapbaar. Zonder AI de vaste tekst.
import { BLOK_LABEL, vulScript, type Belscript, type ScriptBezwaar, type ScriptStaat } from '~~/shared/belscripts'

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
}>()
const staat = defineModel<ScriptStaat | null>('staat', { default: null })
const gekozen = ref(props.voorstel?.scriptId ?? props.scripts[0]?.id ?? '')
const script = computed(() => props.scripts.find((s) => s.id === gekozen.value) ?? null)
const toonCodes = ref(false)
const ai = ref<Record<string, { tekst: string; bronnen?: any[] }>>({})
const aiStatus = ref<'uit' | 'laden' | 'klaar' | 'terugval'>('uit')
const aiReden = ref('')
const open = ref<Set<string>>(new Set())
const vragen = reactive<Record<string, { vink: boolean; antwoord: string }>>({})

async function laadAi() {
  ai.value = {}
  if (!props.aiAan || !script.value || !script.value.data.blokken.some((b) => b.invulwijze !== 'vast')) { aiStatus.value = 'uit'; return }
  aiStatus.value = 'laden'
  try {
    const r = await $fetch<any>('/api/belscripts/invullen', { method: 'POST', body: { scriptId: script.value.id, versie: script.value.versie, accountId: props.accountId, contactId: props.contactId } })
    if (r.ok) { ai.value = r.ai ?? {}; aiStatus.value = 'klaar' } else { aiStatus.value = 'terugval'; aiReden.value = r.reden ?? '' }
  } catch { aiStatus.value = 'terugval' }
}
const ingevuld = computed(() => (script.value ? vulScript(script.value, { waarden: props.waarden, ai: ai.value }) : null))
const bezwaren = computed<ScriptBezwaar[]>(() => {
  const eigen = ingevuld.value?.bezwaren ?? []
  return [...(props.extraBezwaren ?? []).filter((z) => !eigen.some((e) => e.argumentRef && e.argumentRef === z.argumentRef)), ...eigen]
})
const vragenVan = (tekst: string) => tekst.split(/(?<=\?)\s+/).map((x) => x.trim()).filter(Boolean)

function schrijfStaat() {
  if (!script.value) { staat.value = null; return }
  const s = script.value
  staat.value = {
    scriptId: s.id, versie: s.versie, gekozenDoor: s.id === props.voorstel?.scriptId ? 'voorstel' : 'gebruiker', gewisseld: s.id !== props.voorstel?.scriptId,
    bezwaren: bezwaren.value.filter((z) => open.value.has(z.id)).map((z) => ({ id: z.id, bezwaar: z.bezwaar, argumentRef: z.argumentRef ?? null })),
    vragen: s.data.blokken.filter((b) => b.soort === 'vragen').flatMap((b) => vragenVan(b.tekst).map((v, i) => ({ k: `${b.id}:${i}`, b, v, i })))
      .filter((x) => vragen[x.k]?.vink || vragen[x.k]?.antwoord?.trim())
      .map((x) => ({ blokId: x.b.id, vraag: x.v, antwoord: vragen[x.k]?.antwoord?.trim() || 'ja', veld: x.i === 0 ? x.b.veldKoppeling ?? null : null })),
  }
}
function wisselBezwaar(id: string) {
  const n = new Set(open.value)
  n.has(id) ? n.delete(id) : n.add(id)
  open.value = n
  schrijfStaat()
}
watch(() => props.voorstel?.scriptId, (id) => { if (id) gekozen.value = id })
watch(() => props.accountId, () => { open.value = new Set(); for (const k of Object.keys(vragen)) delete vragen[k] })
watch([gekozen, () => props.accountId], () => { void laadAi(); schrijfStaat() }, { immediate: true })
watch(vragen, schrijfStaat, { deep: true })
const code = (v: string) => '{' + v + '}'
const vraagSleutel = (blokId: string, i: number) => { const k = `${blokId}:${i}`; vragen[k] ??= { vink: false, antwoord: '' }; return vragen[k]! }
</script>

<template>
  <div :class="{ 'toon-codes': toonCodes }" data-test="belscript">
    <div class="kop-rij">
      <label class="veld"><span class="veld-label">Script</span>
        <select v-model="gekozen" class="invoer" aria-label="Script" data-test="script-keuze">
          <option v-for="s in scripts" :key="s.id" :value="s.id">{{ s.naam }}{{ s.isPersoonlijk ? ' (mijn variant)' : '' }}{{ s.conversie ? ` · ${s.conversie}` : '' }}</option>
        </select>
      </label>
      <span v-if="script" class="meta">versie {{ script.versie }}<template v-if="voorstel && gekozen === voorstel.scriptId"> · {{ voorstel.reden }}</template></span>
      <button v-if="!compact" type="button" class="dd-act" @click="toonCodes = !toonCodes">{ } {{ toonCodes ? 'Toon tekst' : 'Toon variabelen' }}</button>
    </div>
    <p v-for="m in meldingen ?? []" :key="m" class="kaart kaart--geel mt-8" data-test="script-melding">{{ m }}</p>
    <p v-if="aiStatus === 'terugval'" class="meta mt-8" data-test="ai-terugval">{{ aiReden || 'Zonder AI: de vaste teksten en terugvalzinnen.' }}</p>
    <div v-if="ingevuld">
      <div v-for="b in ingevuld.blokken.filter((x) => x.soort !== 'bezwaren' && x.soort !== 'opvolgmail')" :key="b.id" class="scriptblok" :data-test="`blok-${b.soort}`">
        <div class="scriptblok-kop"><span class="bloklabel">{{ b.titel || BLOK_LABEL[b.soort] }}</span><span v-if="b.vanAi" class="ai-label">AI</span><span v-else class="meta">{{ b.invulwijze === 'vast' ? 'vast' : aiStatus === 'laden' ? 'AI vult in…' : 'vaste tekst' }}</span></div>
        <template v-if="b.soort === 'vragen'">
          <div v-for="(v, i) in vragenVan(b.segmenten.map((x) => x.tekst).join(''))" :key="i" class="mt-4">
            <label class="vink"><input v-model="vraagSleutel(b.id, Number(i)).vink" type="checkbox"> {{ v }} <span v-if="Number(i) === 0 && b.veldKoppeling" class="codes">{{ b.veldKoppeling.bron }}.{{ b.veldKoppeling.sleutel }}</span></label>
            <input v-if="vraagSleutel(b.id, Number(i)).vink" v-model="vraagSleutel(b.id, Number(i)).antwoord" class="invoer mt-4" :aria-label="`Antwoord: ${v}`" placeholder="Kort antwoord">
          </div>
        </template>
        <p v-else :class="{ 'tekst--groot': compact && b.soort === 'opening' }">
          <template v-for="(s, i) in b.segmenten" :key="i"><span v-if="s.onbekend" class="var var--onbekend" data-test="var-onbekend"><span class="var-tekst">{{ s.tekst || '…' }}</span><span class="var-code">{{ code(s.onbekend) }}</span></span><template v-else>{{ s.tekst }}</template></template>
        </p>
        <p v-if="b.bronnen?.length" class="meta">Bron: {{ b.bronnen.map((x: any) => [x.soort, x.citaat, x.datum?.slice(0, 10)].filter(Boolean).join(', ')).join(' · ') }}</p>
      </div>
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
