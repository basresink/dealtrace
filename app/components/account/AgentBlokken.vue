<script setup lang="ts">
// Accountkaart (P19): het dossier met "Laat opnieuw onderzoeken" (Gevorderd, 10 credits), het blok
// "Wat de agents zagen" en "Bronnen om te volgen" (Expert).
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
const nieuweBron = reactive({ soort: 'url', waarde: '' })
async function bewaarBronnen(lijst: any[]) {
  try { await $fetch(`/api/accounts/${props.account.id}/volgbronnen`, { method: 'PUT', body: { bronnen: lijst } }); nieuweBron.waarde = ''; emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
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
  <article v-if="account.kan?.bronnenVolgen" class="kaart" data-test="bronnen-volgen">
    <header class="kaart-kop"><h2 class="kaart-titel">Bronnen om te volgen</h2></header>
    <p v-if="!account.volgBronnen?.length" class="kaart-meta">Nog geen eigen bronnen. De Waarnemer volgt het profiel van de doelgroep.</p>
    <ul v-else class="schakel-lijst">
      <li v-for="(b, n) in account.volgBronnen" :key="n" class="schakel-rij"><span>{{ b.soort === 'url' ? 'URL' : 'Trefwoord' }}: {{ b.waarde }}</span><button type="button" class="dd-act" :aria-label="`${b.waarde} weghalen`" @click="bewaarBronnen(account.volgBronnen.filter((_: any, m: number) => m !== n))">Weg</button></li>
    </ul>
    <form class="filterbalk mt-8" @submit.prevent="bewaarBronnen([...(account.volgBronnen ?? []), { ...nieuweBron }])">
      <select v-model="nieuweBron.soort" class="invoer invoer--klein" aria-label="Soort bron"><option value="url">URL</option><option value="trefwoord">Trefwoord</option></select>
      <input v-model="nieuweBron.waarde" class="invoer invoer--klein" :placeholder="nieuweBron.soort === 'url' ? 'https://' : 'Trefwoord'" aria-label="Bron" data-test="nieuwe-bron">
      <button type="submit" class="dd-act" :disabled="!nieuweBron.waarde.trim()">+ Bron</button>
    </form>
  </article>
</template>
