<script setup lang="ts">
// "Inzicht met bron" (P19, Gevorderd): zelf een inzicht toevoegen met account, titel, bron en citaat.
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: []; opgeslagen: [] }>()
const toast = useToast()
const accounts = ref<{ id: string; naam: string }[]>([])
const f = reactive({ titel: '', bron: '', url: '', citaat: '' })
const bezig = ref(false)
watch(() => props.open, (o) => { if (o) { accounts.value = props.account ? [props.account] : []; Object.assign(f, { titel: '', bron: '', url: '', citaat: '' }) } })
watch(accounts, (a) => { if (a.length > 1) accounts.value = [a[a.length - 1]!] })
const klaar = computed(() => accounts.value.length === 1 && f.titel.trim() && f.bron.trim() && f.citaat.trim())
async function opslaan() {
  bezig.value = true
  try {
    await $fetch('/api/signals/handmatig', { method: 'POST', body: { accountId: accounts.value[0]!.id, titel: f.titel, bron: f.bron, url: f.url || undefined, citaat: f.citaat } })
    toast.toon('Inzicht toegevoegd.'); emit('opgeslagen'); emit('sluit')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="imb-titel" data-test="inzicht-met-bron" @submit.prevent="opslaan">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Inzicht</span><h2 id="imb-titel" class="fo-titel">Inzicht met bron</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button></header>
        <div class="fo-body fo-body--formulier">
          <div class="veld"><span class="veld-label">Account</span><AccountKiezer v-model="accounts" /></div>
          <label class="veld"><span class="veld-label">Titel</span><input v-model="f.titel" class="invoer" maxlength="140" required data-test="imb-titel"></label>
          <label class="veld"><span class="veld-label">Bron</span><input v-model="f.bron" class="invoer" maxlength="140" placeholder="Bijvoorbeeld: gesprek op de vakbeurs" required data-test="imb-bron"></label>
          <label class="veld"><span class="veld-label">URL</span><input v-model="f.url" class="invoer" type="url" placeholder="https://" data-test="imb-url"></label>
          <label class="veld"><span class="veld-label">Citaat</span><textarea v-model="f.citaat" class="invoer" rows="3" maxlength="600" required data-test="imb-citaat" /></label>
        </div>
        <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="submit" class="dd-act dd-act--primair" :disabled="!klaar || bezig" data-test="imb-opslaan">Opslaan</button></footer>
      </form>
    </div>
  </Teleport>
</template>
