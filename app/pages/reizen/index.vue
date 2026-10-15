<script setup lang="ts">
// Prospectreizen (F05): doelgroepen en reizen. Maatwerkreizen maken is P22; hier
// de standaardreis met aantallen per fase en de doelgroepen.
import { fasePil } from '~/utils/accountWeergave'
const { functie } = useMe()
if (!functie('nav.reizen')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Prospectreizen staat aan vanaf Expert en voor de salesmanager' })
const magDoelgroepen = computed(() => !!functie('doelgroepen.beheren')?.beschikbaar)
const { data: dg, refresh: refreshDg } = await useFetch<any>('/api/doelgroepen', { default: () => ({ doelgroepen: [], branches: [], klassen: [], ambitie: null }) })
const { data: rz } = await useFetch<any>('/api/reizen', { default: () => ({ reizen: [] }) })
const open = ref(false)
const bewerk = ref<any>(null)
function nieuw() { bewerk.value = null; open.value = true }
function wijzig(d: any) { bewerk.value = d; open.value = true }
async function bewaard() { open.value = false; await refreshDg() }
const branche = (id: string) => dg.value.branches.find((b: any) => b.id === id)?.naam ?? id
const STATUS: Record<string, string> = { concept: 'Concept', actief: 'Actief', gearchiveerd: 'Gearchiveerd', gepauzeerd: 'Gepauzeerd' }
useHead({ title: 'Prospectreizen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Prospectreizen" titel="Doelgroepen en reizen" uitleg="Welke bedrijven je zoekt, en de route die ze afleggen tot de eerste afspraak." helpartikel="doelgroepen-en-reizen">
      <template #acties>
        <button v-if="magDoelgroepen" type="button" class="dd-actie dd-actie--primair" data-test="doelgroep-nieuw" @click="nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Doelgroep</button>
      </template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <span class="kicker kicker--streep">Doelgroepen</span>
        <div class="tabel-wrap mt-16">
          <LegeStaat v-if="!dg.doelgroepen.length" titel="Nog geen doelgroepen." tekst="Zonder doelgroep komt elk account in de standaardreis." />
          <table v-else class="tabel tabel--kaarten" data-test="doelgroepen">
            <thead><tr><th>Naam</th><th>Status</th><th>Prioriteit</th><th>Branches</th><th>Accounts</th><th>Reis</th><th><span class="sr-only">Acties</span></th></tr></thead>
            <tbody>
              <tr v-for="d in dg.doelgroepen" :key="d.id">
                <td><strong>{{ d.naam }}</strong><br v-if="d.data.omschrijving"><span class="meta">{{ d.data.omschrijving }}</span></td>
                <td><span class="pil" :class="d.status === 'actief' ? 'pil--groen' : 'pil--grijs'">{{ STATUS[d.status] }}</span></td>
                <td class="tnum">{{ d.prioriteit }}</td>
                <td>{{ (d.data.brancheIds ?? []).map(branche).join(', ') || '–' }}</td>
                <td class="tnum">{{ d.aantal }}</td>
                <td>{{ d.reis?.naam ?? '–' }}</td>
                <td><button v-if="magDoelgroepen" type="button" class="dd-act" @click="wijzig(d)">Wijzigen</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <span class="kicker kicker--streep mt-16">Reizen</span>
        <div class="mt-16 ak-blokken">
          <NuxtLink v-for="r in rz.reizen" :key="r.id" :to="`/reizen/${r.id}`" class="kaart top-kaart" :data-test="`reis-${r.isStandaard ? 'standaard' : r.id}`">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ r.naam }}</h2><span class="pil pil--leeg">v{{ r.versie }}</span></header>
            <p class="kaart-meta">{{ r.totaal }} accounts · {{ STATUS[r.status] }}</p>
            <ul class="schakel-lijst">
              <li v-for="f in r.fases" :key="f.id" class="schakel-rij"><span class="pil" :class="fasePil(f.kleur)">{{ f.label }}</span><span class="tnum">{{ f.aantal }}</span></li>
            </ul>
          </NuxtLink>
        </div>
      </div>
    </section>
    <DoelgroepFlyout :open="open" :doelgroep="bewerk" :branches="dg.branches" :klassen="dg.klassen" :ambitie="dg.ambitie" @sluit="open = false" @bewaard="bewaard" />
  </div>
</template>
