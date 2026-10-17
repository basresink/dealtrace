<script setup lang="ts">
// Detail van een cel van de Signaalradar (F5): bij een golf de accounts, waarom het een golf is (met de
// zeven perioden als staafjes), het winpunt dat past, de capaciteit in je komende belblokken en de knoppen
// Start belronde (campagneconcept) en Zet in belblok. Zonder golf de uitleg waarom niet. Staat onder het raster:
// op een groot scherm links het waarom en de acties, rechts de accounts. De naam opent de accountkaart, het
// lampje het eigen inzicht (anders de bron).
import { factorTekst, getal } from '~~/shared/signaalradar'

const props = defineProps<{ reikwijdte: 'mij' | 'org'; brancheId: string | null; soort: string }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const router = useRouter()
const query = computed(() => ({ reikwijdte: props.reikwijdte, branche: props.brancheId ?? 'zonder', soort: props.soort }))
const { data: d, pending, error, refresh } = await useFetch<any>('/api/signaalradar/cel', { query, default: () => null })
// De titel van een signaal begint vaak met de accountnaam; die staat al in de rij.
const zonderNaam = (titel: string, naam: string) => (titel.toLowerCase().startsWith(`${naam.toLowerCase()}:`) ? titel.slice(naam.length + 1).trim() : titel)

const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const allesTonen = ref(false)
watch(query, () => { allesTonen.value = false })
const zichtbaar = computed(() => (allesTonen.value ? d.value?.accounts ?? [] : (d.value?.accounts ?? []).slice(0, 8)))
// Zeven staafjes: de zes perioden ervoor (oudste eerst) en de laatste 30 dagen.
const staven = computed(() => {
  if (!d.value) return []
  const v = [...d.value.perPeriode].reverse().map((n: number, i: number) => ({ n, label: `${6 - i}`, nu: false }))
  v.push({ n: d.value.aantal, label: 'nu', nu: true })
  const max = Math.max(1, ...v.map((x) => x.n))
  return v.map((x) => ({ ...x, hoogte: Math.round((x.n / max) * 100) }))
})

const bezig = ref<'' | 'belronde' | 'belblok'>('')
async function belronde() {
  bezig.value = 'belronde'
  try {
    const r = await $fetch<any>('/api/signaalradar/belronde', { method: 'POST', body: query.value })
    toast.toon(r.toast)
    await router.push(`/campagnes/${r.id}`)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = '' }
}
async function belblok() {
  bezig.value = 'belblok'
  try {
    const r = await $fetch<any>('/api/signaalradar/belblok', { method: 'POST', body: query.value })
    toast.toon(r.toast)
    await refresh()
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = '' }
}
</script>

