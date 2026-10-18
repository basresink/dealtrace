<script setup lang="ts">
// Opvolgreeksen van één prospect, onder Meer op de accountkaart (?meer=reeksen). Bovenaan de lopende reeks in één
// regel (stap x van y, de volgende stap met datum en het contact) en daaronder ReeksDetail, dezelfde detailkolom als
// op /opvolgreeksen: mandaat, stappen per dag, concept goedkeuren, Sla over, Reactie ontvangen, Pauzeer, Hervat en
// Stop. Daaronder de eerdere reeksen met hun uitkomst; elke reeks is open te klappen. Start reeks (hoofdactie in de
// voet) opent StartReeksFlyout met deze prospect vast; de server bewaakt dezelfde regels als op /opvolgreeksen (één
// lopende reeks per prospect, niet op nee, overgedragen of gedeactiveerd, alleen eigenaar, salesmanager of beheerder).
// Zonder reeks een lege staat met uitleg en Start reeks.
import { OVERZICHT_LABEL, REEKS_KANAAL_LABEL } from '~~/shared/opvolgreeks'

const props = defineProps<{ open: boolean; account: { id: string; naam: string } }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const { magNaar } = useFunctie()
const d = ref<any>(null)
const fout = ref<string | null>(null)
const laadt = ref(false)
const startOpen = ref(false)
const uitgeklapt = ref<string | null>(null)
async function laad() {
  laadt.value = !d.value
  try { d.value = await $fetch<any>(`/api/accounts/${props.account.id}/reeksen`); fout.value = null } catch (e) { fout.value = foutTekst(e) } finally { laadt.value = false }
}
watch(() => props.open, (o) => { if (o) { uitgeklapt.value = null; void laad() } }, { immediate: true })
async function gewijzigd() { await laad(); emit('gewijzigd') }
async function gestart() { startOpen.value = false; await gewijzigd() }

const dag = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace(/\./g, '') : '')
const datum = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace(/\./g, '') : '')
function volgende(x: any): string {
  if (!x.volgende) return 'Geen volgende stap meer'
  if (x.stand === 'concept') return `Concept wacht op je goedkeuring: ${x.volgende.titel}`
  if (x.volgende.open) return `Wacht op jou: ${x.volgende.titel}`
  if (x.volgende.kanaal === 'einde') return `Einde ${dag(x.volgende.geplandOp)}: terug naar het ritme`
  return `Volgende: ${REEKS_KANAAL_LABEL[x.volgende.kanaal as keyof typeof REEKS_KANAAL_LABEL] ?? x.volgende.kanaal} ${dag(x.volgende.geplandOp)} · ${x.volgende.titel}`
}
function uitkomst(x: any): string {
  if (x.status === 'klaar') return 'Klaar zonder reactie, terug naar het ritme'
  if (x.viaMail) return `Antwoord in de mailbox${x.mailOnderwerp ? ` ("${x.mailOnderwerp}")` : ''}`
  if (x.toelichting) return x.toelichting
  return x.label.replace(/^Gestopt: /, '').replace(/^./, (c: string) => c.toUpperCase())
}
const STAND_PIL: Record<string, string> = { concept: 'pil--leeg', open: 'pil--oranje', loopt: 'pil--blauw', raak: 'pil--groen', gestopt: 'pil--grijs' }
const ai = computed(() => ({ accountId: props.account.id, label: props.account.naam, voorstellen: ['Welk sjabloon past bij deze prospect?', 'Wat leerde de vorige reeks?', 'Wanneer stop ik de reeks?'] }))
const metaTekst = computed(() => {
  if (!d.value) return 'De opvolgreeksen van deze prospect.'
  const n = d.value.eerdere.length
  return d.value.lopend ? `Er loopt een reeks${n ? ` · ${n} ${n === 1 ? 'eerdere reeks' : 'eerdere reeksen'}` : ''}.` : n ? `Geen lopende reeks · ${n} ${n === 1 ? 'eerdere reeks' : 'eerdere reeksen'}.` : 'Nog geen opvolgreeks op deze prospect.'
})
</script>

