<script setup lang="ts">
// Nieuw accountplan in één scrollende flyout (opzet van DealDrive): bovenaan de prospect (vast als je vanaf de
// accountkaart komt), de contactpersonen met hun rol, titel, eigenaar en geldigheid; daaronder de zes stappen
// van de methode (1 informatie, 2 doelen SMART, 3 kansen en bedreigingen, 4 strategie, 5 actieplan, 6 evaluatie)
// en de extra velden. Elk blok heeft een voorzet van de Pitstop (AI met credits, altijd een voorstel). Alles
// behalve prospect en titel is optioneel. Plan aanmaken maakt het plan en zet elke actie meteen als taak op
// het account. Daarna opent het plan (in de flyout van het overzicht, of op zijn eigen pagina).
import { INHOUD_BLOKKEN, SECTIE_SLEUTELS, dagKort, sectieTitel, sectieUitleg, type AccountplanSectie } from '~~/shared/accountplannen'
import { nlMoment } from '~~/shared/datum'
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: []; aangemaakt: [id: string] }>()
const inst = getCurrentInstance()
const toast = useToast()
const { me } = useMe()

const gekozen = ref<{ id: string; naam: string } | null>(null)
const titel = ref('')
const van = ref('')
const tot = ref('')
const eigenaarId = ref('')
const contactIds = ref<string[]>([])
const secties = reactive<Record<AccountplanSectie, string>>(Object.fromEntries(SECTIE_SLEUTELS.map((s) => [s, ''])) as Record<AccountplanSectie, string>)
const velden = ref<Record<string, unknown>>({})
const acties = ref<{ titel: string; datum: string; contactId: string }[]>([])
const nieuweActie = reactive({ titel: '', datum: '', contactId: '' })
const opties = ref<any>({ eigenaren: [], velden: [], contacten: [], waarschuwing: null })
const bezig = ref(false)
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot de hoofdactie opslaat; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()

async function laadOpties() {
  try { opties.value = await $fetch('/api/accountplannen/opties', { query: gekozen.value ? { accountId: gekozen.value.id } : {} }) } catch (e) { toast.toon(foutTekst(e), 'fout') }
  opslag.basis()
}
watch(() => props.open, (o) => {
  if (!o) return
  const vandaag = nlMoment(new Date()).datum
  gekozen.value = props.account ?? null
  titel.value = `Accountplan ${vandaag.slice(0, 4)}`
  van.value = vandaag
  tot.value = `${vandaag.slice(0, 4)}-12-31`
  eigenaarId.value = me.value?.gebruiker.id ?? ''
  contactIds.value = []
  for (const s of SECTIE_SLEUTELS) secties[s] = ''
  velden.value = {}
  acties.value = []
  Object.assign(nieuweActie, { titel: '', datum: '', contactId: '' })
  laadOpties()
}, { immediate: true })
// Een andere prospect: andere contactpersonen, dus de keuzes die bij de vorige hoorden vervallen.
watch(gekozen, (n, o) => { if (props.open && n?.id !== o?.id) { contactIds.value = []; for (const a of acties.value) a.contactId = ''; nieuweActie.contactId = ''; laadOpties() } })
watch(() => opties.value.eigenaren, (lijst: any[]) => { if (lijst?.length && !lijst.some((e) => e.id === eigenaarId.value)) eigenaarId.value = lijst[0].id })

// Alleen prospects: een plan voor een klant hoort in DealDrive.
const zoek = (q: string) => zoekAccounts(q, 'prospect')
function kies(a: { id: string; naam: string }) { gekozen.value = { id: a.id, naam: a.naam } }
const contacten = computed<any[]>(() => opties.value.contacten ?? [])
const naamVan = (id: string) => contacten.value.find((c) => c.id === id)?.naam ?? ''
const concept = computed(() => ({ ...secties, geldigTot: tot.value || null }))

function voegActieToe() {
  if (nieuweActie.titel.trim().length < 3) return
  acties.value.push({ titel: nieuweActie.titel.trim(), datum: nieuweActie.datum, contactId: nieuweActie.contactId })
  Object.assign(nieuweActie, { titel: '', datum: '', contactId: '' })
}
function neemActiesOver(lijst: { titel: string; datum: string }[]) { for (const a of lijst) acties.value.push({ titel: a.titel, datum: a.datum, contactId: '' }) }

