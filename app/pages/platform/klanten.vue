<script setup lang="ts">
// Platformbeheer · Klanten (F23). Alleen voor de founder; de server weigert de
// API voor iedereen anders met 404, deze pagina toont dan ook "Niet gevonden".
import { STAND_LABEL, type Stand } from '~~/shared/gezondheid'
import { PAKKET_LABEL, type Pakket } from '~~/shared/types'
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const route = useRoute()
const router = useRouter()
const { data, refresh } = await useFetch<any>('/api/platform/klanten', { default: () => ({ klanten: [], meetlat: null }) })
const nieuwOpen = ref(false)
const werkIn = ref<{ id: string; naam: string } | null>(null)
const klantId = computed(() => (route.query.klant as string) || null)
function openKlant(id: string | null) { router.replace({ query: id ? { klant: id } : {} }) }
async function aangemaakt(id: string) { nieuwOpen.value = false; await refresh(); openKlant(id) }
const datum = (t: string | null) => (t ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(t)) : 'nooit')
const m = computed(() => data.value.meetlat)
useHead({ title: 'Klanten · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Klanten" uitleg="Alle organisaties met gezondheid, pakket en gebruikers.">
      <template #acties>
        <button type="button" class="dd-actie dd-actie--primair" data-test="nieuwe-klant-knop" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Nieuwe klant</button>
      </template>
    </PaginaKop>
    <section class="section">
      <div class="container">
        <nav class="tabbalk" aria-label="Platformbeheer"><NuxtLink to="/platform/klanten" class="tab tab--actief">Klanten</NuxtLink><NuxtLink to="/platform/features" class="tab" data-test="tab-features">Features per niveau</NuxtLink></nav>
        <p class="alleen-groot-melding kaart kaart--geel mt-8">Beter op een groot scherm.</p>
        <div v-if="m" class="stat-grid stat-grid--6" data-test="meetlat">
          <div class="stat-card"><span class="stat-label">Klanten</span><span class="stat-num tnum">{{ m.klanten }}</span>
            <span class="stat-foot">{{ m.verdeling.gezond }} gezond · {{ m.verdeling.let_op }} let op · {{ m.verdeling.risico }} risico · {{ m.verdeling.leeg }} leeg</span></div>
          <div class="stat-card"><span class="stat-label">Gebruikers</span><span class="stat-num tnum">{{ m.gebruikersMetLogin }}</span><span class="stat-foot">van {{ m.gebruikers }} met login</span></div>
          <div class="stat-card"><span class="stat-label">Maandomzet</span><span class="stat-num tnum">–</span><span class="stat-foot">Nog geen gegevens</span></div>
          <div class="stat-card"><span class="stat-label">AI-kostprijs</span><span class="stat-num tnum">–</span><span class="stat-foot">Nog geen gegevens</span></div>
          <div class="stat-card" :class="{ 'stat-card--alert': m.aandacht }"><span class="stat-label">Aandacht</span><span class="stat-num tnum">{{ m.aandacht }}</span><span class="stat-foot">signalen</span></div>
        </div>
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <LegeStaat v-if="!data.klanten.length" titel="Nog geen klanten." tekst="Maak de eerste klant aan met Nieuwe klant." />
        <div v-else class="tabel-wrap">
          <table class="tabel tabel--kaarten" data-test="klanten-tabel">
            <thead><tr><th>Klant</th><th>Pakket</th><th>Gebruikers</th><th>Laatst actief</th><th>AI-kosten</th><th>Stand</th><th><span class="sr-only">Acties</span></th></tr></thead>
            <tbody>
              <tr v-for="k in data.klanten" :key="k.id" :data-klant="k.id">
                <td><strong>{{ k.naam }}</strong><span v-if="k.openAanvragen" class="pil pil--geel">{{ k.openAanvragen }} aanvraag</span></td>
                <td>{{ PAKKET_LABEL[k.pakket as Pakket] }}<template v-if="k.status === 'proef'"> · proef</template></td>
                <td class="tnum">{{ k.metLogin }}/{{ k.gebruikers }} met login</td>
                <td>{{ datum(k.laatstActief) }}</td>
                <td>–</td>
                <td><span class="pil" :class="`pil--stand-${k.stand}`" :title="k.redenen.join(' · ')">{{ STAND_LABEL[k.stand as Stand] }}</span></td>
                <td><div class="dd-acties">
                  <button type="button" class="dd-act" @click="openKlant(k.id)">Openen</button>
                  <button type="button" class="dd-act dd-act--primair" :data-test="`werk-in-${k.id}`" @click="werkIn = { id: k.id, naam: k.naam }">Werk in deze organisatie</button>
                </div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <NieuweKlantFlyout :open="nieuwOpen" @sluit="nieuwOpen = false" @aangemaakt="aangemaakt" />
    <KlantFlyout :id="klantId" @sluit="openKlant(null)" @gewijzigd="refresh" @werk-in="(k) => { openKlant(null); werkIn = k }" />
    <WerkInVenster :organisatie="werkIn" @sluit="werkIn = null" />
  </div>
</template>
