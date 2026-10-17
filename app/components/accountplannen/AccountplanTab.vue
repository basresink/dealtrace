<script setup lang="ts">
// Accountplan op de accountkaart (venster Accountplan onder Meer; inFlyout laat de eigen titel weg): het lopende accountplan van dit account met de samenvatting
// (de ingevulde blokken), het actieplan met de voortgang en een link naar /accountplannen/:id. Eerdere
// plannen staan eronder. Zonder plan een lege staat met "Maak accountplan" voor een prospect; een plan voor
// een klant hoort in DealDrive. Alleen als nav.accountplannen aanstaat (de pagina toont het tabblad dan).
import { ACCOUNTPLAN_SECTIES, WEERGAVE_LABEL, dagKort, geldigheidLabel } from '~~/shared/accountplannen'
const props = defineProps<{ account: { id: string; naam: string; soort?: string | null }; inFlyout?: boolean }>()
const isKlant = computed(() => props.account.soort === 'klant')
const { data: lijst } = await useFetch<any>('/api/accountplannen', { query: { accountId: props.account.id }, default: () => ({ plannen: [] }) })
// Het lopende plan: het eerste actuele, anders het meest recente.
const lopendId = computed<string | null>(() => (lijst.value.plannen.find((p: any) => p.weergave === 'actueel') ?? lijst.value.plannen[0])?.id ?? null)
const { data: plan } = await useFetch<any>(() => `/api/accountplannen/${lopendId.value}`, { immediate: !!lopendId.value, watch: [lopendId], default: () => null })
const overige = computed(() => lijst.value.plannen.filter((p: any) => p.id !== lopendId.value))
const samenvatting = computed(() => (plan.value ? ACCOUNTPLAN_SECTIES.filter((s) => (plan.value.secties?.[s.sleutel] ?? '').trim()).map((s) => ({ ...s, tekst: plan.value.secties[s.sleutel] as string })) : []))
const nieuwOpen = ref(false)
const acties = computed<any[]>(() => (plan.value?.acties ?? []).filter((x: any) => x.status !== 'geannuleerd'))
</script>

<template>
  <div class="apt" data-test="ak-accountplannen">
    <div v-if="!inFlyout || (!isKlant && lijst.plannen.length)" class="apt-tabkop" :class="{ 'apt-tabkop--flyout': inFlyout }">
      <h2 v-if="!inFlyout" class="apt-tabtitel">Accountplan</h2>
      <button v-if="!isKlant && lijst.plannen.length" type="button" class="dd-actie dd-actie--secundair" data-test="ak-accountplan-nieuw" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Accountplan</button>
    </div>

    <LegeStaat v-if="!lijst.plannen.length" kicker="Accountplan" :titel="isKlant ? 'Een plan voor een klant maak je in DealDrive.' : `Nog geen accountplan voor ${account.naam}.`" :tekst="isKlant ? 'Accountplannen in Dealtrace zijn voor topprospects.' : 'Een plan geeft deze topprospect doelen, een strategie en acties met een datum. Elke actie wordt een taak op dit account.'" data-test="apt-leeg">
      <button v-if="!isKlant" type="button" class="dd-actie dd-actie--primair mt-16" data-test="ak-accountplan-nieuw" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Maak accountplan</button>
    </LegeStaat>

    <template v-else>
      <article v-if="plan" class="kaart apt-plan" data-test="apt-lopend">
        <header class="apt-kop">
          <div class="apt-kop-tekst">
            <span class="apt-kicker">{{ plan.weergave === 'actueel' ? 'Lopend accountplan' : 'Laatste accountplan' }}</span>
            <NuxtLink :to="`/accountplannen/${plan.id}`" class="apt-titel" :data-test="`ak-accountplan-${plan.id}`">{{ plan.titel }}</NuxtLink>
            <span class="apt-meta tnum"><Label soort="plan" :waarde="plan.weergave" :tekst="WEERGAVE_LABEL[plan.weergave as 'actueel']" /> {{ geldigheidLabel(plan) }}<template v-if="plan.eigenaar"> · {{ plan.eigenaar.naam.replace(/^Testgebruiker /, '') }}</template></span>
          </div>
          <NuxtLink :to="`/accountplannen/${plan.id}`" class="dd-actie dd-actie--zwart" data-test="apt-open">Open accountplan<Icoon naam="ArrowRight" class="dd-actie-icoon" /></NuxtLink>
        </header>

        <div class="apt-voortgang" data-test="apt-voortgang">
          <span class="apt-voortgang-tekst">{{ plan.voortgang.totaal ? `${plan.voortgang.klaar} van ${plan.voortgang.totaal} acties klaar` : 'Nog geen acties in het actieplan' }}</span>
          <span class="apt-balk" role="img" :aria-label="`${plan.voortgang.klaar} van ${plan.voortgang.totaal} acties klaar`"><span class="apt-balk-vul" :style="{ width: `${plan.voortgang.percentage}%` }" /></span>
        </div>

        <div class="apt-raster">
          <section class="apt-blok" data-test="apt-samenvatting">
            <h3 class="apt-blok-titel">Samenvatting</h3>
            <p v-if="!samenvatting.length" class="meta">De blokken van dit plan zijn nog leeg. Vul doelen en strategie in op de pagina van het plan.</p>
            <dl v-else class="apt-secties">
              <div v-for="s in samenvatting" :key="s.sleutel" class="apt-sectie"><dt>{{ s.titel }}</dt><dd>{{ s.tekst }}</dd></div>
            </dl>
          </section>
          <section class="apt-blok" data-test="apt-acties">
            <h3 class="apt-blok-titel">Acties</h3>
            <p v-if="!acties.length" class="meta">Nog geen acties. Elke actie met een datum wordt een taak op dit account.</p>
            <ul v-else class="apt-acties" role="list">
              <li v-for="x in acties" :key="x.id" class="apt-actie" :class="{ 'apt-actie--klaar': x.klaar }">
                <Icoon :naam="x.klaar ? 'CircleCheck' : 'CircleDot'" :grootte="16" class="apt-actie-icoon" />
                <span class="apt-actie-tekst"><span class="apt-actie-titel">{{ x.titel }}</span><span class="meta">{{ x.dueDate ? dagKort(String(x.dueDate).slice(0, 10)) : 'geen datum' }}<template v-if="x.contactNaam"> · {{ x.contactNaam }}</template><template v-if="x.klaar"> · klaar</template></span></span>
              </li>
            </ul>
          </section>
        </div>
      </article>

      <article v-if="overige.length" class="kaart mt-16" data-test="apt-eerder">
        <header class="kaart-kop"><h3 class="kaart-titel">Andere plannen</h3></header>
        <ul class="apt-lijst" role="list">
          <li v-for="p in overige" :key="p.id">
            <NuxtLink :to="`/accountplannen/${p.id}`" class="apt-link" :data-test="`ak-accountplan-${p.id}`">
              <span class="apt-link-naam">{{ p.titel }}</span>
              <span class="apt-meta tnum"><Label soort="plan" :waarde="p.weergave" :tekst="WEERGAVE_LABEL[p.weergave as 'actueel']" /> {{ geldigheidLabel(p) }} · {{ p.acties.klaar }} van {{ p.acties.totaal }} acties klaar</span>
            </NuxtLink>
          </li>
        </ul>
      </article>
    </template>

    <AccountplanNieuwFlyout v-if="!isKlant" :open="nieuwOpen" :account="account" @sluit="nieuwOpen = false" />
  </div>
