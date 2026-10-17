<script setup lang="ts">
// Zijbalk per niveau (6.1, 14). Zwart, 240 px, inklapbaar naar 64 px. Volgorde: Start, Activiteiten,
// Prospects, Rapportages en Planning (uitklapmenu), daarna Manager en Beheer (met Instellingen van de
// organisatie). Onderaan een rij iconen van 22 px op knoppen van 44 px (account, mijn instellingen,
// helpcenter, notificaties, uitloggen) en de gebruikerskaart, zonder menu.
// Wat uit staat, staat nergens in het menu; wat er nog komt, zie je bij Instellingen, Niveaus.
import { NIVEAU_LABEL, ROL_LABEL, type Niveau, type Rol } from '~~/shared/types'
import { nlMoment } from '~~/shared/datum'

const props = defineProps<{ ingeklapt: boolean }>()
const emit = defineEmits<{ inklap: [] }>()

const { me } = useMe()
const { open: zoekenOpen } = useZoeken()
const { online } = useSyncQueue()
const route = useRoute()

// Planning is een uitklapmenu; het gaat vanzelf open als je op een van zijn pagina's staat.
// De cookie heet nog dt_plannen, zodat wie hem open had, hem open houdt.
const UITKLAP = 'Planning'
const plannenOpen = useCookie<boolean>('dt_plannen', { default: () => false, maxAge: 60 * 60 * 24 * 365 })
const groepen = computed(() => zijbalk.value?.groepen ?? [])
const plannenActief = computed(() => !!zijbalk.value?.groepen.find((g) => g.naam === UITKLAP)?.items.some((i) => isActief(i.route)))
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
const foto = computed(() => me.value?.gebruiker.foto ?? null)
const orgLogo = computed(() => me.value?.organisatie?.logo ?? null)
const initialen = computed(() => (me.value?.gebruiker.naam ?? '').replace(/^Test(gebruiker|founder)\s+/, '').split(/\s+/).map((d) => d[0]).slice(0, 2).join('').toUpperCase())
// De datum van vandaag in Nederlandse tijd (nlMoment), ook als de server of het apparaat in UTC draait.
const vandaag = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${nlMoment(new Date()).datum}T12:00:00Z`)).replace('.', '')

function isActief(r: string) {
  return r === '/' ? route.path === '/' : route.path === r || route.path.startsWith(`${r}/`)
}

async function uitloggen() {
  await $fetch('/api/sessie/uitloggen', { method: 'POST' })
  await navigateTo('/login', { external: true })
}
</script>

<template>
  <aside class="app-sidebar" :class="{ 'sb-ingeklapt': props.ingeklapt }" aria-label="Hoofdmenu">
    <div class="sb-merk">
      <NuxtLink class="sb-merk-link" to="/" title="Dealtrace">
        <svg class="sb-merk-icoon" viewBox="0 0 32 32" aria-hidden="true"><circle class="merk-geel" cx="16" cy="16" r="14" /><circle class="merk-inkt" cx="16" cy="16" r="8" /><circle class="merk-geel" cx="16" cy="16" r="3" /></svg>
        <span class="sb-merk-naam">Dealtrace</span>
      </NuxtLink>
      <button class="sb-inklap" type="button" :aria-label="props.ingeklapt ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'" :title="props.ingeklapt ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'" @click="emit('inklap')">
        <Icoon naam="PanelLeft" />
      </button>
    </div>

    <!-- Pakket E: het logo van de organisatie op een licht vlak, alleen in de uitgeklapte zijbalk. -->
    <div v-if="orgLogo && !props.ingeklapt" class="sb-org" data-test="sb-org-logo">
      <img :src="orgLogo" :alt="`Logo van ${me?.organisatie?.naam ?? 'de organisatie'}`" class="sb-org-logo">
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
      <div v-for="g in groepen" :key="g.naam" class="sb-groep" :class="{ 'sb-groep--uitklap': g.naam === UITKLAP }" :data-groep="g.naam">
        <button v-if="g.naam === UITKLAP" type="button" class="sb-groep-kop sb-groep-knop" :aria-expanded="plannenZichtbaar" data-test="sb-planning" @click="plannenOpen = !plannenZichtbaar">
          <span>{{ g.naam }}</span><Icoon naam="ChevronDown" :grootte="14" class="sb-groep-pijl" :class="{ 'sb-groep-pijl--open': plannenZichtbaar }" />
        </button>
        <div v-else class="sb-groep-kop">{{ g.naam }}</div>
        <div class="sb-scheiding" />
        <template v-if="g.naam !== UITKLAP || plannenZichtbaar || props.ingeklapt">
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
    </nav>

    <div class="sb-voet">
      <div class="sb-iconen" data-test="sb-iconen">
        <NuxtLink to="/mij" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/mij') }" title="Account" aria-label="Account" data-test="sb-account"><Icoon naam="CircleUser" :grootte="22" /></NuxtLink>
        <NuxtLink to="/mijn-instellingen" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/mijn-instellingen') }" title="Mijn instellingen" aria-label="Mijn instellingen" data-test="sb-mijn-instellingen"><Icoon naam="Settings" :grootte="22" /></NuxtLink>
        <NuxtLink to="/helpcenter" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/helpcenter') || isActief('/help') }" title="Helpcenter" aria-label="Helpcenter" data-test="sb-helpcenter"><Icoon naam="CircleHelp" :grootte="22" /></NuxtLink>
        <NuxtLink to="/notificaties" class="sb-icoonknop" :class="{ 'sb-icoonknop--actief': isActief('/notificaties') || isActief('/meldingen') }" title="Meldingen" aria-label="Meldingen" data-test="sb-notificaties"><Icoon naam="Bell" :grootte="22" /><span v-if="ongelezen" class="sb-icoon-teller tnum">{{ ongelezen > 9 ? '9+' : ongelezen }}</span></NuxtLink>
        <button type="button" class="sb-icoonknop" title="Uitloggen" aria-label="Uitloggen" data-test="sb-uitloggen" @click="uitloggen"><Icoon naam="LogOut" :grootte="22" /></button>
      </div>
      <div class="sb-gebruiker" data-test="sb-gebruikerskaart">
        <div class="sb-gebruiker-knop sb-gebruiker-kaart">
          <span class="sb-avatar"><img v-if="foto" :src="foto" alt="" class="sb-avatar-foto"><template v-else>{{ initialen }}</template><span v-if="ongelezen" class="sb-avatar-stip" /></span>
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
/* Logo van de organisatie: licht vlak, zodat ook een donker logo leesbaar is; alleen vanaf 1024 px. */
.sb-org { display: flex; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--wit-06); }
.sb-org-logo { display: block; max-width: 100%; max-height: 32px; object-fit: contain; background: var(--wit); border-radius: var(--radius); padding: 4px 6px; }
@media (max-width: 1023px) { .sb-org { display: none; } }
/* Meer lucht boven elke groepstitel, zodat de secties niet op elkaar staan. */
.sb-groep + .sb-groep > .sb-groep-kop { padding-top: 22px; }
.sb-avatar-foto { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
/* Icoonrij onderaan: iconen van 22 px op knoppen van minstens 44 bij 44 px. */
.sb-iconen { gap: 0; padding: 4px 0 8px; }
.sb-icoonknop { width: 44px; min-width: 44px; height: 44px; min-height: 44px; flex: 0 0 44px; }
.sb-icoonknop .sb-icoon-teller { top: 3px; right: 2px; }
.sb-icoonknop :deep(.icoon) { width: 22px; height: 22px; }
/* Ingeklapt (64 px) passen merkteken en inklapknop niet naast elkaar: ze staan dan
   gecentreerd onder elkaar, zodat de knop nooit over het logo valt. Op de icoonstrook
   (768 tot 1023 px) is de inklapknop weg en staat het merkteken in het midden. */
.sb-ingeklapt .sb-merk { flex-direction: column; justify-content: center; gap: 10px; padding: 14px 0 12px; }
.sb-ingeklapt .sb-merk-link { flex: 0 0 auto; justify-content: center; }
.sb-ingeklapt .sb-inklap { width: 32px; height: 32px; }
@media (max-width: 1023px) {
  .sb-merk { justify-content: center; padding-left: 0; padding-right: 0; }
  .sb-merk-link { flex: 0 0 auto; justify-content: center; }
}
/* De gebruikerskaart opent geen menu meer. */
.sb-gebruiker-kaart { cursor: default; }
.sb-gebruiker-kaart:hover { background: transparent; }
</style>
