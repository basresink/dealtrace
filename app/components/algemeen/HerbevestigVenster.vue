<script setup lang="ts">
// Herbevestigen met de code uit je authenticator (TOTP komt met P27; in de
// ontwikkelmodus geldt elke code van 6 cijfers).
const { open, sluit } = useHerbevestig()
const code = ref('')
const fout = ref('')
const bezig = ref(false)
const ontwikkel = useRuntimeConfig().public.authModus === 'ontwikkel'
watch(open, (o) => { if (o) { code.value = ''; fout.value = '' } })

async function bevestig() {
  bezig.value = true
  fout.value = ''
  try {
    await $fetch('/api/sessie/herbevestig', { method: 'POST', body: { code: code.value } })
    sluit(true)
  } catch (e: any) {
    fout.value = foutTekst(e, 'Bevestigen mislukt')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cd-overlay" @click.self="sluit(false)">
      <form class="cd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="hb-titel" data-test="herbevestig" @submit.prevent="bevestig">
        <div class="cd-head"><h2 id="hb-titel" class="cd-title">Bevestig dat jij het bent</h2></div>
        <p class="cd-message">Dit is een gevoelige actie. Vul de code van 6 cijfers uit je authenticator in.</p>
        <label class="veld">
          <span class="veld-label">Code</span>
          <input v-model="code" class="invoer" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\d{6}" required autofocus data-test="herbevestig-code">
          <span v-if="ontwikkel" class="veld-uitleg">Ontwikkelmodus: elke 6 cijfers zijn goed.</span>
          <span v-if="fout" class="veld-fout" role="alert">{{ fout }}</span>
        </label>
        <div class="cd-foot">
          <button type="button" class="cd-btn cd-btn--ghost" @click="sluit(false)">Annuleren</button>
          <button type="submit" class="cd-btn cd-btn--primary" :disabled="bezig || code.length !== 6">Bevestigen</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
