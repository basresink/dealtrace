<script setup lang="ts">
// Foto van een contact uploaden, wijzigen of verwijderen (opzet uit DealDrive, AfbeeldingBewerker). Een jpg of
// png wordt eerst verkleind tot 256 px en gaat dan als bijlage naar het contact (max 1 MB).
const props = defineProps<{ contactId: string; fotoUrl: string | null; compact?: boolean }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const bezig = ref(false)
const invoer = ref<HTMLInputElement | null>(null)
const naarBase64 = (b: Blob) => new Promise<string>((ok, nee) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = nee; r.readAsDataURL(b) })
function kies() { invoer.value?.click() }
defineExpose({ kies })
async function gekozen(e: Event) {
  const el = e.target as HTMLInputElement
  const bestand = el.files?.[0]
  el.value = ''
  if (!bestand) return
  if (!['image/jpeg', 'image/png'].includes(bestand.type) || bestand.size > 10 * 1024 * 1024) { toast.toon('Kies een jpg of png.', 'fout'); return }
  bezig.value = true
  try {
    let blob: Blob
    try { blob = await verkleinFoto(bestand, 256) } catch { toast.toon('Dit bestand is geen leesbare jpg of png. Kies een andere foto.', 'fout'); return }
    if (blob.size > 1_000_000) { toast.toon('De foto is te groot. Kies een jpg of png van hooguit 1 MB.', 'fout'); return }
    await $fetch(`/api/contacten/${props.contactId}/foto`, { method: 'POST', body: { data: await naarBase64(blob) } })
    toast.toon('Foto opgeslagen.')
    emit('gewijzigd')
  } catch (err) { toast.toon(foutTekst(err), 'fout') } finally { bezig.value = false }
}
async function verwijder() {
  if (!confirm('Foto van dit contact verwijderen?')) return
  bezig.value = true
  try { await $fetch(`/api/contacten/${props.contactId}/foto`, { method: 'DELETE' }); toast.toon('Foto verwijderd.'); emit('gewijzigd') } catch (err) { toast.toon(foutTekst(err), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <div class="cfk" :class="{ 'cfk--compact': compact }">
    <input ref="invoer" type="file" accept="image/jpeg,image/png" class="sr-only" tabindex="-1" aria-hidden="true" data-test="contact-foto-bestand" @change="gekozen">
    <button type="button" class="dd-act" :disabled="bezig" data-test="contact-foto-kies" @click="kies"><Icoon naam="Camera" class="dd-act-icoon" />{{ fotoUrl ? 'Foto wijzigen' : 'Foto uploaden' }}</button>
    <button v-if="fotoUrl" type="button" class="dd-act dd-act--gevaar" :disabled="bezig" data-test="contact-foto-weg" @click="verwijder"><Icoon naam="Trash2" class="dd-act-icoon" />Verwijderen</button>
  </div>
</template>

<style scoped>
.cfk { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
