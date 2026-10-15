<script setup lang="ts">
// "Overdragen?" (F17): de keuzes DealDrive, Het CRM en Een collega als tegels van 56 px, met de reden
// als een keuze niet kan; daaronder ontvanger of collega en de vervolgstap. Gebruikt in Bezoek afronden
// (ook offline, via de wachtrij) en in het overdrachtsvenster.
const props = defineProps<{ accountId: string; vervolgstap?: string }>()
const model = defineModel<{ naar: string; naarGebruikerId: string | null; ontvanger: string | null; vervolgstap: { omschrijving: string; datum: string | null; soort: string } } | null>({ default: null })
const { data } = useFetch<any>(() => `/api/accounts/${props.accountId}/overdracht`, { default: () => null })
const KEUZES = [['dealdrive', 'DealDrive'], ['crm', 'Het CRM'], ['collega', 'Een collega']] as const
const f = reactive({ naar: '', naarGebruikerId: '', ontvanger: '', omschrijving: props.vervolgstap ?? '', datum: '', soort: 'afspraak' })
watch(() => data.value, (d) => { if (d) { if (!f.ontvanger) f.ontvanger = d.ontvanger ?? ''; if (!f.omschrijving) f.omschrijving = d.vervolgstap ?? '' } }, { immediate: true })
watch(() => props.vervolgstap, (v) => { if (v) f.omschrijving = v })
watch(f, () => {
  model.value = f.naar ? { naar: f.naar, naarGebruikerId: f.naar === 'collega' ? f.naarGebruikerId || null : null, ontvanger: f.naar !== 'collega' ? f.ontvanger.trim() || null : null, vervolgstap: { omschrijving: f.omschrijving.trim(), datum: f.datum || null, soort: f.soort } } : null
}, { deep: true, immediate: true })
const reden = (k: string) => data.value?.keuzes?.[k]?.reden ?? (k === 'collega' && !data.value ? 'Een collega kiezen kan alleen met verbinding.' : null)
const kan = (k: string) => (k === 'collega' ? !!data.value?.keuzes?.collega?.kan : true)
</script>

<template>
  <div class="ov-keuze" data-test="overdragen-keuze">
    <div class="ov-tegels" role="radiogroup" aria-label="Naar">
      <button v-for="[k, l] in KEUZES" :key="k" type="button" role="radio" class="ov-tegel" :class="{ 'is-gekozen': f.naar === k }" :aria-checked="f.naar === k" :disabled="!kan(k)" :data-test="`naar-${k}`" @click="f.naar = k">
        <strong>{{ l }}</strong><span v-if="reden(k)" class="rij-sub">{{ reden(k) }}</span>
      </button>
    </div>
    <label v-if="f.naar === 'collega'" class="veld"><span class="veld-label">Nieuwe eigenaar <span class="veld-verplicht">*</span></span>
      <select v-model="f.naarGebruikerId" class="invoer" data-test="naar-collega"><option value="" disabled>Kies</option><option v-for="c in data?.collegas ?? []" :key="c.id" :value="c.id">{{ c.naam.replace(/^Testgebruiker /, '') }}</option></select></label>
    <label v-else-if="f.naar" class="veld"><span class="veld-label">E-mailadres van de ontvanger</span><input v-model="f.ontvanger" type="email" class="invoer" placeholder="naam@bedrijf.nl"></label>
    <template v-if="f.naar">
      <label class="veld"><span class="veld-label">Vervolgstap <span class="veld-verplicht">*</span></span><input v-model="f.omschrijving" class="invoer" required data-test="vervolgstap" placeholder="Bijvoorbeeld: projectschouw op locatie"></label>
      <div class="formulier-raster">
        <label class="veld"><span class="veld-label">Datum</span><input v-model="f.datum" type="date" class="invoer"></label>
        <label class="veld"><span class="veld-label">Soort</span><select v-model="f.soort" class="invoer"><option value="afspraak">Afspraak</option><option value="bezoek">Bezoek</option><option value="bellen">Bellen</option><option value="mail">Mail</option><option value="taak">Taak</option></select></label>
      </div>
    </template>
  </div>
</template>
