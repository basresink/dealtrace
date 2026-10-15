<script setup lang="ts">
// Klantflyout (F23), eigen URL ?klant=<id>: contact, contract en pakket, gebruikers
// en aanvragen, functievlaggen per groep, gezondheid, startset en platformaudit.
import { STAND_LABEL, type Stand } from '~~/shared/gezondheid'
import { NIVEAU_LABEL, PAKKETTEN, PAKKET_LABEL, ROL_LABEL, type Niveau, type Pakket, type Rol } from '~~/shared/types'
const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: []; werkIn: [klant: { id: string; naam: string }] }>()
const toast = useToast()
const { metHerbevestiging } = useHerbevestig()
const klant = ref<any>(null)
const laden = ref(false)

async function laad() {
  if (!props.id) { klant.value = null; return }
  laden.value = true
  try { klant.value = await $fetch(String(`/api/platform/klanten/${props.id}`)) } catch (e) { toast.toon(foutTekst(e), 'fout'); emit('sluit') } finally { laden.value = false }
}
watch(() => props.id, laad, { immediate: true })

// P17: de stand van de DealDrive-koppeling (uit of mock; http volgt).
async function zetDealdrive(stand: string) {
  if (stand === klant.value.dealdrive) return
  try { await $fetch(String(`/api/platform/klanten/${props.id}/dealdrive`), { method: 'PUT', body: { stand } }); toast.toon(`DealDrive staat op ${stand}.`); await laad() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Pakketwissel met bevestiging: wat de klant wint en verliest.
const voorstel = ref<{ naar: Pakket; wint: string[]; verliest: string[] } | null>(null)
async function kiesPakket(naar: Pakket) {
  if (naar === klant.value.pakket) return
  const v = await $fetch<any>(String(`/api/platform/klanten/${props.id}/pakket`), { method: 'PUT', body: { pakket: naar } })
  voorstel.value = { naar, wint: v.wint, verliest: v.verliest }
}
const voorstelTekst = computed(() => {
  if (!voorstel.value) return ''
  const v = voorstel.value
  const delen = [v.wint.length ? `Wint: ${v.wint.join(', ')}.` : '', v.verliest.length ? `Verliest: ${v.verliest.join(', ')}.` : '']
  return delen.filter(Boolean).join(' ') || 'Geen verschil in functies.'
})
async function bevestigPakket() {
  const naar = voorstel.value!.naar
  voorstel.value = null
  try {
    await metHerbevestiging<unknown>(() => $fetch<unknown>(String(`/api/platform/klanten/${props.id}/pakket`), { method: 'PUT', body: { pakket: naar, bevestigd: true } }))
    toast.toon(`Pakket gewijzigd naar ${PAKKET_LABEL[naar]}.`)
    await laad(); emit('gewijzigd')
  } catch (e) { const t = foutTekst(e); if (t) toast.toon(t, 'fout') }
}

async function zetStand(stand: 'aanvragen' | 'zelf') {
  try { await $fetch(String(`/api/platform/klanten/${props.id}/gebruikersstand`), { method: 'PUT', body: { stand } }); await laad() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const contract = reactive({ status: 'actief', seats: 5, prijs: 0, proefTot: '' })
watch(klant, (k) => { if (k) Object.assign(contract, { status: k.contract.status ?? 'actief', seats: k.contract.seats ?? 5, prijs: k.contract.prijs ?? 0, proefTot: k.contract.proefTot ?? '' }) })
async function bewaarContract() {
  try { await $fetch(String(`/api/platform/klanten/${props.id}/contract`), { method: 'PUT', body: { ...contract, proefTot: contract.status === 'proef' ? contract.proefTot : undefined } }); toast.toon('Contract opgeslagen.'); await laad(); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function aanvraag(id: string, besluit: 'goedkeuren' | 'afwijzen') {
  try { await $fetch(String(`/api/platform/aanvragen/${id}/afhandelen`), { method: 'POST', body: { besluit } }); toast.toon(besluit === 'goedkeuren' ? 'Aanvraag goedgekeurd.' : 'Aanvraag afgewezen.'); await laad(); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function startset() {
  try { await $fetch(String(`/api/platform/klanten/${props.id}/startset`), { method: 'POST' }); toast.toon('Startset aangevuld.'); await laad() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const datum = (t: string | null) => (t ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(t)) : 'nooit')
const looptTot = computed(() => {
  const c = klant.value?.contract
  if (!c?.start || !c.looptijdMaanden) return ''
  const tot = new Date(c.start); tot.setMonth(tot.getMonth() + c.looptijdMaanden)
  const opzeg = new Date(tot); opzeg.setMonth(opzeg.getMonth() - (c.opzegtermijnMaanden ?? 1))
  return `Loopt tot ${datum(tot.toISOString())} · opzeggen vóór ${datum(opzeg.toISOString())}`
})
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && props.id && !voorstel.value) emit('sluit') }
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', opEscape))
</script>

<template>
  <Teleport to="body">
    <div v-if="id" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--breed" role="dialog" aria-modal="true" aria-labelledby="kf-titel" data-test="klant-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">Klant</span>
            <h2 id="kf-titel" class="fo-titel">{{ klant?.naam ?? 'Laden…' }}</h2>
            <p v-if="klant" class="fo-meta">{{ PAKKET_LABEL[klant.pakket as Pakket] }} · {{ klant.gebruikers.length }} gebruikers</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div v-if="klant" class="fo-body">
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Gebruik en gezondheid</h3>
              <span class="pil" :class="`pil--stand-${klant.gezondheid?.stand ?? 'leeg'}`">{{ STAND_LABEL[(klant.gezondheid?.stand ?? 'leeg') as Stand] }}</span></header>
            <ul v-if="klant.gezondheid?.redenen?.length" class="fo-tekst"><li v-for="r in klant.gezondheid.redenen" :key="r">{{ r }}</li></ul>
            <p v-else class="fo-tekst">Geen signalen.</p>
          </article>

          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Contract en abonnement</h3></header>
            <div class="veld"><span class="veld-label">Pakket</span>
              <div class="keuzegroep" role="group" aria-label="Pakket">
                <button v-for="p in PAKKETTEN" :key="p" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': klant.pakket === p }" :aria-pressed="klant.pakket === p" :data-test="`pakket-${p}`" @click="kiesPakket(p)">{{ PAKKET_LABEL[p] }}</button>
              </div>
            </div>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Status</span><select v-model="contract.status" class="invoer"><option value="proef">Proef</option><option value="actief">Actief</option><option value="opgezegd">Opgezegd</option></select></label>
              <label v-if="contract.status === 'proef'" class="veld"><span class="veld-label">Proef tot</span><input v-model="contract.proefTot" class="invoer" type="date"></label>
              <label class="veld"><span class="veld-label">Seats</span><input v-model.number="contract.seats" class="invoer" type="number" min="1"></label>
              <label class="veld"><span class="veld-label">Prijs per maand (€)</span><input v-model.number="contract.prijs" class="invoer" type="number" min="0"></label>
            </div>
            <p v-if="looptTot" class="veld-uitleg">{{ looptTot }}</p>
            <button type="button" class="dd-act mt-16" @click="bewaarContract">Contract opslaan</button>
          </article>

          <article class="fo-blok" data-test="klant-dealdrive">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Koppeling DealDrive</h3></header>
            <div class="keuzegroep" role="group" aria-label="DealDrive">
              <button v-for="[s, l] in [['uit', 'Uit'], ['mock', 'Mock'], ['http', 'Http']]" :key="s" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': klant.dealdrive === s }" :aria-pressed="klant.dealdrive === s" :disabled="s === 'http'" :data-test="`dealdrive-${s}`" @click="zetDealdrive(s)">{{ l }}</button>
            </div>
            <p class="veld-uitleg">Uit: overdragen geeft een overdrachtstaak met briefing. Mock: de fixtures uit seed/dealdrive-mock. Http komt in een volgende versie.</p>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Gebruikers en aanvragen</h3></header>
            <div class="veld"><span class="veld-label">Nieuwe gebruikers</span>
              <div class="keuzegroep" role="group" aria-label="Gebruikersstand">
                <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': klant.gebruikersStand === 'aanvragen' }" @click="zetStand('aanvragen')">Aanvragen via ons</button>
                <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': klant.gebruikersStand === 'zelf' }" @click="zetStand('zelf')">Zelf toevoegen binnen de seats</button>
              </div>
            </div>
            <ul class="schakel-lijst mt-16">
              <li v-for="a in klant.aanvragen.filter((x: any) => x.status === 'open')" :key="a.id" class="schakel-rij" data-test="aanvraag">
                <div><span class="schakel-naam">Aanvraag: {{ a.data.naam }}</span><span class="veld-uitleg">{{ a.data.email }} · {{ ROL_LABEL[a.data.rol as Rol] ?? a.data.rol }}</span></div>
                <div class="dd-acties"><button type="button" class="dd-act dd-act--primair" @click="aanvraag(a.id, 'goedkeuren')">Goedkeuren</button><button type="button" class="dd-act" @click="aanvraag(a.id, 'afwijzen')">Afwijzen</button></div>
              </li>
              <li v-for="g in klant.gebruikers" :key="g.id" class="schakel-rij">
                <div><span class="schakel-naam">{{ g.naam }}</span><span class="veld-uitleg">{{ ROL_LABEL[g.rol as Rol] }} · {{ NIVEAU_LABEL[g.niveau as Niveau] }} · {{ g.status === 'uitgenodigd' ? 'uitgenodigd' : `laatst ingelogd ${datum(g.laatsteInlog)}` }}</span></div>
              </li>
            </ul>
          </article>

          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Contact</h3></header>
            <p class="fo-tekst">{{ [klant.contact.naam, klant.contact.email, klant.contact.telefoon, klant.contact.adres].filter(Boolean).join(' · ') || 'Geen contactgegevens.' }}</p>
            <p class="fo-tekst">Toegang leverancier: {{ klant.toegangLeverancier === 'na_toestemming' ? 'alleen na toestemming' : 'altijd' }}</p>
          </article>

          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Functies per groep</h3></header>
            <div v-for="(lijst, groep) in klant.functies" :key="groep" class="mt-16">
              <span class="veld-label">{{ groep }}</span>
              <div class="keuzechips">
                <span v-for="f in lijst" :key="f.sleutel" class="pil" :class="f.stand === 'live' ? 'pil--groen' : 'pil--grijs'">{{ f.naam }} · {{ f.stand }}</span>
              </div>
            </div>
          </article>

          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Startset</h3></header>
            <ul class="fo-tekst"><li v-for="s in klant.startset" :key="s.sleutel">{{ s.naam }}: {{ s.op ? datum(s.op) : 'nog niet' }}</li></ul>
            <button type="button" class="dd-act mt-16" @click="startset">Startset aanvullen</button>
          </article>

          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Platformaudit</h3></header>
            <p v-if="!klant.audit.length" class="fo-tekst">Nog niets.</p>
            <ul v-else class="fo-tekst"><li v-for="a in klant.audit" :key="a.id">{{ datum(a.op) }} · {{ a.handeling }}<template v-if="a.reden"> · {{ a.reden }}</template></li></ul>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button v-if="klant" type="button" class="dd-act dd-act--primair" @click="emit('werkIn', { id: klant.id, naam: klant.naam })">Werk in deze organisatie</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="emit('sluit')">Sluiten</button>
        </footer>
      </aside>
    </div>
    <BevestigVenster
      :open="!!voorstel" :titel="voorstel ? `Pakket van ${klant?.naam} wijzigen naar ${PAKKET_LABEL[voorstel.naar]}?` : ''"
      :tekst="voorstelTekst" bevestig="Pakket wijzigen" @geannuleerd="voorstel = null" @bevestigd="bevestigPakket"
    />
  </Teleport>
</template>
