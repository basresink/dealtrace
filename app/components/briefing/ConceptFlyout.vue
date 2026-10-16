<script setup lang="ts">
// Conceptflyout (/concepten): het volledige concept met aanleiding, onderwerp en tekst (of de blokken van
// een bezoekbriefing), stijlscore en bronnen, gekoppeld aan het account en het contact (uit het concept,
// de taak, de afspraak of de beslisser). Aanpassen kan zolang het concept klaar staat; daarna goedkeuren,
// afwijzen of versturen via dezelfde routes als de conceptkaart (useConceptActies).
import { agentLabel, CONCEPT_STATUS, soortLabel, statusFilter } from '~~/shared/concepten'
const props = defineProps<{ concept: any | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [concept?: any] }>()
const c = computed(() => props.concept)
const { me } = useMe()
const vanCollega = computed(() => !!c.value?.gebruikerId && c.value.gebruikerId !== me.value?.gebruiker?.id)
const aanpassen = ref(false)
const tekst = ref('')
const onderwerp = ref('')
watch(() => props.concept?.id, () => { aanpassen.value = false; tekst.value = props.concept?.concept?.tekst ?? ''; onderwerp.value = props.concept?.concept?.onderwerp ?? '' }, { immediate: true })
const { bezig, besluit, verstuur, wa, waKan, waGeenToestemming, verstuurWa, kopieer } = useConceptActies(c, () => emit('gewijzigd'))
async function keur(b: 'goedkeuren' | 'verwerpen', metTekst = false) {
  if (await besluit(b, metTekst ? { tekst: tekst.value, onderwerp: onderwerp.value } : undefined)) { aanpassen.value = false; if (b === 'verwerpen') emit('sluit') }
}
const status = computed(() => statusFilter(c.value?.status ?? ''))
const titel = computed(() => c.value?.concept?.onderwerp || (c.value?.concept?.type === 'taak' && c.value?.concept?.tekst) || `${soortLabel(c.value?.concept?.type)}${c.value?.account?.naam ? ` voor ${c.value.account.naam}` : ''}`)
const datum = (d: string | null) => (d ? new Date(d).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : '')
const VIA: Record<string, string> = { concept: 'ontvanger van dit concept', taak: 'uit de taak', afspraak: 'uit de afspraak', beslisser: 'beslisser van het account' }
const ROL: Record<string, string> = { beslisser: 'Beslisser', champion: 'Champion', beinvloeder: 'Beïnvloeder', gebruiker: 'Gebruiker', poortwachter: 'Poortwachter' }
function toets(e: KeyboardEvent) { if (e.key === 'Escape' && props.concept) emit('sluit') }
onMounted(() => window.addEventListener('keydown', toets))
onBeforeUnmount(() => window.removeEventListener('keydown', toets))
</script>