const kanMaken = computed(() => !!gekozen.value && titel.value.trim().length >= 3 && !bezig.value)
async function maak() {
  if (!kanMaken.value) return
  // Een getypte actie die nog niet is toegevoegd, gaat gewoon mee.
  if (nieuweActie.titel.trim().length >= 3) voegActieToe()
  bezig.value = true
  try {
    const p = await opslag.bewaar(() => $fetch<any>('/api/accountplannen', {
      method: 'POST',
      body: {
        accountId: gekozen.value!.id, titel: titel.value, eigenaarId: eigenaarId.value || null, geldigVan: van.value || null, geldigTot: tot.value || null,
        contactIds: contactIds.value, secties: { ...secties }, ...(opties.value.velden.length ? { velden: velden.value } : {}),
        acties: acties.value.map((a) => ({ titel: a.titel, datum: a.datum || null, contactId: a.contactId || null })),
      },
    }))
    toast.toon(acties.value.length ? `Accountplan aangemaakt. ${acties.value.length === 1 ? 'De actie staat' : `De ${acties.value.length} acties staan`} als taak op het account.` : 'Accountplan aangemaakt.')
    if (inst?.vnode.props?.onAangemaakt) emit('aangemaakt', p.id)
    else { emit('sluit'); await navigateTo(`/accountplannen/${p.id}`) }
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
opslag.volg(() => [gekozen.value?.id ?? null, titel.value, van.value, tot.value, eigenaarId.value, contactIds.value, { ...secties }, velden.value, acties.value])
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="apn-titel" breedte="breed" data-test="ap-nieuw-flyout" :opslag="opslag" @sluit="emit('sluit')" @bewaar="maak">
    <template #kop>
      <span class="fo-kicker"><Icoon naam="ClipboardCheck" :grootte="12" /> Accountplan</span>
      <h2 id="apn-titel" class="fo-titel">Nieuw accountplan</h2>
      <p class="fo-meta">Eén plan per topprospect en per periode. Alleen de prospect en de titel zijn verplicht; de rest vul je nu of later in.</p>
    </template>
    <form id="apn-form" class="fs-form" @submit.prevent="maak">
      <div class="fo-body">
        <article class="fo-blok fo-blok--accent">
          <span class="fo-blok-kicker">Kerngegevens</span>
          <div class="veld">
            <span class="veld-label">Prospect</span>
            <div v-if="gekozen" class="apn-gekozen" data-test="apn-gekozen">
              <span>{{ gekozen.naam }}</span>
              <button v-if="!account" type="button" class="dd-act dd-act--icoon" aria-label="Andere prospect kiezen" @click="gekozen = null"><Icoon naam="X" :grootte="14" /></button>
            </div>
            <ZoekKiezer v-else :zoek="zoek" placeholder="Zoek een prospect op naam" label="Zoek een prospect" data-test="apn-zoek" :optie-test="(t) => `apn-kies-${t.id}`" :sub="accountSub" leeg="Geen prospect gevonden." @kies="kies" />
          </div>
          <p v-if="opties.waarschuwing" class="apn-waarschuwing" role="status" data-test="apn-waarschuwing">{{ opties.waarschuwing }}</p>
          <label class="veld mt-16"><span class="veld-label">Titel</span><input v-model="titel" class="invoer" maxlength="160" required data-test="apn-titel"><span class="veld-uitleg">Zet de periode in de titel, dan zie je in elke lijst voor welk jaar het plan geldt.</span></label>
          <label v-if="opties.eigenaren.length > 1" class="veld mt-16"><span class="veld-label">Eigenaar</span>
            <select v-model="eigenaarId" class="invoer" data-test="apn-eigenaar"><option v-for="e in opties.eigenaren" :key="e.id" :value="e.id">{{ e.naam }}</option></select>
            <span class="veld-uitleg">De eigenaar stuurt het plan en krijgt de acties als taak.</span>
          </label>
          <div class="apn-rij mt-16">
            <label class="veld"><span class="veld-label">Geldig van</span><input v-model="van" type="date" class="invoer tnum" data-test="apn-van"></label>
            <label class="veld"><span class="veld-label">Geldig tot</span><input v-model="tot" type="date" class="invoer tnum" data-test="apn-tot"></label>
          </div>
          <p class="meta mt-8">Na de einddatum staat het plan bij Verlopen. Dat is het sein om te evalueren en een nieuwe periode te openen.</p>
        </article>

        <article class="fo-blok" data-test="apn-blok-contacten">
          <span class="fo-blok-kicker">Contactpersonen <span class="apn-optioneel">optioneel</span></span>
          <AccountplanContacten v-if="gekozen" v-model="contactIds" :contacten="contacten" bewerk prefix="apn" leeg-tekst="Wie beslist er mee, en wie heeft invloed op de beslissing? Kies ze hieronder." />
          <p v-else class="apn-uitleg">Kies eerst een prospect; daarna kies je hier uit de contactpersonen van dat account.</p>
        </article>

        <article v-if="opties.velden.length" class="fo-blok" data-test="apn-blok-velden">
          <span class="fo-blok-kicker">Extra velden</span>
          <AccountplanVelden v-model="velden" :velden="opties.velden" bewerk prefix="apn" />
        </article>

        <article v-for="blok in INHOUD_BLOKKEN" :key="blok.nr" class="fo-blok" :data-test="`apn-stap-${blok.nr}`">
          <div class="fo-blok-kop"><span class="fo-blok-kicker"><span class="apn-nr tnum">{{ blok.nr }}</span>{{ blok.titel }}</span></div>
          <p class="apn-uitleg">{{ blok.toelichting }}</p>
          <template v-if="blok.velden.length">
            <div v-for="v in blok.velden" :key="v" class="veld mt-8">
              <label :for="`apn-veld-${v}`" class="veld-label" :class="{ 'sr-only': blok.velden.length === 1 }">{{ sectieTitel(v) }}</label>
              <textarea :id="`apn-veld-${v}`" v-model="secties[v]" class="invoer apn-tekstvak" rows="4" :placeholder="sectieUitleg(v)" :data-test="`apn-veld-${v}`" />
              <AccountplanVoorzet :doel="v" :account-id="gekozen?.id ?? null" :concept="concept" :heeft-tekst="!!secties[v].trim()" @tekst="(t) => (secties[v] = t)" />
            </div>
          </template>
          <template v-else>
            <ul v-if="acties.length" class="apn-acties" role="list" data-test="apn-acties">
              <li v-for="(a, i) in acties" :key="i" class="apn-actie">
                <span class="apn-actie-tekst"><span class="apn-actie-titel">{{ a.titel }}</span><span class="meta tnum">{{ a.datum ? dagKort(a.datum) : 'eerstvolgend werkuur' }}<template v-if="a.contactId"> · {{ naamVan(a.contactId) }}</template></span></span>
                <button type="button" class="dd-act dd-act--icoon apn-weg" :aria-label="`Verwijder actie ${a.titel}`" @click="acties.splice(i, 1)"><Icoon naam="Trash2" :grootte="14" /></button>
              </li>
            </ul>
            <div class="apn-nieuw">
              <label class="veld apn-nieuw-titel"><span class="veld-label">Nieuwe actie</span><input v-model="nieuweActie.titel" class="invoer" maxlength="200" placeholder="Begin met een werkwoord, bijvoorbeeld Plan het jaargesprek" data-test="apn-actie-titel" @keydown.enter.prevent="voegActieToe"></label>
              <label class="veld"><span class="veld-label">Datum</span><input v-model="nieuweActie.datum" type="date" class="invoer tnum" data-test="apn-actie-datum"></label>
              <label class="veld"><span class="veld-label">Contactpersoon</span>
                <select v-model="nieuweActie.contactId" class="invoer" data-test="apn-actie-contact"><option value="">Geen</option><option v-for="c in contacten.filter((x) => !x.vertrokken)" :key="c.id" :value="c.id">{{ c.naam }}{{ c.functie ? ` · ${c.functie}` : '' }}</option></select>
              </label>
              <button type="button" class="dd-act apn-nieuw-knop" :disabled="nieuweActie.titel.trim().length < 3" data-test="apn-actie-toevoegen" @click="voegActieToe"><Icoon naam="Plus" :grootte="14" />Toevoegen</button>
            </div>
            <AccountplanVoorzet doel="actieplan" :account-id="gekozen?.id ?? null" :concept="concept" @acties="neemActiesOver" />
          </template>
        </article>
      </div>
    </form>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="submit" form="apn-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!kanMaken" data-test="apn-maak"><Icoon naam="Check" :grootte="16" />{{ bezig ? 'Aanmaken...' : 'Plan aanmaken' }}</button>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.apn-gekozen { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 0 0 12px; background: var(--wit); border: 1px solid var(--border-strong); font-weight: 600; }
.apn-rij { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.apn-waarschuwing { margin: 10px 0 0; padding: 10px 12px; background: var(--wit); border-left: 3px solid var(--orange, var(--yellow)); font-size: 13px; line-height: 1.5; }
.apn-optioneel { margin-left: 6px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--muted); }
.apn-uitleg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.apn-nr { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; margin-right: 8px; background: var(--ink); color: var(--yellow); font-size: 11px; letter-spacing: 0; }
.apn-tekstvak { width: 100%; min-height: 96px; resize: vertical; }
.apn-acties { list-style: none; margin: 8px 0 0; padding: 0; }
.apn-actie { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.apn-actie-tekst { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.apn-actie-titel { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.apn-nieuw { display: grid; grid-template-columns: 160px minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 10px; }
.apn-nieuw-titel { grid-column: 1 / -1; }
.apn-nieuw-knop { min-height: 40px; display: inline-flex; align-items: center; gap: 4px; }
@media (max-width: 719px) {
  .apn-rij, .apn-nieuw { grid-template-columns: 1fr; }
  .apn-weg, .apn-nieuw-knop { min-width: var(--touch-target-min); min-height: var(--touch-target-min); }
}
</style>
