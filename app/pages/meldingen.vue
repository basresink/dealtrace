<script setup lang="ts">
// Meldingen (F24, P26): rijen met kleurbalk per soort, "Openen", "Markeer gelezen", "Verberg"; filter op
// soort en "Ongelezen" (standaard aan, in de URL); "Alles gelezen". "Gelezen" staat op de server en geldt
// dus op al je toestellen; "Gelezen" en "Verberg" lopen via de sync-wachtrij, zodat ze ook offline werken.
// Op de telefoon is vegen naar links "Markeer gelezen".
import { MELDING_SOORTEN, MELDING_SOORT_LABEL } from '~~/shared/kanalen'
const { voegToe } = useSyncQueue()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const ongelezen = useState<number>('ongelezen', () => 0)
const filter = computed(() => ({ soort: (route.query.soort as string) || undefined, ongelezen: route.query.alle === '1' ? undefined : '1' }))
const { data: lijst, refresh } = await useFetch<any[]>('/api/notificaties', { query: filter, default: () => [] })
const zet = (k: string, v: string | undefined) => router.replace({ query: { ...route.query, [k]: v } })
async function allesGelezen() {
  try { await $fetch('/api/notificaties/alles-gelezen', { method: 'POST' }); ongelezen.value = 0; await refresh(); toast.toon('Alles gelezen.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Vegen naar links op de telefoon: markeer gelezen.
const veeg = new Map<string, number>()
const veegStart = (n: any, e: TouchEvent) => veeg.set(n.id, e.touches[0]!.clientX)
function veegEind(n: any, e: TouchEvent) {
  const x = veeg.get(n.id); veeg.delete(n.id)
  if (x != null && x - e.changedTouches[0]!.clientX > 60 && !n.gelezenOp) gelezen(n)
}

const SOORT: Record<string, { label: string; balk: string; pil: string }> = {
  kritiek: { label: 'Kritiek', balk: 'kritiek', pil: 'pil--rood' },
  hot: { label: 'Hete aanleiding', balk: 'hot', pil: 'pil--paars' },
  dagstart: { label: 'Dagstart', balk: 'dagstart', pil: 'pil--blauw' },
  herinnering: { label: 'Herinnering', balk: 'herinnering', pil: 'pil--geel' },
  inzicht: { label: 'Inzicht', balk: 'inzicht', pil: 'pil--groen' },
  systeem: { label: 'Dealtrace', balk: 'dagstart', pil: 'pil--grijs' },
}
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

function bij() { if (filter.value.ongelezen && !filter.value.soort) ongelezen.value = lijst.value.filter((n) => !n.gelezenOp).length }
async function gelezen(n: any) {
  n.gelezenOp = new Date().toISOString()
  bij()
  await voegToe({ tabel: 'notificaties', op: 'patch', recordId: n.id, patch: { gelezenOp: n.gelezenOp } })
}
async function verberg(n: any) {
  lijst.value = lijst.value.filter((x) => x.id !== n.id)
  bij()
  await voegToe({ tabel: 'notificaties', op: 'patch', recordId: n.id, patch: { verborgenOp: new Date().toISOString() } })
}
async function open(n: any) {
  if (!n.gelezenOp) await gelezen(n)
  if (n.link) await navigateTo(n.link)
}
useHead({ title: 'Meldingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Meldingen" titel="Meldingen" uitleg="Herinneringen, aanleidingen en wat er voor je klaarstaat." helpartikel="meldingen-instellen" />
    <section class="section section--laatste">
      <div class="container">
        <div class="chips mb-16" data-test="melding-filters">
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.ongelezen }" data-test="filter-ongelezen" @click="zet('alle', filter.ongelezen ? '1' : undefined)">Ongelezen</button>
          <button v-for="s in MELDING_SOORTEN" :key="s" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.soort === s }" @click="zet('soort', filter.soort === s ? undefined : s)">{{ MELDING_SOORT_LABEL[s] }}</button>
          <button v-if="ongelezen" type="button" class="dd-act ml-auto" data-test="alles-gelezen" @click="allesGelezen">Alles gelezen</button>
        </div>
        <LegeStaat v-if="!lijst.length" titel="Geen meldingen." tekst="Je hoort het hier zodra er iets voor je klaarstaat." />
        <ul v-else class="melding-lijst">
          <li v-for="n in lijst" :key="n.id" class="melding" :class="{ 'melding--ongelezen': !n.gelezenOp }" data-test="melding" @touchstart.passive="veegStart(n, $event)" @touchend="veegEind(n, $event)">
            <span class="melding-balk" :class="`melding-balk--${SOORT[n.soort]?.balk ?? 'dagstart'}`" />
            <div class="melding-body">
              <div class="melding-meta">
                <span class="pil" :class="SOORT[n.soort]?.pil">{{ SOORT[n.soort]?.label ?? n.soort }}</span>
                <span class="melding-tijd">{{ tijd(n.op) }}</span>
                <span v-if="!n.gelezenOp" class="melding-stip" aria-label="Ongelezen" />
              </div>
              <h3 class="melding-titel">{{ n.titel }}</h3>
              <p v-if="n.tekst" class="melding-tekst">{{ n.tekst }}</p>
            </div>
            <div class="melding-acties dd-acties">
              <button type="button" class="dd-act dd-act--primair" @click="open(n)">Openen</button>
              <button v-if="!n.gelezenOp" type="button" class="dd-act" @click="gelezen(n)">Markeer gelezen</button>
              <button type="button" class="dd-act" @click="verberg(n)">Verberg</button>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