<template>
  <Teleport to="body">
    <div v-if="c" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="cf-titel" data-test="concept-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">{{ soortLabel(c.concept?.type) }} · {{ CONCEPT_STATUS[status] ?? status }} · {{ agentLabel(c.agent) }}</span>
            <h2 id="cf-titel" class="fo-titel">{{ titel }}</h2>
            <p class="fo-meta">Klaargezet {{ datum(c.op) }}<template v-if="vanCollega && c.gebruiker"> · voor {{ String(c.gebruiker).replace(/^Testgebruiker /, '') }}</template><template v-if="c.beslotenOp && c.status !== 'klaar'"> · besloten {{ datum(c.beslotenOp) }}</template></p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" data-test="concept-flyout-sluit" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>

        <div class="fo-body cf-body">
          <article class="fo-blok cf-koppeling" data-test="concept-koppeling">
            <h3 class="fo-blok-kicker">Gekoppeld aan</h3>
            <div v-if="c.account" class="cf-rij">
              <Icoon naam="Building2" :grootte="16" />
              <div class="cf-rij-tekst"><NuxtLink :to="`/accounts/${c.account.id}`" class="cf-link" data-test="concept-account">{{ c.account.naam }}</NuxtLink><span v-if="c.account.soort" class="pil pil--leeg">{{ c.account.soort === 'klant' ? 'Klant' : 'Prospect' }}</span></div>
            </div>
            <p v-else class="meta">Geen account.</p>
            <div v-if="c.contact" class="cf-rij">
              <Icoon naam="CircleUser" :grootte="16" />
              <div class="cf-rij-tekst">
                <NuxtLink :to="`/contacten/${c.contact.id}`" class="cf-link" data-test="concept-contact">{{ c.contact.naam }}</NuxtLink>
                <span class="meta">{{ [c.contact.functie, ROL[c.contact.rol] ?? null].filter(Boolean).join(' · ') }}<template v-if="c.contact.functie || ROL[c.contact.rol]"> · </template>{{ VIA[c.contact.via] ?? '' }}</span>
                <span v-if="c.contact.email" class="meta">{{ c.contact.email }}</span>
              </div>
            </div>
            <p v-else-if="c.account" class="meta" data-test="concept-geen-contact">Nog geen contact bekend. Leg de beslisser vast op de accountkaart.</p>
            <div v-if="c.taak" class="cf-rij"><Icoon naam="ListTodo" :grootte="16" /><span class="cf-rij-tekst"><span class="meta">Bij de taak</span> {{ c.taak.titel }}</span></div>
            <div v-if="c.afspraak" class="cf-rij"><Icoon naam="Calendar" :grootte="16" /><span class="cf-rij-tekst"><span class="meta">Bij de afspraak van</span> {{ datum(c.afspraak.start) }}</span></div>
          </article>

          <article v-if="c.concept?.aanleiding" class="fo-blok fo-blok--accent"><h3 class="fo-blok-kicker">Aanleiding</h3><p class="cf-p">{{ c.concept.aanleiding }}</p></article>

          <article class="fo-blok fo-blok--agent" data-test="concept-inhoud">
            <header class="fo-blok-kop">
              <h3 class="fo-blok-kicker">{{ c.concept?.type === 'briefing' ? 'Voorbereiding' : 'Concept' }}</h3>
              <span v-if="c.concept?.stijlscore" class="pil pil--leeg" :title="`${c.concept.woorden} van ${c.concept.grens} woorden`">stijl {{ c.concept.stijlscore }} · {{ c.concept.woorden }} woorden</span>
            </header>
            <template v-if="!aanpassen">
              <p v-if="c.concept?.onderwerp" class="cf-onderwerp"><span class="meta">Onderwerp</span> {{ c.concept.onderwerp }}</p>
              <p v-if="c.concept?.tekst" class="cf-tekst" data-test="concept-volledig">{{ c.concept.tekst }}</p>
              <dl v-else-if="c.concept?.blokken" class="cn-blokken"><template v-for="(t, k) in c.concept.blokken" :key="k"><dt>{{ k }}</dt><dd>{{ t }}</dd></template></dl>
            </template>
            <div v-else class="fo-body--formulier cf-form">
              <label v-if="c.concept?.type === 'mail'" class="veld"><span class="veld-label">Onderwerp</span><input v-model="onderwerp" class="invoer" data-test="concept-onderwerp"></label>
              <label class="veld"><span class="veld-label">Tekst</span><textarea v-model="tekst" class="invoer" rows="10" data-test="concept-tekst" /></label>
            </div>
          </article>

          <p v-if="c.concept?.bronnen?.length" class="meta">Bron: {{ c.concept.bronnen.map((b: any) => b.titel).join(' · ') }}<template v-if="c.concept.vvVersies && Object.keys(c.concept.vvVersies).length"> · verkoopverhaal versie {{ c.concept.vvVersies.winpunten ?? Object.values(c.concept.vvVersies)[0] }}</template></p>
          <p v-if="waGeenToestemming && wa" class="meta">Geen toestemming voor WhatsApp bij dit contact.</p>
          <p class="meta">De agent voert niets uit. Jij keurt goed en belt, mailt of bezoekt zelf.</p>
        </div>

        <footer class="fo-foot dd-acties">
          <template v-if="c.status === 'klaar'">
            <template v-if="!aanpassen">
              <button type="button" class="dd-act" data-test="concept-verwerpen" @click="keur('verwerpen')">Afwijzen</button>
              <button v-if="c.concept?.tekst" type="button" class="dd-act" data-test="concept-aanpassen" @click="aanpassen = true"><Icoon naam="Pencil" :grootte="14" />Aanpassen</button>
              <span class="dd-acties-vul fo-foot-vul" />
              <button type="button" class="dd-act dd-act--primair" data-test="concept-goedkeuren" @click="keur('goedkeuren')">Goedkeuren</button>
            </template>
            <template v-else>
              <button type="button" class="dd-act" @click="aanpassen = false">Annuleren</button>
              <span class="dd-acties-vul fo-foot-vul" />
              <button type="button" class="dd-act dd-act--primair" data-test="concept-bewaar-goedkeur" @click="keur('goedkeuren', true)">Bewaar en keur goed</button>
            </template>
          </template>
          <template v-else-if="c.status === 'goedgekeurd'">
            <button v-if="c.concept?.tekst" type="button" class="dd-act" @click="kopieer"><Icoon naam="Copy" :grootte="14" />Kopieer</button>
            <a v-if="c.links?.mailto" :href="c.links.mailto" class="dd-act" data-test="concept-mailto">Verstuur via je mail</a>
            <a v-if="c.links?.whatsapp && !waGeenToestemming" :href="c.links.whatsapp" target="_blank" rel="noopener" class="dd-act" data-test="concept-wa-link">{{ c.concept?.type === 'whatsapp' ? 'Open in WhatsApp' : 'WhatsApp' }}</a>
            <span class="dd-acties-vul fo-foot-vul" />
            <button v-if="c.concept?.type === 'whatsapp' && waKan" type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="concept-verstuur-wa" @click="verstuurWa">Verstuur via WhatsApp</button>
            <button v-if="c.concept?.type === 'mail'" type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="concept-verstuur" @click="verstuur">Verstuur</button>
          </template>
          <template v-else>
            <button v-if="c.concept?.tekst" type="button" class="dd-act" @click="kopieer"><Icoon naam="Copy" :grootte="14" />Kopieer</button>
            <span class="dd-acties-vul fo-foot-vul" />
            <button type="button" class="dd-act" @click="emit('sluit')">Sluiten</button>
          </template>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.cf-body { display: flex; flex-direction: column; gap: 14px; }
.cf-body .fo-blok { margin-bottom: 0; }
.cf-koppeling { display: flex; flex-direction: column; gap: 10px; border-left-color: var(--ink); background: var(--surface); }
.cf-rij { display: flex; align-items: flex-start; gap: 10px; color: var(--muted); }
.cf-rij-tekst { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; color: var(--ink); font-size: 14px; }
.cf-link { font-weight: 700; color: var(--ink); min-height: 32px; display: inline-flex; align-items: center; }
.cf-p { margin: 0; font-size: 14px; line-height: 1.55; }
.cf-onderwerp { margin: 0 0 10px; font-weight: 700; font-size: 15px; }
.cf-onderwerp .meta { display: block; font-weight: 400; font-size: 12px; }
.cf-tekst { margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
.cf-form { gap: 12px; }
.fo-foot .dd-act { display: inline-flex; align-items: center; gap: 6px; }
@media (max-width: 719px) {
  .cf-link { min-height: var(--touch-target-min); }
  .fo-foot .dd-act { min-height: var(--touch-target-min); }
}
</style>
