<script setup lang="ts">
// De aanleiding van de dag als groot blok (opzet uit DealDrive, LeadCard): links een vlak met de initialen
// van het account en het label "Aanleiding", rechts de kop, waarom het ertoe doet, bron en tijd, en
// "Open kaart" en "Maak taak".
const props = defineProps<{ a: { id: string; titel: string; waarom: string | null; bron: string; bronNaam: string; op: string; relevantie: number; account: { id: string; naam: string } | null } }>()
defineEmits<{ maakTaak: [id: string] }>()
const initialen = computed(() => (props.a.account?.naam ?? props.a.titel).replace(/^Test(bedrijf|installatie)?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'DT')
const wanneer = computed(() => {
  const ms = Date.now() - Date.parse(props.a.op)
  const u = Math.floor(ms / 3_600_000)
  if (u < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min geleden`
  if (u < 24) return `${u} uur geleden`
  if (u < 48) return 'Gisteren'
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(props.a.op))
})
</script>

<template>
  <article class="ah" data-test="aanleiding-van-de-dag">
    <div class="ah-vlak" aria-hidden="true"><span class="ah-mark">{{ initialen }}</span><span class="ah-hoek">Aanleiding</span></div>
    <div class="ah-tekst">
      <span class="kicker kicker--streep">Aanleiding van de dag</span>
      <h2 class="ah-titel">{{ a.account && !a.titel.includes(a.account.naam) ? `${a.account.naam}: ` : '' }}{{ a.titel }}</h2>
      <p v-if="a.waarom" class="ah-waarom">{{ a.waarom }}</p>
      <div class="ah-regel"><span class="ah-bron"><span class="ah-blokje" :class="a.bron === 'extern' ? 'ah-blokje--extern' : ''" />{{ a.bronNaam }}</span><span class="tnum">{{ wanneer }} · relevantie {{ a.relevantie }}</span></div>
      <div class="ah-knoppen">
        <NuxtLink v-if="a.account" :to="`/accounts/${a.account.id}`" class="ah-knop ah-knop--primair" data-test="aanleiding-open-kaart">→ Open kaart</NuxtLink>
        <button type="button" class="ah-knop" data-test="aanleiding-maak-taak" @click="$emit('maakTaak', a.id)">+ Maak taak</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.ah { display: grid; gap: 36px; grid-template-columns: 1fr; padding: 8px 0 40px; }
@media (min-width: 900px) { .ah { grid-template-columns: 1.4fr 1fr; align-items: center; } }
.ah-vlak { position: relative; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--ink) 0%, var(--ink-soft) 100%); }
.ah-mark { font-family: var(--font-serif, 'Source Serif 4', Georgia, serif); font-size: 96px; font-weight: 700; letter-spacing: -0.04em; color: var(--yellow-op-donker); line-height: 1; }
.ah-hoek { position: absolute; top: 0; left: 0; background: var(--yellow); color: var(--ink); padding: 8px 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; }
.ah-titel { font-family: var(--font-serif, 'Source Serif 4', Georgia, serif); font-size: clamp(28px, 4vw, 46px); line-height: 1.1; letter-spacing: -0.02em; font-weight: 700; margin: 14px 0 20px; color: var(--ink); }
.ah-waarom { font-size: 18px; line-height: 1.55; color: var(--ink-soft); margin: 0 0 22px; }
.ah-regel { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 13px; color: var(--muted); margin-bottom: 22px; }
.ah-bron { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--ink); }
.ah-blokje { width: 14px; height: 14px; background: var(--ink); display: inline-block; }
.ah-blokje--extern { background: var(--red); }
.ah-knoppen { display: flex; gap: 10px; flex-wrap: wrap; }
.ah-knop { display: inline-flex; align-items: center; gap: 8px; min-height: var(--touch-target-min); padding: 12px 22px; border: 1px solid var(--border-strong); border-radius: 2px; background: transparent; color: var(--ink); font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast); }
.ah-knop:hover { border-color: var(--ink); background: var(--surface); }
.ah-knop--primair { background: var(--ink); border-color: var(--ink); color: var(--yellow); }
.ah-knop--primair:hover { background: var(--ink-soft); }
</style>
