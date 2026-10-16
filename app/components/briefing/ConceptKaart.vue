<script setup lang="ts">
// Een concept voluit (8.5.7, F06): maker, aanleiding, tekst met stijlscore, winpunt en bronnen; "Goedkeuren",
// "Aanpassen", "Afwijzen". Daarna bij mail "Verstuur" (via de mailkoppeling) of "Verstuur via je mail"
// (mailto), bij een tekst met nummer WhatsApp. Staat in het Pitstop-paneel (compact); op /concepten staat
// hetzelfde concept in de ConceptFlyout. De acties komen uit useConceptActies.
import { soortLabel, agentLabel } from '~~/shared/concepten'
const props = defineProps<{ concept: any; compact?: boolean }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const c = computed(() => props.concept)
const aanpassen = ref(false)
const tekst = ref('')
const onderwerp = ref('')
watch(() => props.concept, (x) => { tekst.value = x?.concept?.tekst ?? ''; onderwerp.value = x?.concept?.onderwerp ?? '' }, { immediate: true })
const { bezig, besluit: doeBesluit, verstuur, wa, waKan, waGeenToestemming, verstuurWa, kopieer } = useConceptActies(c, () => emit('gewijzigd'))
async function besluit(b: 'goedkeuren' | 'verwerpen', metTekst = false) {
  if (await doeBesluit(b, metTekst ? { tekst: tekst.value, onderwerp: onderwerp.value } : undefined)) aanpassen.value = false
}
</script>

<template>
  <article class="kaart cn-kaart" :data-test="`concept-${c.id}`">
    <header class="cn-kop">
      <span class="pil pil--leeg">{{ soortLabel(c.concept?.type) }}</span>
      <span class="meta">{{ agentLabel(c.agent) }}<template v-if="c.accountNaam"> · <NuxtLink :to="`/accounts/${c.accountId}`">{{ c.accountNaam }}</NuxtLink></template></span>
      <span v-if="c.concept?.stijlscore" class="pil pil--leeg" :title="`${c.concept.woorden} van ${c.concept.grens} woorden`">stijl {{ c.concept.stijlscore }}</span>
      <span v-if="c.status !== 'klaar'" class="pil">{{ c.status === 'verworpen' ? 'afgewezen' : c.status }}</span>
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
          <button type="button" class="dd-act" data-test="concept-verwerpen" @click="besluit('verwerpen')">Afwijzen</button>
        </template>
        <template v-else>
          <button type="button" class="dd-act dd-act--primair" data-test="concept-bewaar-goedkeur" @click="besluit('goedkeuren', true)">Goedkeuren</button>
          <button type="button" class="dd-act" @click="aanpassen = false">Annuleren</button>
        </template>
      </template>
      <template v-else-if="c.status === 'goedgekeurd'">
        <button v-if="c.concept?.type === 'mail'" type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="concept-verstuur" @click="verstuur">Verstuur</button>
        <a v-if="c.links?.mailto" :href="c.links.mailto" class="dd-act" data-test="concept-mailto">Verstuur via je mail</a>
        <button v-if="c.concept?.type === 'whatsapp' && waKan" type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="concept-verstuur-wa" @click="verstuurWa">Verstuur via WhatsApp</button>
        <a v-if="c.links?.whatsapp && !waGeenToestemming" :href="c.links.whatsapp" target="_blank" rel="noopener" class="dd-act" data-test="concept-wa-link">{{ c.concept?.type === 'whatsapp' ? 'Open in WhatsApp' : 'WhatsApp' }}</a>
        <span v-if="waGeenToestemming && wa" class="meta">Geen toestemming voor WhatsApp</span>
        <button v-if="c.concept?.tekst" type="button" class="dd-act" @click="kopieer">Kopieer</button>
      </template>
    </div>
    <p v-if="!compact" class="meta cn-noot">De agent voert niets uit. Jij keurt goed en belt, mailt of bezoekt zelf.</p>
  </article>
</template>
