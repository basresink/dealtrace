<script setup lang="ts">
// De accounts achter een rij van de bezoek- of meetinganalyse (opzet DealDrive): langst stil eerst,
// met soort, klasse, plaats en het laatste bezoek of de laatste meeting. Per account plan je meteen
// een afspraak en, bij bezoeken, zet je hem klaar voor een regiodag. Op de telefoon een schuifvenster.
import type { FlyoutAccount } from '~~/shared/afspraakAnalyse'

const props = defineProps<{ open: boolean; kicker: string; titel: string; accounts: FlyoutAccount[]; kolomLaatste: string; planLabel: string; klaarzetten?: boolean }>()
const emit = defineEmits<{ sluit: []; plan: [a: { id: string; naam: string }]; klaarzet: [a: { id: string; naam: string }] }>()
const laatsteLabel = (a: FlyoutAccount) => (a.dagenGeleden === null ? 'nooit' : a.dagenGeleden === 0 ? 'vandaag' : `${a.dagenGeleden} ${a.dagenGeleden === 1 ? 'dag' : 'dagen'}`)
const datum = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' })
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="aaf-titel" breedte="breed" paneel-klasse="aaf" :sluit-test="'analyse-flyout-sluit'" data-test="analyse-flyout" @sluit="emit('sluit')">
      <template #kop>
            <span class="fo-kicker">{{ kicker }}</span>
            <h2 id="aaf-titel" class="fo-titel">{{ titel }}</h2>
            <p class="aaf-sub">{{ accounts.length }} {{ accounts.length === 1 ? 'account' : 'accounts' }}, langst stil eerst. Klik een naam om de accountkaart te openen.</p></template>
        <div class="fo-body">
          <LegeStaat v-if="!accounts.length" titel="Geen accounts in deze selectie." />
          <template v-else>
            <div class="tabel-wrap aaf-groot">
              <table class="tabel">
                <thead><tr><th>Account</th><th>Soort</th><th>Klasse</th><th>Plaats</th><th>{{ kolomLaatste }}</th><th aria-label="Acties" /></tr></thead>
                <tbody>
                  <tr v-for="a in accounts" :key="a.id" :data-test="`aaf-rij-${a.id}`">
                    <td class="cel-naam"><NuxtLink :to="`/accounts/${a.id}`" class="tabel-link">{{ a.naam }}</NuxtLink></td>
                    <td><span class="pil pil--grijs">{{ a.soort === 'klant' ? 'Klant' : 'Prospect' }}</span></td>
                    <td>{{ a.klasse ?? '—' }}</td>
                    <td>{{ a.plaats ?? '—' }}</td>
                    <td :class="`aaf-laatst aaf-laatst--${a.toon}`"><span :title="a.laatste ? datum(a.laatste) : undefined">{{ laatsteLabel(a) }}</span><span v-if="a.laatsteSoort" class="pil pil--grijs aaf-soort">{{ a.laatsteSoort }}</span></td>
                    <td><span class="cel-acties"><button type="button" class="dd-act" :data-test="`aaf-plan-${a.id}`" @click="emit('plan', { id: a.id, naam: a.naam })"><Icoon naam="Plus" :grootte="14" />{{ planLabel }}</button><button v-if="klaarzetten" type="button" class="dd-act" @click="emit('klaarzet', { id: a.id, naam: a.naam })">Klaarzetten</button></span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul class="aaf-lijst aaf-klein">
              <li v-for="a in accounts" :key="a.id" class="aaf-item">
                <div class="aaf-item-tekst">
                  <NuxtLink :to="`/accounts/${a.id}`" class="tabel-link">{{ a.naam }}</NuxtLink>
                  <span class="aaf-meta">{{ a.soort === 'klant' ? 'Klant' : 'Prospect' }}<template v-if="a.klasse"> · klasse {{ a.klasse }}</template><template v-if="a.plaats"> · {{ a.plaats }}</template> · <span :class="`aaf-laatst--${a.toon}`">{{ kolomLaatste.toLowerCase() }} {{ laatsteLabel(a) }}</span></span>
                </div>
                <span class="aaf-item-acties"><button type="button" class="dd-act" @click="emit('plan', { id: a.id, naam: a.naam })"><Icoon naam="Plus" :grootte="14" />{{ planLabel }}</button><button v-if="klaarzetten" type="button" class="dd-act" @click="emit('klaarzet', { id: a.id, naam: a.naam })">Klaarzetten</button></span>
              </li>
            </ul>
          </template>
        </div>
    </FlyoutShell>
</template>

<style scoped>
:global(.fo-panel.aaf) { max-width: min(860px, 100vw); }
.aaf-sub { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
.aaf-laatst { white-space: nowrap; }
.aaf-laatst--nooit { color: var(--red); font-weight: 700; }
.aaf-laatst--stil { color: var(--orange-dark, var(--orange)); font-weight: 700; }
.aaf-soort { margin-left: 6px; }
.aaf-lijst { list-style: none; margin: 0; padding: 0; }
.aaf-item { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.aaf-item-tekst { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.aaf-meta { font-size: 12px; color: var(--muted); }
.aaf-item-acties { display: flex; flex-wrap: wrap; gap: 8px; }
.aaf-item-acties .dd-act { min-height: 44px; }
.aaf-klein { display: none; }
@media (max-width: 719px) { .aaf-groot { display: none; } .aaf-klein { display: block; } }
</style>
