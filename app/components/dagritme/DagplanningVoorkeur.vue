<script setup lang="ts">
// "Plan mijn dag automatisch" (F3 Dagplanner): een schakelaar met een tijdstip, op /dagstart en in Mijn
// instellingen (#dagplanning). Uit: de dagstart is een voorstel dat pas na je akkoord in je agenda komt.
// Aan: de Dagplanner deelt elke werkdag op je tijdstip zelf in (na je stille uren) en plant opnieuw als
// er iets verschuift. Opslaan via PUT /api/mij/dagplanning; gaat hij aan na het tijdstip, dan plant hij
// de rest van vandaag meteen.
import { PLAN_TIJDEN } from '~~/shared/dagplanning'
const props = defineProps<{ compact?: boolean }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const { functie } = useMe()
const toast = useToast()
const aan = computed(() => !!functie('dagritme.dagstart')?.beschikbaar)
const { data: v } = await useFetch<{ automatisch: boolean; tijd: string }>('/api/mij/dagplanning', { key: 'dagplanning-voorkeur', immediate: aan.value, default: () => ({ automatisch: false, tijd: '07:00' }) })
const bezig = ref(false)
async function bewaar(patch: Partial<{ automatisch: boolean; tijd: string }>) {
  bezig.value = true
  try {
    const r = await $fetch<any>('/api/mij/dagplanning', { method: 'PUT', body: patch })
    v.value = { automatisch: r.automatisch, tijd: r.tijd }
    if (patch.automatisch !== undefined) toast.toon(r.plan?.status === 'gepland' ? 'Je dag is nu ingedeeld en staat in je agenda.' : r.automatisch ? `De Dagplanner deelt je dag voortaan om ${r.tijd} in.` : 'Je krijgt weer een voorstel; plannen doe je zelf.')
    else toast.toon(`Tijdstip bewaard: ${r.tijd}.`)
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <section v-if="aan" class="dpv" :class="{ 'dpv--compact': props.compact }" data-test="dagplanning-voorkeur">
    <div class="dpv-rij">
      <div class="dpv-tekst">
        <h2 class="dpv-titel">Plan mijn dag automatisch</h2>
        <p class="dpv-uitleg">{{ v.automatisch ? `Elke werkdag om ${v.tijd} zet de Dagplanner je belblokken, voorbereiding en kansen zelf in je agenda. Verschuift er iets, dan plant hij de rest opnieuw en meldt hij wat er schoof.` : 'Uit: je krijgt een voorstel en het komt pas in je agenda na je akkoord.' }}</p>
      </div>
      <Schakelaar :aan="v.automatisch" label="Plan mijn dag automatisch" data-test="dagplanning-aan" :uit="bezig" @wissel="bewaar({ automatisch: $event })" />
    </div>
    <label class="dpv-tijd">
      <span>Tijdstip</span>
      <select :disabled="!v.automatisch || bezig" data-test="dagplanning-tijd" @change="bewaar({ tijd: ($event.target as HTMLSelectElement).value })">
        <option v-for="t in PLAN_TIJDEN" :key="t" :value="t" :selected="t === v.tijd">{{ t }}</option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.dpv { padding: 20px 22px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); display: grid; gap: 12px; }
.dpv--compact { padding: 16px; }
.dpv-rij { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
.dpv-tekst { min-width: 0; }
.dpv-titel { font-family: var(--font-serif); font-size: 17px; font-weight: 700; margin: 0 0 4px; }
.dpv-uitleg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); max-width: 64ch; }
.dpv-tijd { display: grid; grid-template-columns: auto 110px; gap: 10px; align-items: center; font-size: 13px; color: var(--ink-soft); justify-content: start; }
.dpv-tijd select { width: 100%; min-height: 44px; padding: 0 8px; border: 1px solid var(--border-strong); background: var(--wit); font: inherit; font-size: 14px; color: var(--ink); }
.dpv-tijd select:disabled { color: var(--muted); }
@media (max-width: 719px) { .dpv { padding: 16px; } }
</style>
