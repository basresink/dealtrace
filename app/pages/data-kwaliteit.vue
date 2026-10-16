<script setup lang="ts">
// Datakwaliteit: welke gegevens ontbreken bij de accounts, contacten, taken en afspraken die je mag zien.
// Bovenaan de score, daaronder per gat een kaart met aantal, uitleg en een knop naar de gefilterde
// prospectlijst, of een uitklapbare lijst met links naar de accountkaart, het contact of de taak.
import { KWALITEIT_GROEPEN } from '~~/shared/datakwaliteit'

const { functie } = useMe()
const aan = !!functie('data.kwaliteit')?.beschikbaar
const { data, pending } = await useFetch<any>('/api/data-kwaliteit', { immediate: aan, default: () => null })
const open = ref<Record<string, boolean>>({})
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
                    <NuxtLink v-else-if="c.link" :to="c.link" class="dd-act" data-test="dk-filter"><Icoon naam="Filter" :grootte="14" />Toon in lijst</NuxtLink>
                    <button v-else type="button" class="dd-act" :aria-expanded="!!open[c.sleutel]" data-test="dk-uitklap" @click="open[c.sleutel] = !open[c.sleutel]">
                      <Icoon naam="ChevronDown" :grootte="14" class="dk-pijl" :class="{ 'dk-pijl--open': open[c.sleutel] }" />{{ open[c.sleutel] ? 'Verberg de lijst' : c.aantal === 1 ? 'Toon het item' : c.meer ? `Toon de eerste ${c.voorbeelden.length}` : `Toon de ${c.aantal}` }}
                    </button>
                  </div>
                  <ul v-if="open[c.sleutel] && !c.link" class="dk-lijst" data-test="dk-lijst">
                    <li v-for="v in c.voorbeelden" :key="v.id"><NuxtLink :to="v.link" class="dk-rij"><span class="dk-rij-naam">{{ v.naam }}</span><span v-if="v.sub" class="meta">{{ v.sub }}</span><Icoon naam="ArrowRight" :grootte="14" class="dk-rij-pijl" /></NuxtLink></li>
                    <li v-if="c.meer" class="meta dk-meer">En nog {{ getal(c.meer) }}. Los eerst deze op.</li>
                  </ul>
                </article>
              </div>
            </section>
          </template>
        </div>
      </section>
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
.dk-pijl { transition: transform var(--transition-fast); }
.dk-pijl--open { transform: rotate(180deg); }
.dk-lijst { margin: 4px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--border); max-height: 360px; overflow-y: auto; }
.dk-rij { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 6px 0; border-bottom: 1px solid var(--border); color: inherit; text-decoration: none; }
.dk-rij:hover .dk-rij-naam { text-decoration: underline; }
.dk-rij-naam { flex: 1; min-width: 0; overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.dk-rij .meta { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dk-rij-pijl { flex: 0 0 auto; color: var(--muted); }
.dk-meer { padding: 8px 0; }
@media (max-width: 720px) {
  .dk-score-kaart { flex-direction: column; align-items: stretch; gap: 12px; }
  .dk-raster { grid-template-columns: 1fr; }
  .dk-voet .dd-act { min-height: 44px; }
  .dk-rij { flex-wrap: wrap; }
  .dk-rij .meta { flex-basis: 100%; order: 3; }
}
</style>
