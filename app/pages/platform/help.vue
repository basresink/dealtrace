<script setup lang="ts">
// Platformbeheer · Help-artikelen (F21, F23): de platformartikelen met versie en status. De editor volgt in P25.
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const { data } = await useFetch<any>('/api/platform/help', { default: () => ({ artikelen: [] }) })
const zoek = ref('')
const lijst = computed(() => data.value.artikelen.filter((a: any) => !zoek.value || a.titel.toLowerCase().includes(zoek.value.toLowerCase())))
useHead({ title: 'Help-artikelen · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" :titel="`${data.artikelen.length} platformartikelen`" uitleg="Artikelen voor alle organisaties. Een klant kan eigen artikelen toevoegen; die staan hier niet." />
    <section class="section section--laatste">
      <div class="container stapel">
        <input v-model="zoek" class="invoer" type="search" placeholder="Zoek op titel" aria-label="Zoek artikel">
        <table class="tabel tabel--kaarten"><thead><tr><th>Titel</th><th>Categorie</th><th>Niveau</th><th>Status</th><th>Versie</th></tr></thead>
          <tbody><tr v-for="a in lijst" :key="a.slug"><td data-label="Titel"><NuxtLink :to="`/help/${a.slug}`">{{ a.titel }}</NuxtLink></td><td data-label="Categorie">{{ a.categorie }}</td><td data-label="Niveau">{{ a.niveau ?? 'iedereen' }}</td><td data-label="Status">{{ a.status }}</td><td data-label="Versie" class="tnum">{{ a.versie }}</td></tr></tbody></table>
      </div>
    </section>
  </div>
</template>
