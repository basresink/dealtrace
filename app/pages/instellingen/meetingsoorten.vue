<script setup lang="ts">
// Meetingsoorten en uitkomsten (F22, beheerder): naam, type, categorie, duur, vorm, doel, agendapunten met
// verplicht, voorbereiding en uitkomsten met gevolg. Seed en editor gebruiken dezelfde bron (gat 16). De
// categorie is de groep in Type afspraak: Afspraak (bezoek op locatie, vorm bezoek) of Meeting (op
// afstand, online of telefonisch). De lijst staat in die twee groepen.
import { CATEGORIE_LABEL, CATEGORIE_UITLEG, VORMEN_PER_CATEGORIE, categorieVan, type Categorie } from '~~/shared/agenda'
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.meetingsoorten')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/meetingsoorten', { default: () => ({ soorten: [], kan: {} }) })
const GEVOLG: Record<string, string> = { gehouden: 'Eerste afspraak gehouden, vraag "Overdragen?"', later: 'Wachtend tot datum, met terugkomtaak', contactpersoon: 'Nieuw contact en een nieuwe poging', nee: 'Nee met reden en terugkomregel', afspraak: 'Eerste afspraak plannen', geen: 'Geen gevolg' }
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const bewerk = ref<any>(null)
const groepen = computed(() => (['bezoek', 'meeting'] as Categorie[]).map((c) => ({ categorie: c, label: CATEGORIE_LABEL[c], uitleg: CATEGORIE_UITLEG[c], soorten: data.value.soorten.filter((s: any) => categorieVan(s) === c) })))
function open(s: any) { bewerk.value = { ...JSON.parse(JSON.stringify(s)), categorie: categorieVan(s) } }
// Een andere categorie zet de vorm die erbij past: een bezoek op locatie, een meeting online of telefonisch.
function zetCategorie(c: Categorie) { bewerk.value.categorie = c; if (!VORMEN_PER_CATEGORIE[c].includes(bewerk.value.vorm)) bewerk.value.vorm = VORMEN_PER_CATEGORIE[c][0] }
function nieuw() { bewerk.value = { naam: '', type: 'klant', categorie: 'meeting', duurMin: 30, vorm: 'online', actief: true, data: { doel: '', agenda: [{ punt: 'Aanleiding', verplicht: true }], voorbereiding: [], uitkomsten: [{ code: 'vervolg', label: 'Vervolg afgesproken', gevolg: { type: 'gehouden', overdragen: true } }], eersteAfspraak: false, herinneringMin: 15, kleur: 'grijs' } } }
const slugVan = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
async function bewaar() {
  try {
    const b = bewerk.value
    b.data.uitkomsten = b.data.uitkomsten.filter((u: any) => u.label.trim()).map((u: any) => ({ ...u, code: u.code || slugVan(u.label) }))
    b.data.agenda = b.data.agenda.filter((p: any) => p.punt.trim())
    await $fetch('/api/meetingsoorten', { method: 'PUT', body: b })
    toast.toon('Meetingsoort bewaard.'); bewerk.value = null; await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Meetingsoorten · Dealtrace' })
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot de hoofdactie opslaat; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [bewerk.value])
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.meetingsoorten" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Verkoop" titel="Meetingsoorten en uitkomsten" uitleg="Elke afspraak heeft een soort. De uitkomst na afloop zet de reis, de status en de volgende stap." helpartikel="meetingsoorten-en-uitkomsten-inrichten">
        <template #acties><button type="button" class="dd-actie dd-actie--primair" data-test="ms-nieuw" @click="nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Meetingsoort</button></template>
      </PaginaKop>
      <section class="section">
        <div class="container">
          <div data-test="ms-lijst">
            <section v-for="g in groepen" :key="g.categorie" class="ms-groep" :data-test="`ms-groep-${g.categorie}`">
              <h2 class="ms-groep-kop">{{ g.label }} <span class="meta">{{ g.uitleg }}</span></h2>
              <div class="lijst">
                <div v-for="s in g.soorten" :key="s.id" class="rij rij--compact" :class="{ 'rij--uit': !s.actief }">
                  <div class="rij-info">
                    <h3 class="rij-titel">{{ s.naam }} <span class="pil pil--leeg">{{ s.type === 'intern' ? 'intern' : 'prospect' }}</span><span v-if="s.data.eersteAfspraak" class="pil pil--leeg">eerste afspraak</span><span v-if="!s.actief" class="pil">uit</span></h3>
                    <div class="rij-sub">{{ s.duurMin }} min · {{ VORM[s.vorm] }} · {{ s.data.agenda.length }} agendapunten · {{ s.data.uitkomsten.length ? s.data.uitkomsten.map((u: any) => u.label).join(', ') : 'geen gespreksuitkomst' }}</div>
                  </div>
                  <button type="button" class="dd-act" :data-test="`ms-bewerk-${s.slug}`" @click="open(s)">Bewerk</button>
                </div>
                <p v-if="!g.soorten.length" class="meta">Nog geen soorten in deze groep.</p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </template>
    <FlyoutShell v-if="bewerk" open titel-id="ms-titel" data-test="ms-flyout" :opslag="opslag" @sluit="bewerk = null" @bewaar="bewaar">
        <template #kop><span class="fo-kicker">Meetingsoort</span><h2 id="ms-titel" class="fo-titel">{{ bewerk.naam || 'Nieuwe meetingsoort' }}</h2></template>
        <form id="ms-form" class="fs-form" @submit.prevent="bewaar">
          <div class="fo-body fo-body--formulier">
            <article class="fo-blok">
              <div class="formulier-raster">
                <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="bewerk.naam" class="invoer" required minlength="2" data-test="ms-naam"></label>
                <label class="veld"><span class="veld-label">Type</span><select v-model="bewerk.type" class="invoer"><option value="klant">Prospect</option><option value="intern">Intern (telt nooit als contactmoment)</option></select></label>
                <label class="veld"><span class="veld-label">Duur (minuten)</span><input v-model.number="bewerk.duurMin" type="number" min="5" max="480" step="5" class="invoer"></label>
                <label class="veld"><span class="veld-label">Categorie</span><select :value="bewerk.categorie" class="invoer" data-test="ms-categorie" @change="zetCategorie(($event.target as HTMLSelectElement).value as Categorie)"><option value="bezoek">Afspraak (bezoek op locatie)</option><option value="meeting">Meeting (online of telefonisch)</option></select></label>
                <label class="veld"><span class="veld-label">Vorm</span><select v-model="bewerk.vorm" class="invoer" data-test="ms-vorm" :disabled="bewerk.categorie === 'bezoek'"><option v-for="k in VORMEN_PER_CATEGORIE[bewerk.categorie as Categorie]" :key="k" :value="k">{{ VORM[k] }}</option></select></label>
                <label class="veld"><span class="veld-label">Standaardherinnering (minuten)</span><input v-model.number="bewerk.data.herinneringMin" type="number" min="0" class="invoer"></label>
                <label class="veld"><span class="veld-label">Standaardlocatie</span><select v-model="bewerk.data.standaardLocatie" class="invoer"><option :value="null">Geen</option><option value="account">Adres van het account</option><option value="online">Meetinglink</option></select></label>
              </div>
              <label class="veld mt-16"><span class="veld-label">Doel</span><input v-model="bewerk.data.doel" class="invoer"></label>
              <p class="schakel-rij mt-16"><span>Telt als eerste afspraak</span><Schakelaar :aan="!!bewerk.data.eersteAfspraak" label="Telt als eerste afspraak" @wissel="bewerk.data.eersteAfspraak = $event" /></p>
              <p class="schakel-rij"><span>Actief</span><Schakelaar :aan="bewerk.actief !== false" label="Actief" @wissel="bewerk.actief = $event" /></p>
            </article>
            <article class="fo-blok">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Agendapunten</h3></header>
              <div v-for="(p, i) in bewerk.data.agenda" :key="i" class="schakel-rij"><input v-model="p.punt" class="invoer" :aria-label="`Agendapunt ${Number(i) + 1}`"><Schakelaar :aan="p.verplicht" :label="p.verplicht ? 'verplicht' : 'niet verplicht'" @wissel="p.verplicht = $event" /><button type="button" class="dd-act dd-act--icoon" aria-label="Verwijder" @click="bewerk.data.agenda.splice(i, 1)"><Icoon naam="Trash2" /></button></div>
              <button type="button" class="dd-act mt-8" @click="bewerk.data.agenda.push({ punt: '', verplicht: false })">Agendapunt toevoegen</button>
            </article>
            <article class="fo-blok">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Uitkomsten met gevolg</h3></header>
              <p v-if="bewerk.type === 'intern'" class="meta">Intern overleg heeft geen gespreksuitkomst.</p>
              <template v-else>
                <div v-for="(u, i) in bewerk.data.uitkomsten" :key="i" class="formulier-raster mt-8">
                  <label class="veld"><span class="veld-label">Label</span><input v-model="u.label" class="invoer"></label>
                  <label class="veld"><span class="veld-label">Gevolg</span><select v-model="u.gevolg.type" class="invoer"><option v-for="(l, k) in GEVOLG" :key="k" :value="k">{{ l }}</option></select></label>
                  <label v-if="u.gevolg.type === 'later'" class="veld"><span class="veld-label">Termijn (dagen)</span><input v-model.number="u.gevolg.termijnDagen" type="number" min="1" class="invoer"></label>
                  <button type="button" class="dd-act dd-act--icoon" aria-label="Verwijder" @click="bewerk.data.uitkomsten.splice(i, 1)"><Icoon naam="Trash2" /></button>
                </div>
                <button type="button" class="dd-act mt-8" @click="bewerk.data.uitkomsten.push({ code: '', label: '', gevolg: { type: 'later', termijnDagen: 30 } })">Uitkomst toevoegen</button>
              </template>
            </article>
          </div>
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
          <button type="submit" form="ms-form" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="ms-bewaar"><Icoon naam="Check" :grootte="16" />Bewaar</button>
          <span class="fo-foot-vul" />
        </footer>
        </template>
      </FlyoutShell>
  </div>
</template>

<style scoped>
.ms-groep + .ms-groep { margin-top: 28px; }
.ms-groep-kop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0 0 10px; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink); }
.ms-groep-kop .meta { font-weight: 400; letter-spacing: 0; text-transform: none; }
</style>
