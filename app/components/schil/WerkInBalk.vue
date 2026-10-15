<script setup lang="ts">
// Gele balk bovenaan elke pagina zolang de founder in een organisatie werkt (13.3 flow 4):
// "Je werkt in X als founder · alleen meekijken · nog 7 uur 42 · Terug naar platform".
import { resterendTekst } from '~~/shared/werkIn'
const { me } = useMe()
const { metHerbevestiging } = useHerbevestig()
const toast = useToast()
const werkIn = computed(() => me.value?.werkIn)
const geladenOp = Date.now()
const nu = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { nu.value = Date.now() }, 30_000) })
onBeforeUnmount(() => clearInterval(timer))
const resterend = computed(() => {
  if (!werkIn.value) return ''
  const ms = werkIn.value.resterendMs - (nu.value - geladenOp)
  if (ms <= 0 && import.meta.client) window.location.href = '/platform/klanten'
  return resterendTekst(ms)
})
const wisselOpen = ref(false)
const naar = computed(() => (werkIn.value?.modus === 'meekijken' ? 'wijzigen' : 'meekijken'))

async function wissel(reden: string) {
  wisselOpen.value = false
  try {
    await metHerbevestiging<unknown>(() => $fetch<unknown>(String('/api/platform/werk-in/modus'), { method: 'POST', body: { modus: naar.value, reden } }))
    window.location.reload()
  } catch (e) {
    const t = foutTekst(e)
    if (t) toast.toon(t, 'fout')
  }
}
async function terug() {
  await $fetch('/api/platform/werk-in', { method: 'DELETE' })
  window.location.href = '/platform/klanten'
}
</script>

<template>
  <div v-if="werkIn" class="werkin-balk" role="status" data-test="werk-in-balk">
    <p class="werkin-tekst">
      Je werkt in <strong>{{ werkIn.organisatie }}</strong> als founder
      · <span data-test="werk-in-modus">{{ werkIn.modus === 'meekijken' ? 'alleen meekijken' : 'ook wijzigen' }}</span>
      · <span class="tnum">{{ resterend }}</span>
    </p>
    <div class="werkin-acties">
      <button type="button" class="werkin-knop" @click="wisselOpen = true">{{ naar === 'wijzigen' ? 'Ook wijzigen' : 'Alleen meekijken' }}</button>
      <button type="button" class="werkin-knop werkin-knop--terug" data-test="terug-naar-platform" @click="terug">Terug naar platform</button>
    </div>
    <BevestigVenster
      :open="wisselOpen" :titel="naar === 'wijzigen' ? 'Overschakelen naar ook wijzigen' : 'Terug naar alleen meekijken'"
      tekst="Geef opnieuw een reden. De beheerder van de klant krijgt een melding." bevestig="Overschakelen" met-reden
      @geannuleerd="wisselOpen = false" @bevestigd="wissel"
    />
  </div>
</template>
