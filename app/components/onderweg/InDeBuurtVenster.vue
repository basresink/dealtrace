<script setup lang="ts">
// In de buurt (P30, Gevorderd): eigen prospects en klanten binnen 15 minuten van je huidige plek, op
// kansscore met de reden. Per regel Bel, Navigeer en "+ Inloop". Alleen online.
import { kaartLink, type Kaartapp } from '~~/shared/route'
const props = defineProps<{ open: boolean; kaartapp?: Kaartapp }>()
const emit = defineEmits<{ sluit: []; inloop: [account: { id: string; naam: string }] }>()
const { plek, fout } = useLocatie()
const lijst = ref<any[] | null>(null)
const alleenProspects = ref(false)
const bezig = ref(false)
async function zoek() {
  lijst.value = null
  if (!navigator.onLine) { fout.value = 'In de buurt werkt alleen met verbinding.'; return }
  bezig.value = true
  const p = await plek()
  if (p) { try { lijst.value = ((await $fetch('/api/onderweg/in-de-buurt', { query: { lat: p.lat, lng: p.lng, prospects: alleenProspects.value ? '1' : undefined } })) as any).accounts } catch (e) { fout.value = foutTekst(e) } }
  bezig.value = false
}
watch(() => props.open, (o) => { if (o) void zoek() })
watch(alleenProspects, () => { if (props.open) void zoek() })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="idb-titel" data-test="in-de-buurt">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Binnen 15 minuten</span><h2 id="idb-titel" class="fo-titel">In de buurt</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button></header>
        <div class="fo-body">
          <p class="schakel-rij"><span>Alleen prospects</span><Schakelaar :aan="alleenProspects" label="Alleen prospects" @wissel="alleenProspects = $event" /></p>
          <p v-if="bezig" class="meta">Je plek bepalen…</p>
          <p v-else-if="fout" class="kaart kaart--rood">{{ fout }}</p>
          <LegeStaat v-else-if="lijst && !lijst.length" titel="Niemand binnen 15 minuten." tekst="Kijk later opnieuw of zet de filter alleen prospects uit." />
          <ul v-else-if="lijst" class="ow-tijdlijn" style="padding: 0">
            <li v-for="a in lijst" :key="a.id" class="ow-stop">
              <p class="ow-stop-rij"><strong>{{ a.naam }}</strong><span class="meta">{{ a.minuten }} min<template v-if="a.schatting"> · schatting</template></span></p>
              <p class="meta">{{ a.reden }}<template v-if="a.contact"> · {{ a.contact.naam }}</template></p>
              <p class="ow-stop-acties">
                <NuxtLink class="dd-act" :to="`/accounts/${a.id}`"><Icoon naam="Phone" />Bel</NuxtLink>
                <a class="dd-act" :href="kaartLink({ punt: a.punt }, kaartapp ?? 'google') ?? undefined" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
                <button type="button" class="dd-act dd-act--geel" @click="emit('inloop', { id: a.id, naam: a.naam })"><Icoon naam="Plus" />Inloop</button>
              </p>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
