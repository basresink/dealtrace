<script setup lang="ts">
// De knop Meer op de accountkaart en de contactkaart opent dit venster: korte kaders onder elkaar (titel,
// één regel uitleg of stand en een pijl). Elk kader opent zijn eigen venster (Info, Briefing, Volgen,
// Invloed, Belscript, Dossier, Kwalificatie, Ritme, Reis, Klaarzetten, Overdragen) of is een link. De
// pagina bepaalt welke kaders er staan; kiezen sluit dit venster en geeft het id door.
export interface MeerKader { id: string; titel: string; tekst: string; icoon: string; test: string; href?: string; accent?: boolean }
const props = defineProps<{ open: boolean; onderwerp: string; kaders: MeerKader[] }>()
const emit = defineEmits<{ sluit: []; kies: [id: string] }>()
function toets(e: KeyboardEvent) { if (e.key === 'Escape' && props.open) emit('sluit') }
onMounted(() => document.addEventListener('keydown', toets))
onBeforeUnmount(() => document.removeEventListener('keydown', toets))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="mf-titel" data-test="meer-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">Meer</span>
            <h2 id="mf-titel" class="fo-titel">{{ onderwerp }}</h2>
            <p class="fo-meta">Kies wat je wilt zien of doen; elk onderdeel opent zijn eigen venster.</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" data-test="meer-flyout-sluit" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <ul class="mf-lijst" role="list">
            <li v-for="k in kaders" :key="k.id">
              <a v-if="k.href" :href="k.href" class="mf-kader" :data-test="k.test" @click="emit('sluit')">
                <span class="mf-icoon"><Icoon :naam="k.icoon" :grootte="18" /></span>
                <span class="mf-tekst"><span class="mf-titel">{{ k.titel }}</span><span class="mf-regel">{{ k.tekst }}</span></span>
                <Icoon naam="ChevronRight" :grootte="18" class="mf-pijl" />
              </a>
              <button v-else type="button" class="mf-kader" :class="{ 'mf-kader--accent': k.accent }" :data-test="k.test" @click="emit('kies', k.id)">
                <span class="mf-icoon"><Icoon :naam="k.icoon" :grootte="18" /></span>
                <span class="mf-tekst"><span class="mf-titel">{{ k.titel }}</span><span class="mf-regel">{{ k.tekst }}</span></span>
                <Icoon naam="ChevronRight" :grootte="18" class="mf-pijl" />
              </button>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.mf-lijst { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.mf-kader { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 2px; background: var(--wit); color: var(--ink); font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.mf-kader:hover { border-color: var(--ink); }
.mf-kader:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.mf-kader--accent { border-left: 3px solid var(--yellow); }
.mf-icoon { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 36px; height: 36px; background: var(--bg); color: var(--ink); }
.mf-tekst { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.mf-titel { font-size: 14px; font-weight: 700; }
.mf-regel { overflow: hidden; font-size: 12px; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.mf-pijl { flex: none; color: var(--muted); }
.mf-kader:hover .mf-pijl { color: var(--ink); }
</style>
