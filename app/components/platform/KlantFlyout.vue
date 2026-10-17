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

// P17 en P23: de DealDrive-koppeling inrichten (basis-URL, organisatie-id, geheim schrijf-alleen) en de stand.
const dd = reactive({ basisUrl: '', organisatieId: '', geheim: '' })
watch(klant, (k) => { if (k) Object.assign(dd, { basisUrl: k.dealdriveInrichting?.basisUrl ?? '', organisatieId: k.dealdriveInrichting?.organisatieId ?? '', geheim: '' }) })
async function zetDealdrive(stand: string) {
  try {
    await $fetch(String(`/api/platform/klanten/${props.id}/dealdrive`), { method: 'PUT', body: { stand, basisUrl: dd.basisUrl, organisatieId: dd.organisatieId, ...(dd.geheim ? { geheim: dd.geheim } : {}) } })
    toast.toon(stand === klant.value.dealdrive ? 'De DealDrive-koppeling is bewaard.' : `DealDrive staat op ${({ uit: 'uit', mock: 'mock', aan: 'aan' } as Record<string, string>)[stand]}.`)
    await laad()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
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
</script>

<template>
  <Teleport to="body">
    <FlyoutShell v-if="id" open titel-id="kf-titel" breedte="breed" data-test="klant-flyout" @sluit="emit('sluit')">
      <template #kop>
            <span class="fo-kicker">Klant</span>
            <h2 id="kf-titel" class="fo-titel">{{ klant?.naam ?? 'Laden…' }}</h2>
            <p v-if="klant" class="fo-meta">{{ PAKKET_LABEL[klant.pakket as Pakket] }} · {{ klant.gebruikers.length }} gebruikers</p></template>
        <div v-if="klant" class="fo-body">
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Gebruik en gezondheid</h3>
              <Label soort="gezondheid" :waarde="klant.gezondheid?.stand ?? 'leeg'" :tekst="STAND_LABEL[(klant.gezondheid?.stand ?? 'leeg') as Stand]" /></header>
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
            <p class="veld-uitleg alleen-groot-melding">Beter op een groot scherm.</p>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Basis-URL van DealDrive</span><input v-model="dd.basisUrl" class="invoer" type="url" placeholder="https://dealdrive.voorbeeld.test" data-test="dealdrive-url"></label>
              <label class="veld"><span class="veld-label">Organisatie-id in DealDrive</span><input v-model="dd.organisatieId" class="invoer" data-test="dealdrive-org"></label>
              <label class="veld"><span class="veld-label">Gedeeld geheim</span><input v-model="dd.geheim" class="invoer" type="password" autocomplete="off" :placeholder="klant.dealdriveInrichting?.geheimVingerafdruk ? `Bewaard (${klant.dealdriveInrichting.geheimVingerafdruk})` : 'Minstens 32 tekens'" data-test="dealdrive-geheim"></label>
            </div>
            <div class="keuzegroep mt-16" role="group" aria-label="DealDrive">
              <button v-for="[s, l] in [['uit', 'Uit'], ['mock', 'Mock'], ['aan', 'Aan']]" :key="s" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': klant.dealdrive === s }" :aria-pressed="klant.dealdrive === s" :data-test="`dealdrive-${s}`" @click="zetDealdrive(s)">{{ l }}</button>
            </div>
            <p class="veld-uitleg">Uit: overdragen geeft een overdrachtstaak met briefing. Mock: de vaste antwoorden uit seed/dealdrive-mock. Aan: de echte koppeling; zolang DealDrive de ontvangende kant niet heeft, blijft een klant op uit.</p>
            <ul v-if="klant.dealdriveInrichting?.runs?.length" class="dd-runs mt-8">
              <li v-for="r in klant.dealdriveInrichting.runs" :key="r.start" class="veld-uitleg">{{ new Date(r.start).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }} · {{ r.handeling }} · {{ r.ok ? 'gelukt' : r.fout }}</li>
            </ul>
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
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button v-if="klant" type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" @click="emit('werkIn', { id: klant.id, naam: klant.naam })"><Icoon naam="Check" :grootte="16" />Werk in deze organisatie</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
    <BevestigVenster
      :open="!!voorstel" :titel="voorstel ? `Pakket van ${klant?.naam} wijzigen naar ${PAKKET_LABEL[voorstel.naar]}?` : ''"
      :tekst="voorstelTekst" bevestig="Pakket wijzigen" @geannuleerd="voorstel = null" @bevestigd="bevestigPakket"
    />
  </Teleport>
</template>
