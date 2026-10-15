<script setup lang="ts">
// Visitekaartje scannen (P31, Gevorderd): foto, de AI leest naam, functie, bedrijf, telefoon en mail
// (2 credits), daarna het conceptcontact met een mogelijk duplicaat. "Bewaar contact" via de wachtrij.
// Offline wacht de foto: "Wordt gelezen zodra je verbinding hebt".
const props = defineProps<{ open: boolean; account: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: []; bewaard: [] }>()
const toast = useToast()
const { voegToe } = useSyncQueue()
const bijlagen = useBijlagen()
const lezen = ref(false)
const concept = ref<any>(null)
const samenvoegen = ref<boolean | null>(null)
watch(() => props.open, (o) => { if (o) { concept.value = null; samenvoegen.value = null; lezen.value = false } })
async function foto(e: Event) {
  const bestand = (e.target as HTMLInputElement).files?.[0]
  if (!bestand || !props.account) return
  const klein = await verkleinFoto(bestand)
  const id = await bijlagen.voegToe(klein, 'visitekaartje', { soort: 'accounts', id: props.account.id })
  if (!navigator.onLine) {
    await voegToe({ tabel: 'contacts', op: 'patch', recordId: props.account.id, patch: { soort: 'contact.uitVisitekaartje', bijlageId: id } })
    toast.toon('Foto bewaard. Wordt gelezen zodra je verbinding hebt.')
    emit('sluit'); return
  }
  lezen.value = true
  try {
    await bijlagen.verstuur()
    concept.value = await $fetch('/api/contacten/visitekaartje', { method: 'POST', body: { bijlageId: id, accountId: props.account.id } })
  } catch (err) { toast.toon(foutTekst(err), 'fout') } finally { lezen.value = false }
}
async function bewaar() {
  const c = concept.value
  if (!c || !props.account) return
  await voegToe({ tabel: 'contacts', op: 'patch', recordId: props.account.id, patch: { soort: 'contact.uitVisitekaartje', contact: c.contact, samenvoegenMet: c.duplicaat && samenvoegen.value !== false ? c.duplicaat.id : null } })
  toast.toon(c.duplicaat && samenvoegen.value !== false ? `Samengevoegd met ${c.duplicaat.naam}.` : 'Contact bewaard.')
  emit('bewaard'); emit('sluit')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && account" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="vk-titel" data-test="visitekaartje" @submit.prevent="bewaar">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Visitekaartje</span><h2 id="vk-titel" class="fo-titel">{{ account.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button></header>
        <div class="fo-body fo-body--formulier">
          <label v-if="!concept" class="ba-mic" :class="{ 'ba-mic--aan': lezen }"><Icoon naam="Camera" />{{ lezen ? 'Kaartje lezen…' : 'Maak een foto van het kaartje' }}<input type="file" accept="image/*" capture="environment" class="sr-only" data-test="vk-foto" :disabled="lezen" @change="foto"></label>
          <template v-else>
            <p v-if="concept.duplicaat" class="kaart kaart--geel" data-test="vk-dubbel">Lijkt op {{ concept.duplicaat.naam }} bij dit account. <button type="button" class="dd-act" @click="samenvoegen = true">Samenvoegen</button> <button type="button" class="dd-act" @click="samenvoegen = false">Toch nieuw</button></p>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Voornaam</span><input v-model="concept.contact.voornaam" class="invoer"></label>
              <label class="veld"><span class="veld-label">Achternaam</span><input v-model="concept.contact.achternaam" class="invoer" required></label>
              <label class="veld"><span class="veld-label">Functie</span><input v-model="concept.contact.functie" class="invoer"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="concept.contact.telefoon" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">E-mail</span><input v-model="concept.contact.email" class="invoer" type="email"></label>
            </div>
            <p v-if="concept.contact.bedrijf && concept.contact.bedrijf !== account.naam" class="meta mt-8">Op het kaartje staat het bedrijf {{ concept.contact.bedrijf }}.</p>
          </template>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" :disabled="!concept" @click="concept = null">Aanpassen</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" class="dd-act dd-act--primair" :disabled="!concept || (concept.duplicaat && samenvoegen === null)" data-test="vk-bewaar">Bewaar contact</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
