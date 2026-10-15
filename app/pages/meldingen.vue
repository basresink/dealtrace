<script setup lang="ts">
// Meldingen (F24): rijen met kleurbalk per soort, "Openen", "Markeer gelezen", "Verberg".
// "Gelezen" en "Verberg" lopen via de sync-wachtrij, zodat ze ook offline werken.
const { voegToe } = useSyncQueue()
const ongelezen = useState<number>('ongelezen', () => 0)
const { data: lijst } = await useFetch<any[]>('/api/notificaties', { default: () => [] })

const SOORT: Record<string, { label: string; balk: string; pil: string }> = {
  kritiek: { label: 'Kritiek', balk: 'kritiek', pil: 'pil--rood' },
  hot: { label: 'Hete aanleiding', balk: 'hot', pil: 'pil--paars' },
  dagstart: { label: 'Dagstart', balk: 'dagstart', pil: 'pil--blauw' },
  herinnering: { label: 'Herinnering', balk: 'herinnering', pil: 'pil--geel' },
  inzicht: { label: 'Inzicht', balk: 'inzicht', pil: 'pil--groen' },
  systeem: { label: 'Dealtrace', balk: 'dagstart', pil: 'pil--grijs' },
}
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

function bij() { ongelezen.value = lijst.value.filter((n) => !n.gelezenOp).length }
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
        <LegeStaat v-if="!lijst.length" titel="Geen meldingen." tekst="Nieuwe meldingen verschijnen hier." />
        <ul v-else class="melding-lijst">
          <li v-for="n in lijst" :key="n.id" class="melding" :class="{ 'melding--ongelezen': !n.gelezenOp }" data-test="melding">
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
