<script setup lang="ts">
// Extra bronnen in het Info-venster: eigen webadressen (label en URL) waar meer over de prospect of het
// contact te vinden is, zoals een nieuwspagina, een vacaturesite of een interview. Bij een account volgen
// de agents ze als bron.
const props = defineProps<{ bronnen: { label: string; url: string }[]; uitleg: string }>()
const emit = defineEmits<{ bewaar: [bronnen: { label: string; url: string }[]] }>()
const open = ref(false)
const label = ref('')
const url = ref('')
const fout = ref('')
function voegToe() {
  fout.value = ''
  let u = url.value.trim()
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u)) { fout.value = 'Vul een geldig webadres in, bijvoorbeeld https://voorbeeld.test/nieuws.'; return }
  emit('bewaar', [...props.bronnen, { label: label.value.trim() || u.replace(/^https?:\/\//i, '').split('/')[0]!, url: u }])
  label.value = ''; url.value = ''; open.value = false
}
const kort = (u: string) => u.replace(/^https?:\/\//i, '').replace(/\/$/, '')
</script>

<template>
  <div class="eb" data-test="extra-bronnen">
    <p class="eb-uitleg">{{ uitleg }}</p>
    <ul v-if="bronnen.length" class="eb-lijst">
      <li v-for="(b, i) in bronnen" :key="`${b.url}-${i}`" class="eb-rij" data-test="extra-bron">
        <div class="eb-tekst">
          <span class="eb-label">{{ b.label }}</span>
          <a :href="b.url" target="_blank" rel="noopener noreferrer" class="eb-url">{{ kort(b.url) }} <span aria-hidden="true">↗</span></a>
        </div>
        <button type="button" class="eb-weg" :aria-label="`${b.label} verwijderen`" data-test="extra-bron-weg" @click="emit('bewaar', bronnen.filter((_, n) => n !== i))"><Icoon naam="Trash2" :grootte="14" /></button>
      </li>
    </ul>
    <button v-if="!open" type="button" class="eb-voeg" data-test="extra-bron-nieuw" @click="open = true">+ Voeg bron toe</button>
    <form v-else class="eb-form" @submit.prevent="voegToe">
      <label class="veld"><span class="veld-label">Label</span><input v-model="label" class="invoer" maxlength="80" placeholder="Bijvoorbeeld Nieuwspagina" data-test="extra-bron-label"></label>
      <label class="veld"><span class="veld-label">Webadres</span><input v-model="url" class="invoer" type="text" inputmode="url" autocomplete="url" maxlength="300" placeholder="https://" required data-test="extra-bron-url"></label>
      <p v-if="fout" class="veld-fout" role="alert">{{ fout }}</p>
      <div class="dd-acties">
        <button type="submit" class="dd-act dd-act--primair" data-test="extra-bron-bewaar">Toevoegen</button>
        <button type="button" class="dd-act" @click="open = false; fout = ''">Annuleren</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.eb-uitleg { margin: 4px 0 8px; font-size: 12px; line-height: 1.45; color: var(--muted); }
.eb-lijst { margin: 0; padding: 0; list-style: none; }
.eb-rij { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.eb-tekst { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.eb-label { font-size: 13px; font-weight: 700; color: var(--ink); }
.eb-url { font-size: 12px; color: var(--ink-soft); text-decoration: none; overflow-wrap: anywhere; }
.eb-url:hover { text-decoration: underline; }
.eb-weg { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; padding: 0; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--muted); cursor: pointer; }
.eb-weg:hover { border-color: var(--red); color: var(--red); }
.eb-voeg { margin: 8px 0 4px; padding: 6px 0; border: 0; border-bottom: 1px dashed var(--muted); background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; }
.eb-voeg:hover { color: var(--ink); border-bottom-color: var(--yellow); border-bottom-style: solid; }
.eb-form { display: flex; flex-direction: column; gap: 10px; margin: 8px 0 4px; padding: 12px; background: var(--bg); border-left: 3px solid var(--yellow); }
@media (max-width: 767px) { .eb-weg, .eb-voeg { min-width: 44px; min-height: 44px; } }
</style>
