<script setup lang="ts">
// Hulpflyout (560 px; op de telefoon een schuifvenster tot 92 procent hoogte). Zonder
// artikel bij de knop zoekt hij het artikel van de huidige route.
import { artikelVoorRoute, isGelezen } from '~~/shared/help'
import { markdownNaarHtml } from '~~/shared/markdown'
const { open, slug, sluit } = useHulp()
const route = useRoute()
const artikel = ref<any>(null)
const fout = ref(false)
const lijf = ref<HTMLElement | null>(null)
const { voegToe } = useSyncQueue()
watch(open, async (o) => {
  if (!o) return
  artikel.value = null
  fout.value = false
  try {
    let s = slug.value
    if (!s) {
      const lijst = await $fetch<any>('/api/help')
      s = artikelVoorRoute(route.fullPath, lijst.artikelen) ?? 'je-eerste-dag-in-dealtrace'
    }
    artikel.value = await $fetch(`/api/help/${s}`)
    await nextTick()
    controleerGelezen()
  } catch { fout.value = true }
})
const html = computed(() => (artikel.value ? markdownNaarHtml(artikel.value.inhoud, { zonderTitel: artikel.value.titel }) : ''))
function controleerGelezen() {
  const el = lijf.value
  if (!el || !artikel.value || artikel.value.gelezen) return
  if (isGelezen(el.scrollTop, el.clientHeight, el.scrollHeight)) { artikel.value.gelezen = true; void voegToe({ tabel: 'help_gelezen', op: 'patch', recordId: artikel.value.id, patch: { soort: 'help.gelezen' } }) }
}
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && open.value) sluit() }
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', opEscape))
watch(() => route.fullPath, () => sluit())
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="sluit">
      <aside class="fo-panel fo-panel--hulp fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="hulp-titel" data-test="hulp-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">Hulp<template v-if="artikel"> · {{ artikel.categorie }}</template></span>
            <h2 id="hulp-titel" class="fo-titel">{{ artikel?.titel ?? (fout ? 'Geen artikel gevonden' : 'Laden…') }}</h2>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="sluit"><Icoon naam="X" /></button>
        </header>
        <div ref="lijf" class="fo-body help-inhoud" @scroll.passive="controleerGelezen">
          <p v-if="fout" class="fo-tekst">Er is voor dit scherm nog geen artikel. Kijk in het helpcenter.</p>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-else-if="artikel" class="help-tekst" v-html="html" />
        </div>
        <footer class="fo-foot dd-acties">
          <NuxtLink v-if="artikel" class="dd-act" :to="`/help/${artikel.slug}`" @click="sluit"><Icoon naam="BookOpen" class="dd-act-icoon" />Open in het helpcenter</NuxtLink>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="sluit">Sluiten</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
