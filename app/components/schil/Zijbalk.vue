<script setup lang="ts">
// Zijbalk per niveau (6.1, 14). Zwart, 240 px, inklapbaar naar 64 px. Volgorde: Start, Activiteiten,
// Prospects, Rapportages en Plannen (uitklapmenu). Onderaan een rij iconen van 22 px op knoppen van 44 px
// (mijn instellingen, instellingen, helpcenter, meldingen, uitloggen) en de gebruikerskaart, zonder menu.
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
// Plannen is een uitklapmenu; het gaat vanzelf open als je op een van zijn pagina's staat.
const plannenOpen = useCookie<boolean>('dt_plannen', { default: () => false, maxAge: 60 * 60 * 24 * 365 })
// Instellingen staat in de icoonrij onderaan, niet in de lijst.
const ICOONRIJ = new Set(['nav.instellingen'])
const groepen = computed(() => (zijbalk.value?.groepen ?? []).map((g) => ({ ...g, items: g.items.filter((i) => !ICOONRIJ.has(i.sleutel)) })).filter((g) => g.items.length))
const instellingenAan = computed(() => !!zijbalk.value?.groepen.some((g) => g.items.some((i) => i.sleutel === 'nav.instellingen')))
const plannenActief = computed(() => !!zijbalk.value?.groepen.find((g) => g.naam === 'Plannen')?.items.some((i) => isActief(i.route)))
const plannenZichtbaar = computed(() => plannenOpen.value || plannenActief.value)
const ongelezen = useState<number>('ongelezen', () => 0)
const concepten = useState<number>('conceptenTeller', () => 0)

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
      <div v-for="g in groepen" :key="g.naam" class="sb-groep" :class="{ 'sb-groep--uitklap': g.naam === 'Plannen' }" :data-groep="g.naam">
        <button v-if="g.naam === 'Plannen'" type="button" class="sb-groep-kop sb-groep-knop" :aria-expanded="plannenZichtbaar" data-test="sb-plannen" @click="plannenOpen = !plannenZichtbaar">
          <span>{{ g.naam }}</span><Icoon naam="ChevronDown" :grootte="14" class="sb-groep-pijl" :class="{ 'sb-groep-pijl--open': plannenZichtbaar }" />
        </button>
        <div v-else class="sb-groep-kop">{{ g.naam }}</div>
        <div class="sb-scheiding" />
        <template v-if="g.naam !== 'Plannen' || plannenZichtbaar || props.ingeklapt">
          <NuxtLink
            v-for="item in g.items" :key="item.sleutel" class="sb-link" :class="{ 'sb-link--actief': isActief(item.route) }"
            :to="item.route" :title="item.naam" :aria-current="isActief(item.route) ? 'page' : undefined" :data-sleutel="item.sleutel"
          >
            <Icoon :naam="item.icoon" class="sb-link-icoon" />
            <span class="sb-link-tekst">{{ item.naam }}</span>
            <span v-if="item.sleutel === 'nav.concepten' && concepten" class="sb-link-teller tnum" data-test="sb-concepten">{{ concepten > 9 ? '9+' : concepten }}</span>
            <span v-else-if="item.label" class="sb-link-pil">{{ item.label }}</span>
            <span v-else-if="me?.nieuw.includes(item.sleutel)" class="sb-link-pil">nieuw</span>
          </NuxtLink>
        </template>
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
      <div class="sb-iconen" data-test="sb-iconen">
        <NuxtLink to="/mij" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/mij') }" title="Mijn instellingen" aria-label="Mijn instellingen"><Icoon naam="CircleUser" :grootte="22" /></NuxtLink>
        <NuxtLink v-if="instellingenAan" to="/instellingen" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/instellingen') }" title="Instellingen" aria-label="Instellingen" data-sleutel="nav.instellingen"><Icoon naam="Settings" :grootte="22" /></NuxtLink>
        <NuxtLink to="/help" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/help') }" title="Helpcenter" aria-label="Helpcenter"><Icoon naam="CircleHelp" :grootte="22" /></NuxtLink>
        <NuxtLink to="/meldingen" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/meldingen') }" title="Meldingen" aria-label="Meldingen"><Icoon naam="Bell" :grootte="22" /><span v-if="ongelezen" class="sb-icoon-teller tnum">{{ ongelezen > 9 ? '9+' : ongelezen }}</span></NuxtLink>
        <button type="button" class="sb-icoonknop" title="Uitloggen" aria-label="Uitloggen" @click="uitloggen"><Icoon naam="LogOut" :grootte="22" /></button>
      </div>
      <div class="sb-gebruiker" data-test="sb-gebruikerskaart">
        <div class="sb-gebruiker-knop sb-gebruiker-kaart">
          <span class="sb-avatar">{{ initialen }}<span v-if="ongelezen" class="sb-avatar-stip" /></span>
          <span class="sb-gebruiker-info">
            <span class="sb-gebruiker-naam">{{ me?.gebruiker.naam }}</span>
            <span class="sb-gebruiker-rol" data-test="gebruikersblok">{{ gebruikerRol }}</span>
          </span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Icoonrij onderaan: iconen van 22 px op knoppen van minstens 44 bij 44 px. */
.sb-iconen { gap: 0; padding: 4px 0 8px; }
.sb-icoonknop { width: 44px; min-width: 44px; height: 44px; min-height: 44px; flex: 0 0 44px; }
.sb-icoonknop .sb-icoon-teller { top: 3px; right: 2px; }
.sb-icoonknop :deep(.icoon) { width: 22px; height: 22px; }
/* De gebruikerskaart opent geen menu meer. */
.sb-gebruiker-kaart { cursor: default; }
.sb-gebruiker-kaart:hover { background: transparent; }
</style>
