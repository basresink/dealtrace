<script setup lang="ts">
// Dagstart (F3 Dagplanner): de dag in het kort. Afspraken staan vast, bezoeken op route met de reistijd
// ervoor, belblokken in het uur waarop je doelgroep het vaakst opneemt (bereikbaarheid per branche en uur
// uit alle belpogingen), een voorbereidingsblok voor de eerste afspraak, en "Wat schoof" als er na de
// eerste indeling iets veranderde. Je werkplek (binnendienst of buitendienst) bepaalt de indeling; er is
// geen keuzeknop. Alles op deze pagina gaat over jezelf: de bereikbaarheid komt uit je eigen belpogingen.
// Daaronder de blokken van de dag (RitmeBlokken): belblokken om te vullen, belprioriteit naast je afspraken,
// kansen langs de route, lopende campagnes en accountplannen, elk alleen als de functie aanstaat.
// Onderaan Tips en tricks en drie artikelen uit de academie bij je dag (RitmeSteun). Het
// voorstel komt pas in je agenda na je akkoord. Eén bron: GET /api/dagstart (shared/dagritme.ts planDag).
// Met "Plan mijn dag automatisch" deelt de Dagplanner de dag zelf in (volgens je werkplek): dan toont de
// pagina wat hij in je agenda zette, met Ongedaan maken per blok of voor de hele dag, Loopt uit voor de
// lopende afspraak en in "Wat schoof" wat er bij herplannen veranderde (shared/dagplanning.ts).
const { functie } = useMe()
const aan = !!functie('dagritme.dagstart')?.beschikbaar
const toast = useToast()
const route = useRoute()
const router = useRouter()
const query = computed(() => ({ dag: route.query.dag || undefined, branche: route.query.branche || undefined }))
const { data: d, refresh } = await useFetch<any>('/api/dagstart', { query, immediate: aan, default: () => null })
function zet(q: Record<string, string | undefined>) { router.replace({ query: { ...route.query, ...q } }) }

const UUR_H = 56
const startUur = computed(() => Math.min(8, ...((d.value?.plan?.blokken ?? []).map((b: any) => uurVan(b.start)))))
const eindUur = computed(() => Math.max(18, ...((d.value?.plan?.blokken ?? []).map((b: any) => Math.ceil(uurVan(b.eind))))))
const uren = computed(() => Array.from({ length: Math.max(1, eindUur.value - Math.floor(startUur.value)) }, (_, i) => Math.floor(startUur.value) + i))
function uurVan(isoTijd: string) {
  const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' }).format(new Date(isoTijd)).split(':').map(Number)
  return p[0]! + p[1]! / 60
}
const tijd = (isoTijd: string) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(isoTijd))
/** Overlappende blokken naast elkaar: per groep die elkaar raakt een eigen baan. */
const geplaatst = computed(() => {
  const l = [...(d.value?.plan?.blokken ?? [])].map((b: any) => ({ b, s: uurVan(b.start), e: Math.max(uurVan(b.eind), uurVan(b.start) + 24 / UUR_H), baan: 0, banen: 1 })).sort((a, b) => a.s - b.s || b.e - a.e)
  let groep: typeof l = []
  let eindes: number[] = []
  let groepEind = 0
  const sluit = () => { const n = Math.max(1, eindes.length); for (const x of groep) x.banen = n }
  for (const x of l) {
    if (groep.length && x.s >= groepEind) { sluit(); groep = []; eindes = []; groepEind = 0 }
    let i = eindes.findIndex((e) => e <= x.s)
    if (i < 0) { i = eindes.length; eindes.push(x.e) } else eindes[i] = x.e
    x.baan = i
    groep.push(x)
    groepEind = Math.max(groepEind, x.e)
  }
  sluit()
  return l
})
const stijl = (x: { s: number; e: number; baan: number; banen: number }) => ({
  top: `${(x.s - Math.floor(startUur.value)) * UUR_H + 1}px`, height: `${Math.max(22, (x.e - x.s) * UUR_H - 3)}px`,
  left: `calc(${(100 / x.banen) * x.baan}% + ${x.baan ? 2 : 0}px)`, width: `calc(${100 / x.banen}% - ${x.banen > 1 ? 2 : 0}px)`,
})
const Link = resolveComponent('NuxtLink')
const ICOON: Record<string, string> = { afspraak: 'Handshake', bezoek: 'MapPin', reis: 'Car', kans: 'Compass', bel: 'Phone', voorbereiding: 'BookOpen', lunch: 'Utensils', focus: 'SquareCheck', bezet: 'Lock' }
const ICOON_KLASSE: Record<string, string> = { bel: 'item-icoon--call', bezoek: 'item-icoon--visit', kans: 'item-icoon--visit', afspraak: 'item-icoon--email' }

