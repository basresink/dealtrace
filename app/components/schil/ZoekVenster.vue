<script setup lang="ts">
// Globale zoek (6.3): toets / of Ctrl K. Groepen per soort, pijltjes, Enter,
// Escape; functies die niet aanstaan, komen er niet in (de server laat ze weg). Onder de eigen resultaten de groep
// "KvK-register" (8.6, KvK opzoeken vanaf Gevorderd): toevoegen met één tik, ontdubbeld.
const { open } = useZoeken()
const { magNaar } = useFunctie()
const q = ref('')
const groepen = ref<{ soort: string; label: string; rijen: { titel: string; detail?: string; link: string; slot?: boolean; label?: string }[]; totaal: number }[]>([])
const actief = ref(0)
const invoer = ref<HTMLInputElement>()

const rijen = computed(() => groepen.value.flatMap((g) => g.rijen))

const { functie } = useMe()
const toast = useToast()
const kvkAan = computed(() => !!functie('onderweg.kvkOpzoeken')?.beschikbaar)
const kvk = reactive({ gekoppeld: false, bezig: false, resultaten: [] as any[], fout: '' })
let kvkTimer: ReturnType<typeof setTimeout> | undefined
watch(q, (w) => {
  if (kvkTimer) clearTimeout(kvkTimer)
  kvk.resultaten = []; kvk.fout = ''
  if (!kvkAan.value || !kvk.gekoppeld || w.trim().length < 3) return
  if (!navigator.onLine) { kvk.fout = 'KvK zoeken kan alleen met verbinding'; return }
  kvkTimer = setTimeout(async () => {
    kvk.bezig = true
    try { kvk.resultaten = (await $fetch<any>('/api/kvk/zoek', { method: 'POST', body: { naam: w.trim() } })).resultaten.slice(0, 8) } catch (e) { kvk.fout = foutTekst(e) } finally { kvk.bezig = false }
  }, 500)
})
async function voegToe(r: any) {
  try {
    const res = await $fetch<any>(`/api/kvk/${r.kvk}/toevoegen`, { method: 'POST', body: {} })
    open.value = false
    toast.toon(res.tekst ?? `${r.naam} staat erbij.`)
    await navigateTo(`/accounts/${res.id}`)
  } catch (e: any) {
    if (e?.statusCode === 409 && e?.data?.data?.accountId) { open.value = false; return navigateTo(`/accounts/${e.data.data.accountId}`) }
    toast.toon(foutTekst(e), 'fout')
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(q, (w) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    // De server laat uitgezette functies al weg; de client filtert voor de zekerheid op hetzelfde register.
    groepen.value = w.trim() ? ((await $fetch<any>('/api/zoeken', { query: { q: w } })).groepen as typeof groepen.value).map((g) => ({ ...g, rijen: g.rijen.filter((r) => !r.slot && magNaar(r.link)) })).filter((g) => g.rijen.length) : []
    actief.value = 0
  }, 150)
})
watch(open, async (o) => {
  if (o) {
    q.value = ''; groepen.value = []; await nextTick(); invoer.value?.focus()
    if (kvkAan.value) kvk.gekoppeld = (await $fetch<any>('/api/kvk/status').catch(() => ({ gekoppeld: false }))).gekoppeld
  }
})

function kies(r: { link: string }) {
  open.value = false
  return navigateTo(r.link)
}

function toets(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); actief.value = Math.min(actief.value + 1, rijen.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); actief.value = Math.max(actief.value - 1, 0) }
  else if (e.key === 'Enter' && rijen.value[actief.value]) kies(rijen.value[actief.value]!)
  else if (e.key === 'Escape') open.value = false
}

function globaal(e: KeyboardEvent) {
  const doel = e.target as HTMLElement
  const typt = doel?.tagName === 'INPUT' || doel?.tagName === 'TEXTAREA' || doel?.isContentEditable
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typt)) { e.preventDefault(); open.value = true }
}
onMounted(() => window.addEventListener('keydown', globaal))
onBeforeUnmount(() => window.removeEventListener('keydown', globaal))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="zoek-overlay" @click.self="open = false">
      <div class="zoek-paneel" role="dialog" aria-modal="true" aria-label="Zoeken in Dealtrace">
        <div class="zoek-veld">
          <Icoon naam="Search" class="zoek-veld-icoon" />
          <input ref="invoer" v-model="q" class="zoek-invoer" type="text" enterkeyhint="search" placeholder="Zoek in Dealtrace" aria-label="Zoeken" @keydown="toets">
          <button type="button" class="zoek-sluit" aria-label="Sluiten" @click="open = false"><Icoon naam="X" /></button>
        </div>
        <div class="zoek-lijst" role="listbox">
          <p v-if="q.trim() && !rijen.length && !kvk.resultaten.length" class="zoek-hint">Niets gevonden voor "{{ q }}".</p>
          <section v-for="g in groepen" :key="g.soort" class="zoek-groep">
            <header class="zoek-groep-kop"><span class="zoek-groep-label">{{ g.label }}</span><span class="zoek-groep-telling">{{ g.totaal }}</span></header>
            <button
              v-for="r in g.rijen" :key="r.link + r.titel" type="button" role="option" class="zoek-rij"
              :class="{ 'zoek-rij--actief': rijen.indexOf(r) === actief }" :aria-selected="rijen.indexOf(r) === actief" @click="kies(r)"
            >
              <span class="zoek-rij-titel">{{ r.titel }} <span v-if="r.label" class="pil pil--grijs zoek-rij-label" data-test="zoek-label">{{ r.label }}</span></span>
              <span v-if="r.detail" class="zoek-rij-detail">{{ r.detail }}</span>
            </button>
          </section>
          <section v-if="kvkAan && kvk.gekoppeld && q.trim().length >= 3" class="zoek-groep kvk-groep" data-test="kvk-register">
            <header class="zoek-groep-kop"><span class="zoek-groep-label">KvK-register</span><span class="zoek-groep-telling">{{ kvk.resultaten.length }}</span></header>
            <p v-if="kvk.fout" class="zoek-hint">{{ kvk.fout }}</p>
            <p v-else-if="kvk.bezig" class="zoek-hint">Zoeken in KvK…</p>
            <div v-for="r in kvk.resultaten" :key="r.kvk" class="zoek-rij" :data-kvk="r.kvk">
              <span class="zoek-rij-titel">{{ r.naam }}</span>
              <span class="zoek-rij-detail">{{ r.plaats }} · KvK {{ r.kvk }}<template v-if="r.alBekend"> · Al in je bestand</template></span>
              <NuxtLink v-if="r.alBekend" class="dd-act" :to="`/accounts/${r.alBekend.accountId}`" @click="open = false">Open kaart</NuxtLink>
              <button v-else type="button" class="dd-act dd-act--primair" data-test="kvk-voeg-toe" @click="voegToe(r)">Voeg toe</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 0064: tag naast een gedeactiveerde prospect. */
.zoek-rij-label { margin-left: 8px; vertical-align: middle; }
</style>
