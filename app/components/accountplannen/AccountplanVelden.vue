<script setup lang="ts">
// Extra velden van een accountplan: de eigen velden met object Accountplan (Instellingen, Eigen velden).
// Lezen: naam en waarde; bewerken: het passende invoerveld per type. De server controleert de waarden.
interface VeldDef { sleutel: string; naam: string; type: string; opties: { waarde: string; label: string }[]; hulp?: string | null; waarde?: unknown }
const props = withDefaults(defineProps<{ velden: VeldDef[]; bewerk?: boolean; prefix?: string }>(), { bewerk: false, prefix: 'apv' })
const waarden = defineModel<Record<string, unknown>>({ default: () => ({}) })
function toon(v: VeldDef): string {
  const w = v.waarde
  if (w === null || w === undefined || w === '') return 'Niet ingevuld'
  if (v.type === 'janee') return w ? 'Ja' : 'Nee'
  if (v.type === 'keuzelijst') return v.opties.find((o) => o.waarde === w)?.label ?? String(w)
  if (Array.isArray(w)) return w.map((x) => v.opties.find((o) => o.waarde === x)?.label ?? x).join(', ')
  return String(w)
}
function zet(k: string, w: unknown) { waarden.value = { ...waarden.value, [k]: w } }
const invoerType = (t: string) => (t === 'getal' || t === 'bedrag' ? 'number' : t === 'datum' ? 'date' : t === 'email' ? 'email' : t === 'telefoon' ? 'tel' : t === 'link' ? 'url' : 'text')
</script>

<template>
  <div class="apx" :data-test="`${prefix}-velden`">
    <dl v-if="!bewerk" class="apx-defs">
      <div v-for="v in props.velden" :key="v.sleutel" class="apx-rij"><dt>{{ v.naam }}</dt><dd :class="{ 'apx-leeg': v.waarde === null || v.waarde === undefined || v.waarde === '' }">{{ toon(v) }}</dd></div>
    </dl>
    <template v-else>
      <label v-for="v in props.velden" :key="v.sleutel" class="veld apx-veld">
        <span class="veld-label">{{ v.naam }}</span>
        <select v-if="v.type === 'keuzelijst'" class="invoer" :value="waarden[v.sleutel] ?? ''" :data-test="`${prefix}-veld-${v.sleutel}`" @change="zet(v.sleutel, ($event.target as HTMLSelectElement).value || null)">
          <option value="">Kies een optie</option>
          <option v-for="o in v.opties" :key="o.waarde" :value="o.waarde">{{ o.label }}</option>
        </select>
        <select v-else-if="v.type === 'janee'" class="invoer" :value="waarden[v.sleutel] === true ? 'ja' : waarden[v.sleutel] === false ? 'nee' : ''" :data-test="`${prefix}-veld-${v.sleutel}`" @change="zet(v.sleutel, ($event.target as HTMLSelectElement).value || null)">
          <option value="">Niet ingevuld</option><option value="ja">Ja</option><option value="nee">Nee</option>
        </select>
        <select v-else-if="v.type === 'meerkeuze'" class="invoer" multiple :data-test="`${prefix}-veld-${v.sleutel}`" @change="zet(v.sleutel, [...($event.target as HTMLSelectElement).selectedOptions].map((o) => o.value))">
          <option v-for="o in v.opties" :key="o.waarde" :value="o.waarde" :selected="Array.isArray(waarden[v.sleutel]) && (waarden[v.sleutel] as string[]).includes(o.waarde)">{{ o.label }}</option>
        </select>
        <textarea v-else-if="v.type === 'langeTekst'" class="invoer" rows="3" :value="String(waarden[v.sleutel] ?? '')" :data-test="`${prefix}-veld-${v.sleutel}`" @input="zet(v.sleutel, ($event.target as HTMLTextAreaElement).value)" />
        <input v-else class="invoer" :type="invoerType(v.type)" :value="waarden[v.sleutel] ?? ''" :data-test="`${prefix}-veld-${v.sleutel}`" @input="zet(v.sleutel, ($event.target as HTMLInputElement).value)">
        <span v-if="v.hulp" class="veld-uitleg">{{ v.hulp }}</span>
      </label>
    </template>
  </div>
</template>

<style scoped>
.apx-defs { margin: 0; }
.apx-rij { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.apx-rij:last-child { border-bottom: 0; }
.apx-rij dt { color: var(--muted); }
.apx-rij dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.apx-leeg { color: var(--muted); font-weight: 400 !important; }
.apx-veld { margin-top: 10px; }
.apx-veld:first-child { margin-top: 0; }
.apx-veld .invoer { width: 100%; }
</style>
