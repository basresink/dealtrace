<script setup lang="ts">
// Zijbalk per niveau (6.1, 14). Zwart, 240 px, inklapbaar naar 64 px.
// Wat voor het niveau uit staat, staat in de ingeklapte groep "Nog niet aangezet".
import { NIVEAU_LABEL, ROL_LABEL, type Niveau, type Rol } from '~~/shared/types'

const props = defineProps<{ ingeklapt: boolean }>()
const emit = defineEmits<{ inklap: [] }>()

const { me } = useMe()
const { toon: toonNietAangezet } = useNietAangezet()
const { open: zoekenOpen } = useZoeken()
const { online } = useSyncQueue()
const route = useRoute()

const slotOpen = useCookie<boolean>('dt_slotgroep', { default: () => false, maxAge: 60 * 60 * 24 * 365 })
const menuOpen = ref(false)
const ongelezen = useState<number>('ongelezen', () => 0)
const concepten = useState<number>('conceptenTeller', () => 0)
const conceptenAan = computed(() => !!me.value?.functies?.find((f: any) => f.sleutel === 'concepten.inbox')?.beschikbaar)

const zijbalk = computed(() => me.value?.zijbalk)
const gebruikerRol = computed(() => {
  const g = me.value?.gebruiker
  if (!g) return ''
  const rol = ROL_LABEL[g.rol as Rol]?.toUpperCase() ?? ''
  return g.rol === 'founder' ? rol : `${rol} · ${NIVEAU_LABEL[g.niveau as Niveau].toUpperCase()}`
})
const initialen = computed(() => (me.value?.gebruiker.naam ?? '').replace(/^Test(gebruiker|founder)\s+/, '').split(/\s+/).map((d) => d[0]).slice(0, 2).join('').toUpperCase())
const vandaag = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date()).replace('.', '')

function isActief(r: string) {
  return r === '/' ? route.path === '/' : route.path === r || route.path.startsWith(`${r}/`)
}

async function uitloggen() {
  await $fetch('/api/sessie/uitloggen', { method: 'POST' })
  await navigateTo('/login', { external: true })
}
</script>

