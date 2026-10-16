<script setup lang="ts">
// De knop Meer in de paginakop: minder gebruikte acties en doorverwijzingen in een keuzemenu, zodat de
// knoppenrij op een laptop van 1280 px op één regel blijft. Elk item is een link (to of href) of een actie.
// Het menu sluit bij een klik erbuiten, met Escape en na het kiezen van een item.
export interface KopMeerItem { label: string; icoon?: string; to?: string; href?: string; actie?: () => void; test?: string; download?: boolean }
const props = withDefaults(defineProps<{ items: KopMeerItem[]; label?: string; test?: string }>(), { label: 'Meer', test: 'kop-meer' })
const open = ref(false)
const houder = ref<HTMLElement | null>(null)
const zichtbaar = computed(() => props.items.filter(Boolean))
const lijst = ref<HTMLElement | null>(null)
const links = ref(false)
// Rechts uitgelijnd onder de knop; past dat niet (de knop staat links, zoals op de telefoon), dan links.
watch(open, async (o) => {
  links.value = false
  if (!o) return
  await nextTick()
  if (lijst.value && lijst.value.getBoundingClientRect().left < 8) links.value = true
})

function sluit() { open.value = false }
function kies(i: KopMeerItem) { sluit(); i.actie?.() }
function buiten(e: MouseEvent) { if (open.value && houder.value && !houder.value.contains(e.target as Node)) sluit() }
function toets(e: KeyboardEvent) { if (open.value && e.key === 'Escape') sluit() }
onMounted(() => { document.addEventListener('click', buiten); document.addEventListener('keydown', toets) })
onBeforeUnmount(() => { document.removeEventListener('click', buiten); document.removeEventListener('keydown', toets) })
</script>

<template>
  <div v-if="zichtbaar.length" ref="houder" class="keuzemenu-houder">
    <button type="button" class="dd-actie dd-actie--secundair" aria-haspopup="menu" :aria-expanded="open" :data-test="test" @click.stop="open = !open">
      <Icoon naam="Ellipsis" class="dd-actie-icoon" />{{ label }}<Icoon naam="ChevronDown" :grootte="14" class="keuzemenu-pijl" :class="{ 'keuzemenu-pijl--open': open }" />
    </button>
    <ul v-if="open" ref="lijst" class="keuzemenu" :class="{ 'kop-meer-links': links }" role="menu" :data-test="`${test}-menu`">
      <li v-for="i in zichtbaar" :key="i.label" role="none">
        <NuxtLink v-if="i.to" :to="i.to" role="menuitem" class="keuzemenu-item" :data-test="i.test" @click="sluit"><Icoon v-if="i.icoon" :naam="i.icoon" :grootte="16" />{{ i.label }}</NuxtLink>
        <a v-else-if="i.href" :href="i.href" role="menuitem" class="keuzemenu-item" :data-test="i.test" :download="i.download || undefined" @click="sluit"><Icoon v-if="i.icoon" :naam="i.icoon" :grootte="16" />{{ i.label }}</a>
        <button v-else type="button" role="menuitem" class="keuzemenu-item" :data-test="i.test" @click="kies(i)"><Icoon v-if="i.icoon" :naam="i.icoon" :grootte="16" />{{ i.label }}</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.keuzemenu-item { text-decoration: none; }
.kop-meer-links { left: 0; right: auto; }
</style>
