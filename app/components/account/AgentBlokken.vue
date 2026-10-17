<script setup lang="ts">
// Accountkaart (P19): het dossier met "Laat opnieuw onderzoeken" (Gevorderd, 10 credits), het blok
// "Wat de agents zagen". Eigen bronnen om te volgen staan als Extra bronnen in het Info-venster.
import { CRITERIUM_LABEL, DOSSIER_CRITERIA } from '~~/shared/agents'
const props = defineProps<{ account: any }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const AGENT_NAAM: Record<string, string> = { waarnemer: 'Waarnemer', verrijker: 'Verrijker', profielbouwer: 'Profielbouwer', notulist: 'Notulist', handmatig: 'Handmatig' }
const credits = ref<{ geblokt: string | null } | null>(null)
onMounted(async () => { if (props.account.kan?.onderzoek) credits.value = await $fetch<any>('/api/assistent/credits').catch(() => null) })
const bezig = ref(false)
async function onderzoek() {
  bezig.value = true
  try { const r = await $fetch<any>(`/api/accounts/${props.account.id}/onderzoek`, { method: 'POST' }); toast.toon(r.compleet ? 'Dossier ververst en compleet.' : 'Dossier ververst.'); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const d = computed(() => props.account.dossier)
const datum = (s: string | null) => (s ? new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <article class="kaart" data-test="dossier">
    <header class="kaart-kop"><h2 class="kaart-titel">Dossier</h2><span v-if="d?.op" class="kaart-meta">ververst {{ datum(d.op) }}</span></header>
    <ul v-if="d?.criteria && typeof d.criteria === 'object'" class="kaart-meta band-lijst">
      <li v-for="k in DOSSIER_CRITERIA" :key="k" class="band-rij">{{ CRITERIUM_LABEL[k] }}: {{ d.criteria[k]?.oordeel === 'ja' ? 'ja' : d.criteria[k]?.oordeel === 'nee' ? 'nee' : 'onbekend' }}</li>
    </ul>
    <p v-else-if="d" class="kaart-meta">{{ d.criteria ?? 0 }} criteria</p>
    <p v-else class="kaart-meta">Nog geen dossier. Het dossier vult zich met de reis en de Verrijker.</p>
    <p v-if="d?.aannames?.length" class="kaart-meta mt-8"><span v-for="x in d.aannames" :key="x.veld">{{ x.veld }}: {{ x.waarde }} <span class="pil pil--leeg">aanname</span></span></p>
    <div v-if="account.kan?.onderzoek" class="mt-16">
      <button type="button" class="dd-act" :disabled="bezig || !!credits?.geblokt" :title="credits?.geblokt ?? undefined" data-test="opnieuw-onderzoeken" @click="onderzoek">Laat opnieuw onderzoeken</button>
      <span class="kaart-meta"> Kost 10 credits</span>
    </div>
  </article>
  <article class="kaart" data-test="agents-zagen">
    <header class="kaart-kop"><h2 class="kaart-titel">Wat de agents zagen</h2></header>
    <p v-if="!account.agentInzichten?.length" class="kaart-meta">De agents hebben nog niets gevonden bij dit account.</p>
    <ul v-else class="schakel-lijst">
      <li v-for="i in account.agentInzichten" :key="i.id" class="schakel-rij"><span><NuxtLink :to="`/acties?tab=inzichten&gelezen=alle`">{{ i.title }}</NuxtLink><br><span class="meta">{{ AGENT_NAAM[i.agent] ?? i.agent }}<template v-if="i.bronNaam && i.bronNaam !== AGENT_NAAM[i.agent]"> · {{ i.bronNaam }}</template> · {{ datum(i.op) }}</span></span></li>
    </ul>
  </article>
</template>
