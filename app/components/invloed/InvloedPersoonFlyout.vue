<script setup lang="ts">
// Details van één persoon op de invloedskaart (F8): rol met zekerheid of "bevestigd door jou", houding,
// contactmomenten en rapporteert-aan; citaten uit gespreksverslagen als bewijs; een voorstel van de Notulist
// om te bevestigen of te verwerpen. Rol bevestigen of wijzigen, houding en rapporteert-aan zetten gaat via
// PUT /api/contacten/:id/invloed. Een rol zonder naam (Profielbouwer) krijgt de stap "vraag naar de naam".
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
import { HOUDINGEN, HOUDING_LABEL, geenKring, rolLabel, type Houding } from '~~/shared/invloed'
const props = defineProps<{ persoon: any | null; personen: any[]; accountId: string | null; kan: Record<string, boolean> }>()
const emit = defineEmits<{ sluit: []; gewijzigd: []; taak: [{ titel: string; contactId: string | null }] }>()
const toast = useToast()
const bezig = ref(false)
const p = computed(() => props.persoon)
const voornaam = computed(() => String(p.value?.naam ?? '').split(' ')[0])
const kanBewerken = computed(() => !!props.kan.bewerken && !!p.value && !p.value.onbekend)
const opties = computed(() => props.personen.filter((x) => !x.onbekend && x.id !== p.value?.id && geenKring(props.personen, p.value?.id, x.id)))
const naamVan = (id: string | null) => props.personen.find((x) => x.id === id)?.naam ?? null
const contactTekst = (n: number) => (n === 0 ? 'nooit' : n === 1 ? '1 keer' : `${n} keer`)
const zekerheidTekst = computed(() => {
  const x = p.value
  if (!x) return ''
  if (x.rolBevestigd) return 'Bevestigd door jou'
  if (x.zekerheid !== null && x.zekerheid !== undefined) return `${x.vermoedelijk || x.onbekend ? 'Vermoedelijk · ' : ''}Profielbouwer ${x.zekerheid}%`
  return x.bron && !/^ingevoerd/i.test(x.bron) ? x.bron : 'Nog niet bevestigd'
})
const datum = (d: string | null) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }) : '')

async function zet(body: Record<string, unknown>, melding: string) {
  if (!p.value) return
  bezig.value = true
  try { await $fetch(`/api/contacten/${p.value.id}/invloed`, { method: 'PUT', body }); toast.toon(melding); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && props.persoon) emit('sluit') }
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', opEscape))
</script>

