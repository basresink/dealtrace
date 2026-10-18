<script setup lang="ts">
// De donkere kop op Richting: "Waar we voor staan" met de kernzin, de belofte, vier kerncijfers en
// de voetregel (hoeveel onderdelen bevestigd, wanneer laatst bevestigd, wie deze versie gebruikt).
import { RICHTING_TEKST, type Kerncijfer } from '~~/shared/richting'

defineProps<{
  kernzin: string | null
  belofte: string | null
  cijfers: Kerncijfer[]
  bevestigd: { tekst: string; laatst: string | null }
}>()
const datum = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(d)) : '')
</script>

<template>
  <section class="ri-held" :class="{ 'ri-held--enkel': !cijfers.length }" :aria-labelledby="kernzin ? 'ri-held-zin' : undefined" :aria-label="kernzin ? undefined : RICHTING_TEKST.heldKicker" data-test="ri-held">
    <div class="ri-held-links">
      <span class="ri-held-kicker">{{ RICHTING_TEKST.heldKicker }}</span>
      <p v-if="kernzin" id="ri-held-zin" class="ri-held-zin" data-test="ri-held-kernzin">{{ kernzin }}</p>
      <p v-if="belofte" class="ri-held-belofte" data-test="ri-held-belofte">
        <Icoon naam="ShieldCheck" :grootte="16" class="ri-held-belofte-ico" />
        <span><strong>{{ RICHTING_TEKST.belofteLabel }}</strong> {{ belofte }}</span>
      </p>
    </div>
    <dl v-if="cijfers.length" class="ri-held-feiten" aria-label="Kerncijfers" data-test="ri-kerncijfers">
      <div v-for="c in cijfers" :key="c.sleutel" class="ri-held-feit" :data-cijfer="c.sleutel">
        <dt class="ri-held-feit-tekst">{{ c.tekst }}</dt>
        <dd class="ri-held-feit-cijfer tnum">{{ c.cijfer }}</dd>
      </div>
    </dl>
    <div class="ri-held-voet" data-test="ri-held-voet">
      <span><Icoon naam="Check" :grootte="14" />{{ bevestigd.tekst }}</span>
      <span v-if="bevestigd.laatst">Laatst bevestigd {{ datum(bevestigd.laatst) }}</span>
      <span>{{ RICHTING_TEKST.gebruik }}</span>
    </div>
  </section>
</template>

<style scoped>
/* Zelfde kaartstijl en marges als de andere blokken: rand 1 px, radius van een kaart, binnenmarge
   van een kaart (24 px, 16 px op de telefoon) en 24 px tussen de onderdelen. De gele streep zit
   boven de kicker, zodat de inhoud gelijk uitlijnt met de kaarten eronder. */
.ri-held { margin: 0; display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 24px; padding: var(--kaart-padding); background: var(--ink); color: var(--wit); border: 1px solid var(--ink); border-radius: var(--radius-card); }
.ri-held--enkel { grid-template-columns: minmax(0, 1fr); }
.ri-held-kicker { display: inline-flex; align-items: center; gap: 10px; }
.ri-held-kicker::before { content: ''; width: 24px; height: 2px; background: var(--yellow); }
.ri-held-links { min-width: 0; }
.ri-held-kicker { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--yellow); }
.ri-held-zin { margin: 10px 0 0; font-family: var(--font-serif); font-size: clamp(22px, 3.2vw, 32px); font-weight: 700; line-height: 1.2; color: var(--wit); }
.ri-held-belofte { margin: 16px 0 0; display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.5; color: var(--wit-85); }
.ri-held-belofte strong { color: var(--yellow); }
.ri-held-belofte-ico { margin-top: 3px; color: var(--yellow); flex: none; }
.ri-held-feiten { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-self: start; border: 1px solid var(--wit-16); border-radius: 2px; }
.ri-held-feit { display: flex; flex-direction: column-reverse; justify-content: flex-end; padding: 12px 14px; min-width: 0; border-top: 1px solid var(--wit-16); }
.ri-held-feit:nth-child(-n + 2) { border-top: 0; }
.ri-held-feit:nth-child(even) { border-left: 1px solid var(--wit-16); }
.ri-held-feit-cijfer { margin: 0; font-family: var(--font-serif); font-size: 24px; font-weight: 700; line-height: 1.1; color: var(--wit); }
.ri-held-feit-tekst { font-size: var(--fs-meta); color: var(--wit-70); }
.ri-held-voet { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px 16px; padding-top: 14px; border-top: 1px solid var(--wit-16); font-size: var(--fs-meta); color: var(--wit-70); }
.ri-held-voet span { display: inline-flex; align-items: center; gap: 6px; }
@media (max-width: 900px) { .ri-held { grid-template-columns: minmax(0, 1fr); gap: 20px; } }
</style>
