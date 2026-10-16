<script setup lang="ts">
// "Document uploaden" op de accountkaart: PDF, Office, tekst of afbeelding tot 8 MB.
const props = defineProps<{ open: boolean; account: { id: string; naam: string }; contactId?: string | null }>()
const emit = defineEmits<{ sluit: []; bewaard: [] }>()
const toast = useToast()
const bestand = ref<File | null>(null)
const naam = ref('')
const bezig = ref(false)
const sleep = ref(false)
watch(() => props.open, (o) => { if (o) { bestand.value = null; naam.value = '' } })
function kies(f: File | undefined | null) { if (!f) return; bestand.value = f; naam.value = f.name }
const base64 = (f: File) => new Promise<string>((ok, nee) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = nee; r.readAsDataURL(f) })
async function bewaar() {
  if (!bestand.value) return
  if (bestand.value.size > 8_000_000) { toast.toon('Het document is groter dan 8 MB.', 'fout'); return }
  bezig.value = true
  try {
    await $fetch(`/api/accounts/${props.account.id}/documenten`, { method: 'POST', body: { naam: naam.value.trim() || bestand.value.name, mime: bestand.value.type || 'application/octet-stream', data: await base64(bestand.value), contactId: props.contactId ?? undefined } })
    toast.toon('Document bewaard.'); emit('bewaard')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="df-titel" data-test="document-flyout" @submit.prevent="bewaar">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Document uploaden</span><h2 id="df-titel" class="fo-titel">{{ account.naam }}</h2><p class="fo-meta">PDF, Word, Excel, PowerPoint, tekst of afbeelding, tot 8 MB.</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <label class="doc-drop" :class="{ 'doc-drop--over': sleep }" @dragover.prevent="sleep = true" @dragleave="sleep = false" @drop.prevent="sleep = false; kies($event.dataTransfer?.files?.[0])">
            <Icoon naam="Upload" :grootte="22" />
            <span><strong>{{ bestand ? bestand.name : 'Sleep een bestand hierheen' }}</strong><br><span class="meta">{{ bestand ? `${Math.ceil(bestand.size / 1024)} kB` : 'of klik om te kiezen' }}</span></span>
            <input type="file" class="doc-drop-invoer" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*" data-test="document-bestand" @change="kies(($event.target as HTMLInputElement).files?.[0])">
          </label>
          <label class="veld mt-16"><span class="veld-label">Naam</span><input v-model="naam" class="invoer" maxlength="200" data-test="document-naam"></label>
        </div>
        <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button><button type="submit" class="dd-act dd-act--geel" :disabled="bezig || !bestand" data-test="document-bewaar">Uploaden</button></footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.doc-drop { position: relative; display: flex; align-items: center; gap: 14px; padding: 28px 20px; border: 1px dashed var(--border-strong); background: var(--surface); cursor: pointer; }
.doc-drop--over { border-color: var(--ink); background: var(--yellow-soft, #fff7cc); }
.doc-drop-invoer { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
</style>