<template>
  <aside class="app-sidebar" aria-label="Hoofdmenu">
    <div class="sb-merk">
      <NuxtLink class="sb-merk-link" to="/" title="Dealtrace">
        <svg class="sb-merk-icoon" viewBox="0 0 32 32" aria-hidden="true"><circle class="merk-geel" cx="16" cy="16" r="14" /><circle class="merk-inkt" cx="16" cy="16" r="8" /><circle class="merk-geel" cx="16" cy="16" r="3" /></svg>
        <span class="sb-merk-naam">Dealtrace</span>
      </NuxtLink>
      <button class="sb-inklap" type="button" :aria-label="props.ingeklapt ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'" :title="props.ingeklapt ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'" @click="emit('inklap')">
        <Icoon naam="PanelLeft" />
      </button>
    </div>

    <div class="sb-meta">
      <span class="sb-live" :class="{ 'sb-live--offline': !online }"><span class="sb-live-stip" /><span class="sb-live-tekst">{{ online ? 'LIVE' : 'OFFLINE' }}</span></span>
      <span class="sb-datum tnum">{{ vandaag }}</span>
    </div>

    <div class="sb-zoek-vak">
      <button class="sb-zoek" type="button" aria-label="Zoeken" @click="zoekenOpen = true">
        <Icoon naam="Search" class="sb-link-icoon" /><span class="sb-zoek-tekst">Zoeken</span><kbd class="sb-kbd">Ctrl K</kbd>
      </button>
    </div>

    <nav v-if="zijbalk" class="sb-nav" aria-label="Hoofdnavigatie">
      <div v-for="g in zijbalk.groepen" :key="g.naam" class="sb-groep">
        <div class="sb-groep-kop">{{ g.naam }}</div>
        <div class="sb-scheiding" />
        <NuxtLink
          v-for="item in g.items" :key="item.sleutel" class="sb-link" :class="{ 'sb-link--actief': isActief(item.route) }"
          :to="item.route" :title="item.naam" :aria-current="isActief(item.route) ? 'page' : undefined" :data-sleutel="item.sleutel"
        >
          <Icoon :naam="item.icoon" class="sb-link-icoon" />
          <span class="sb-link-tekst">{{ item.naam }}</span>
          <span v-if="item.label" class="sb-link-pil">{{ item.label }}</span>
          <span v-else-if="me?.nieuw.includes(item.sleutel)" class="sb-link-pil">nieuw</span>
        </NuxtLink>
      </div>

      <div v-if="zijbalk.nietAangezet.length" class="sb-groep sb-slotgroep" :class="{ 'sb-slotgroep--open': slotOpen }" data-groep="niet-aangezet">
        <button type="button" class="sb-slotgroep-kop" :aria-expanded="slotOpen" @click="slotOpen = !slotOpen">
          <span class="sb-slotgroep-tekst">Nog niet aangezet</span>
          <span class="sb-slotgroep-teller">{{ zijbalk.nietAangezet.length }}</span>
          <Icoon naam="ChevronDown" :grootte="14" class="icoon--14 sb-slotgroep-pijl" />
        </button>
        <div v-show="slotOpen" class="sb-slotgroep-lijst">
          <a
            v-for="item in zijbalk.nietAangezet" :key="item.sleutel" class="sb-link sb-link--slot" :href="item.route"
            aria-disabled="true" :title="item.naam" :data-sleutel="item.sleutel" @click.prevent="toonNietAangezet(item.sleutel)"
          >
            <Icoon :naam="item.icoon" class="sb-link-icoon" />
            <span class="sb-link-tekst">{{ item.naam }}</span>
            <Icoon naam="Lock" :grootte="14" class="sb-slot-icoon" />
          </a>
        </div>
      </div>
    </nav>

    <div class="sb-voet">
      <NuxtLink class="sb-bel" :class="{ 'sb-bel--actief': isActief('/meldingen') }" to="/meldingen">
        <span class="sb-bel-icoon"><Icoon naam="Bell" /><span v-if="ongelezen" class="sb-bel-teller tnum">{{ ongelezen > 9 ? '9+' : ongelezen }}</span></span>
        <span class="sb-bel-tekst">Meldingen</span>
      </NuxtLink>
      <NuxtLink v-if="conceptenAan" class="sb-bel" :class="{ 'sb-bel--actief': isActief('/concepten') }" to="/concepten" data-test="sb-concepten">
        <span class="sb-bel-icoon"><Icoon naam="Inbox" /><span v-if="concepten" class="sb-bel-teller tnum">{{ concepten > 9 ? '9+' : concepten }}</span></span>
        <span class="sb-bel-tekst">Concepten</span>
      </NuxtLink>
      <NuxtLink class="sb-bel" :class="{ 'sb-bel--actief': isActief('/help') }" to="/help">
        <span class="sb-bel-icoon"><Icoon naam="CircleHelp" /></span><span class="sb-bel-tekst">Helpcenter</span>
      </NuxtLink>
      <div class="sb-gebruiker" :class="{ 'sb-gebruiker--open': menuOpen }">
        <button class="sb-gebruiker-knop" type="button" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
          <span class="sb-avatar">{{ initialen }}</span>
          <span class="sb-gebruiker-info">
            <span class="sb-gebruiker-naam">{{ me?.gebruiker.naam }}</span>
            <span class="sb-gebruiker-rol" data-test="gebruikersblok">{{ gebruikerRol }}</span>
          </span>
          <Icoon naam="ChevronDown" class="sb-gebruiker-pijl" />
        </button>
        <div v-show="menuOpen" class="sb-gebruiker-menu" role="menu">
          <NuxtLink role="menuitem" to="/mij" @click="menuOpen = false"><Icoon naam="UserCog" />Mijn instellingen</NuxtLink>
          <NuxtLink role="menuitem" to="/roadmap" @click="menuOpen = false"><Icoon naam="Route" />Roadmap</NuxtLink>
          <button role="menuitem" type="button" @click="uitloggen"><Icoon naam="LogOut" />Uitloggen</button>
        </div>
      </div>
    </div>
  </aside>
</template>
