<script setup lang="ts">
// Accountplannen in de opzet van DealDrive (/accountplannen): kop met het aantal actuele plannen, Zoeken en
// "+ Accountplan"; daaronder twee groepen, Actueel en Verlopen en afgerond, met een kaart per plan (soort en
// status als pil, eigenaar, naam, account, geldigheid en de voortgang van het actieplan). Een klik op de kaart
// opent het plan in een venster; "Open accountplan" gaat naar de volledige pagina. Alleen voor Expert.
import { geldigheidLabel, WEERGAVE_LABEL } from '~~/shared/accountplannen'
const { functie } = useMe()
const aan = !!functie('nav.accountplannen')?.beschikbaar
const { open: zoekenOpen } = useZoeken()
const route = useRoute()
const router = useRouter()
const { data, refresh } = await useFetch<any>('/api/accountplannen', { immediate: aan, default: () => ({ plannen: [], actueel: 0 }) })
const actueel = computed(() => data.value.plannen.filter((p: any) => p.weergave === 'actueel'))
const historie = computed(() => data.value.plannen.filter((p: any) => p.weergave !== 'actueel'))
const GROEPEN = computed(() => [
  { id: 'actueel', titel: 'Actueel', uitleg: 'Plannen die nu lopen. Hier stuur je op.', leeg: 'Geen lopend accountplan.', items: actueel.value },
  { id: 'historie', titel: 'Verlopen en afgerond', uitleg: 'De geldigheid is voorbij of het plan is afgesloten. Evalueer het en open een nieuwe periode.', leeg: 'Nog niets afgerond of verlopen.', items: historie.value },
])
// Het venster van een plan staat in de URL (?plan=), zodat terug en vernieuwen werken.
const planId = computed(() => (typeof route.query.plan === 'string' ? route.query.plan : null))
function openPlan(id: string | null) { router.replace({ query: { ...route.query, plan: id ?? undefined } }) }
const nieuwOpen = ref(false)
useHead({ title: 'Accountplannen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.accountplannen" />
    <template v-else>
      <PaginaKop :kicker="`Accountplannen · ${data.actueel} actueel`" titel="Eén plan per klant, elke stap aanwijsbaar." uitleg="Wie zijn grootste klanten een plan geeft, hoeft ze volgend jaar niet terug te winnen." helpartikel="accountplannen">
        <template #acties>
          <button type="button" class="dd-actie dd-actie--secundair dd-actie--icoon" aria-label="Zoeken" title="Zoeken" data-test="ap-zoek" @click="zoekenOpen = true"><Icoon naam="Search" /></button>
          <button type="button" class="dd-actie dd-actie--primair" data-test="ap-nieuw" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Accountplan</button>
        </template>
      </PaginaKop>

      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.plannen.length" kicker="Nog niets" titel="Er is nog geen accountplan." tekst="Begin bij de klant of prospect waar het meest op het spel staat. Eén plan per periode is genoeg. Een plan dat je niet evalueert, is een document en geen sturing." data-test="ap-leeg">
            <button type="button" class="dd-actie dd-actie--zwart" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Eerste accountplan</button>
          </LegeStaat>
          <template v-else>
            <div v-for="g in GROEPEN" :key="g.id" class="ap-groep" :data-test="`ap-groep-${g.id}`">
              <div class="ap-groep-kop"><h2 class="ap-groep-titel">{{ g.titel }}</h2><span class="ap-groep-aantal tnum">{{ g.items.length }}</span></div>
              <p class="ap-groep-uitleg">{{ g.uitleg }}</p>
              <div v-if="!g.items.length" class="ap-groep-leeg" :data-test="`ap-leeg-${g.id}`">{{ g.leeg }}</div>
              <ul v-else class="ap-lijst" role="list">
                <li v-for="p in g.items" :key="p.id" class="ap-kaart" :class="`ap-kaart--${p.weergave}`" :data-test="`ap-kaart-${p.id}`">
                  <button type="button" class="ap-knop" :aria-label="`${p.titel} openen`" @click="openPlan(p.id)">
                    <span class="ap-kop">
                      <span class="ap-pillen">
                        <span class="pil" :class="p.account.soort === 'klant' ? 'pil--blauw' : 'pil--paars'">{{ p.account.soort === 'klant' ? 'KLANT' : 'PROSPECT' }}</span>
                        <span class="pil" :class="{ 'pil--geel': p.weergave === 'actueel', 'pil--rood': p.weergave === 'verlopen', 'pil--zwart': p.weergave === 'afgerond' }">{{ WEERGAVE_LABEL[p.weergave as 'actueel'].toUpperCase() }}</span>
                      </span>
                      <span class="ap-eigenaar">{{ p.eigenaar?.naam ?? 'Niet toegewezen' }}</span>
                    </span>
                    <span class="ap-naam">{{ p.titel }}</span>
                    <span class="ap-account">{{ p.account.naam }}</span>
                    <span class="ap-geldig tnum"><strong>Geldig:</strong> {{ geldigheidLabel(p) }}</span>
                    <span class="ap-voortgang">
                      <span class="ap-cijfers">
                        <span class="ap-cijfer"><span class="ap-num tnum">{{ p.acties.totaal }}</span><span class="ap-label">acties</span></span>
                        <span class="ap-cijfer"><span class="ap-num tnum">{{ p.acties.klaar }}</span><span class="ap-label">klaar</span></span>
                        <span class="ap-cijfer"><span class="ap-num tnum">{{ p.acties.percentage }}%</span><span class="ap-label">voortgang</span></span>
                      </span>
                      <span class="ap-balk" aria-hidden="true"><span class="ap-vul" :style="{ width: `${p.acties.percentage}%` }" /></span>
                    </span>
                  </button>
                  <NuxtLink :to="`/accountplannen/${p.id}`" class="ap-open" :data-test="`ap-open-${p.id}`">Open accountplan <Icoon naam="ArrowRight" :grootte="14" /></NuxtLink>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </section>

      <AccountplanFlyout :plan-id="planId" @sluit="openPlan(null)" @gewijzigd="refresh" @verwijderd="openPlan(null); refresh()" />
      <AccountplanNieuwFlyout :open="nieuwOpen" @sluit="nieuwOpen = false" />
    </template>
  </div>
</template>

<style scoped>
.ap-groep { margin-bottom: 36px; }
.ap-groep:last-child { margin-bottom: 0; }
.ap-groep-kop { display: flex; align-items: baseline; gap: 10px; }
.ap-groep-titel { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
.ap-groep-aantal { font-size: 12px; font-weight: 700; color: var(--muted); }
.ap-groep-uitleg { margin: 4px 0 14px; font-size: 13px; color: var(--muted); }
.ap-groep-leeg { padding: 20px; background: var(--wit); border: 1px dashed var(--border-strong); font-size: 13px; color: var(--muted); }
.ap-lijst { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); }
@media (min-width: 720px) { .ap-lijst { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ap-kaart { display: flex; flex-direction: column; min-width: 0; background: var(--wit); border: 1px solid var(--border); border-left: 4px solid var(--border-strong); }
.ap-kaart--actueel { border-left-color: var(--yellow); }
.ap-kaart--verlopen { border-left-color: var(--red); }
.ap-kaart--afgerond { border-left-color: var(--ink); }
.ap-knop { display: flex; flex-direction: column; width: 100%; padding: 16px 18px 8px; color: var(--ink); text-align: left; background: transparent; border: 0; font: inherit; cursor: pointer; }
.ap-knop:hover { background: var(--surface); }
.ap-knop:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
.ap-kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.ap-pillen { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.ap-eigenaar { font-size: 11px; font-weight: 600; color: var(--muted); text-align: right; }
.ap-naam { font-family: var(--font-serif); font-size: 18px; font-weight: 700; margin-top: 4px; overflow-wrap: anywhere; }
.ap-account { margin-top: 6px; font-size: 13px; color: var(--ink-soft); }
.ap-geldig { margin-top: 6px; font-size: 12px; color: var(--ink-soft); }
.ap-voortgang { display: block; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.ap-cijfers { display: flex; gap: 20px; }
.ap-cijfer { display: flex; flex-direction: column; }
.ap-num { font-family: var(--font-serif); font-size: 18px; font-weight: 700; line-height: 1; }
.ap-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.ap-balk { display: block; margin-top: 8px; height: 6px; background: var(--surface); }
.ap-vul { display: block; height: 100%; background: var(--green); transition: width var(--transition-base); }
.ap-open { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; min-height: 36px; margin: 0 18px 8px; font-size: 12px; font-weight: 700; color: var(--muted); text-decoration: none; }
.ap-open:hover { color: var(--ink); text-decoration: underline; }
@media (max-width: 719px) {
  .ap-open { min-height: var(--touch-target-min); }
  .ap-knop { padding: 16px 16px 8px; }
}
</style>
