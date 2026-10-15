<script setup lang="ts">
// Globale zoek (6.3): toets / of Ctrl K. Groepen per soort, pijltjes, Enter,
// Escape; functies die niet aanstaan met slot.
const { open } = useZoeken()
const { toon: toonNietAangezet } = useNietAangezet()
const q = ref('')
const groepen = ref<{ soort: string; label: string; rijen: { titel: string; detail?: string; link: string; slot?: boolean }[]; totaal: number }[]>([])
const actief = ref(0)
const invoer = ref<HTMLInputElement>()

const rijen = computed(() => groepen.value.flatMap((g) => g.rijen))

let timer: ReturnType<typeof setTimeout> | undefined
watch(q, (w) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    groepen.value = w.trim() ? (await $fetch<any>('/api/zoeken', { query: { q: w } })).groepen : []
    actief.value = 0
  }, 150)
})
watch(open, async (o) => {
  if (o) { q.value = ''; groepen.value = []; await nextTick(); invoer.value?.focus() }
})

function kies(r: { link: string; slot?: boolean }) {
  open.value = false
  if (r.slot) {
    const sleutel = useMe().me.value?.zijbalk.nietAangezet.find((i) => i.route === r.link)?.sleutel
    if (sleutel) return toonNietAangezet(sleutel)
  }
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
          <p v-if="q.trim() && !rijen.length" class="zoek-hint">Niets gevonden voor "{{ q }}".</p>
          <section v-for="g in groepen" :key="g.soort" class="zoek-groep">
            <header class="zoek-groep-kop"><span class="zoek-groep-label">{{ g.label }}</span><span class="zoek-groep-telling">{{ g.totaal }}</span></header>
            <button
              v-for="r in g.rijen" :key="r.link + r.titel" type="button" role="option" class="zoek-rij"
              :class="{ 'zoek-rij--actief': rijen.indexOf(r) === actief }" :aria-selected="rijen.indexOf(r) === actief" @click="kies(r)"
            >
              <span class="zoek-rij-titel">{{ r.titel }} <Icoon v-if="r.slot" naam="Lock" :grootte="14" /></span>
              <span v-if="r.detail || r.slot" class="zoek-rij-detail">{{ r.slot ? 'Nog niet aangezet' : r.detail }}</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
