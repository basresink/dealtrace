<script setup lang="ts">
// Eén concurrent op Richting, op volle breedte: wat ze goed doen, waar ze zwakker zijn en ons
// onderscheid naast elkaar; "Zo zeg je het" groot; het bezwaar als gesprek; bewijs en "Hier verliezen we".
import { leesAlsDeKlantZegt } from '~~/shared/verkoopverhaal'

const props = defineProps<{ c: any; voorstellen: boolean }>()
const emit = defineEmits<{ voorstel: [] }>()
const gesprek = computed(() => leesAlsDeKlantZegt(props.c.alsDeKlantZegt))
</script>

<template>
  <article class="kaart ri-conc" :data-concurrent="c.id" :data-soort="c.soortSleutel ?? c.soort" :aria-labelledby="`ri-c-${c.id}`">
    <header class="ri-conc-kop">
      <h3 :id="`ri-c-${c.id}`" class="kaart-titel ri-conc-titel">{{ c.naam }}</h3>
      <Label soort="richting" waarde="soort" :tekst="c.soort" />
      <button v-if="voorstellen" type="button" class="dd-act" data-test="stel-voor" @click="emit('voorstel')"><Icoon naam="Pencil" :grootte="14" />Stel voor</button>
    </header>
    <div class="ri-conc-drie">
      <div><span class="ri-label">Wat ze goed doen</span><p v-if="c.sterk">{{ c.sterk }}</p><p v-else class="meta">Nog niet ingevuld.</p></div>
      <div><span class="ri-label">Waar ze zwakker zijn</span><p v-if="c.zwak">{{ c.zwak }}</p><p v-else class="meta">Nog niet ingevuld.</p></div>
      <div class="ri-conc-ons"><span class="ri-label">Ons onderscheid</span><p v-if="c.onderscheid">{{ c.onderscheid }}</p><p v-else class="meta">Nog niet ingevuld.</p></div>
    </div>
    <div v-if="c.zoZegJeHet || c.alsDeKlantZegt" class="ri-conc-zeg">
      <div v-if="c.zoZegJeHet"><span class="ri-label">Zo zeg je het</span><p class="ri-zeg" data-test="zo-zeg-je-het">{{ c.zoZegJeHet }}</p></div>
      <div v-if="c.alsDeKlantZegt">
        <span class="ri-label">Als de prospect zegt</span>
        <div v-if="gesprek" class="ri-dialoog" data-test="ri-gesprek">
          <p class="ri-ballon ri-ballon--prospect"><small>Prospect</small>"{{ gesprek.bezwaar }}"</p>
          <p class="ri-ballon ri-ballon--jij"><small>Jij</small>"{{ gesprek.antwoord }}"</p>
        </div>
        <p v-else class="ri-dialoog-tekst">{{ c.alsDeKlantZegt }}</p>
      </div>
    </div>
    <footer v-if="c.bewijs || c.wanneerVerliezen" class="ri-conc-voet">
      <span v-if="c.bewijs" class="ri-stuk ri-stuk--bewijs"><Icoon naam="CircleCheck" :grootte="16" /><span><strong>Bewijs:</strong> {{ c.bewijs }}</span></span>
      <span v-if="c.wanneerVerliezen" class="ri-stuk ri-stuk--verlies" data-test="hier-verliezen-we"><Icoon naam="TriangleAlert" :grootte="16" /><span><strong>Hier verliezen we:</strong> {{ c.wanneerVerliezen }}</span></span>
    </footer>
  </article>
</template>

<style scoped>
.ri-conc { padding: 0; overflow: hidden; }
.ri-conc-kop { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.ri-conc-titel { flex: 1 1 240px; min-width: 0; }
.ri-label { display: block; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.ri-conc-drie { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ri-conc-drie > div { padding: 14px 20px; min-width: 0; }
.ri-conc-drie > div + div { border-left: 1px solid var(--border); }
.ri-conc-drie p { margin: 4px 0 0; font-size: var(--fs-body); line-height: 1.5; color: var(--ink); }
.ri-conc-ons { background: var(--surface); }
.ri-conc-zeg { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); border-top: 1px solid var(--border); }
.ri-conc-zeg > div { padding: 16px 20px; min-width: 0; }
.ri-conc-zeg > div + div { border-left: 1px solid var(--border); }
.ri-zeg { margin: 6px 0 0; padding-left: 12px; border-left: 3px solid var(--yellow); font-family: var(--font-serif); font-size: 17px; font-weight: 600; line-height: 1.4; color: var(--ink); }
.ri-dialoog { margin-top: 8px; display: grid; gap: 8px; }
.ri-dialoog-tekst { margin: 6px 0 0; font-size: var(--fs-body); }
.ri-ballon { margin: 0; max-width: 92%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 2px; font-size: var(--fs-body); line-height: 1.45; color: var(--ink); }
.ri-ballon small { display: block; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.ri-ballon--prospect { justify-self: start; background: var(--surface); }
.ri-ballon--jij { justify-self: end; background: var(--wit); border-color: var(--border-strong); border-left: 3px solid var(--yellow); }
.ri-conc-voet { display: flex; flex-wrap: wrap; gap: 10px 24px; padding: 12px 20px; border-top: 1px solid var(--border); font-size: var(--fs-klein); color: var(--ink); }
.ri-stuk { display: inline-flex; gap: 6px; align-items: flex-start; flex: 1 1 260px; min-width: 0; }
.ri-stuk :deep(svg) { margin-top: 2px; flex: none; }
.ri-stuk--bewijs :deep(svg) { color: var(--green); }
.ri-stuk--verlies :deep(svg) { color: var(--red); }
@media (max-width: 800px) {
  .ri-conc-drie { grid-template-columns: minmax(0, 1fr); }
  .ri-conc-drie > div + div, .ri-conc-zeg > div + div { border-left: 0; border-top: 1px solid var(--border); }
  .ri-conc-kop, .ri-conc-drie > div, .ri-conc-zeg > div, .ri-conc-voet { padding-left: 16px; padding-right: 16px; }
}
</style>
