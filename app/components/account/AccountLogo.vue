<script setup lang="ts">
// Het logovlak van een prospect of klant (opzet uit DealDrive, AccountLogo). De initialen staan er altijd;
// laadt het logo (eigen logo-URL of het favicon van het domein via onze eigen route /api/logo), dan schuift
// het eroverheen. Geeft de route geen logo (204), laadt het niet of is het kleiner dan 32 px, dan blijven
// de initialen staan. Bij een testdomein vraagt het vlak niets op (B11).
import { accountLogoUrl } from '~~/shared/logo'

const props = withDefaults(defineProps<{
  naam: string
  initialen: string
  kleur: string
  logoUrl?: string | null
  website?: string | null
  domein?: string | null
  logoUit?: boolean | null
  grootte?: number
}>(), { grootte: 64, logoUrl: null, website: null, domein: null, logoUit: false })

const url = computed(() => accountLogoUrl(props))
const mislukt = ref(false)
const zichtbaar = ref(false)
const img = ref<HTMLImageElement | null>(null)
watch(url, () => { mislukt.value = false; zichtbaar.value = false })
const MINIMALE_BREEDTE = 32
function beoordeel(el: HTMLImageElement) {
  if (el.naturalWidth < MINIMALE_BREEDTE) mislukt.value = true
  else zichtbaar.value = true
}
// Na een serverrender kan het plaatje al binnen zijn voordat @load gekoppeld is.
onMounted(() => { if (img.value?.complete && img.value.naturalWidth > 0) beoordeel(img.value) })
</script>

<template>
  <span class="acc-logovlak" :class="{ 'acc-logovlak--logo': zichtbaar }" :style="{ background: kleur, width: `${grootte}px`, height: `${grootte}px` }" aria-hidden="true" data-test="account-logo">
    <span class="acc-logovlak-init" :style="{ fontSize: `${Math.round(grootte / 3.4)}px` }">{{ initialen }}</span>
    <img v-if="url && !mislukt" ref="img" :src="url" alt="" class="acc-logovlak-img" :class="{ 'acc-logovlak-img--zichtbaar': zichtbaar }" loading="lazy" referrerpolicy="no-referrer" data-test="account-logo-img" @load="beoordeel($event.target as HTMLImageElement)" @error="mislukt = true">
  </span>
</template>

<style scoped>
.acc-logovlak { position: relative; display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; overflow: hidden; color: var(--wit); font-weight: 800; letter-spacing: 0.02em; }
.acc-logovlak--logo { border: 1px solid var(--border); }
.acc-logovlak-init { position: relative; }
.acc-logovlak-img { position: absolute; inset: 0; width: 100%; height: 100%; padding: 12%; object-fit: contain; background: var(--wit); opacity: 0; transition: opacity 0.15s ease; }
.acc-logovlak-img--zichtbaar { opacity: 1; }
</style>
