<script setup lang="ts">
// Datakwaliteit: welke gegevens ontbreken bij de accounts, contacten, taken en afspraken die je mag zien.
// Bovenaan de score, daaronder per gat een kaart met aantal en uitleg. "Bekijk" opent de flyout met
// de regels (naam, account, wat er ontbreekt) die doorklikken naar de accountkaart of het contact;
// de gefilterde prospectlijst staat als extra knop in de flyout. ?categorie= opent de flyout direct.
// Eigen velden met "Meenemen in Datakwaliteit" komen als "Zonder <veldnaam>" in hun groep.
import { KWALITEIT_GROEPEN } from '~~/shared/datakwaliteit'

const { functie } = useMe()
const aan = !!functie('data.kwaliteit')?.beschikbaar
const { data, pending } = await useFetch<any>('/api/data-kwaliteit', { immediate: aan, default: () => null })
const route = useRoute()
const router = useRouter()
const gekozen = computed(() => {
  const k = route.query.categorie
  return typeof k === 'string' ? (data.value?.categorieen ?? []).find((c: any) => c.sleutel === k) ?? null : null
})
function openCategorie(sleutel: string | null) {
  const query = { ...route.query }
  if (sleutel) query.categorie = sleutel
  else delete query.categorie
  router.replace({ query })
}
const groepen = computed(() => KWALITEIT_GROEPEN.map((g) => ({ naam: g, items: (data.value?.categorieen ?? []).filter((c: any) => c.groep === g) })).filter((g) => g.items.length))
const BEREIK: Record<string, string> = { eigen: 'Je eigen accounts', team: 'De accounts van je teams', alles: 'Alle accounts van je organisatie' }
const scoreKleur = computed(() => (!data.value ? '' : data.value.score >= 85 ? 'dk-score--goed' : data.value.score >= 60 ? 'dk-score--matig' : 'dk-score--laag'))
const getal = (n: number) => n.toLocaleString('nl-NL')
useHead({ title: 'Datakwaliteit · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="data.kwaliteit" />
    <template v-else>
      <PaginaKop kicker="Rapportages · Datakwaliteit" titel="Datakwaliteit" uitleg="Welke gegevens ontbreken, waarom dat ertoe doet en waar je het oplost." helpartikel="datakwaliteit">
        <template #acties>
          <NuxtLink to="/mijn-dashboard" class="dd-actie dd-actie--secundair" data-test="naar-dashboard"><Icoon naam="ArrowLeft" class="dd-actie-icoon" />Mijn dashboard</NuxtLink>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <p v-if="pending && !data" class="meta">Laden...</p>
          <template v-if="data">
            <article class="kaart dk-score-kaart" data-test="dk-score">
              <div class="dk-score" :class="scoreKleur">
                <span class="stat-label">Compleet</span>
                <span class="dk-score-getal tnum" data-test="dk-score-getal">{{ data.score }}%</span>
              </div>
              <div class="dk-score-tekst">
                <div class="dk-balk" role="img" :aria-label="`${data.score} procent compleet`"><div class="dk-balk-vul" :class="scoreKleur" :style="{ width: `${data.score}%` }" /></div>
                <p class="dk-score-zin">
                  <template v-if="data.gaten">{{ getal(data.gaten) }} {{ data.gaten === 1 ? 'gat' : 'gaten' }} in {{ data.categorieen.filter((c: any) => c.aantal).length }} van {{ data.categorieen.length }} controles.</template>
                  <template v-else>Alles is compleet. Mooi zo.</template>
                </p>
                <p class="meta" data-test="dk-bereik">{{ BEREIK[data.bereik] }}</p>
              </div>
            </article>

            <section v-for="g in groepen" :key="g.naam" class="mt-24" :data-groep="g.naam">
              <h2 class="dk-groep-kop">{{ g.naam }}</h2>
              <div class="dk-raster">
                <article v-for="c in g.items" :key="c.sleutel" class="kaart dk-kaart" :class="{ 'dk-kaart--leeg': !c.aantal }" :data-categorie="c.sleutel" data-test="dk-categorie">
                  <header class="dk-kop">
                    <span class="dk-icoon" :class="{ 'dk-icoon--ok': !c.aantal }"><Icoon :naam="c.aantal ? c.icoon : 'CircleCheck'" :grootte="18" /></span>
                    <h3 class="dk-titel">{{ c.titel }}</h3>
                    <span class="dk-aantal tnum" data-test="dk-aantal">{{ getal(c.aantal) }}</span>
                  </header>
                  <p class="dk-uitleg">{{ c.uitleg }}</p>
                  <p v-if="c.noemer" class="meta">{{ getal(c.aantal) }} van {{ getal(c.noemer) }}</p>
                  <div class="dk-voet">
                    <span v-if="!c.aantal" class="pil pil--groen">In orde</span>
                    <button v-else type="button" class="dd-act" aria-haspopup="dialog" data-test="dk-open" @click="openCategorie(c.sleutel)">
                      <Icoon naam="List" :grootte="14" />{{ c.aantal === 1 ? 'Bekijk het item' : `Bekijk de ${getal(c.aantal)}` }}
                    </button>
                    <span v-if="c.eigenVeld" class="pil pil--grijs" title="Eigen veld">Eigen veld</span>
                  </div>
                </article>
              </div>
            </section>
          </template>
        </div>
      </section>
      <KwaliteitFlyout :categorie="gekozen" @sluit="openCategorie(null)" />
    </template>
  </div>
</template>

<style scoped>
.dk-score-kaart { display: flex; gap: 24px; align-items: center; }
.dk-score { display: flex; flex-direction: column; gap: 4px; min-width: 120px; }
.dk-score-getal { font-size: 48px; font-weight: 800; line-height: 1; }
.dk-score--goed { color: var(--green); }
.dk-score--matig { color: var(--orange-dark); }
.dk-score--laag { color: var(--red); }
.dk-score-tekst { flex: 1; min-width: 0; }
.dk-balk { height: 10px; background: var(--surface); border: 1px solid var(--border); }
.dk-balk-vul { height: 100%; background: currentcolor; }
.dk-balk-vul.dk-score--goed { background: var(--green); }
.dk-balk-vul.dk-score--matig { background: var(--orange); }
.dk-balk-vul.dk-score--laag { background: var(--red); }
.dk-score-zin { margin: 12px 0 4px; font-size: 15px; font-weight: 600; }
.dk-groep-kop { margin: 0 0 16px; font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.dk-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; align-items: start; }
.dk-kaart { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.dk-kaart--leeg { background: var(--surface); }
.dk-kop { display: flex; align-items: center; gap: 12px; }
.dk-icoon { display: inline-flex; flex: 0 0 36px; align-items: center; justify-content: center; width: 36px; height: 36px; background: var(--ink); color: var(--yellow); }
.dk-icoon--ok { background: var(--green-zacht); color: var(--green); }
.dk-titel { flex: 1; min-width: 0; margin: 0; font-size: 14px; font-weight: 700; }
.dk-aantal { font-size: 24px; font-weight: 800; }
.dk-uitleg { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.dk-voet { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
@media (max-width: 720px) {
  .dk-score-kaart { flex-direction: column; align-items: stretch; gap: 12px; }
  .dk-raster { grid-template-columns: 1fr; }
  .dk-voet .dd-act { min-height: 44px; }
}
</style>
