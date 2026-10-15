<script setup lang="ts">
// Buying committee (F04): per rol een vak met namen, bron en zekerheid; ontbrekende
// rollen grijs met "Nog niet gevonden".
import { CONTACTROL_LABEL, ROLLEN_CONTACT, type ContactRol } from '~~/shared/contactgegevens'
const props = defineProps<{ contacten: any[]; ontbrekend: string[] }>()
const rollen = ROLLEN_CONTACT.filter((r) => r !== 'onbekend')
const per = (r: string) => props.contacten.filter((c) => c.rol === r && c.status !== 'vertrokken')
</script>

<template>
  <div class="committee" data-test="buying-committee">
    <div v-for="r in rollen" :key="r" class="committee-vak" :class="{ 'committee-vak--leeg': ontbrekend.includes(r) }" :data-rol="r">
      <span class="veld-label">{{ CONTACTROL_LABEL[r as ContactRol] }}</span>
      <template v-if="per(r).length">
        <NuxtLink v-for="c in per(r)" :key="c.id" :to="`/contacten/${c.id}`" class="committee-naam">{{ c.naam }}</NuxtLink>
        <span v-for="c in per(r)" :key="`b${c.id}`" class="veld-uitleg">{{ c.bron ?? 'ingevoerd' }}<template v-if="c.zekerheid !== null && c.zekerheid < 60"> · vermoedelijk</template></span>
      </template>
      <template v-else>
        <span class="meta">Nog niet gevonden</span>
        <span class="veld-uitleg">Vraag in je volgende gesprek.</span>
      </template>
    </div>
  </div>
</template>
