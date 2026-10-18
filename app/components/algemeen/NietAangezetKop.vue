<script setup lang="ts">
// Directe link naar een pagina die niet aanstaat: de paginakop met kicker
// "Nog niet aangezet" en dezelfde uitleg als de flyout; nooit een foutpagina (6.1).
import { functie } from '~~/shared/functies'
import { NIVEAU_LABEL, NIVEAUS, ROL_LABEL, type Niveau, type Rol } from '~~/shared/types'
const props = defineProps<{ sleutel: string }>()
const { me, functie: meFunctie } = useMe()
const { magNaar } = useFunctie()
const f = computed(() => functie(props.sleutel))
// Hoort de functie bij een rol die je niet hebt, dan helpt een hoger niveau niet: zeg wie het aanpast.
const rolTekst = computed(() => {
  const rollen = f.value?.rollen
  const rol = (me.value?.gebruiker.rol === 'founder' ? 'beheerder' : me.value?.gebruiker.rol) as Rol | undefined
  if (!rollen || rollen === 'iedereen' || !rol || rollen.includes(rol)) return null
  return `Alleen de ${rollen.map((r) => ROL_LABEL[r].toLowerCase()).join(' of de ')} past dit aan.`
})
// Kanalen: de afkoeling staat op Terugkomen; link erheen als je die pagina mag zien.
const verder = computed(() => (props.sleutel === 'instellingen.kanalen' && magNaar('/instellingen/terugkomen') ? { to: '/instellingen/terugkomen?tab=afkoeling', tekst: 'Bekijk de afkoeling bij Terugkomen' } : null))
// Zonder niveau waarop hij aangaat, staat de functie voor de hele organisatie uit (de founder zette hem uit).
// Staat hij aan bij een lager niveau dan het jouwe, dan zette je organisatie hem voor jouw niveau uit.
const niveau = computed(() => {
  const n = meFunctie(props.sleutel)?.aanVanaf as Niveau | null | undefined
  const mijn = me.value?.gebruiker.niveau as Niveau | undefined
  if (n && mijn && NIVEAUS.indexOf(n) <= NIVEAUS.indexOf(mijn)) return null
  return n ? NIVEAU_LABEL[n] : null
})
</script>

<template>
  <section v-if="f" class="section" data-test="niet-aangezet-pagina">
    <div class="container container--smal">
      <span class="kicker kicker--streep">Nog niet aangezet</span>
      <h1 class="title title--groot">{{ f.naam }}</h1>
      <p class="subtitle subtitle--groot" data-test="niet-aangezet-reden">{{ rolTekst ?? (niveau ? `Deze functie hoort bij ${niveau}.` : 'Deze functie staat voor je organisatie nog niet aan.') }}</p>
      <div class="kaart mt-16">
        <h2 class="kop-kaart">Wat het doet</h2>
        <p class="tekst mt-8">{{ f.uitleg.watHetDoet }}</p>
        <h2 class="kop-kaart mt-16">Tot die tijd</h2>
        <p class="tekst mt-8">{{ f.uitleg.totDieTijd }}</p>
        <div class="dd-acties mt-16">
          <NuxtLink class="dd-act dd-act--primair" :to="`/helpcenter/${f.helpartikel}`"><Icoon naam="BookOpen" class="dd-act-icoon" />Lees hoe het werkt</NuxtLink>
          <NuxtLink v-if="verder" class="dd-act" :to="verder.to" data-test="niet-aangezet-verder">{{ verder.tekst }}</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
