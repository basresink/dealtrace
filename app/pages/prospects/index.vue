<script setup lang="ts">
// Top deze week (F03): de zes belangrijkste eigen prospects, in de opzet van DealDrive:
// kop met paarse kicker, daaronder een grijze band met zes kaarten in de kleur van de warmte.
import { klasseLabel } from '~/utils/accountWeergave'
const { functie } = useMe()
if (!functie('prospects.lijst')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const { data } = await useFetch<{ prospects: any[]; klassen: { id: string; naam: string }[] }>('/api/accounts/top', { default: () => ({ prospects: [], klassen: [] }) })
const top = computed(() => data.value.prospects)
const nu = new Date()
const maandag = new Date(nu); maandag.setDate(nu.getDate() - ((nu.getDay() + 6) % 7))
const zondag = new Date(maandag); zondag.setDate(maandag.getDate() + 6)
const d = (x: Date) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(x).replace('.', '')
useHead({ title: 'Prospects · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop
      accent="paars"
      :kicker="`Top deze week · ${d(maandag)} tot ${d(zondag)}`"
      titel="Belangrijkste prospects van deze week"
      uitleg="Hoge score, verse signalen en actieve aanleidingen: deze prospects verdienen nu een eerstvolgend contactmoment. Klik een kaart voor de prospectkaart, of bekijk alle prospects."
      helpartikel="de-accountkaart-lezen"
      zonder-hulp
    >
      <template #acties>
        <FunctieLink class="dd-actie dd-actie--zwart" to="/prospects/alle" data-test="alle-prospects">Alle prospects →</FunctieLink>
      </template>
    </PaginaKop>
    <section class="section section--alt section--laatste">
      <div class="container">
        <LegeStaat v-if="!top.length" titel="Nog geen prospects deze week." tekst="Voeg een prospect toe of importeer een lijst." />
        <div v-else class="top-raster" data-test="top-week">
          <NuxtLink v-for="p in top" :key="p.id" :to="`/accounts/${p.id}`" class="top-kaart-dd" :class="`top-kaart-dd--${p.warmte}`" :data-account="p.id">
            <span class="top-kaart-kop">
              <span class="top-rang-pil tnum">#{{ p.rang }}</span>
              <Label v-if="p.klasse" soort="klasse" :waarde="klasseLabel(p.klasse, data.klassen)" />
            </span>
            <h2 class="top-kaart-naam">{{ p.naam }}</h2>
            <span v-if="p.branche || p.plaats" class="top-kaart-meta">{{ [p.branche, p.plaats].filter(Boolean).join(' · ') }}</span>
            <span v-if="p.aanleiding" class="top-kaart-aanleiding">{{ p.aanleiding.tekst }}</span>
            <span class="top-kaart-voet">
              <span v-if="p.inzichten" class="top-kaart-tag tnum">{{ p.inzichten }} {{ p.inzichten === 1 ? 'inzicht' : 'inzichten' }}</span>
              <span class="top-kaart-open">Open →</span>
            </span>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
