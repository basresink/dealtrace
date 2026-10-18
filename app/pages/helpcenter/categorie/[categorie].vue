<script setup lang="ts">
// Eén categorie van het helpcenter: kruimelpad (Helpcenter, de collectie, de categorie), de categorieën als
// filter-pillen met deze categorie aan, en de artikelen als kaarten. Een onbekende categorie en een
// categorie die niet voor jouw rol is (Inrichten, Voor de salesmanager) geven hetzelfde antwoord, zodat het adres niets verklapt.
import { CATEGORIE_UITLEG, COLLECTIES, categorieUitSlug, overzichtLink } from '~~/shared/help'
const route = useRoute()
const cat = computed(() => categorieUitSlug(String(route.params.categorie ?? '')))
const { data } = await useFetch<any>('/api/help', { key: 'help-categorie', default: () => ({ artikelen: [] }) })
const artikelen = computed<any[]>(() => (cat.value ? data.value.artikelen.filter((a: any) => a.collectie === cat.value!.collectie && a.categorie === cat.value!.naam) : []))
const collectieNaam = computed(() => COLLECTIES[cat.value?.collectie ?? 'product'].naam)
// Een categorie uit Nieuwe klanten werven gaat terug naar dat hoofdstuk van de academie.
const overzicht = computed(() => overzichtLink(cat.value?.collectie ?? 'product', cat.value?.naam))
// Een productcategorie zonder artikelen voor jou bestaat niet; de academie en de tips tonen een lege staat.
const bestaat = computed(() => !!cat.value && (artikelen.value.length > 0 || cat.value.collectie !== 'product'))
useHead({ title: () => `${bestaat.value ? cat.value!.naam : 'Categorie'} · Helpcenter · Dealtrace` })
</script>

<template>
  <div>
    <template v-if="bestaat">
      <PaginaKop :titel="cat!.naam" :uitleg="CATEGORIE_UITLEG[cat!.naam]" helpartikel="helpcenter">
        <template #kicker><HelpKruimelpad :pad="[{ label: 'Helpcenter', to: '/helpcenter' }, { label: collectieNaam, to: overzicht, test: 'kruimel-overzicht' }, { label: cat!.naam }]" /></template>
        <template #na><HelpCategorieen :actief="cat!.naam" :collectie="cat!.collectie" /></template>
      </PaginaKop>
      <section class="section hcat">
        <div class="container">
          <HelpGroep :titel="`${artikelen.length} ${artikelen.length === 1 ? 'artikel' : 'artikelen'}`" data-test="categorie-artikelen">
            <HelpKaart v-for="a in artikelen" :key="a.id" :artikel="a" />
          </HelpGroep>
          <p v-if="!artikelen.length" class="hcat-leeg">{{ cat!.collectie === 'newbusiness' ? 'De artikelen volgen met de academie.' : 'De artikelen in deze categorie volgen.' }}</p>
        </div>
      </section>
      <HelpSteun />
    </template>
    <section v-else class="section">
      <div class="container">
        <HelpKruimelpad :pad="[{ label: 'Helpcenter', to: '/helpcenter' }, { label: 'Categorie niet gevonden' }]" />
        <HelpCategorieen class="hcat-chips" />
        <div class="hcat-melding" data-test="categorie-onbekend">
          <h1 class="hcat-melding-titel">Deze categorie is er niet.</h1>
          <p>Het adres bestaat niet, of de categorie hoort bij een rol die jij niet hebt. Ga terug naar het <NuxtLink to="/helpcenter" class="hcat-inline">helpcenter</NuxtLink> voor alles wat wel op jouw werk van toepassing is.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hcat { padding-top: 0; }
.hcat-leeg { padding: 24px; background: var(--wit); border: 1px dashed var(--border-strong); color: var(--muted); text-align: center; }
.hcat-chips { margin: 0 0 20px; }
.hcat-melding { padding: 28px; background: var(--wit); border: 1px dashed var(--border-strong); }
.hcat-melding-titel { font-family: var(--font-serif); font-size: 22px; font-weight: 700; margin: 0 0 8px; }
.hcat-melding p { margin: 0; font-size: 14px; line-height: 1.65; color: var(--ink-soft); }
.hcat-inline { color: var(--ink); font-weight: 600; border-bottom: 1px solid var(--yellow); text-decoration: none; }
</style>
