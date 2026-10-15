<script setup lang="ts">
// Niveaus (6.1, B18). Welke functies bij welk niveau aanstaan, stelt de founder in
// op /platform/features. De beheerder kiest hier alleen het standaardniveau en
// "Iedereen ziet alles" (alles uit het pakket aan, nooit boven pakket of rol).
import { NIVEAUS, NIVEAU_LABEL } from '~~/shared/types'
const { me, laad } = useMe()
if (me.value?.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const { data: inst } = await useFetch<Record<string, any>>('/api/settings', { default: () => ({}) })
const n = reactive({ iedereenAlles: false, standaardNiveauNieuweGebruiker: 'beginner', ...(inst.value.niveaus ?? {}) })
const { status, wijzig } = useAutoBewaar(async (value) => {
  await $fetch('/api/settings/niveaus', { method: 'PUT', body: { value } })
  await laad()
})
watch(n, (v) => wijzig({ ...v }), { deep: true })
useHead({ title: 'Niveaus · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Niveaus" titel="Niveaus" uitleg="Een niveau bepaalt welke functies voor iemand aanstaan." helpartikel="niveaus" />
    <section class="section section--laatste">
      <div class="container">
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Voor je organisatie</h2><span class="bewaar-status" aria-live="polite" data-test="bewaar-niveaus">{{ status }}</span></header>
          <div class="schakel-rij">
            <div><span class="schakel-naam">Iedereen ziet alles</span><span class="veld-uitleg">Zet alles uit je pakket aan voor iedereen, los van het niveau. Rollen blijven gelden.</span></div>
            <Schakelaar :aan="n.iedereenAlles" label="Iedereen ziet alles" data-test="iedereen-alles" @wissel="n.iedereenAlles = $event" />
          </div>
          <div class="veld mt-16"><span class="veld-label">Standaardniveau voor nieuwe gebruikers</span>
            <div class="keuzegroep" role="group" aria-label="Standaardniveau">
              <button v-for="niv in NIVEAUS" :key="niv" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': n.standaardNiveauNieuweGebruiker === niv }" :aria-pressed="n.standaardNiveauNieuweGebruiker === niv" @click="n.standaardNiveauNieuweGebruiker = niv">{{ NIVEAU_LABEL[niv] }}</button>
            </div>
          </div>
          <p class="veld-uitleg mt-16">Welke functies bij Beginner, Gevorderd en Expert horen, stelt Dealtrace in. Het niveau per persoon zet je bij Gebruikers.</p>
        </article>
      </div>
    </section>
  </div>
</template>
