<script setup lang="ts">
// Accountplannen op de accountkaart (tabblad Reis en kwalificatie): de plannen van dit account met status,
// geldigheid en voortgang, en "+ Accountplan" met het account al ingevuld. Alleen als de functie aanstaat.
// Een plan is voor een topprospect; voor een klant staat er geen + Accountplan (plannen voor klanten horen in DealDrive).
import { WEERGAVE_LABEL, geldigheidLabel } from '~~/shared/accountplannen'
const props = defineProps<{ account: { id: string; naam: string; soort?: string | null } }>()
const isKlant = computed(() => props.account.soort === 'klant')
const { functie } = useMe()
const aan = computed(() => !!functie('nav.accountplannen')?.beschikbaar)
const { data } = await useFetch<any>('/api/accountplannen', { query: { accountId: props.account.id }, immediate: aan.value, default: () => ({ plannen: [] }) })
const nieuwOpen = ref(false)
const pilKlas = (w: string) => ({ actueel: 'pil--geel', verlopen: 'pil--rood', afgerond: 'pil--zwart' } as Record<string, string>)[w]
</script>

<template>
  <article v-if="aan" class="kaart" data-test="ak-accountplannen">
    <header class="kaart-kop">
      <h2 class="kaart-titel">Accountplannen</h2>
      <button v-if="!isKlant" type="button" class="dd-act dd-act--geel" data-test="ak-accountplan-nieuw" @click="nieuwOpen = true"><Icoon naam="Plus" :grootte="14" />Accountplan</button>
    </header>
    <ul v-if="data.plannen.length" class="akp-lijst" role="list">
      <li v-for="p in data.plannen" :key="p.id" class="akp-rij">
        <NuxtLink :to="`/accountplannen/${p.id}`" class="akp-link" :data-test="`ak-accountplan-${p.id}`">
          <span class="akp-naam">{{ p.titel }}</span>
          <span class="akp-meta tnum"><span class="pil" :class="pilKlas(p.weergave)">{{ WEERGAVE_LABEL[p.weergave as 'actueel'].toUpperCase() }}</span> {{ geldigheidLabel(p) }} · {{ p.acties.klaar }} van {{ p.acties.totaal }} acties klaar</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else-if="isKlant" class="meta">Een plan voor een klant maak je in DealDrive.</p>
    <p v-else class="meta">Nog geen accountplan voor {{ account.naam }}. Een plan geeft deze topprospect doelen, een strategie en acties met een datum.</p>
    <AccountplanNieuwFlyout v-if="!isKlant" :open="nieuwOpen" :account="account" @sluit="nieuwOpen = false" />
  </article>
</template>

<style scoped>
.akp-lijst { list-style: none; margin: 0; padding: 0; }
.akp-rij { border-bottom: 1px solid var(--border); }
.akp-rij:last-child { border-bottom: 0; }
.akp-link { display: flex; flex-direction: column; gap: 4px; min-height: 44px; padding: 8px 0; color: var(--ink); text-decoration: none; }
.akp-link:hover .akp-naam { text-decoration: underline; }
.akp-naam { font-weight: 700; font-size: 14px; overflow-wrap: anywhere; }
.akp-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
</style>
