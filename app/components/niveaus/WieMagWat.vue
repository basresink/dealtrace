<script setup lang="ts">
// Wie mag wat (leesoverzicht): per onderdeel wat een accountmanager, salesmanager en beheerder mag. De
// rechten staan vast in Dealtrace (shared/permissions.ts); een functie moet daarnaast aanstaan.
import { ROLLEN_KLANT, ROL_LABEL_KLANT } from '~~/shared/niveauOverzicht'

defineProps<{ rechten: { onderdeel: string; label: string; perRol: Record<string, string> }[] }>()
</script>

<template>
  <article class="kaart" data-test="wie-mag-wat">
    <header class="kaart-kop"><h2 class="kaart-titel">Wie mag wat</h2></header>
    <p class="kaart-meta">Wat elke rol mag, los van het niveau. Een salesmanager werkt met de mensen in zijn eigen teams. Deze rechten staan vast; de rol van iemand kies je bij Gebruikers.</p>
    <div class="tabel-wrap mt-16">
      <table class="tabel tabel--kaarten wmw-tabel">
        <thead><tr><th>Onderdeel</th><th v-for="r in ROLLEN_KLANT" :key="r">{{ ROL_LABEL_KLANT[r] }}</th></tr></thead>
        <tbody>
          <tr v-for="o in rechten" :key="o.onderdeel" data-test="recht-rij" :data-onderdeel="o.onderdeel">
            <td><strong>{{ o.label }}</strong></td>
            <td v-for="r in ROLLEN_KLANT" :key="r" :data-rol="r"><span class="wmw-rol">{{ ROL_LABEL_KLANT[r] }}</span>{{ o.perRol[r] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>

<style scoped>
.wmw-rol { display: none; }
@media (max-width: 767px) {
  .wmw-rol { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
}
</style>
