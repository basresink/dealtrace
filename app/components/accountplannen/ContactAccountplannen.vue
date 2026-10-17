<script setup lang="ts">
// Accountplannen van een contact (venster Accountplan onder Meer op de contactkaart): de plannen waarin dit
// contact staat, als contactpersoon van het plan of met een actie in het actieplan
// (GET /api/contacten/:id/accountplannen). Per plan de status, de geldigheid, de voortgang, de acties van dit
// contact en een link naar het plan.
import { WEERGAVE_LABEL, dagKort, geldigheidLabel } from '~~/shared/accountplannen'
defineProps<{ plannen: any[]; roepnaam: string }>()
</script>

<template>
  <div class="cap" data-test="contact-accountplannen">
    <article v-for="p in plannen" :key="p.id" class="kaart cap-plan" :data-test="`contact-accountplan-${p.id}`">
      <header class="cap-kop">
        <span class="cap-kicker">{{ p.weergave === 'actueel' ? 'Lopend accountplan' : 'Accountplan' }}</span>
        <NuxtLink :to="`/accountplannen/${p.id}`" class="cap-titel">{{ p.titel }}</NuxtLink>
        <span class="cap-meta tnum"><Label soort="plan" :waarde="p.weergave" :tekst="WEERGAVE_LABEL[p.weergave as 'actueel']" /> {{ geldigheidLabel(p) }}<template v-if="p.eigenaar"> · {{ p.eigenaar.naam.replace(/^Testgebruiker /, '') }}</template></span>
      </header>
      <p class="cap-rol">{{ p.alsContactpersoon ? `${roepnaam} is contactpersoon in dit plan.` : `${roepnaam} heeft een actie in het actieplan.` }} {{ p.voortgang.totaal ? `${p.voortgang.klaar} van ${p.voortgang.totaal} acties klaar.` : 'Nog geen acties.' }}</p>
      <ul v-if="p.acties.length" class="cap-acties" role="list">
        <li v-for="x in p.acties" :key="x.id" class="cap-actie" :class="{ 'cap-actie--klaar': x.klaar }">
          <Icoon :naam="x.klaar ? 'CircleCheck' : 'CircleDot'" :grootte="16" class="cap-actie-icoon" />
          <span><span class="cap-actie-titel">{{ x.titel }}</span><span class="meta"> · {{ x.dueDate ? dagKort(String(x.dueDate).slice(0, 10)) : 'geen datum' }}</span></span>
        </li>
      </ul>
      <NuxtLink :to="`/accountplannen/${p.id}`" class="dd-actie dd-actie--zwart cap-open" data-test="contact-accountplan-open">Open accountplan<Icoon naam="ArrowRight" class="dd-actie-icoon" /></NuxtLink>
    </article>
  </div>
</template>

<style scoped>
.cap { display: flex; flex-direction: column; gap: 12px; }
.cap-plan { display: flex; flex-direction: column; gap: 10px; }
.cap-kop { display: flex; flex-direction: column; gap: 4px; }
.cap-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.cap-titel { font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.cap-titel:hover { text-decoration: underline; }
.cap-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.cap-rol { margin: 0; font-size: 13px; color: var(--ink-soft); }
.cap-acties { margin: 0; padding: 0; list-style: none; }
.cap-actie { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.cap-actie:last-child { border-bottom: 0; }
.cap-actie-icoon { flex: none; margin-top: 2px; color: var(--muted); }
.cap-actie--klaar .cap-actie-icoon { color: var(--green); }
.cap-actie--klaar .cap-actie-titel { color: var(--muted); text-decoration: line-through; }
.cap-actie-titel { font-weight: 600; overflow-wrap: anywhere; }
.cap-open { align-self: flex-start; }
</style>
