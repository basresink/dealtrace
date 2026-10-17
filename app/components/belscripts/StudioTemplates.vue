<script setup lang="ts">
// Belscript Studio, tabblad Templates: zes soorten belscripts als startpunt met doel, lengte, wanneer,
// rol en het resultaat uit de eigen gesprekken (pas vanaf 30 gesprekken een percentage). Filter op
// situatie; Bekijk opent een flyout met het voorbeeld voor een prospect, Gebruik als basis maakt een
// nieuw concept in Standaardscript (alleen wie beheert). Het huidige actieve script blijft in gebruik.
import { BLOK_LABEL, INVULWIJZE_LABEL, TEMPLATE_FILTERS, filterTemplates, scriptUitTemplate, templateVanScript, voorbeeldSegmenten, type ScriptTemplate, type TemplateFilter } from '~~/shared/belscripts'

const props = defineProps<{ lijst: any }>()
const emit = defineEmits<{ gebruikt: [id: string] }>()
const toast = useToast()
const { data } = await useFetch<any>('/api/belscripts/templates', { default: () => ({ templates: [], kan: {} }) })
const filter = ref<TemplateFilter>('alle')
const zichtbaar = computed(() => filterTemplates(data.value.templates as (ScriptTemplate & { lengte: any; resultaat: any })[], filter.value))
const aantal = (f: TemplateFilter) => filterTemplates(data.value.templates, f).length
const inGebruik = computed(() => new Set((props.lijst?.scripts ?? []).filter((s: any) => s.status === 'actief').map((s: any) => templateVanScript(s)).filter(Boolean)))

const bekijk = ref<any>(null)
const voorbeeld = ref<any>({ waarden: {}, accounts: [], accountId: '' })
async function open(t: any) {
  bekijk.value = t
  if (!voorbeeld.value.accountId) voorbeeld.value = await $fetch<any>('/api/belscripts/voorbeeld').catch(() => voorbeeld.value)
}
const voorbeeldNaam = computed(() => voorbeeld.value.accounts?.find((a: any) => a.id === voorbeeld.value.accountId)?.naam ?? 'een prospect')

