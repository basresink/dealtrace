<script setup lang="ts">
// Concepten (8.5.7): alles wat agents voor je klaarzetten, nieuwste eerst. Filter op soort; de
// salesmanager ziet ook de concepten van zijn teams die op goedkeuring wachten (8.12).
const { functie } = useMe()
const aan = !!functie('concepten.inbox')?.beschikbaar
const team = !!functie('campagnes.team')?.beschikbaar
const route = useRoute()
const router = useRouter()
const query = computed(() => ({ type: route.query.type || undefined, team: route.query.team === '1' ? '1' : undefined }))
const { data, refresh } = await useFetch<any>('/api/concepten', { query, immediate: aan, default: () => ({ concepten: [] }) })
const TYPES: [string, string][] = [['', 'Alle'], ['mail', 'Mail'], ['linkedin', 'LinkedIn'], ['belscript', 'Belscript'], ['briefing', 'Bezoekbriefing']]
useHead({ title: 'Concepten · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="concepten.inbox" />
    <template v-else>
      <PaginaKop :kicker="`Concepten · ${data.concepten.filter((c: any) => c.status === 'klaar').length} wachten`" titel="Concepten" uitleg="Wat agents voor je klaarzetten. Jij keurt goed, past aan of verwerpt; niets gaat zonder jou de deur uit." helpartikel="concepten-goedkeuren-en-versturen" />
      <section class="section">
        <div class="container container--smal">
          <div class="cp-werkbalk mb-16">
            <div class="cp-tonen" role="group" aria-label="Soort">
              <button v-for="[k, l] in TYPES" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': (route.query.type ?? '') === k }" :aria-pressed="(route.query.type ?? '') === k" @click="router.replace({ query: { ...route.query, type: k || undefined } })">{{ l }}</button>
            </div>
            <label v-if="team" class="keuze"><input type="checkbox" :checked="route.query.team === '1'" data-test="concepten-team" @change="router.replace({ query: { ...route.query, team: ($event.target as HTMLInputElement).checked ? '1' : undefined } })"> Ook van mijn team</label>
          </div>
          <LegeStaat v-if="!data.concepten.length" titel="Geen concepten." tekst="Wat agents voor je klaarzetten, verschijnt hier." />
          <div v-else class="cn-lijst" data-test="concepten">
            <ConceptKaart v-for="c in data.concepten" :key="c.id" :concept="c" @gewijzigd="refresh()" />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