</template>

<style scoped>
/* Kop van het tabblad, gelijk aan de andere tabbladen (KaartTabbladen). */
.apt-tabkop { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 20px; }
.apt-tabkop--flyout { justify-content: flex-end; margin-bottom: 0; }
.apt-tabtitel { margin: 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
.apt-plan { display: flex; flex-direction: column; gap: 18px; }
.apt-kop { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
.apt-kop-tekst { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.apt-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.apt-titel { font-family: var(--font-serif); font-size: 20px; font-weight: 700; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.apt-titel:hover { text-decoration: underline; }
.apt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.apt-voortgang { display: flex; flex-direction: column; gap: 6px; }
.apt-voortgang-tekst { font-size: 13px; font-weight: 600; }
.apt-balk { display: block; height: 6px; background: var(--bg); border: 1px solid var(--border); }
.apt-balk-vul { display: block; height: 100%; background: var(--yellow); }
.apt-raster { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.apt-blok-titel { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.apt-secties { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.apt-sectie dt { font-size: 13px; font-weight: 700; }
.apt-sectie dd { display: -webkit-box; margin: 2px 0 0; overflow: hidden; font-size: 13px; line-height: 1.5; color: var(--ink-soft); white-space: pre-line; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.apt-acties { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.apt-actie { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.apt-actie:last-child { border-bottom: 0; }
.apt-actie-icoon { flex: none; margin-top: 2px; color: var(--muted); }
.apt-actie--klaar .apt-actie-icoon { color: var(--green); }
.apt-actie-tekst { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.apt-actie-titel { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.apt-actie--klaar .apt-actie-titel { color: var(--muted); text-decoration: line-through; }
.apt-lijst { margin: 0; padding: 0; list-style: none; }
.apt-lijst li { border-bottom: 1px solid var(--border); }
.apt-lijst li:last-child { border-bottom: 0; }
.apt-link { display: flex; flex-direction: column; gap: 4px; min-height: 44px; padding: 8px 0; color: var(--ink); text-decoration: none; }
.apt-link:hover .apt-link-naam { text-decoration: underline; }
.apt-link-naam { font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
</style>
