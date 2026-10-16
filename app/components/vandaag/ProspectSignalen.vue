<script setup lang="ts">
// "Wat gebeurt bij je prospects vandaag?" (opzet uit DealDrive): inzichten bij je eigen prospects in de
// laatste 48 uur, hoogste relevantie eerst, hooguit zes. Een kaart opent het inzicht.
defineProps<{ lijst: { id: string; titel: string; tekst: string | null; bron: string; bronNaam: string; op: string; relevantie: number; account: { id: string; naam: string } }[] }>()
const wanneer = (op: string) => {
  const u = Math.floor((Date.now() - Date.parse(op)) / 3_600_000)
  return u < 1 ? 'net' : u < 24 ? `${u} uur geleden` : 'gisteren'
}
const initialen = (n: string) => n.replace(/^Test(bedrijf|installatie)?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'DT'
</script>

<template>
  <section data-test="prospect-signalen">
    <div class="sec-head">
      <div>
        <span class="kicker kicker--streep">Inzichten prospects · laatste 48 uur</span>
        <h2 class="title">Wat gebeurt bij je prospects vandaag?</h2>
      </div>
      <NuxtLink to="/inzichten" class="ps-link">Inzichten prospects →</NuxtLink>
    </div>
    <p v-if="!lijst.length" class="ps-leeg">Nog geen prospect-signalen in de laatste 48 uur. De Waarnemer kijkt mee; plan intussen een belblok of start een campagne.</p>
    <div v-else class="ps-raster">
      <NuxtLink v-for="s in lijst" :key="s.id" :to="`/acties?tab=inzichten&inzicht=${s.id}`" class="ps-kaart" :data-test="`prospect-signaal-${s.id}`">
        <span class="ps-vlak" :class="{ 'ps-vlak--extern': s.bron === 'extern' }"><span class="ps-mark">{{ initialen(s.account.naam) }}</span></span>
        <span class="ps-kicker"><span class="ps-groep" :class="{ 'ps-groep--extern': s.bron === 'extern' }">{{ s.bron === 'extern' ? 'Extern' : 'Intern' }}</span><span class="tnum">{{ s.bronNaam }} · {{ wanneer(s.op) }}</span></span>
        <span class="ps-titel">{{ s.titel }}</span>
        <span v-if="s.tekst" class="ps-tekst">{{ s.tekst }}</span>
        <span class="ps-meta"><span>{{ s.account.naam }}</span><span class="tnum">relevantie {{ s.relevantie }}</span></span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.sec-head { margin-bottom: 24px; }
.ps-link { align-self: flex-end; font-size: 13px; font-weight: 700; color: var(--ink); border-bottom: 2px solid var(--yellow); text-decoration: none; white-space: nowrap; }
.ps-leeg { padding: 24px; border: 1px dashed var(--border-strong); background: #fff; text-align: center; font-size: 14px; color: var(--muted); }
.ps-raster { display: grid; gap: 28px; grid-template-columns: 1fr; }
@media (min-width: 700px) { .ps-raster { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1024px) { .ps-raster { grid-template-columns: 1fr 1fr 1fr; } }
.ps-kaart { display: flex; flex-direction: column; gap: 8px; color: inherit; text-decoration: none; }
.ps-kaart:hover .ps-titel { color: var(--yellow-dark); }
.ps-vlak { aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--ink) 0%, var(--ink-soft) 100%); }
.ps-vlak--extern { background: linear-gradient(135deg, var(--blue) 0%, var(--ink) 100%); }
.ps-mark { font-family: var(--font-serif); font-size: 44px; font-weight: 700; color: var(--yellow-op-donker); }
.ps-kicker { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11px; color: var(--muted); }
.ps-groep { padding: 1px 7px; background: var(--ink); color: #fff; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 10px; }
.ps-groep--extern { background: var(--blue); }
.ps-titel { font-family: var(--font-serif); font-size: 20px; font-weight: 700; line-height: 1.25; color: var(--ink); transition: color var(--transition-fast); }
.ps-tekst { font-size: 14px; line-height: 1.5; color: var(--ink-soft); }
.ps-meta { display: flex; justify-content: space-between; gap: 8px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); }
</style>
