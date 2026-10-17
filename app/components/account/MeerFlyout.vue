<script setup lang="ts">
// De knop Meer op de accountkaart en de contactkaart opent dit venster: korte kaders onder elkaar (titel,
// één regel uitleg of stand en een pijl). Elk kader opent zijn eigen venster (Info, Briefing, Volgen,
// Invloed, Belscript, Dossier, Kwalificatie, Ritme, Reis, Klaarzetten, Overdragen) of is een link. De
// pagina bepaalt welke kaders er staan; kiezen sluit dit venster en geeft het id door.
export interface MeerKader { id: string; titel: string; tekst: string; icoon: string; test: string; href?: string; accent?: boolean }
const props = defineProps<{ open: boolean; onderwerp: string; kaders: MeerKader[] }>()
const emit = defineEmits<{ sluit: []; kies: [id: string] }>()
// Een kader van een functie die uit staat, staat er niet (wens: geen knop naar een uitgezette functie).
const FUNCTIE_VAN: Record<string, string> = {
  briefing: 'briefing.lezen', volgen: 'prospects.volgen', belscript: 'belscript.kiezen', reis: 'reis.zien', kwalificatie: 'reis.kwalificeer',
  campagnes: 'campagnes.meedoen', accountplan: 'nav.accountplannen', klaarzetten: 'bezoeken.klaarzetten', overdragen: 'overdracht.basis',
  visitekaartje: 'contact.visitekaartje', offline: 'onderweg.dagpakket', deactiveren: 'prospects.deactiveren',
}
const { aan, magNaar } = useFunctie()
const zichtbaar = computed(() => props.kaders.filter((k) => (!FUNCTIE_VAN[k.id] || aan(FUNCTIE_VAN[k.id]!)) && (!k.href || magNaar(k.href))))
// Vraag AI in de kop opent de assistent met dit onderwerp (FlyoutShell); er is niets te bewaren.
const ai = computed(() => ({ label: props.onderwerp, voorstellen: [`Wat is de volgende stap bij ${props.onderwerp}?`, `Vat ${props.onderwerp} samen`, 'Waar moet ik op letten?'] }))
</script>

<template>
  <FlyoutShell :open="open" kicker="Meer" :titel="onderwerp" meta="Kies wat je wilt zien of doen; elk onderdeel opent zijn eigen venster." titel-id="mf-titel" breedte="smal" :ai="ai" sluit-test="meer-flyout-sluit" data-test="meer-flyout" @sluit="emit('sluit')">
        <div class="fo-body">
          <ul class="mf-lijst" role="list">
            <li v-for="k in zichtbaar" :key="k.id">
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
  </FlyoutShell>
</template>

<style scoped>
.mf-lijst { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.mf-kader { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 2px; background: var(--wit); color: var(--ink); font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.mf-kader:hover { border-color: var(--ink); }
.mf-kader:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.mf-kader--accent { border-left: 3px solid var(--yellow); }
.mf-icoon { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--bg); color: var(--ink); }
.mf-tekst { display: flex; flex: 1; flex-direction: column; gap: 0; min-width: 0; line-height: 1.35; }
.mf-titel { font-size: 14px; font-weight: 700; }
.mf-regel { overflow: hidden; font-size: 12px; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.mf-pijl { flex: none; color: var(--muted); }
.mf-kader:hover .mf-pijl { color: var(--ink); }
</style>
