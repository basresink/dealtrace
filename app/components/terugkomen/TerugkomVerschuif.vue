<script setup lang="ts">
// "Wat verschuift bij bewaren": de prospects op nee die nog niet gestart zijn en geen aangepaste datum
// hebben, met hun oude en nieuwe terugkomdatum (uit de droogloop POST /api/instellingen/terugkomen/proef).
import { KANAAL_LABEL, type Kanaal } from '~~/shared/nbStatus'
import { terugDagKort, type Verschuiving } from '~~/shared/terugkomBeheer'

const props = defineProps<{ lijst: Verschuiving[] | null; bezig?: boolean; regels?: { id: string; reden: string }[]; leeg?: string }>()
const MAX = 12
const open = ref(false)
const zicht = computed(() => (open.value ? props.lijst ?? [] : (props.lijst ?? []).slice(0, MAX)))
const regelNaam = (id: string | null) => (id ? props.regels?.find((r) => r.id === id)?.reden ?? id : 'geen regel')
</script>

<template>
  <div class="tv" aria-live="polite" data-test="tk-verschuif">
    <p v-if="lijst === null" class="meta">{{ bezig ? 'Even rekenen...' : leeg ?? 'Pas iets aan om te zien wat er verschuift.' }}</p>
    <p v-else-if="!lijst.length" class="meta" data-test="tk-verschuif-niets">Er verschuift niets: geen enkele wachtende prospect krijgt een andere datum of een ander kanaal.</p>
    <template v-else>
      <p class="tv-kop"><strong>Wat verschuift bij bewaren ({{ lijst.length }})</strong></p>
      <p class="meta">Alleen prospects die nog niet gestart zijn en geen met de hand aangepaste datum hebben.</p>
      <ul class="tv-lijst">
        <li v-for="v in zicht" :key="v.id" data-test="tk-verschuif-rij">
          <NuxtLink :to="`/accounts/${v.id}`" class="tv-naam">{{ v.naam }}</NuxtLink>
          <span class="tv-datum"><span class="tnum">{{ terugDagKort(v.van) }}</span> <span class="meta">naar</span> <strong class="tnum">{{ terugDagKort(v.naar) }}</strong>
            <span v-if="v.kanaalVan !== v.kanaalNaar" class="meta"> · {{ KANAAL_LABEL[v.kanaalVan as Kanaal] }} naar {{ KANAAL_LABEL[v.kanaalNaar as Kanaal] }}</span>
            <span v-if="v.regelVan !== v.regelNaar" class="meta"> · regel {{ regelNaam(v.regelNaar) }}</span>
          </span>
        </li>
      </ul>
      <button v-if="lijst.length > MAX" type="button" class="dd-act mt-8" :aria-expanded="open" @click="open = !open">{{ open ? 'Toon minder' : `Toon alle ${lijst.length}` }}</button>
    </template>
  </div>
</template>

<style scoped>
.tv { border-top: 1px solid var(--border); padding-top: 12px; margin-top: 16px; }
.tv-kop { margin: 0 0 2px; }
.tv-lijst { list-style: none; margin: 8px 0 0; padding: 0; }
.tv-lijst li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-klein); }
.tv-lijst li:last-child { border-bottom: 0; }
.tv-naam { color: var(--ink); font-weight: 600; min-height: 24px; overflow-wrap: anywhere; }
.tv-datum { text-align: right; }
@media (max-width: 719px) { .tv-naam { min-height: var(--touch-target-min); display: inline-flex; align-items: center; } .tv-datum { text-align: left; } }
</style>
