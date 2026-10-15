<script setup lang="ts">
// "+ Inloop" (P30, Gevorderd): de drie dichtstbijzijnde accounts uit het dagpakket op je huidige
// plek; je bevestigt er één en Bezoek afronden opent met "Ongepland bezoek" en de tijd van nu.
import { dichtstbijzijnd } from '~~/shared/route'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ sluit: []; gekozen: [account: { id: string; naam: string }] }>()
const { pakket } = useDagpakket()
const { plek, fout } = useLocatie()
const lijst = ref<any[]>([])
const bezig = ref(false)
watch(() => props.open, async (o) => {
  if (!o) return
  bezig.value = true; lijst.value = []
  const p = await plek()
  bezig.value = false
  if (p) lijst.value = dichtstbijzijnd(p, pakket.value?.accounts ?? [], 3)
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="ik-titel" data-test="inloop-kiezer">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Inloopbezoek</span><h2 id="ik-titel" class="fo-titel">Waar ben je binnen?</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button></header>
        <div class="fo-body">
          <p v-if="bezig" class="meta">Je plek bepalen…</p>
          <p v-else-if="fout" class="kaart kaart--rood">{{ fout }}</p>
          <p v-else-if="!lijst.length" class="meta">Geen accounts uit je dagpakket in de buurt.</p>
          <div class="uitkomst-raster" style="grid-template-columns: 1fr">
            <button v-for="a in lijst" :key="a.id" type="button" class="uitkomst-knop" :data-test="`inloop-${a.id}`" @click="emit('gekozen', { id: a.id, naam: a.naam })"><strong>{{ a.naam }}</strong><br><span class="meta">{{ a.km }} km · {{ a.plaats }}</span></button>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
