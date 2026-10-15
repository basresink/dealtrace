<script setup lang="ts">
// Onderbalk op de telefoon (P27, 8.4): vijf tabs per werkplekprofiel, op elk niveau gelijk.
// Elke pagina hoort bij precies één tab; wat niet in de balk staat, hoort bij "Meer".
import { tabsVoor, tabVoorRoute } from '~~/shared/onderbalk'
const route = useRoute()
const { me } = useMe()
const meer = useState<boolean>('meerOpen', () => false)
const tabs = computed(() => tabsVoor(me.value?.gebruiker.werkplek, me.value?.gebruiker.rol ?? 'accountmanager', me.value?.gebruiker.eigenPortefeuille !== false))
const actief = computed(() => (meer.value ? tabs.value.length - 1 : tabVoorRoute(route.path, tabs.value)))
watch(() => route.fullPath, () => { meer.value = false })
</script>

<template>
  <nav class="onderbalk" aria-label="Onderbalk" data-test="onderbalk">
    <template v-for="(t, i) in tabs" :key="t.sleutel">
      <NuxtLink v-if="t.route" :to="t.route" class="ob-tab" :class="{ 'ob-tab--aan': actief === i }" :aria-current="actief === i ? 'page' : undefined" :data-tab="t.sleutel"><Icoon :naam="t.icoon" :grootte="24" /><span>{{ t.label }}</span></NuxtLink>
      <button v-else type="button" class="ob-tab" :class="{ 'ob-tab--aan': actief === i }" :aria-expanded="meer" :data-tab="t.sleutel" @click="meer = !meer"><Icoon :naam="t.icoon" :grootte="24" /><span>{{ t.label }}</span></button>
    </template>
  </nav>
</template>
