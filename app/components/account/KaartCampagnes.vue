<script setup lang="ts">
// De campagnes van een account of contact (venster Campagnes onder Meer, op de accountkaart en de contactkaart):
// elke campagne met soort, status, doel, volgende stap en de stand op het campagnebord, met een link naar het
// bord. De data komt uit de tabbladen-API (campagnes).
const props = defineProps<{ campagnes: any[]; opContact?: boolean }>()
const CAMP_KOLOM: Record<string, string> = { klaar: 'Klaar', bezig: 'Bezig', afspraak: 'Afspraak', nee: 'Nee', 'geen-reactie': 'Geen reactie', later: 'Later' }
</script>

<template>
  <div class="kc" data-test="kaart-campagnes">
    <p class="meta">{{ props.opContact ? 'De campagnes met een taak of contactmoment voor dit contact, met de stand op het campagnebord.' : 'De campagnes waarin dit account meeloopt, met de stand op het campagnebord.' }}</p>
    <LegeStaat v-if="!campagnes.length" kicker="Campagnes" :titel="opContact ? 'Dit contact loopt in geen enkele campagne mee.' : 'Dit account loopt in geen enkele campagne mee.'" tekst="Voeg het account toe op een campagnebord onder Campagnes." data-test="kc-leeg" />
    <ul v-else class="kc-rijen" role="list">
      <li v-for="c in campagnes" :key="c.id">
        <FunctieLink als-tekst :to="`/campagnes/${c.id}`" class="kc-rij" :data-test="`ak-campagne-${c.id}`">
          <span class="kc-info"><span class="kc-titel">{{ c.naam }}</span><span class="meta">{{ c.soort }} · {{ c.status }}<template v-if="c.doel"> · {{ c.doel }}</template><template v-if="c.volgendeStap"> · volgende stap: {{ c.volgendeStap }}</template></span></span>
          <span class="pil" :class="c.gehaald ? 'pil--groen' : 'pil--grijs'">{{ c.gehaald ? 'Doel gehaald' : CAMP_KOLOM[c.kolom] ?? c.kolom }}</span>
          <Icoon naam="ChevronRight" :grootte="16" class="kc-pijl" />
        </FunctieLink>
      </li>
    </ul>
    <FunctieLink to="/campagnes" class="dd-actie dd-actie--secundair kc-alle" data-test="kc-alle">Alle campagnes<Icoon naam="ArrowRight" class="dd-actie-icoon" /></FunctieLink>
  </div>
</template>

<style scoped>
.kc { display: flex; flex-direction: column; gap: 12px; }
.kc > .meta { margin: 0; }
.kc-rijen { margin: 0; padding: 0; list-style: none; background: var(--wit); border: 1px solid var(--border); }
.kc-rijen > li { border-bottom: 1px solid var(--border); }
.kc-rijen > li:last-child { border-bottom: 0; }
.kc-rij { display: flex; align-items: center; gap: 10px; min-height: var(--touch-target-min); padding: 12px 14px; color: inherit; text-decoration: none; }
.kc-rij:hover { background: var(--surface); }
.kc-info { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.kc-titel { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.kc-pijl { flex: none; color: var(--muted); }
.kc-alle { align-self: flex-start; }
</style>
