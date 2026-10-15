<script setup lang="ts">
// De app-schil (14, 6.1, P27): vanaf 1024 px de zijbalk, van 768 tot 1023 px de icoonstrook,
// kleiner dan 768 px de compacte kop met de onderbalk. Beide staan in de pagina; CSS kiest per
// breedte, zodat er niets verspringt. Schuifvensters sluiten met omlaag vegen en Escape.
const ingeklapt = useCookie<boolean>('dt_ingeklapt', { default: () => false, maxAge: 60 * 60 * 24 * 365 })
const { me } = useMe()
const { toon } = useToast()
const ongelezen = useState<number>('ongelezen', () => 0)
useSchermklasse()

// Het bovenste schuifvenster sluit met Escape of door omlaag te vegen over de kop.
function sluitBovenste() { const k = [...document.querySelectorAll<HTMLElement>('.fo-overlay .fo-sluit')].at(-1); k?.click() }
// Sluit alleen als het venster zelf niet al op Escape reageerde (dan is er een overlay minder).
function toets(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  const voor = document.querySelectorAll('.fo-overlay').length
  if (!voor) return
  setTimeout(() => { if (document.querySelectorAll('.fo-overlay').length === voor) sluitBovenste() }, 60)
}
let vegen: { y: number; t: number } | null = null
function start(e: TouchEvent) { const el = e.target as HTMLElement; vegen = el.closest('.fo-panel .fo-head') ? { y: e.touches[0]!.clientY, t: Date.now() } : null }
function eind(e: TouchEvent) { if (vegen && e.changedTouches[0]!.clientY - vegen.y > 80) sluitBovenste(); vegen = null }

async function telOngelezen() {
  if (!me.value) return
  try {
    const lijst = await $fetch<{ gelezenOp: string | null }[]>('/api/notificaties')
    ongelezen.value = lijst.filter((n) => !n.gelezenOp).length
  } catch { /* offline: teller blijft staan */ }
}

onMounted(async () => {
  window.addEventListener('keydown', toets)
  document.addEventListener('touchstart', start, { passive: true })
  document.addEventListener('touchend', eind, { passive: true })
  useSyncQueue().start()
  useBijlagen().start()
  await telOngelezen()
  // "Leadgenerator staat nu voor je aan." (4.4), één keer per functie.
  const nieuw = me.value?.nogTonen ?? []
  for (const f of nieuw) toon(`${f.naam} staat nu voor je aan.`, 'succes', f.helpartikel ? { tekst: 'Lees hoe het werkt', naar: `/help/${f.helpartikel}` } : undefined)
  if (nieuw.length) await $fetch('/api/mij/gezien', { method: 'POST' })
})
onBeforeUnmount(() => { window.removeEventListener('keydown', toets); document.removeEventListener('touchstart', start); document.removeEventListener('touchend', eind) })
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--ingeklapt': ingeklapt }">
    <Zijbalk :ingeklapt="ingeklapt" @inklap="ingeklapt = !ingeklapt" />
    <MobieleKop />
    <main id="inhoud" class="app-shell-main">
      <WerkInBalk />
      <OfflineStrook />
      <slot />
    </main>
    <NietAangezetFlyout />
    <HulpFlyout />
    <ZoekVenster />
    <AssistentChat />
    <ConflictVenster />
    <ToastStapel />
    <AfrondStrook />
    <HerbevestigVenster />
    <Onderbalk />
    <MeerVenster />
    <InstallVraag />
  </div>
</template>
