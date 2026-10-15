<script setup lang="ts">
// Compacte kop op de telefoon (P27, 8.3): paginatitel of terugknop, en rechts Zoeken,
// Inspreken en Meldingen. Geen logo en geen snelle acties.
const route = useRoute()
const router = useRouter()
const { me } = useMe()
const { open: zoekenOpen } = useZoeken()
const ongelezen = useState<number>('ongelezen', () => 0)
const inspreken = ref(false)
const items = computed(() => [...(me.value?.zijbalk.groepen.flatMap((g) => g.items) ?? []), { naam: 'Mijn instellingen', route: '/mij' }, { naam: 'Meldingen', route: '/meldingen' }, { naam: 'Helpcenter', route: '/help' }, { naam: 'Prospects', route: '/accounts' }])
const item = computed(() => {
  const p = route.path
  return items.value.filter((i) => (i.route === '/' ? p === '/' : p === i.route || p.startsWith(`${i.route}/`))).sort((a, b) => b.route.length - a.route.length)[0]
})
const sub = computed(() => !!item.value && route.path !== item.value.route && item.value.route !== '/')
const titel = computed(() => (item.value?.route === '/accounts' ? 'Prospects' : item.value?.naam) ?? 'Dealtrace')
function terug() { if (window.history.length > 1) router.back(); else navigateTo(item.value?.route === '/accounts' ? '/prospects' : item.value!.route) }
const teller = computed(() => (ongelezen.value > 9 ? '9+' : String(ongelezen.value)))
</script>

<template>
  <header class="mobiele-kop" data-test="mobiele-kop">
    <button v-if="sub" type="button" class="mk-terug" data-test="mk-terug" @click="terug"><Icoon naam="ArrowLeft" :grootte="20" /><span>{{ titel }}</span></button>
    <h1 v-else class="mk-titel">{{ titel }}</h1>
    <div class="mk-knoppen">
      <button type="button" class="mk-knop" aria-label="Zoeken" data-test="mk-zoeken" @click="zoekenOpen = true"><Icoon naam="Search" :grootte="22" /></button>
      <button type="button" class="mk-knop" aria-label="Inspreken" data-test="mk-inspreken" @click="inspreken = true"><Icoon naam="Mic" :grootte="22" /></button>
      <NuxtLink to="/meldingen" class="mk-knop" aria-label="Meldingen" data-test="mk-meldingen"><Icoon naam="Bell" :grootte="22" /><span v-if="ongelezen" class="mk-teller">{{ teller }}</span></NuxtLink>
    </div>
    <Teleport to="body">
      <div v-if="inspreken" class="fo-overlay" @click.self="inspreken = false">
        <section class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-label="Inspreken">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Inspreken</span><h2 class="fo-titel">Zeg wat er moet gebeuren</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="inspreken = false"><Icoon naam="X" /></button></header>
          <div class="fo-body"><p class="tekst">Inspreken komt in een volgende versie.</p></div>
          <footer class="fo-foot dd-acties"><span class="dd-acties-vul" /><button type="button" class="dd-act" @click="inspreken = false">Sluiten</button></footer>
        </section>
      </div>
    </Teleport>
  </header>
</template>
