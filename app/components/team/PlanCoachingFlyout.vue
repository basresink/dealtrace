<script setup lang="ts">
// Plan een coachingsgesprek vanaf /team of /coaching: kies de accountmanager (voorgekozen wie het eerst aan
// de beurt is) en het moment. Het gesprek komt als interne meeting met de coachingkaart als agenda in de
// agenda (POST /api/coaching/:id/plan), net als op de coachingkaart.
const props = defineProps<{ open: boolean; leden: { id: string; naam: string; reden?: string }[]; voorkeur?: string | null }>()
const emit = defineEmits<{ sluit: []; gepland: [] }>()
const toast = useToast()
const wie = ref('')
const moment = ref('')
const bezig = ref(false)
const kort = (n: string) => n.replace(/^Testgebruiker /, '')
// Standaard de eerstvolgende werkdag om 9:00.
function morgen() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1)
  return `${d.toLocaleDateString('sv-SE')}T09:00`
}
watch(() => props.open, (o) => { if (o) { wie.value = props.voorkeur ?? props.leden[0]?.id ?? ''; moment.value = morgen() } }, { immediate: true })
const gekozen = computed(() => props.leden.find((l) => l.id === wie.value))
async function plan() {
  bezig.value = true
  try { const r = await $fetch<{ tekst: string }>(`/api/coaching/${wie.value}/plan`, { method: 'POST', body: { start: new Date(moment.value).toISOString() } }); toast.toon(`${r.tekst} ${kort(gekozen.value?.naam ?? '')} krijgt een uitnodiging.`); emit('gepland') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <FlyoutShell v-if="open" open kicker="Coaching" titel="Plan een coachingsgesprek" meta="Een half uur, met de coachingkaart als agenda." breedte="smal" data-test="plan-coaching" @sluit="emit('sluit')">
    <form id="pc-form" class="fs-form" @submit.prevent="plan">
      <div class="fo-body fo-body--formulier">
        <label class="veld"><span class="veld-label">Met wie</span>
          <select v-model="wie" class="invoer" required data-test="pc-wie"><option v-for="l in leden" :key="l.id" :value="l.id">{{ kort(l.naam) }}</option></select>
        </label>
        <p v-if="gekozen?.reden" class="meta">{{ gekozen.reden }}</p>
        <label class="veld"><span class="veld-label">Wanneer</span><input v-model="moment" type="datetime-local" class="invoer" required data-test="pc-moment"></label>
      </div>
    </form>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="submit" form="pc-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!wie || !moment || bezig" data-test="pc-plan"><Icoon naam="CalendarCheck" :grootte="16" />Plan gesprek</button>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </FlyoutShell>
</template>
