<script setup lang="ts">
// Een concept (8.5.7, F06): maker, aanleiding, tekst met stijlscore, winpunt en bronnen; "Goedkeuren",
// "Aanpassen", "Verwerpen". Daarna bij mail "Verstuur" (via de mailkoppeling) of "Verstuur via je mail"
// (mailto), bij een tekst met nummer WhatsApp. Goedkeuren kan offline; versturen wacht op verbinding.
const props = defineProps<{ concept: any; compact?: boolean }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const { voegToe } = useSyncQueue()
const c = computed(() => props.concept)
const aanpassen = ref(false)
const tekst = ref('')
const onderwerp = ref('')
watch(() => props.concept, (x) => { tekst.value = x?.concept?.tekst ?? ''; onderwerp.value = x?.concept?.onderwerp ?? '' }, { immediate: true })
const TYPE: Record<string, string> = { mail: 'Mail', linkedin: 'LinkedIn-bericht', belscript: 'Belscript', briefing: 'Bezoekbriefing' }
async function besluit(b: 'goedkeuren' | 'verwerpen', metTekst = false) {
  const body = { besluit: b, ...(metTekst ? { tekst: tekst.value, onderwerp: onderwerp.value } : {}) }
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'concepten', op: 'patch', recordId: c.value.id, patch: { soort: 'concept.besluit', ...body } })
      toast.toon('Bewaard. Wordt verstuurd zodra je weer verbinding hebt.')
    } else {
      await $fetch(`/api/concepten/${c.value.id}/besluit`, { method: 'POST', body })
      toast.toon(b === 'verwerpen' ? 'Concept verworpen.' : 'Goedgekeurd.')
    }
    aanpassen.value = false
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const bezig = ref(false)
async function verstuur() {
  bezig.value = true
  try { const r = await $fetch<any>('/api/mail/verstuur', { method: 'POST', body: { conceptId: c.value.id } }); toast.toon(r.tekst); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function kopieer() { try { await navigator.clipboard.writeText([c.value.concept.onderwerp, c.value.concept.tekst].filter(Boolean).join('\n\n')); toast.toon('Gekopieerd.') } catch { toast.toon('Kopiëren lukt hier niet.', 'let-op') } }
</script>

<template>
  <article class="kaart cn-kaart" :data-test="`concept-${c.id}`">
    <header class="cn-kop">
      <span class="pil pil--leeg">{{ TYPE[c.concept?.type] ?? c.concept?.type }}</span>
      <span class="meta">{{ c.agent === 'schrijver' ? 'Schrijver' : c.agent }}<template v-if="c.accountNaam"> · <NuxtLink :to="`/accounts/${c.accountId}`">{{ c.accountNaam }}</NuxtLink></template></span>
      <span v-if="c.concept?.stijlscore" class="pil pil--leeg" :title="`${c.concept.woorden} van ${c.concept.grens} woorden`">stijl {{ c.concept.stijlscore }}</span>
      <span v-if="c.status !== 'klaar'" class="pil">{{ c.status }}</span>
    </header>
    <p v-if="c.concept?.aanleiding && !compact" class="meta">{{ c.concept.aanleiding }}</p>
    <template v-if="!aanpassen">
      <p v-if="c.concept?.onderwerp"><strong>{{ c.concept.onderwerp }}</strong></p>
      <p v-if="c.concept?.tekst" class="cn-tekst">{{ c.concept.tekst }}</p>
      <dl v-else-if="c.concept?.blokken" class="cn-blokken"><template v-for="(t, k) in c.concept.blokken" :key="k"><dt>{{ k }}</dt><dd>{{ t }}</dd></template></dl>
    </template>
    <template v-else>
      <label v-if="c.concept?.type === 'mail'" class="veld"><span class="veld-label">Onderwerp</span><input v-model="onderwerp" class="invoer"></label>
      <label class="veld"><span class="veld-label">Tekst</span><textarea v-model="tekst" class="invoer" rows="6" data-test="concept-tekst" /></label>
    </template>
    <p v-if="c.concept?.bronnen?.length && !compact" class="meta">Bron: {{ c.concept.bronnen.map((b: any) => b.titel).join(' · ') }}<template v-if="c.concept.vvVersies && Object.keys(c.concept.vvVersies).length"> · verkoopverhaal versie {{ c.concept.vvVersies.winpunten ?? Object.values(c.concept.vvVersies)[0] }}</template></p>
    <div class="dd-acties cn-acties">
      <template v-if="c.status === 'klaar'">
        <template v-if="!aanpassen">
          <button type="button" class="dd-act dd-act--primair" data-test="concept-goedkeuren" @click="besluit('goedkeuren')">Goedkeuren</button>
          <button v-if="c.concept?.tekst" type="button" class="dd-act" data-test="concept-aanpassen" @click="aanpassen = true">Aanpassen</button>
          <button type="button" class="dd-act" data-test="concept-verwerpen" @click="besluit('verwerpen')">Verwerpen</button>
        </template>
        <template v-else>
          <button type="button" class="dd-act dd-act--primair" data-test="concept-bewaar-goedkeur" @click="besluit('goedkeuren', true)">Goedkeuren</button>
          <button type="button" class="dd-act" @click="aanpassen = false">Annuleren</button>
        </template>
      </template>
      <template v-else-if="c.status === 'goedgekeurd'">
        <button v-if="c.concept?.type === 'mail'" type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="concept-verstuur" @click="verstuur">Verstuur</button>
        <a v-if="c.links?.mailto" :href="c.links.mailto" class="dd-act" data-test="concept-mailto">Verstuur via je mail</a>
        <a v-if="c.links?.whatsapp" :href="c.links.whatsapp" target="_blank" rel="noopener" class="dd-act">WhatsApp</a>
        <button v-if="c.concept?.tekst" type="button" class="dd-act" @click="kopieer">Kopieer</button>
      </template>
    </div>
    <p v-if="!compact" class="meta cn-noot">De agent voert niets uit. Jij keurt goed en belt, mailt of bezoekt zelf.</p>
  </article>
</template>