const maxProcent = computed(() => Math.max(1, ...((d.value?.bereik?.uren ?? []).map((u: any) => u.procent ?? 0))))
const bezig = ref(false)
async function zetInAgenda() {
  bezig.value = true
  try {
    const uit = await $fetch<any>('/api/dagstart/belblokken', { method: 'POST', body: { modus: d.value.modus, dag: d.value.dag } })
    toast.toon(`${uit.aantal === 1 ? 'Het belblok staat' : `${uit.aantal} belblokken staan`} in je agenda.`)
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function neemOver() {
  try { await $fetch('/api/dagstart/bewaar', { method: 'POST' }); toast.toon('De nieuwe indeling is je dag.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// De automatische dagplanning (F3).
const dp = computed(() => d.value?.dagplanning ?? null)
const gepland = computed(() => !!d.value?.vandaag && dp.value?.status === 'gepland')
const AANLEIDING: Record<string, string> = { verzet: 'Afspraak verzet', uitloop: 'Afspraak loopt uit', geannuleerd: 'Afspraak geannuleerd', niet_verschenen: 'Niet verschenen', nieuw: 'Nieuwe afspraak', agenda: 'Wijziging in je agenda', ongedaan: 'Ongedaan gemaakt' }
const ITEM_ICOON: Record<string, string> = { belblok: 'Phone', voorbereiding: 'BookOpen', kans: 'Compass', lunch: 'Utensils', focus: 'SquareCheck' }
const nuTik = ref(Date.now())
let klok: ReturnType<typeof setInterval> | undefined
onMounted(() => { nuTik.value = Date.now(); klok = setInterval(() => { nuTik.value = Date.now() }, 60_000) })
onBeforeUnmount(() => clearInterval(klok))
const kanOngedaan = (i: { start: string }) => Date.parse(i.start) > nuTik.value
const bezigDp = ref<string | null>(null)
async function ongedaan(sleutel?: string) {
  bezigDp.value = sleutel ?? 'dag'
  try {
    const r = await $fetch<any>('/api/dagplanning/ongedaan', { method: 'POST', body: sleutel ? { sleutel } : {} })
    toast.toon(r.tekst)
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezigDp.value = null }
}
async function planNu() {
  bezigDp.value = 'plan'
  try {
    const r = await $fetch<any>('/api/dagplanning/plan', { method: 'POST' })
    toast.toon(r.status === 'gepland' ? 'Je dag is ingedeeld en staat in je agenda.' : r.status === 'voorstel' ? 'De Bewaker liet alleen een voorstel toe.' : 'Je dag was al ingedeeld.')
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezigDp.value = null }
}
/** De lopende of eerstvolgende afspraak van vandaag: die kan uitlopen. */
const lopend = computed(() => (d.value?.plan?.blokken ?? []).find((b: any) => (b.soort === 'afspraak' || b.soort === 'bezoek') && b.vast && Date.parse(b.eind) > nuTik.value) ?? null)
async function uitloop(minuten: number) {
  if (!lopend.value) return
  bezigDp.value = `uitloop-${minuten}`
  try {
    const r = await $fetch<any>(`/api/afspraken/${lopend.value.id}/uitloop`, { method: 'POST', body: { minuten } })
    toast.toon(`${r.tekst} De rest van je dag is opnieuw ingedeeld.`)
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezigDp.value = null }
}
useHead({ title: 'Dagstart · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="dagritme.dagstart" />
    <template v-else-if="d">
      <PaginaKop helpartikel="dagstart">
        <template #kicker><span class="kicker kicker--streep" data-test="ds-kicker">{{ d.kicker }}</span></template>
        <template #titel><h1 class="title title--groot" data-test="ds-titel">{{ d.titel }}</h1></template>
        <template #uitleg><p class="subtitle subtitle--groot" data-test="ds-lede">{{ d.lede }}</p></template>
        <template #acties>
          <span class="pil pil--grijs ds-werkplek" data-test="ds-werkplek">{{ d.modus === 'buiten' ? 'Buitendienst' : 'Binnendienst' }} · je werkplek</span>
          <NuxtLink to="/agenda" class="dd-actie dd-actie--secundair"><Icoon naam="Calendar" class="dd-actie-icoon" />Agenda</NuxtLink>
        </template>
      </PaginaKop>

      <section class="section">
        <div class="container ds">
          <article class="kaart ds-dag" data-test="ds-dag">
            <header class="kaart-kop"><h2 class="kaart-titel">Je dag</h2><span class="meta">{{ d.plan.samenvatting }}</span></header>
            <p v-if="!d.werkdag" class="ds-leeg">Geen werkdag. Je planner rust vandaag.</p>
            <template v-else>
              <div class="ds-rooster" :style="{ height: `${uren.length * UUR_H}px` }" aria-hidden="true">
                <div v-for="u in uren" :key="u" class="ds-uur" :style="{ top: `${(u - Math.floor(startUur)) * UUR_H}px` }"><span>{{ String(u).padStart(2, '0') }}:00</span></div>
                <div class="ds-kolom">
                  <div v-for="x in geplaatst" :key="x.b.id" class="ds-blok" :class="[`ds-blok--${x.b.soort}`, { 'ds-blok--voorstel': x.b.voorstel }]" :style="stijl(x)" :title="`${tijd(x.b.start)} ${x.b.titel}${x.b.sub ? ` · ${x.b.sub}` : ''}`">
                    <b>{{ tijd(x.b.start) }} {{ x.b.titel }}</b><span v-if="x.b.sub && (x.e - x.s) * UUR_H >= 40">{{ x.b.sub }}</span>
                  </div>
                </div>
              </div>
              <ul class="ds-lijst" data-test="ds-blokken">
                <li v-for="b in d.plan.blokken.filter((x: any) => x.soort !== 'reis')" :key="b.id" :data-test="`ds-blok-${b.soort}`">
                  <component :is="b.href ? Link : 'div'" :to="b.href ?? undefined" class="item-rij">
                    <span class="item-tijd">{{ tijd(b.start) }}<small>{{ tijd(b.eind) }}</small></span>
                    <span class="item-icoon" :class="ICOON_KLASSE[b.soort]"><Icoon :naam="ICOON[b.soort] ?? 'Clock'" /></span>
                    <span class="item-body"><span class="item-naam">{{ b.titel }}</span><span v-if="b.sub" class="item-meta">{{ b.sub }}</span><span v-if="b.voorstel" class="pil pil--geel">Voorstel</span></span>
                  </component>
                </li>
              </ul>
              <p v-if="!d.plan.blokken.length" class="ds-leeg" data-test="ds-leeg">Niets gepland. Een lege agenda is het beste moment om te prospecteren.</p>
            </template>
          </article>

          <div class="ds-zij">
            <article class="kaart" data-test="ds-bereik">
              <header class="kaart-kop"><h2 class="kaart-titel">Wanneer neemt jouw doelgroep op?</h2></header>
              <p class="meta ds-meta" data-test="ds-bereik-meta">{{ d.bereik.doelgroep ?? 'Alle branches' }} · {{ d.bereik.pogingen === 1 ? '1 eigen belpoging' : `${d.bereik.pogingen} eigen belpogingen` }} · laatste 90 dagen</p>
              <label class="ds-branche"><span class="sr-only">Doelgroep</span>
                <select data-test="ds-branche" @change="zet({ branche: ($event.target as HTMLSelectElement).value || undefined })">
                  <option value="" :selected="!route.query.branche">Doelgroep van je belacties</option>
                  <option value="alle" :selected="route.query.branche === 'alle'">Alle branches</option>
                  <option v-for="b in d.branches" :key="b.id" :value="b.id" :selected="route.query.branche === b.id">{{ b.naam }}</option>
                </select>
              </label>
              <div class="ds-grafiek" role="img" :aria-label="`Bereikbaarheid per uur voor ${d.bereik.doelgroep ?? 'alle branches'}`">
                <div v-for="u in d.bereik.uren" :key="u.uur" class="ds-staaf" :class="{ 'ds-staaf--top': d.plan.belUur === u.uur }">
                  <span class="ds-staaf-n">{{ u.procent != null ? `${u.procent}%` : '' }}</span>
                  <span class="ds-staaf-v" :style="{ height: `${u.procent != null ? Math.max(4, (u.procent / maxProcent) * 90) : 2}px` }" />
                  <span class="ds-staaf-uur">{{ u.uur }}</span>
                </div>
              </div>
              <p class="ds-uitleg" data-test="ds-bel-uitleg">{{ d.plan.belUitleg }}</p>
            </article>

            <article class="kaart" data-test="ds-schoof">
              <header class="kaart-kop"><h2 class="kaart-titel">Wat schoof</h2></header>
              <div v-if="gepland && dp.wijzigingen.length" class="ds-wijzigingen">
                <section v-for="(w, n) in [...dp.wijzigingen].reverse()" :key="`${w.op}-${n}`" class="ds-wijziging" :data-test="n === 0 ? 'ds-wijziging-laatste' : undefined">
                  <h3 class="ds-wijziging-kop">{{ tijd(w.op) }} · {{ AANLEIDING[w.aanleiding] ?? 'Herpland' }}</h3>
                  <ul class="ds-schoof"><li v-for="(r, i) in w.regels" :key="i">{{ r }}</li></ul>
                </section>
              </div>
              <ul v-else-if="d.schoof.length" class="ds-schoof"><li v-for="(r, i) in d.schoof" :key="i">{{ r }}</li></ul>
              <p v-else class="meta">Niets. Alles past vandaag.</p>
              <button v-if="d.schoof.length && !gepland" type="button" class="dd-act mt-8" data-test="ds-neem-over" @click="neemOver">Neem de nieuwe indeling over</button>
            </article>

            <article v-if="d.vandaag && d.werkdag && (gepland || dp?.automatisch)" class="kaart" data-test="ds-dagplanner">
              <header class="kaart-kop"><h2 class="kaart-titel">{{ gepland ? 'Gepland door de Dagplanner' : 'Dagplanner' }}</h2></header>
              <template v-if="gepland">
                <p class="meta">Dit zette de Dagplanner zelf in je dag. Een blok dat nog niet begon, maak je hier ongedaan.</p>
                <ul class="ds-items">
                  <li v-for="i in dp.items" :key="i.sleutel" class="item-rij ds-item" :data-test="`ds-item-${i.sleutel}`">
                    <span class="item-tijd">{{ tijd(i.start) }}<small>{{ tijd(i.eind) }}</small></span>
                    <span class="item-icoon" :class="ICOON_KLASSE[i.soort === 'belblok' ? 'bel' : i.soort]"><Icoon :naam="ITEM_ICOON[i.soort] ?? 'Clock'" /></span>
                    <span class="item-body"><span class="item-naam">{{ i.titel }}</span><span v-if="i.sub" class="item-meta">{{ i.sub }}</span><span class="pil-tags"><span class="pil pil--paars">Dagplanner</span><span v-if="i.agenda" class="pil pil--grijs">In je agenda</span></span>
                      <button v-if="kanOngedaan(i)" type="button" class="dd-act ds-item-knop" :disabled="!!bezigDp" :data-test="`ds-ongedaan-${i.sleutel}`" :aria-label="`Maak ${i.titel} ongedaan`" @click="ongedaan(i.sleutel)"><Icoon naam="Undo2" />Ongedaan</button>
                    </span>
                  </li>
                </ul>
                <p v-if="!dp.items.length" class="meta">Er staat niets meer van de Dagplanner in je dag.</p>
                <div v-if="lopend" class="ds-uitloop" data-test="ds-uitloop">
                  <span class="meta">Loopt {{ lopend.titel }} uit?</span>
                  <div class="ds-uitloop-knoppen">
                    <button v-for="m in [15, 30, 60]" :key="m" type="button" class="dd-act" :disabled="!!bezigDp" :data-test="`ds-uitloop-${m}`" @click="uitloop(m)">+{{ m }} min</button>
                  </div>
                </div>
                <button type="button" class="dd-actie dd-actie--secundair mt-8" :disabled="!!bezigDp" data-test="ds-ongedaan-dag" @click="ongedaan()"><Icoon naam="Undo2" class="dd-actie-icoon" />Maak de hele dag ongedaan</button>
              </template>
              <template v-else>
                <p class="meta" data-test="ds-dagplanner-stand">{{ dp?.status === 'ongedaan' ? 'Je maakte de planning van vandaag ongedaan. De Dagplanner plant vandaag niet meer vanzelf.' : dp?.status === 'voorstel' ? 'De Bewaker liet vandaag alleen een voorstel toe. Plan zelf in, of laat de Dagplanner het nu doen.' : `De Dagplanner deelt je dag om ${dp?.tijd} in. Wil je niet wachten, plan dan nu.` }}</p>
                <button type="button" class="dd-actie dd-actie--primair mt-8" :disabled="!!bezigDp" data-test="ds-plan-nu" @click="planNu"><Icoon naam="CalendarClock" class="dd-actie-icoon" />Plan mijn dag nu</button>
              </template>
            </article>

            <article v-if="d.plan.voorstellen.length" class="kaart" data-test="ds-voorstel">
              <header class="kaart-kop"><h2 class="kaart-titel">Eerst jouw akkoord</h2></header>
              <p class="meta">{{ d.plan.voorstellen.length === 1 ? 'Het belblok staat' : `${d.plan.voorstellen.length} belblokken staan` }} als voorstel in je dag. Pas na je akkoord komt het in je agenda, met je {{ d.belTaken }} belacties erin.</p>
              <button type="button" class="dd-actie dd-actie--primair mt-8" :disabled="bezig" data-test="ds-zet-in-agenda" @click="zetInAgenda"><Icoon naam="CalendarCheck" class="dd-actie-icoon" />Zet in mijn agenda</button>
            </article>

            <DagplanningVoorkeur compact @gewijzigd="refresh()" />

            <nav class="kaart ds-links" aria-label="Meer van je ritme">
              <NuxtLink to="/weekstart" class="tekst-link">Weekstart</NuxtLink>
              <NuxtLink to="/weekreview" class="tekst-link">Weekreview</NuxtLink>
              <NuxtLink to="/" class="tekst-link">Vandaag</NuxtLink>
            </nav>
          </div>
        </div>
      </section>

      <section v-if="d.blokken" class="section">
        <div class="container"><RitmeBlokken :blokken="d.blokken" moment="dagstart" :dag="d.dag" @ververs="refresh()" /></div>
      </section>

      <section class="section section--laatste">
        <div class="container"><RitmeSteun :steun="d.steun" moment="dagstart" /></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ds { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.ds-zij { display: grid; gap: 16px; min-width: 0; }
.ds-dag { min-width: 0; }
.ds-rooster { position: relative; margin-top: 12px; }
.ds-uur { position: absolute; left: 0; right: 0; border-top: 1px solid var(--border); }
.ds-uur span { position: absolute; top: 2px; left: 0; font-size: 11px; color: var(--muted); font-feature-settings: 'tnum'; }
.ds-kolom { position: absolute; top: 0; bottom: 0; left: 52px; right: 0; }
.ds-blok { position: absolute; padding: 4px 8px; overflow: hidden; display: flex; flex-direction: column; gap: 1px; font-size: 12px; line-height: 1.3; background: var(--surface); border-left: 3px solid var(--border-strong); color: var(--ink); }
.ds-blok b { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ds-blok span { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ds-blok--afspraak { border-left-color: var(--blue); }
.ds-blok--bezoek, .ds-blok--kans { border-left-color: var(--green); }
.ds-blok--bel { border-left-color: var(--yellow); background: var(--yellow-soft, var(--surface)); }
.ds-blok--voorstel { border-style: dashed; border-width: 1px 1px 1px 3px; border-color: var(--ink); border-left-color: var(--yellow); background: var(--wit); }
.ds-blok--reis { background: transparent; border-left: 1px dashed var(--border-strong); }
.ds-blok--lunch { background: transparent; }
.ds-blok--bezet { background: repeating-linear-gradient(-45deg, var(--surface), var(--surface) 6px, var(--border) 6px, var(--border) 7px); border-left-color: var(--muted); }
.ds-blok--voorbereiding { border-left-color: var(--purple); }
.ds-lijst { display: none; list-style: none; margin: 8px 0 0; padding: 0; }
.ds-lijst a.item-rij { text-decoration: none; }
.ds-leeg { margin: 12px 0 0; font-size: 14px; color: var(--muted); }
.ds-meta { margin: 0 0 8px; }
.ds-branche select { width: 100%; min-height: 44px; padding: 0 10px; border: 1px solid var(--border-strong); background: var(--wit); font: inherit; font-size: 13px; color: var(--ink); }
.ds-grafiek { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; align-items: end; height: 130px; margin-top: 12px; }
.ds-staaf { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; min-width: 0; height: 100%; }
.ds-staaf-v { width: 100%; max-width: 22px; background: var(--border-strong); }
.ds-staaf--top .ds-staaf-v { background: var(--ink); }
.ds-staaf-n { font-size: 10px; color: var(--muted); font-feature-settings: 'tnum'; }
.ds-staaf--top .ds-staaf-n { color: var(--ink); font-weight: 700; }
.ds-staaf-uur { font-size: 11px; color: var(--muted); }
.ds-uitleg { margin: 10px 0 0; font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.ds-schoof { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
.ds-wijzigingen { display: grid; gap: 10px; max-height: 340px; overflow-y: auto; }
.ds-wijziging-kop { margin: 0 0 2px; font-size: 12px; font-weight: 700; color: var(--muted); font-feature-settings: 'tnum'; }
.ds-links { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
.ds-links a { display: inline-flex; align-items: center; min-height: 44px; font-size: 13px; }
.ds-werkplek { align-self: center; }
.ds-items { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
.ds-item { align-items: start; grid-template-columns: auto auto minmax(0, 1fr); }
.ds-item .item-body { min-width: 0; }
.ds-item-knop { justify-self: start; margin-top: 6px; }
.ds-uitloop { display: grid; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.ds-uitloop-knoppen { display: flex; gap: 8px; flex-wrap: wrap; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 1023px) { .ds { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 719px) {
  .ds-rooster { display: none; }
  .ds-lijst { display: block; }
}
</style>
