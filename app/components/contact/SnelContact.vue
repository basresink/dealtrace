<script setup lang="ts">
// Snel een contactpersoon toevoegen binnen een flyout (+ Taak, + Afspraak): staat er bij de gekozen prospect nog
// geen contact, of wil je een nieuw contact, dan vul je hier voornaam, achternaam, functie, telefoon en e-mail in.
// Dezelfde API als + Contact (POST /api/contacten, met de dubbelcheck); het nieuwe contact is daarna gekozen.
// Geen eigen <form>: het blok staat binnen het formulier van de flyout, Enter bewaart alleen dit contact.
const props = withDefaults(defineProps<{ account: { id: string; naam: string } | null; prefix?: string; geenContacten?: boolean }>(), { prefix: 'sc', geenContacten: false })
const emit = defineEmits<{ gemaakt: [c: { id: string; naam: string; functie: string | null; rol: string | null; accountId: string; accountNaam: string }] }>()
const toast = useToast()
const open = ref(false)
const bezig = ref(false)
const fout = ref('')
const dubbel = ref<{ id: string; naam: string; accountId: string | null } | null>(null)
const leeg = () => ({ voornaam: '', achternaam: '', functie: '', telefoon: '', email: '' })
const f = reactive(leeg())
const t = (s: string) => `${props.prefix}-${s}`
watch(() => props.account?.id, () => { open.value = false; Object.assign(f, leeg()); fout.value = ''; dubbel.value = null })
function openen() { Object.assign(f, leeg()); fout.value = ''; dubbel.value = null; open.value = true }
const kan = computed(() => !!props.account && !!f.achternaam.trim() && !bezig.value)

function kies(c: { id: string; naam: string; functie?: string | null; rol?: string | null }) {
  emit('gemaakt', { id: c.id, naam: c.naam, functie: c.functie ?? null, rol: c.rol ?? null, accountId: props.account!.id, accountNaam: props.account!.naam })
  open.value = false
}
async function bewaar() {
  if (!kan.value || !props.account) return
  bezig.value = true; fout.value = ''; dubbel.value = null
  try {
    const c = await $fetch<{ id: string; naam: string; functie: string | null; rol: string | null }>('/api/contacten', { method: 'POST', body: { ...f, accountId: props.account.id } })
    toast.toon(`${c.naam} staat erbij en is gekozen.`)
    kies(c)
  } catch (e: any) {
    const m = e?.data?.data?.match
    if (e?.statusCode === 409 && m) dubbel.value = { id: m.id, naam: `${m.firstName ?? ''} ${m.lastName}`.trim(), accountId: m.accountId ?? null }
    else fout.value = foutTekst(e)
  } finally { bezig.value = false }
}
</script>

<template>
  <div v-if="account && $aan('contacten.basis')" class="sc" :data-test="t('blok')">
    <button v-if="!open" type="button" class="dd-act sc-knop" :data-test="t('open')" @click="openen"><Icoon naam="UserPlus" :grootte="14" />{{ geenContacten ? 'Maak een contactpersoon' : 'Nieuw contact' }}</button>
    <fieldset v-else class="sc-blok" :data-test="t('form')">
      <legend class="veld-label sc-titel">Nieuw contact bij {{ account.naam }}</legend>
      <div class="sc-raster">
        <label class="veld"><span class="veld-label">Voornaam</span><input v-model="f.voornaam" class="invoer" autocomplete="off" :data-test="t('voornaam')" @keydown.enter.prevent="bewaar"></label>
        <label class="veld"><span class="veld-label">Achternaam <span class="veld-verplicht">*</span></span><input v-model="f.achternaam" class="invoer" autocomplete="off" :data-test="t('achternaam')" @keydown.enter.prevent="bewaar"></label>
        <label class="veld"><span class="veld-label">Functie</span><input v-model="f.functie" class="invoer" autocomplete="off" :data-test="t('functie')" @keydown.enter.prevent="bewaar"></label>
        <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer" type="tel" autocomplete="off" :data-test="t('telefoon')" @keydown.enter.prevent="bewaar"></label>
        <label class="veld sc-breed"><span class="veld-label">E-mail</span><input v-model="f.email" class="invoer" type="email" autocomplete="off" :data-test="t('email')" @keydown.enter.prevent="bewaar"></label>
      </div>
      <p v-if="dubbel" class="veld-uitleg sc-melding" role="alert" :data-test="t('dubbel')">{{ dubbel.naam }} staat al in je bestand.<button v-if="dubbel.accountId === account.id" type="button" class="dd-act" :data-test="t('kies-dubbel')" @click="kies({ id: dubbel.id, naam: dubbel.naam })">Kies dit contact</button></p>
      <p v-if="fout" class="veld-fout" role="alert" :data-test="t('fout')">{{ fout }}</p>
      <div class="sc-acties">
        <button type="button" class="dd-act dd-act--geel" :disabled="!kan" :data-test="t('bewaar')" @click="bewaar"><Icoon naam="Check" :grootte="14" />{{ bezig ? 'Toevoegen…' : 'Contact toevoegen' }}</button>
        <button type="button" class="dd-act" :data-test="t('annuleer')" @click="open = false">Annuleer</button>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.sc { margin-top: -8px; }
.sc-knop { min-height: var(--touch-target-min); }
.sc-blok { margin: 0; padding: 12px 14px 14px; border: 1px solid var(--border-strong); border-radius: var(--radius); background: var(--surface); }
.sc-titel { padding: 0 4px; }
.sc-raster { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
.sc-raster .veld { margin: 0; }
.sc-breed { grid-column: 1 / -1; }
.sc-melding { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0 0; }
.sc-acties { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
@media (max-width: 720px) {
  .sc-raster { grid-template-columns: 1fr; }
  .sc-acties .dd-act, .sc-melding .dd-act { min-height: var(--touch-target-min); }
}
</style>
