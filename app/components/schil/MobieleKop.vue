<script setup lang="ts">
// Compacte kop op de telefoon (P27, 8.3): paginatitel of terugknop, en rechts Zoeken,
// Inspreken en Meldingen. Geen logo en geen snelle acties. Inspreken opent het spraakvenster (P31).
const route = useRoute()
const router = useRouter()
const { me, functie } = useMe()
const { open: zoekenOpen } = useZoeken()
const ongelezen = useState<number>('ongelezen', () => 0)
const inspreken = useState('spraak-open', () => false)
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
const { openen: openAi } = useAssistent()
const items = computed(() => [...(me.value?.zijbalk.groepen.flatMap((g) => g.items) ?? []), { naam: 'Account', route: '/mij' }, { naam: 'Mijn instellingen', route: '/mijn-instellingen' }, { naam: 'Meldingen', route: '/notificaties' }, { naam: 'Meldingen', route: '/meldingen' }, { naam: 'Helpcenter', route: '/helpcenter' }, { naam: 'Helpcenter', route: '/help' }, { naam: 'Prospects', route: '/accounts' }])
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
      <button v-if="aiAan" type="button" class="mk-knop" aria-label="Vraag AI" data-test="mk-ai" @click="openAi()"><Icoon naam="Sparkles" :grootte="22" /></button>
      <button type="button" class="mk-knop" aria-label="Inspreken" data-test="mk-inspreken" @click="inspreken = true"><Icoon naam="Mic" :grootte="22" /></button>
      <NuxtLink to="/notificaties" class="mk-knop" aria-label="Meldingen" data-test="mk-meldingen"><Icoon naam="Bell" :grootte="22" /><span v-if="ongelezen" class="mk-teller">{{ teller }}</span></NuxtLink>
    </div>
  </header>
</template>