const bezig = ref(false)
async function gebruik(t: ScriptTemplate) {
  bezig.value = true
  try {
    const nieuw = scriptUitTemplate(t)
    const r = await $fetch<any>('/api/belscripts', { method: 'POST', body: nieuw })
    bekijk.value = null
    toast.toon(`Template ${t.naam} staat klaar in Standaardscript als concept. Het huidige script blijft in gebruik tot je activeert.`)
    emit('gebruikt', r.id)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <div>
    <div class="kaart kaart--geel">
      <p><strong>Zes soorten belscripts als startpunt.</strong> Kies er een, pas hem aan in Standaardscript en activeer hem voor je team. De resultaten komen uit de gesprekken van je eigen organisatie; onder 30 gesprekken vergelijken we niet.</p>
      <p v-if="!data.kan.gebruiken" class="meta mt-8">Je salesmanager zet een template om in het standaardscript. Je kunt ze hier bekijken.</p>
    </div>
    <div class="rijtje mt-16" role="group" aria-label="Filter op situatie">
      <button v-for="f in TEMPLATE_FILTERS" :key="f.sleutel" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter === f.sleutel }" :aria-pressed="filter === f.sleutel" :data-test="`tpl-filter-${f.sleutel}`" @click="filter = f.sleutel">
        {{ f.label }} <span class="pil-teller">{{ aantal(f.sleutel) }}</span>
      </button>
    </div>
    <div class="st-raster mt-16" data-test="tpl-raster">
      <article v-for="t in zichtbaar" :key="t.id" class="kaart st-kaart" :data-test="`tpl-${t.id}`">
        <div class="rijtje"><span class="pil" :class="t.soort === 'nieuw' ? 'pil--blauw' : 'pil--leeg'">{{ t.soort === 'nieuw' ? 'Nieuw contact' : 'Eerder contact' }}</span><span v-if="inGebruik.has(t.id)" class="pil pil--geel">In gebruik</span></div>
        <h3 class="kaart-titel mt-8">{{ t.naam }}</h3>
        <dl class="st-defs mt-8">
          <div><dt>Doel</dt><dd>{{ t.doel }}</dd></div>
          <div><dt>Lengte</dt><dd class="tnum">{{ t.lengte.woorden }} woorden, ongeveer {{ t.lengte.seconden }} seconden</dd></div>
          <div><dt>Wanneer</dt><dd>{{ t.wanneer }}</dd></div>
          <div><dt>Rol</dt><dd>{{ t.rol }}</dd></div>
        </dl>
        <div class="rijtje mt-8"><span v-for="b in t.blokken" :key="b.id" class="pil pil--leeg">{{ BLOK_LABEL[b.soort] }}</span></div>
        <p class="meta mt-8" :data-test="`tpl-resultaat-${t.id}`"><Icoon naam="ChartLine" :grootte="14" /> {{ t.resultaat.label }}</p>
        <div class="rijtje mt-12 st-voet">
          <button type="button" class="dd-act" :data-test="`tpl-bekijk-${t.id}`" @click="open(t)">Bekijk</button>
          <button v-if="data.kan.gebruiken" type="button" class="dd-act dd-act--primair" :disabled="bezig" :data-test="`tpl-gebruik-${t.id}`" @click="gebruik(t)">Gebruik als basis</button>
        </div>
      </article>
      <LegeStaat v-if="!zichtbaar.length" titel="Geen templates voor dit filter." tekst="Kies een ander filter." />
    </div>

    <FlyoutShell v-if="bekijk" open titel-id="st-titel" data-test="tpl-flyout" @sluit="bekijk = null">
        <template #kop><span class="fo-kicker">Template</span><h2 id="st-titel" class="fo-titel">{{ bekijk.naam }}</h2></template>
          <div class="fo-body">
            <dl class="defs">
              <div class="def-rij"><dt>Doel</dt><dd>{{ bekijk.doel }}</dd></div>
              <div class="def-rij"><dt>Lengte</dt><dd>{{ bekijk.lengte.woorden }} woorden, ongeveer {{ bekijk.lengte.seconden }} seconden</dd></div>
              <div class="def-rij"><dt>Wanneer</dt><dd>{{ bekijk.wanneer }}</dd></div>
              <div class="def-rij"><dt>Resultaat</dt><dd>{{ bekijk.resultaat.label }}</dd></div>
            </dl>
            <article class="fo-blok">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Zo klinkt het bij {{ voorbeeldNaam }}</h3></header>
              <div v-for="b in bekijk.blokken" :key="b.id" class="scriptblok">
                <div class="scriptblok-kop"><span class="bloklabel">{{ BLOK_LABEL[b.soort as keyof typeof BLOK_LABEL] }}</span><span class="meta">{{ INVULWIJZE_LABEL[b.invulwijze as keyof typeof INVULWIJZE_LABEL] }}</span></div>
                <p><template v-for="(seg, j) in voorbeeldSegmenten(b.tekst, voorbeeld.waarden)" :key="j"><span v-if="seg.variabele" class="var" :class="{ 'var--onbekend': seg.onbekend }">{{ seg.tekst || '…' }}</span><template v-else>{{ seg.tekst }}</template></template></p>
              </div>
            </article>
            <article v-if="bekijk.bezwaren.length" class="fo-blok">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Bezwaren</h3></header>
              <ul class="st-bezwaren"><li v-for="z in bekijk.bezwaren" :key="z.id"><strong>"{{ z.bezwaar }}"</strong> {{ z.antwoord }}</li></ul>
            </article>
          </div>
        <template #voet>
          <footer class="fo-foot fs-voet">
          <button v-if="data.kan.gebruiken" type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig" data-test="tpl-flyout-gebruik" @click="gebruik(bekijk)"><Icoon naam="Check" :grootte="16" />Gebruik als basis</button>
          <span class="fo-foot-vul" />
        </footer>
        </template>
      </FlyoutShell>
  </div>
</template>

<style scoped>
.st-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: var(--kaart-gap); }
.st-kaart { display: flex; flex-direction: column; }
.st-voet { margin-top: auto; padding-top: 12px; }
.st-defs { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 0; }
.st-defs dt { font-size: var(--fs-label); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.st-defs dd { margin: 2px 0 0; font-size: var(--fs-klein); }
.st-bezwaren { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: var(--fs-klein); }
</style>
