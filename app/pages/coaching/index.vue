<script setup lang="ts">
// Coaching (P21): de teamleden met het laatste coachingsgesprek en de open afspraken. Een gesprek per
// accountmanager per twee weken is de norm (hoofdstuk 16).
import { NIVEAU_LABEL } from '~~/shared/types'
const { functie } = useMe()
const aan = computed(() => !!functie('nav.coaching')?.beschikbaar)
const { data } = await useFetch<any>('/api/coaching', { immediate: aan.value, default: () => ({ leden: [], teams: [] }) })
const dagen = (d: string | null) => (d ? Math.floor((Date.now() - Date.parse(d)) / 864e5) : null)
useHead({ title: 'Coaching · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.coaching" />
    <template v-else>
      <PaginaKop kicker="Coaching" titel="Wie spreek je deze week?" uitleg="Eén coachingsgesprek per accountmanager per twee weken." helpartikel="coachingsgesprek" />
      <section class="section">
        <div class="container">
          <LegeStaat v-if="!data.leden.length" titel="Je bent nog geen eigenaar van een team." tekst="Vraag je beheerder om je aan een team te koppelen." />
          <ul v-else class="schakel-lijst kaart" data-test="coaching-lijst">
            <li v-for="l in data.leden" :key="l.id" class="schakel-rij">
              <NuxtLink :to="`/coaching/${l.id}`" class="cg-rij"><strong>{{ l.naam.replace(/^Testgebruiker /, '') }}</strong><span class="meta">{{ NIVEAU_LABEL[l.niveau as 'beginner'] }} · {{ l.werkplek }}</span></NuxtLink>
              <span class="meta">{{ l.laatsteGesprek ? `Laatste gesprek ${dagen(l.laatsteGesprek)} dagen geleden` : 'Nog geen gesprek' }}<template v-if="l.openAfspraken"> · {{ l.openAfspraken }} open {{ l.openAfspraken === 1 ? 'afspraak' : 'afspraken' }}</template></span>
              <span v-if="!l.laatsteGesprek || (dagen(l.laatsteGesprek) ?? 0) > 14" class="pil pil--rood">Gesprek plannen</span>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cg-rij { display: flex; flex-direction: column; min-height: 44px; justify-content: center; }
</style>
