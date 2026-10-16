<script setup lang="ts">
// Platformbeheer · Agent-prompts (F23): per slot de platformlaag met versies, het vaste kader en Proefdraai op
// Voltvast-data. Opslaan vraagt herbevestiging; de elfde versie verdringt de oudste.
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const { data, refresh } = await useFetch<any>('/api/platform/prompts', { default: () => ({ slots: [], kader: '' }) })
useHead({ title: 'Agent-prompts · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Agent-prompts" uitleg="De keten is organisatie, platform, code. Het vaste kader staat altijd aan het eind en is door geen prompt op te heffen." />
    <section class="section section--laatste">
      <div class="container stapel">
        <PromptEditor v-for="s in data.slots" :key="s.slot + (s.versies[0]?.versie ?? 0)" :slot="s" :kader="data.kader" basis="/api/platform/prompts" @bewaard="refresh()" />
      </div>
    </section>
  </div>
</template>
