<script setup lang="ts">
// Eén categorie van het helpcenter: de artikelen als kaarten, de andere categorieën van dezelfde
// collectie eronder. Een onbekende categorie en een categorie die niet voor jouw rol is (Inrichten,
// Voor de salesmanager) geven hetzelfde antwoord, zodat het adres niets verklapt.
import { CATEGORIE_UITLEG, CATEGORIEEN_NEWBUSINESS, CATEGORIEEN_PRODUCT, categorieLink, categorieUitSlug } from '~~/shared/help'
const route = useRoute()
const cat = computed(() => categorieUitSlug(String(route.params.categorie ?? '')))
const { data } = await useFetch<any>('/api/help', { key: 'help-categorie', default: () => ({ artikelen: [] }) })
const artikelen = computed<any[]>(() => (cat.value ? data.value.artikelen.filter((a: any) => a.collectie === cat.value!.collectie && a.categorie === cat.value!.naam) : []))
const collectieNaam = computed(() => (cat.value?.collectie === 'newbusiness' ? 'New business' : 'Hoe werkt Dealtrace'))
const overzicht = computed(() => (cat.value?.collectie === 'newbusiness' ? '/helpcenter/academie' : '/helpcenter/instructies'))
const verwant = computed(() => {
  if (!cat.value) return []
  const namen: readonly string[] = cat.value.collectie === 'product' ? CATEGORIEEN_PRODUCT : CATEGORIEEN_NEWBUSINESS
  return namen.filter((n) => n !== cat.value!.naam && data.value.artikelen.some((a: any) => a.collectie === cat.value!.collectie && a.categorie === n))
})
const bestaat = computed(() => !!cat.value && (artikelen.value.length > 0 || cat.value.collectie === 'newbusiness'))
useHead({ title: () => `${bestaat.value ? cat.value!.naam : 'Categorie'} · Helpcenter · Dealtrace` })
</script>

<template>
  <div>
    <template v-if="bestaat">
      <PaginaKop :kicker="`Helpcenter · ${collectieNaam}`" :titel="cat!.naam" :uitleg="CATEGORIE_UITLEG[cat!.naam]" helpartikel="helpcenter">
        <template #acties><NuxtLink :to="overzicht" class="dd-actie dd-actie--secundair" data-test="terug-overzicht"><Icoon naam="ArrowLeft" class="dd-actie-icoon" />{{ collectieNaam }}</NuxtLink></template>
      </PaginaKop>
      <section class="section hcat">
        <div class="container">
          <HelpGroep :titel="`${artikelen.length} ${artikelen.length === 1 ? 'artikel' : 'artikelen'}`" data-test="categorie-artikelen">
            <HelpKaart v-for="a in artikelen" :key="a.id" :artikel="a" />
          </HelpGroep>
          <p v-if="!artikelen.length" class="hcat-leeg">De artikelen volgen met de academie.</p>
          <nav v-if="verwant.length" class="hcat-verwant" aria-label="Andere categorieën">
            <h2 class="hcat-verwant-titel">Andere categorieën</h2>
            <ul class="hcat-verwant-lijst" role="list">
              <li v-for="n in verwant" :key="n"><NuxtLink :to="categorieLink(n)" class="hcat-verwant-link">{{ n }}</NuxtLink></li>
            </ul>
          </nav>
        </div>
      </section>
      <HelpSteun />
    </template>
    <section v-else class="section">
      <div class="container">
        <NuxtLink to="/helpcenter" class="hcat-kruimel">Helpcenter</NuxtLink>
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
.hcat-verwant { margin-top: 32px; }
.hcat-verwant-titel { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
.hcat-verwant-lijst { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
@media (min-width: 700px) { .hcat-verwant-lijst { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .hcat-verwant-lijst { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.hcat-verwant-link { display: flex; align-items: center; min-height: var(--touch-target-min); padding: 10px 14px; background: var(--wit); border: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--ink); text-decoration: none; }
.hcat-verwant-link:hover { border-color: var(--ink); }
.hcat-kruimel { display: inline-flex; align-items: center; min-height: var(--touch-target-min); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.hcat-kruimel::before { content: '\2190  '; white-space: pre; }
.hcat-melding { padding: 28px; background: var(--wit); border: 1px dashed var(--border-strong); }
.hcat-melding-titel { font-family: var(--font-serif); font-size: 22px; font-weight: 700; margin: 0 0 8px; }
.hcat-melding p { margin: 0; font-size: 14px; line-height: 1.65; color: var(--ink-soft); }
.hcat-inline { color: var(--ink); font-weight: 600; border-bottom: 1px solid var(--yellow); text-decoration: none; }
</style>
