<script setup lang="ts">
// Accounts kiezen op naam (vrije keuze in de wizard, + Accounts op het bord): een zoekveld met type-ahead
// (ZoekKiezer, zes treffers), gekozen accounts als chips.
const gekozen = defineModel<{ id: string; naam: string }[]>({ default: () => [] })
async function zoek(q: string) { return (await zoekAccounts(q)).filter((a) => !gekozen.value.some((x) => x.id === a.id)) }
function kies(a: { id: string; naam: string }) { if (!gekozen.value.some((x) => x.id === a.id)) gekozen.value = [...gekozen.value, { id: a.id, naam: a.naam }] }
function weg(id: string) { gekozen.value = gekozen.value.filter((x) => x.id !== id) }
</script>

<template>
  <div class="cp-kiezer">
    <ZoekKiezer :zoek="zoek" kop="Prospect" placeholder="Zoek een prospect op naam" data-test="account-zoek" :optie-test="(t) => `kies-${t.id}`" :sub="accountSub" leeg="Geen account gevonden." @kies="kies" />
    <div v-if="gekozen.length" class="chips">
      <span v-for="g in gekozen" :key="g.id" class="chip">{{ g.naam }}<button type="button" class="chip-weg" :aria-label="`${g.naam} weghalen`" @click="weg(g.id)"><Icoon naam="X" :grootte="12" /></button></span>
    </div>
  </div>
</template>
