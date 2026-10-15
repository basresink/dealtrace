<script setup lang="ts">
// Kolomwissel naar Afspraak, Geparkeerd of Afgewezen: het venster vraagt de uitkomst (gat 38), bij
// Geen interesse een reden, en bij een eindkolom "Is het winpunt uitgevoerd?".
import { KOLOM_LABEL, UITKOMST_VOOR_KOLOM, type Kolom } from '~~/shared/campagnes'
import { UITKOMST_LABEL } from '~~/shared/hercontact'
import { NEE_REDENEN } from '~~/shared/nbStatus'
const props = defineProps<{ naam: string; kolom: Kolom; metWinpunt: boolean }>()
const emit = defineEmits<{ bewaar: [k: { uitkomst: string; reden: string | null; laterOp: string | null; winpuntUitgevoerd: boolean | null }]; sluit: [] }>()
const opties = computed(() => UITKOMST_VOOR_KOLOM[props.kolom] ?? [])
const uitkomst = ref(opties.value[0] ?? '')
const reden = ref('')
const laterOp = ref('')
const winpunt = ref<boolean | null>(null)
const mag = computed(() => !!uitkomst.value && (uitkomst.value !== 'geen_interesse' || !!reden.value) && (!props.metWinpunt || winpunt.value !== null))
</script>

<template>
  <Teleport to="body">
    <div class="cd-overlay" @click.self="emit('sluit')">
      <form class="cd-dialog" role="dialog" aria-modal="true" aria-labelledby="kv-titel" data-test="kolom-venster" @submit.prevent="mag && emit('bewaar', { uitkomst, reden: reden || null, laterOp: laterOp || null, winpuntUitgevoerd: metWinpunt ? winpunt : null })">
        <div class="cd-head"><h2 id="kv-titel" class="cd-title">{{ naam }} naar {{ KOLOM_LABEL[kolom] }}</h2></div>
        <fieldset class="veld"><legend class="veld-label">Uitkomst</legend>
          <label v-for="o in opties" :key="o" class="keuze"><input v-model="uitkomst" type="radio" :value="o" :data-test="`uitkomst-${o}`"> {{ UITKOMST_LABEL[o as keyof typeof UITKOMST_LABEL] ?? o }}</label>
        </fieldset>
        <label v-if="uitkomst === 'geen_interesse'" class="veld"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span>
          <select v-model="reden" class="invoer" data-test="reden"><option value="" disabled>Kies</option><option v-for="r in NEE_REDENEN" :key="r" :value="r">{{ r }}</option></select></label>
        <label v-if="uitkomst === 'later'" class="veld"><span class="veld-label">Terugkomen op</span><input v-model="laterOp" type="date" class="invoer"></label>
        <fieldset v-if="metWinpunt" class="veld"><legend class="veld-label">Is het winpunt uitgevoerd?</legend>
          <label class="keuze"><input v-model="winpunt" type="radio" :value="true" data-test="winpunt-ja"> Ja</label>
          <label class="keuze"><input v-model="winpunt" type="radio" :value="false" data-test="winpunt-nee"> Nee</label>
        </fieldset>
        <div class="cd-foot">
          <button type="button" class="cd-btn cd-btn--ghost" @click="emit('sluit')">Annuleren</button>
          <button type="submit" class="cd-btn cd-btn--primary" :disabled="!mag" data-test="kolom-bewaar">Bewaar</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