<template>
  <div v-if="p" class="fo-overlay fo-overlay--boven" @click.self="emit('sluit')">
    <aside class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="ivp-titel" data-test="invloed-persoon">
      <header class="fo-head">
        <div class="fo-head-tekst">
          <span class="fo-kicker" data-test="ivp-kicker">{{ rolLabel(p.rol) }} · {{ zekerheidTekst }}</span>
          <h2 id="ivp-titel" class="fo-titel">{{ p.functie ?? p.naam }}</h2>
          <p class="fo-meta"><NuxtLink v-if="!p.onbekend" :to="`/contacten/${p.id}`" class="fo-link" data-test="ivp-contact">{{ p.naam }}</NuxtLink><template v-else>Naam onbekend</template></p>
        </div>
        <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
      </header>
      <div class="fo-body">
        <article class="fo-blok">
          <dl class="ivp-defs">
            <dt>Houding</dt><dd data-test="ivp-houding">{{ HOUDING_LABEL[p.houding as Houding] }}<template v-if="p.houdingOp"> · {{ datum(p.houdingOp) }}</template></dd>
            <dt>Contact</dt><dd data-test="ivp-contactmomenten">{{ contactTekst(p.momenten) }}<template v-if="p.momenten"> · {{ p.gesproken ? 'gesproken' : 'nog geen gesprek' }}</template></dd>
            <dt>Rapporteert aan</dt><dd>{{ naamVan(p.rapporteertAan) ?? 'Onbekend' }}</dd>
          </dl>
          <blockquote v-if="p.houdingCitaat" class="ivp-citaat">{{ p.houdingCitaat }}</blockquote>
        </article>

        <article v-if="p.voorstel" class="fo-blok fo-blok--agent" data-test="ivp-voorstel">
          <span class="fo-blok-kicker">Voorstel van de Notulist</span>
          <p class="ivp-tekst">Houding: <strong>{{ HOUDING_LABEL[p.voorstel.houding as Houding] }}</strong></p>
          <blockquote class="ivp-citaat">{{ p.voorstel.citaat }}</blockquote>
          <p class="ivp-uitleg">Uit de gespreksverslagen · {{ datum(p.voorstel.op) }}. Het telt pas als jij het bevestigt.</p>
          <div v-if="kanBewerken" class="ivp-knoppen">
            <button type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="ivp-voorstel-bevestig" @click="zet({ voorstel: 'bevestig' }, 'Houding bevestigd.')">Bevestig</button>
            <button type="button" class="dd-act" :disabled="bezig" data-test="ivp-voorstel-verwerp" @click="zet({ voorstel: 'verwerp' }, 'Voorstel verworpen.')">Verwerp</button>
          </div>
        </article>

        <article class="fo-blok" data-test="ivp-bewijs">
          <span class="fo-blok-kicker">Bewijs uit verslagen</span>
          <ul v-if="p.citaten?.length" class="ivp-citaten" role="list">
            <li v-for="(c, i) in p.citaten" :key="i"><blockquote class="ivp-citaat">{{ c.tekst }}</blockquote><span class="ivp-uitleg">{{ c.bron }}</span></li>
          </ul>
          <p v-else class="ivp-uitleg">{{ p.onbekend ? 'De Profielbouwer leidt deze rol af uit functies op de website en in verslagen. Hij verzint geen namen.' : `Nog geen verslag noemt ${voornaam}. Leg na je gesprek een verslag vast; de Notulist leest het.` }}</p>
        </article>

        <article v-if="p.onbekend" class="fo-blok fo-blok--accent" data-test="ivp-onbekend">
          <span class="fo-blok-kicker">Voorgestelde stap</span>
          <p class="ivp-tekst">Vraag in je volgende gesprek naar de naam van de {{ String(p.functie ?? 'persoon').toLowerCase() }}, of laat de Verrijker zoeken.</p>
          <button v-if="kan.taak" type="button" class="dd-act dd-act--primair" data-test="ivp-maak-taak" @click="emit('taak', { titel: `Vraag naar de ${String(p.functie ?? 'beslisser').toLowerCase()}`, contactId: null })"><Icoon naam="Plus" class="dd-act-icoon" />Maak taak</button>
        </article>

        <article v-if="kanBewerken" class="fo-blok" data-test="ivp-bewerk">
          <span class="fo-blok-kicker">Bijwerken</span>
          <label class="veld"><span class="veld-label">Rol</span>
            <select class="invoer" :value="p.rol" :disabled="bezig" data-test="ivp-rol" @change="zet({ rol: ($event.target as HTMLSelectElement).value }, 'Rol gewijzigd.')">
              <option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option>
            </select>
          </label>
          <div class="veld"><span class="veld-label" id="ivp-houding-label">Houding</span>
            <div class="keuzegroep ivp-houdingen" role="group" aria-labelledby="ivp-houding-label">
              <button v-for="h in HOUDINGEN" :key="h" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': p.houding === h }" :aria-pressed="p.houding === h" :disabled="bezig" :data-test="`ivp-houding-${h}`" @click="zet({ houding: h }, `Houding: ${HOUDING_LABEL[h].toLowerCase()}.`)">{{ HOUDING_LABEL[h] }}</button>
            </div>
          </div>
          <label class="veld"><span class="veld-label">Rapporteert aan</span>
            <select class="invoer" :value="p.rapporteertAan ?? ''" :disabled="bezig" data-test="ivp-rapporteert" @change="zet({ rapporteertAan: ($event.target as HTMLSelectElement).value || null }, 'Rapporteert-aan bijgewerkt.')">
              <option value="">Onbekend</option>
              <option v-for="o in opties" :key="o.id" :value="o.id">{{ o.naam }}<template v-if="o.functie"> · {{ o.functie }}</template></option>
            </select>
          </label>
        </article>
      </div>
      <footer class="fo-foot dd-acties">
        <button type="button" class="dd-act" @click="emit('sluit')">Sluiten</button>
        <span class="dd-acties-vul fo-foot-vul" />
        <button v-if="kanBewerken && !p.rolBevestigd" type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="ivp-bevestig-rol" @click="zet({ bevestigRol: true }, 'Rol bevestigd.')"><Icoon naam="Check" class="dd-act-icoon" />Bevestig rol</button>
      </footer>
    </aside>
  </div>
</template>

<style scoped>
.ivp-defs { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 16px; margin: 0; font-size: 13px; }
.ivp-defs dt { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.ivp-defs dd { margin: 0; color: var(--ink); }
.ivp-citaat { margin: 10px 0 0; padding: 8px 12px; border-left: 3px solid var(--yellow); background: var(--surface); font-family: var(--font-serif); font-size: 14px; line-height: 1.5; color: var(--ink); }
.ivp-citaten { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.ivp-tekst { margin: 6px 0 0; font-size: 14px; color: var(--ink); }
.ivp-uitleg { display: block; margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: var(--muted); }
.ivp-knoppen { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.ivp-houdingen { flex-wrap: wrap; }
.fo-blok .veld + .veld { margin-top: 12px; }
@media (max-width: 719px) {
  .ivp-knoppen .dd-act, .fo-blok .dd-act, .ivp-houdingen .keuzegroep-knop, .fo-foot .dd-act { min-height: 44px; }
}
</style>
