<script setup lang="ts">
// Legenda onder een dekkingstabel; de woorden volgen het venster of het ritme.
defineProps<{ gezien: string; stil: string; nooit: string }>()
</script>

<template>
  <div class="dl" data-test="dekking-legenda">
    <span><i class="dl-blok dl-blok--gezien" />{{ gezien }}</span>
    <span><i class="dl-blok dl-blok--stil" />{{ stil }}</span>
    <span><i class="dl-blok dl-blok--nooit" />{{ nooit }}</span>
  </div>
</template>

<style scoped>
.dl { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; font-size: 12px; font-weight: 600; color: var(--ink-soft); }
.dl span { display: inline-flex; align-items: center; gap: 6px; }
.dl-blok { display: inline-block; width: 10px; height: 10px; }
.dl-blok--gezien { background: var(--green); }
.dl-blok--stil { background: var(--red); }
.dl-blok--nooit { background: var(--ink-soft); }
</style>
