<script setup lang="ts">
// Klaarzetten voor buitendienst (F10): collega kiezen, regiodag of "eerstvolgende in deze regio",
// korte reden. De kans verschijnt bij die collega met de bron "Klaargezet door" en een melding.
// Offline gaat het via de wachtrij (kans.klaarzetten).
const props = defineProps<{ open: boolean; account: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: []; klaar: [] }>()
const toast = useToast()
const { voegToe } = useSyncQueue()
const collegas = ref<{ id: string; naam: string; werkplek: string }[]>([])
const f = reactive({ voorGebruiker: '', datum: '', reden: '' })
watch(() => props.open, async (o) => {
  if (!o) return
  Object.assign(f, { voorGebruiker: '', datum: '', reden: '' })
  const g: any = await $fetch('/api/gebieden').catch(() => ({ gebruikers: [] }))
  collegas.value = (g.gebruikers ?? []).filter((u: any) => u.werkplek === 'buitendienst')
  f.voorGebruiker = collegas.value[0]?.id ?? ''
}, { immediate: true })
async function zet() {
  if (!props.account || !f.voorGebruiker) return
  const body = { voorGebruiker: f.voorGebruiker, datum: f.datum || null, reden: f.reden }
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'klaargezet_voor', op: 'patch', recordId: props.account.id, patch: { soort: 'kans.klaarzetten', ...body } })
      toast.toon('Klaargezet. Wordt verstuurd zodra je weer verbinding hebt.')
    } else {
      const r: any = await $fetch(`/api/accounts/${props.account.id}/klaarzetten`, { method: 'POST', body })
      toast.toon(r.tekst)
    }
    emit('klaar'); emit('sluit')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && account" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="kz-titel" data-test="klaarzetten" @submit.prevent="zet">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Klaarzetten voor buitendienst</span><h2 id="kz-titel" class="fo-titel">{{ account.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button></header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <label class="veld"><span class="veld-label">Collega</span><select v-model="f.voorGebruiker" class="invoer" data-test="kz-collega"><option v-for="u in collegas" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option></select></label>
            <label class="veld mt-16"><span class="veld-label">Regiodag</span><input v-model="f.datum" type="date" class="invoer"><span class="veld-uitleg">Leeg: de eerstvolgende regiodag in de regio van dit account.</span></label>
            <label class="veld mt-16"><span class="veld-label">Reden</span><input v-model="f.reden" class="invoer" maxlength="300" placeholder="Bijvoorbeeld: wil een monteur langs" data-test="kz-reden"></label>
          </article>
        </div>
        <footer class="fo-foot dd-acties"><button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button><span class="dd-acties-vul fo-foot-vul" /><button type="submit" class="dd-act dd-act--primair" :disabled="!f.voorGebruiker" data-test="kz-zet">Klaarzetten</button></footer>
      </form>
    </div>
  </Teleport>
</template>