<template>
  <div class="rd" data-test="sr-detail" :aria-busy="pending">
    <p v-if="!d && pending" class="rd-laden">Even rekenen…</p>
    <div v-else-if="!d && error" class="rd-fout" role="alert" data-test="sr-detail-fout">
      <p class="rd-label">Deze cel staat niet op de radar</p>
      <p class="rd-reden">{{ foutTekst(error) }} Kies een cel in het raster.</p>
    </div>
    <template v-else-if="d">
      <div class="rd-kop">
        <p class="rd-kicker" :class="{ 'rd-kicker--golf': d.golf }" data-test="sr-detail-kicker">
          <template v-if="d.golf">Golf · {{ factorTekst(d.factor) }}</template>
          <template v-else>{{ d.brancheNaam }} · {{ d.soortLabel }}</template>
        </p>
        <h2 class="rd-titel">{{ d.titel }}</h2>
        <p v-if="d.golf" class="rd-haak">{{ d.haak }}</p>
      </div>

      <div class="rd-indeling" :class="{ 'rd-indeling--twee': d.accounts.length }">
        <div class="rd-kolom">
          <div class="rd-waarom" :class="{ 'rd-waarom--geen': !d.golf }" data-test="sr-waarom">
            <p class="rd-label">{{ d.golf ? 'Waarom een golf' : 'Geen golf' }}</p>
            <p class="rd-reden">{{ d.reden }}</p>
            <div class="rd-staven" role="img" :aria-label="`Accounts per periode van 30 dagen, oudste eerst: ${staven.map((s) => s.n).join(', ')}. Normaal ${getal(d.normaal)}.`">
              <span v-for="(s, i) in staven" :key="i" class="rd-staaf" :class="{ 'rd-staaf--nu': s.nu }">
                <span class="rd-staaf-vak"><span class="rd-staaf-vul" :style="{ height: `${Math.max(s.hoogte, s.n ? 6 : 0)}%` }" /></span>
                <span class="rd-staaf-n tnum">{{ s.n }}</span>
                <span class="rd-staaf-label">{{ s.label }}</span>
              </span>
            </div>
            <p class="rd-meta">Perioden van 30 dagen; normaal is het gemiddelde van de zes ervoor ({{ getal(d.normaal) }}).</p>
            <NuxtLink v-if="!d.golf" to="/inzichten" class="rd-link" data-test="sr-naar-inzichten">De signalen staan per account bij Inzichten <Icoon naam="ArrowRight" :grootte="14" /></NuxtLink>
          </div>

          <template v-if="d.golf">
            <div class="rd-winpunt" data-test="sr-winpunt">
              <template v-if="d.winpunt">
                <p class="rd-label">Winpunt dat past</p>
                <p class="rd-winpunt-titel">{{ d.winpunt.titel }}</p>
                <p class="rd-winpunt-tekst">{{ d.winpunt.omschrijving }}</p>
              </template>
              <p v-else class="rd-winpunt-tekst">Je verkoopverhaal heeft nog geen actief winpunt. De belronde gebruikt de algemene belofte.</p>
              <div class="rd-herkomst">
                <span class="pil pil--grijs">WINPUNTVOOR</span>
                <span class="pil pil--grijs">{{ d.signalen }} INZICHTEN MET BRON</span>
                <span v-if="d.winpunt?.reden" class="rd-herkomst-reden">{{ d.winpunt.reden }}</span>
              </div>
            </div>
            <p class="rd-capaciteit" :class="`rd-capaciteit--${d.capaciteit.past}`" data-test="sr-capaciteit">{{ d.capaciteit.tekst }}</p>
            <div class="rd-acties">
              <button type="button" class="dd-actie dd-actie--primair" data-test="sr-belronde" :disabled="!d.acties.belronde.ok || !!bezig" aria-describedby="sr-belronde-reden" @click="belronde">
                <Icoon naam="Megaphone" class="dd-actie-icoon" />{{ bezig === 'belronde' ? 'Bezig…' : 'Start belronde' }}
              </button>
              <button type="button" class="dd-actie dd-actie--secundair" data-test="sr-belblok" :disabled="!d.acties.belblok.ok || !!bezig" aria-describedby="sr-belblok-reden" @click="belblok">
                <Icoon naam="Phone" class="dd-actie-icoon" />{{ bezig === 'belblok' ? 'Bezig…' : 'Zet in belblok' }}
              </button>
            </div>
            <div class="rd-redenen">
              <p id="sr-belronde-reden" class="rd-meta">Start belronde: {{ d.acties.belronde.reden }}</p>
              <p id="sr-belblok-reden" class="rd-meta">Zet in belblok: {{ d.acties.belblok.reden }}</p>
            </div>
          </template>
        </div>

        <div v-if="d.accounts.length" class="rd-kolom rd-blok">
          <p class="rd-label">Accounts <span class="tnum">{{ d.accounts.length }}</span></p>
          <ul class="rd-lijst" role="list" data-test="sr-accounts">
            <li v-for="a in zichtbaar" :key="a.id" class="item-rij rd-rij">
              <span class="item-tijd">{{ datum(a.signaal.op) }}</span>
              <span class="item-icoon rd-icoon" aria-hidden="true"><Icoon naam="Lightbulb" :grootte="16" /></span>
              <span class="item-body">
                <NuxtLink :to="`/accounts/${a.id}`" class="item-naam rd-naam" :data-test="`sr-account-${a.id}`">{{ a.naam }}</NuxtLink>
                <span class="item-meta">{{ zonderNaam(a.signaal.titel, a.naam) }}<template v-if="a.signaal.bron"> · {{ a.signaal.bron }}</template></span>
                <span v-if="!a.eigen" class="item-meta">Van {{ a.eigenaar ?? 'niemand' }}</span>
              </span>
              <span class="item-acties rd-rij-acties">
                <span v-if="a.signalen > 1" class="pil pil--paars">{{ a.signalen }} SIGNALEN</span>
                <NuxtLink v-if="a.signaal.mijnInzicht" :to="`/inzichten?inzicht=${a.signaal.id}`" class="rd-ibtn" :aria-label="`Open het inzicht van ${a.naam}`" title="Open het inzicht" :data-test="`sr-signaal-${a.signaal.id}`"><Icoon naam="Lightbulb" :grootte="16" /></NuxtLink>
                <a v-else-if="a.signaal.url" :href="a.signaal.url" target="_blank" rel="noopener" class="rd-ibtn" :aria-label="`Open de bron van het signaal bij ${a.naam}`" title="Open de bron" :data-test="`sr-signaal-${a.signaal.id}`"><Icoon naam="ExternalLink" :grootte="16" /></a>
              </span>
            </li>
          </ul>
          <button v-if="d.accounts.length > 8 && !allesTonen" type="button" class="dd-act rd-meer" data-test="sr-alle-accounts" @click="allesTonen = true">Toon alle {{ d.accounts.length }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rd { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.rd-kop, .rd-kolom { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.rd-kop { gap: 8px; }
.rd-indeling { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
@media (min-width: 1024px) { .rd-indeling--twee { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; } }
.rd-fout { padding: 12px 14px; background: var(--surface); border-left: 3px solid var(--border-strong); }
.rd-laden { margin: 0; font-size: 13px; color: var(--muted); }
.rd-kicker { margin: 0; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.rd-kicker--golf { color: var(--purple); }
.rd-titel { margin: 0; font-family: var(--font-serif); font-size: var(--fs-kaarttitel); font-weight: 700; line-height: 1.3; color: var(--ink); overflow-wrap: anywhere; }
.rd-haak { margin: 0; font-size: 13px; color: var(--ink-soft); }
.rd-label { display: flex; gap: 8px; margin: 0 0 6px; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.rd-waarom { padding: 12px 14px; background: var(--yellow-zacht); border-left: 3px solid var(--yellow); }
.rd-waarom--geen { background: var(--surface); border-left-color: var(--border-strong); }
.rd-reden { margin: 0; font-size: 13px; color: var(--ink); }
.rd-staven { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
.rd-staaf { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.rd-staaf-vak { display: flex; align-items: flex-end; width: 100%; max-width: 28px; height: 44px; background: var(--wit); border: 1px solid var(--border); }
.rd-staaf-vul { display: block; width: 100%; background: var(--border-strong); }
.rd-staaf--nu .rd-staaf-vul { background: var(--ink); }
.rd-staaf-n { font-size: 11px; font-weight: 700; color: var(--ink); }
.rd-staaf-label { font-size: 10px; color: var(--muted); }
.rd-meta { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
.rd-link { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; margin-top: 4px; font-size: 12px; font-weight: 700; color: var(--ink); }
.rd-lijst { list-style: none; margin: 0; padding: 0; }
.rd-rij { position: relative; grid-template-columns: 52px 36px minmax(0, 1fr) auto; }
.rd-naam { color: inherit; text-decoration: none; }
/* De naam maakt de hele rij klikbaar (accountkaart); het lampje rechts ligt erboven. */
.rd-naam::after { content: ''; position: absolute; inset: 0; }
.rd-naam:hover { color: var(--yellow-dark); }
.rd-naam:focus-visible { outline: none; }
.rd-naam:focus-visible::after { outline: 2px solid var(--ink); outline-offset: -2px; }
.rd-rij-acties { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; }
.rd-ibtn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--border); background: var(--wit); color: var(--purple); }
.rd-ibtn:hover { border-color: var(--ink); }
.rd-ibtn:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.rd-icoon { background: var(--purple); color: var(--wit); }
.rd-meer { margin-top: 6px; }
.rd-winpunt { padding: 12px 14px; border: 1px solid var(--border); border-left: 3px solid var(--purple); }
.rd-winpunt-titel { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.rd-winpunt-tekst { margin: 4px 0 0; font-size: 13px; color: var(--ink-soft); }
.rd-herkomst { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.rd-herkomst-reden { font-size: 12px; color: var(--muted); }
.rd-capaciteit { margin: 0; font-size: 13px; color: var(--ink-soft); }
.rd-capaciteit--nee { color: var(--orange-dark); }
.rd-acties { display: flex; flex-wrap: wrap; gap: 8px; }
.rd-redenen { margin-top: -8px; }
.rd-redenen .rd-meta { margin: 2px 0 0; }
@media (max-width: 599px) {
  .rd-rij { grid-template-columns: 36px minmax(0, 1fr) auto; }
  .rd-rij > .rd-rij-acties { grid-column: 3; grid-row: 2; flex-direction: column; align-items: flex-end; }
  .rd-ibtn { width: 44px; height: 44px; }
  .rd-acties .dd-actie { flex: 1 1 100%; justify-content: center; }
}
</style>
