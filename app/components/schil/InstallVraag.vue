<script setup lang="ts">
// Installatievraag (P27, 8.14): vanaf de tweede dag van gebruik, op Android met de knop
// "Installeren", op iPhone met uitleg (Deel, Zet op beginscherm). Na installatie vraagt
// Dealtrace de browser om de opslag te bewaren.
const zichtbaar = ref(false)
const ios = ref(false)
let prompt: any = null
onMounted(() => {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) return
    if (localStorage.getItem('dt_install_weg') === '1') return
    const dagen = JSON.parse(localStorage.getItem('dt_dagen') ?? '[]') as string[]
    if (dagen.length < 2) return
    ios.value = /iPhone|iPad/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent)
    if (ios.value && window.innerWidth < 768) zichtbaar.value = true
  } catch { /* privémodus */ }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; if (window.innerWidth < 768) zichtbaar.value = true })
  window.addEventListener('appinstalled', () => { zichtbaar.value = false; navigator.storage?.persist?.() })
})
async function installeer() { if (!prompt) return; prompt.prompt(); await prompt.userChoice; zichtbaar.value = false }
function weg() { zichtbaar.value = false; try { localStorage.setItem('dt_install_weg', '1') } catch { /* */ } }
</script>

<template>
  <div v-if="zichtbaar" class="kaart install-vraag" role="dialog" aria-label="Dealtrace installeren" data-test="install-vraag">
    <p><strong>Zet Dealtrace op je beginscherm.</strong></p>
    <p v-if="ios" class="tekst mt-8">Tik onderin op Deel en kies "Zet op beginscherm".</p>
    <div class="dd-acties mt-8">
      <button v-if="!ios" type="button" class="dd-act dd-act--primair" @click="installeer">Installeren</button>
      <button type="button" class="dd-act" @click="weg">Niet nu</button>
    </div>
  </div>
</template>
