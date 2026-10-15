<script setup lang="ts">
// De app-schil voor laptop en tablet (14, 6.1). De telefoonschil met onderbalk is P27.
const ingeklapt = useCookie<boolean>('dt_ingeklapt', { default: () => false, maxAge: 60 * 60 * 24 * 365 })
const { me } = useMe()
const { toon } = useToast()
const ongelezen = useState<number>('ongelezen', () => 0)

async function telOngelezen() {
  if (!me.value?.organisatie) return
  try {
    const lijst = await $fetch<{ gelezenOp: string | null }[]>('/api/notificaties')
    ongelezen.value = lijst.filter((n) => !n.gelezenOp).length
  } catch { /* offline: teller blijft staan */ }
}

onMounted(async () => {
  useSyncQueue().start()
  await telOngelezen()
  // "Leadgenerator staat nu voor je aan." (4.4), één keer per functie.
  const nieuw = me.value?.nogTonen ?? []
  for (const f of nieuw) toon(`${f.naam} staat nu voor je aan.`, 'succes', f.helpartikel ? { tekst: 'Lees hoe het werkt', naar: `/help/${f.helpartikel}` } : undefined)
  if (nieuw.length) await $fetch('/api/mij/gezien', { method: 'POST' })
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--ingeklapt': ingeklapt }">
    <Zijbalk :ingeklapt="ingeklapt" @inklap="ingeklapt = !ingeklapt" />
    <main id="inhoud" class="app-shell-main">
      <OfflineStrook />
      <slot />
    </main>
    <NietAangezetFlyout />
    <ZoekVenster />
    <ConflictVenster />
    <ToastStapel />
  </div>
</template>
