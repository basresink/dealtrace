<script setup lang="ts">
// Mijn scripts (F08, Gevorderd): persoonlijke varianten van een teamscript. Een variant erft
// doel, fases en koppelingen; wijzigt het origineel, dan zie je "Het origineel is gewijzigd".
const { functie } = useMe()
const aan = !!functie('belscript.variant')?.beschikbaar
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/belscripts', { immediate: aan, default: () => ({ scripts: [], mijn: [] }) })
const open = ref<string | null>(null)
async function kopie(id: string) {
  try { const r = await $fetch<any>(`/api/belscripts/${id}/kopie`, { method: 'POST' }); await refresh(); open.value = r.id } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const origineel = (id: string) => data.value.scripts.find((s: any) => s.id === id)?.naam ?? 'een teamscript'
useHead({ title: 'Mijn scripts · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="belscript.variant" />
    <template v-else>
      <PaginaKop kicker="Mijn instellingen" titel="Mijn scripts" uitleg="Je eigen formuleringen op een script van je team. Activeer je variant om ermee te bellen." helpartikel="een-belscript-kiezen" />
      <section class="section section--laatste">
        <div class="container">
          <div class="lijst" data-test="mijn-scripts">
            <div v-for="s in data.mijn" :key="s.id" class="rij rij--compact">
              <div class="rij-info"><h3 class="rij-titel">{{ s.naam }} <span class="pil pil--leeg">{{ s.status === 'actief' ? `actief, versie ${s.versie}` : 'concept' }}</span></h3>
                <div class="rij-sub">Variant van {{ origineel(s.basisScriptId) }}<template v-if="s.origineelGewijzigd"> · <strong data-test="origineel-gewijzigd">Het origineel is gewijzigd</strong></template></div></div>
              <button type="button" class="dd-act" @click="open = s.id">{{ s.origineelGewijzigd ? 'Bekijk verschil' : 'Bewerk' }}</button>
            </div>
            <p v-if="!data.mijn.length" class="rij rij--compact meta">Je hebt nog geen eigen variant.</p>
          </div>
          <h2 class="kop-blok mt-24">Scripts van je team</h2>
          <div class="lijst mt-8">
            <div v-for="s in data.scripts.filter((x: any) => x.status === 'actief')" :key="s.id" class="rij rij--compact">
              <div class="rij-info"><h3 class="rij-titel">{{ s.naam }}</h3><div class="rij-sub">{{ s.doelLabel }} · {{ s.conversie }}</div></div>
              <button type="button" class="dd-act" :data-test="`variant-${s.naam}`" @click="kopie(s.id)">Maak persoonlijke variant</button>
            </div>
          </div>
        </div>
      </section>
      <ScriptEditor :script-id="open" @sluit="open = null" @gewijzigd="refresh()" />
    </template>
  </div>
</template>