<template>
  <FlyoutShell :open="open" kicker="Opvolgreeksen" :titel="account.naam" :meta="metaTekst" titel-id="arf-titel" breedte="breed" :ai="ai" sluit-test="reeksen-flyout-sluit" data-test="reeksen-flyout" @sluit="emit('sluit')">
    <div class="fo-body arf-body">
      <p v-if="fout" class="fo-fout">{{ fout }}</p>
      <p v-else-if="laadt || !d" class="meta">Laden…</p>
      <template v-else>
        <!-- De lopende reeks: stap x van y, de volgende stap met datum en het contact; daaronder de stappen en acties. -->
        <section v-if="d.lopend" class="arf-sectie" data-test="arf-lopend">
          <h3 class="arf-kop">Lopende reeks</h3>
          <div class="arf-samen">
            <span class="item-icoon" aria-hidden="true"><Icoon naam="Repeat" :grootte="16" /></span>
            <div class="arf-samen-tekst">
              <b>{{ d.lopend.naam }} · stap {{ d.lopend.stap }} van {{ d.lopend.van }}<template v-if="d.lopend.status === 'gepauzeerd'"> · gepauzeerd</template></b>
              <span class="item-meta" data-test="arf-volgende">{{ volgende(d.lopend) }}</span>
              <span class="item-meta">{{ d.lopend.contact ? d.lopend.contact.naam : 'Geen contactpersoon' }} · gestart {{ dag(d.lopend.gestartOp) }}<template v-if="d.lopend.eigenaar.naam"> · {{ d.lopend.eigenaar.naam.replace(/^Testgebruiker /, '') }}</template></span>
            </div>
            <span class="pil" :class="STAND_PIL[d.lopend.stand]" data-test="arf-stand">{{ OVERZICHT_LABEL[d.lopend.stand as keyof typeof OVERZICHT_LABEL] }}</span>
          </div>
          <div v-if="d.lopend.magOpenen" class="arf-detail">
            <Suspense>
              <ReeksDetail :key="`${d.lopend.id}-${d.lopend.status}`" :reeks-id="d.lopend.id" zonder-account @gewijzigd="gewijzigd" />
              <template #fallback><p class="meta">Laden…</p></template>
            </Suspense>
          </div>
          <p v-else class="meta">Deze reeks is van {{ d.lopend.eigenaar.naam ?? 'een collega' }}, buiten je team.</p>
        </section>

        <!-- Lege staat: nog geen reeks op deze prospect. -->
        <LegeStaat v-if="!d.lopend && !d.eerdere.length" kicker="Nog niets" titel="Nog geen opvolgreeks op deze prospect." tekst="Een opvolgreeks zet na een uitkomst als stuur informatie, een voicemail of een eerste gesprek een paar stappen klaar: mail, LinkedIn en een belmoment. Mail en LinkedIn krijgen een concept dat jij goedkeurt. De reeks stopt vanzelf zodra de prospect reageert of er een afspraak staat." data-test="arf-leeg">
          <button v-if="d.kan.starten" type="button" class="dd-actie dd-actie--primair" data-test="arf-start-leeg" @click="startOpen = true"><Icoon naam="Repeat" class="dd-actie-icoon" />Start reeks</button>
          <p v-else-if="d.kan.reden" class="meta" data-test="arf-reden">{{ d.kan.reden }}</p>
        </LegeStaat>
        <template v-else>
          <p v-if="!d.lopend && !d.kan.starten && d.kan.reden" class="kaart kaart--geel" data-test="arf-reden">{{ d.kan.reden }}</p>
          <p v-else-if="!d.lopend" class="meta" data-test="arf-geen-lopend">Er loopt nu geen reeks. Start een nieuwe met Start reeks onderaan.</p>
        </template>

        <!-- Eerdere reeksen met hun uitkomst. -->
        <section v-if="d.eerdere.length" class="arf-sectie" data-test="arf-eerdere">
          <h3 class="arf-kop">Eerdere reeksen</h3>
          <ul class="arf-lijst">
            <li v-for="x in d.eerdere" :key="x.id" :data-test="`arf-eerder-${x.id}`">
              <button type="button" class="item-rij arf-rij" :aria-expanded="uitgeklapt === x.id" :disabled="!x.magOpenen" :data-test="`arf-eerder-knop-${x.id}`" @click="uitgeklapt = uitgeklapt === x.id ? null : x.id">
                <span class="item-icoon" :class="{ 'item-icoon--visit': x.stand === 'raak' }" aria-hidden="true"><Icoon :naam="x.stand === 'raak' ? 'CircleCheck' : 'Square'" :grootte="16" /></span>
                <span class="item-body">
                  <span class="item-naam">{{ x.naam }}</span>
                  <span class="item-meta" data-test="arf-uitkomst">{{ uitkomst(x) }}</span>
                  <span class="item-meta">{{ datum(x.gestartOp) }} tot {{ datum(x.gestoptOp) || 'nu' }}<template v-if="x.contact"> · {{ x.contact.naam }}</template> · {{ x.gedaan }} van {{ x.van }} stappen gedaan</span>
                </span>
                <span class="item-acties"><span class="pil" :class="STAND_PIL[x.stand]">{{ OVERZICHT_LABEL[x.stand as keyof typeof OVERZICHT_LABEL] }}</span><Icoon v-if="x.magOpenen" :naam="uitgeklapt === x.id ? 'ChevronUp' : 'ChevronDown'" :grootte="16" class="arf-pijl" /></span>
              </button>
              <div v-if="uitgeklapt === x.id" class="arf-detail">
                <Suspense>
                  <ReeksDetail :reeks-id="x.id" zonder-account @gewijzigd="gewijzigd" />
                  <template #fallback><p class="meta">Laden…</p></template>
                </Suspense>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </div>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button v-if="d?.kan.starten" type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="arf-start" @click="startOpen = true"><Icoon naam="Repeat" :grootte="16" />Start reeks</button>
        <span class="fo-foot-vul" />
        <NuxtLink v-if="magNaar('/opvolgreeksen')" :to="d?.lopend ? `/opvolgreeksen?reeks=${d.lopend.id}` : '/opvolgreeksen'" class="fs-ibtn" title="Alle opvolgreeksen" aria-label="Alle opvolgreeksen" data-test="arf-alle"><Icoon naam="ExternalLink" :grootte="18" /></NuxtLink>
      </footer>
    </template>
  </FlyoutShell>
  <StartReeksFlyout :open="startOpen" :account="account" bovenop @sluit="startOpen = false" @gestart="gestart" />
</template>

<style scoped>
.arf-body { display: flex; flex-direction: column; gap: var(--kaart-gap, 16px); }
.arf-sectie { display: flex; flex-direction: column; gap: 10px; }
.arf-kop { margin: 0; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.arf-samen { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 12px 14px; background: var(--surface); border-left: 3px solid var(--yellow); }
.arf-samen-tekst { display: flex; min-width: 0; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
.arf-detail { padding: 16px; background: var(--wit); border: 1px solid var(--border); }
.arf-lijst { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--border); }
.arf-lijst > li { border-bottom: 1px solid var(--border); }
.arf-rij { width: 100%; grid-template-columns: 36px minmax(0, 1fr) auto; text-align: left; background: none; border: 0; font: inherit; color: inherit; cursor: pointer; }
.arf-rij:disabled { cursor: default; }
.arf-rij:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
.arf-rij .item-body { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.arf-rij .item-acties { display: inline-flex; align-items: center; gap: 6px; }
.arf-pijl { color: var(--muted); }
.arf-lijst .arf-detail { margin: 0 0 12px; }
@media (max-width: 719px) {
  .arf-rij { min-height: var(--touch-target-min); }
  .arf-detail { padding: 12px; }
}
</style>
