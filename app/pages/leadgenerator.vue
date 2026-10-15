<script setup lang="ts">
// Leadgenerator · tabblad Importeren (F02). De wizard in vier stappen: bestand,
// kolommen koppelen, controle en ontdubbelen, bevestigen. Plus de importbatches.
// Zoeken, koppelingen en rondes bouwt P11.
import { IMPORT_DOELEN } from '~~/shared/leadGenerator'
const { me, functie } = useMe()
const toast = useToast()
const kanImport = computed(() => functie('import.uitvoeren')?.beschikbaar)
const nietAan = computed(() => !kanImport.value && functie('import.uitvoeren')?.reden === 'niveau')
const kanTeam = computed(() => functie('import.teamVerdelen')?.beschikbaar)
const { data: batches, refresh } = kanImport.value ? await useFetch<any[]>('/api/import', { default: () => [] }) : { data: ref<any[]>([]), refresh: async () => {} }

const stap = ref(1)
const bestand = ref<File | null>(null)
const soort = ref<'bedrijven' | 'bedrijven_contacten'>('bedrijven_contacten')
const label = ref('')
const bezig = ref(false)
const vb = ref<any>(null)
const koppeling = ref<string[]>([])
const controle = ref<any>(null)
const keuzes = reactive<Record<string, string>>({})
const eigenaar = ref<'vast' | 'team'>('vast')
const klaar = ref<any>(null)
const terug = ref<any>(null)

function kies(e: Event) { bestand.value = (e.target as HTMLInputElement).files?.[0] ?? null }
function sleep(e: DragEvent) { e.preventDefault(); bestand.value = e.dataTransfer?.files?.[0] ?? null }
async function stap1() {
  if (!bestand.value) return
  if (bestand.value.size > 10 * 1024 * 1024) { toast.toon('Het bestand is groter dan 10 MB. Splits het in kleinere delen.', 'fout'); return }
  bezig.value = true
  try {
    const fd = new FormData(); fd.append('bestand', bestand.value); fd.append('soort', soort.value); fd.append('label', label.value)
    vb.value = await $fetch('/api/import/voorbeeld', { method: 'POST', body: fd })
    koppeling.value = [...vb.value.koppeling]
    stap.value = 2
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const doelen = computed(() => [
  ...Object.entries(IMPORT_DOELEN).filter(([k]) => soort.value === 'bedrijven_contacten' || !k.startsWith('contact')).map(([k, v]) => ({ k, v })),
  ...(vb.value?.eigenVelden ?? []).map((v: any) => ({ k: `cf:${v.sleutel}`, v: `Eigen veld: ${v.naam}` })),
])
async function stap2() {
  bezig.value = true
  try {
    controle.value = await $fetch('/api/import/controle', { method: 'POST', body: { batchId: vb.value.batchId, koppeling: koppeling.value } })
    for (const k of Object.keys(keuzes)) delete keuzes[k]
    for (const r of controle.value.regels) keuzes[r.rij] = r.keuze === 'samenvoegen' && r.match ? `samenvoegen:${r.match.id}` : r.keuze
    stap.value = 3
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const openKeuzes = computed(() => Object.values(keuzes).filter((k) => k === 'kiezen').length)
async function verwerk() {
  bezig.value = true
  try {
    klaar.value = await $fetch('/api/import/verwerk', { method: 'POST', body: { batchId: vb.value.batchId, keuzes, eigenaar: { soort: eigenaar.value } } })
    stap.value = 5
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
function opnieuw() { stap.value = 1; bestand.value = null; label.value = ''; vb.value = null; controle.value = null; klaar.value = null }
async function vraagTerug(b: any) { try { terug.value = { ...b, ...(await $fetch<any>(`/api/import/${b.id}/terugdraaien?proef=1`, { method: 'POST' })) } } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function draaiTerug() {
  const b = terug.value; terug.value = null
  try { const r = await $fetch<any>(`/api/import/${b.id}/terugdraaien`, { method: 'POST' }); toast.toon(`${r.verwijderd} accounts verwijderd; ${r.bleven} bleven staan.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const CAT: Record<string, string> = { alInBestand: 'Al in je bestand', mogelijk: 'Mogelijk dubbel', dubbelInBestand: 'Dubbel in het bestand', fouten: 'Met fouten', dealdriveKlant: 'Al klant in DealDrive', dealdriveProspect: 'Al prospect in DealDrive' }
const STATUS: Record<string, string> = { concept: 'Concept', verwerkt: 'Verwerkt', teruggedraaid: 'Teruggedraaid' }
const datum = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t))
useHead({ title: 'Leadgenerator · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="nietAan" sleutel="import.uitvoeren" />
    <template v-else-if="kanImport">
      <PaginaKop kicker="Leadgenerator" titel="Leadgenerator" uitleg="Bedrijven die passen bij je doelgroep, met bewijs, bron en datum." helpartikel="importeren" />
      <section class="section">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <nav class="tabbalk" aria-label="Leadgenerator"><button type="button" class="tab tab--actief" aria-current="page">Importeren</button></nav>
          <ol class="stappen mt-16" aria-label="Stappen">
            <li v-for="(s, i) in ['Bestand', 'Kolommen koppelen', 'Controle en ontdubbelen', 'Bevestigen']" :key="s" :class="{ 'stap--actief': stap === i + 1, 'stap--klaar': stap > i + 1 }"><span class="stap-nr">{{ i + 1 }}</span>{{ s }}</li>
          </ol>

          <form v-if="stap === 1" class="kaart mt-16" data-test="stap-bestand" @submit.prevent="stap1">
            <label class="sleepvak" @dragover.prevent @drop="sleep">
              <input type="file" accept=".xlsx,.csv" class="sr-only" data-test="bestand" @change="kies">
              <Icoon naam="Download" :grootte="24" />
              <span>{{ bestand ? bestand.name : 'Sleep een Excel- of CSV-bestand hierheen, of klik om te kiezen' }}</span>
              <span class="veld-uitleg">Hooguit 10.000 rijen en 10 MB.</span>
            </label>
            <div class="formulier-raster mt-16">
              <div class="veld"><span class="veld-label">Wat staat erin</span>
                <div class="keuzegroep" role="group"><button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': soort === 'bedrijven' }" @click="soort = 'bedrijven'">Bedrijven</button><button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': soort === 'bedrijven_contacten' }" @click="soort = 'bedrijven_contacten'">Bedrijven met contactpersonen</button></div>
              </div>
              <label class="veld"><span class="veld-label">Bron en label <span class="veld-verplicht">*</span></span><input v-model="label" class="invoer" required placeholder="Bijvoorbeeld Beurs Vakdagen 2026" data-test="label"></label>
            </div>
            <div class="dd-acties mt-16"><a class="dd-act" href="/voorbeeld-import.csv" download><Icoon naam="Download" class="dd-act-icoon" />Voorbeeldbestand</a><span class="dd-acties-vul" /><button type="submit" class="dd-act dd-act--primair" :disabled="!bestand || !label.trim() || bezig" data-test="volgende-1">Volgende</button></div>
          </form>

          <div v-else-if="stap === 2" class="kaart mt-16" data-test="stap-koppelen">
            <p class="kaart-meta">{{ vb.aantalRijen }} rijen in {{ bestand?.name }}. Koppel elke kolom aan een veld; een kolom zonder veld wordt niet geïmporteerd.</p>
            <div class="tabel-wrap mt-16">
              <table class="tabel">
                <thead><tr><th>Kolom in je bestand</th><th>Veld in Dealtrace</th><th>Voorbeeld</th></tr></thead>
                <tbody><tr v-for="(k, i) in (vb.kolommen as string[])" :key="i">
                  <td><strong>{{ k }}</strong></td>
                  <td><select v-model="koppeling[i]" class="invoer invoer--klein" :aria-label="`Veld voor ${k}`" :data-kolom="k"><option value="">Niet importeren</option><option v-for="d in doelen" :key="d.k" :value="d.k">{{ d.v }}</option></select></td>
                  <td class="meta">{{ vb.voorbeeld.slice(0, 3).map((r: string[]) => r[i]).filter(Boolean).join(' · ') }}</td>
                </tr></tbody>
              </table>
            </div>
            <p v-if="!koppeling.includes('naam')" class="veld-fout mt-16" role="alert">Koppel een kolom aan Bedrijfsnaam om verder te gaan.</p>
            <div class="dd-acties mt-16"><button type="button" class="dd-act" @click="stap = 1">Terug</button><span class="dd-acties-vul" /><button type="button" class="dd-act dd-act--primair" :disabled="!koppeling.includes('naam') || bezig" data-test="volgende-2" @click="stap2">Volgende</button></div>
          </div>

          <div v-else-if="stap === 3" class="kaart mt-16" data-test="stap-controle">
            <p class="rapport" data-test="rapport"><strong>{{ controle.nieuw }} nieuw</strong> · {{ controle.alInBestand }} al in je bestand<template v-if="controle.mogelijk"> · {{ controle.mogelijk }} mogelijk dubbel</template> · {{ controle.dubbelInBestand }} dubbel in het bestand · {{ controle.fouten }} met fouten<template v-if="controle.dealdriveKlant || controle.dealdriveProspect"> · {{ controle.dealdriveKlant }} al klant en {{ controle.dealdriveProspect }} al prospect in DealDrive</template></p>
            <p v-if="controle.dealdriveMelding" class="veld-uitleg">{{ controle.dealdriveMelding }}</p>
            <div v-if="controle.regels.length" class="tabel-wrap mt-16">
              <table class="tabel tabel--kaarten" data-test="regels">
                <thead><tr><th>Rij</th><th>Bedrijf</th><th>Wat</th><th>Keuze</th></tr></thead>
                <tbody><tr v-for="r in controle.regels.slice(0, 300)" :key="r.rij" :data-rij="r.rij">
                  <td class="tnum">{{ r.rij }}</td>
                  <td>{{ r.naam }}<template v-if="r.match"><br><span class="meta">lijkt op {{ r.match.naam }}</span></template><template v-if="r.dealdrive"><br><span class="meta">{{ r.dealdrive.eigenaar }}</span></template></td>
                  <td>{{ CAT[r.categorie] }}<ul v-if="r.fouten.length" class="veld-uitleg"><li v-for="f in r.fouten" :key="f.reden">{{ f.reden }}</li></ul></td>
                  <td><select v-model="keuzes[r.rij]" class="invoer invoer--klein" :aria-label="`Keuze voor rij ${r.rij}`">
                    <option v-if="keuzes[r.rij] === 'kiezen'" value="kiezen" disabled>Kies…</option>
                    <option value="nieuw">Importeer als nieuw</option>
                    <option v-if="r.match" :value="`samenvoegen:${r.match.id}`">Voeg samen met {{ r.match.naam }}</option>
                    <option value="overslaan">Sla over</option>
                  </select></td>
                </tr></tbody>
              </table>
              <p v-if="controle.regels.length > 300" class="meta mt-8">De eerste 300 regels staan hier; de rest houdt de standaardkeuze.</p>
            </div>
            <div class="dd-acties mt-16"><button type="button" class="dd-act" @click="stap = 2">Terug</button><a v-if="controle.fouten" class="dd-act" :href="`/api/import/${vb.batchId}/fouten.csv`">Download foutenlijst</a><span class="dd-acties-vul" /><button type="button" class="dd-act dd-act--primair" :disabled="openKeuzes > 0" data-test="volgende-3" @click="stap = 4">{{ openKeuzes ? `Nog ${openKeuzes} keuzes` : 'Volgende' }}</button></div>
          </div>

          <div v-else-if="stap === 4" class="kaart mt-16" data-test="stap-bevestigen">
            <div class="veld"><span class="veld-label">Eigenaar van de nieuwe accounts</span>
              <div class="keuzegroep" role="group"><button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': eigenaar === 'vast' }" @click="eigenaar = 'vast'">Vast: ik</button><button v-if="kanTeam" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': eigenaar === 'team' }" data-test="eigenaar-team" @click="eigenaar = 'team'">Gelijk verdelen over het team</button></div>
            </div>
            <p class="kaart-meta mt-16">Verrijken via KvK en Datacollectief, doelgroep en campagne komen in een volgende versie.</p>
            <div class="dd-acties mt-16"><button type="button" class="dd-act" @click="stap = 3">Terug</button><span class="dd-acties-vul" /><button type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="importeren" @click="verwerk">{{ bezig ? 'Bezig met importeren…' : 'Importeren' }}</button></div>
            <div v-if="bezig" class="voortgang mt-16" role="progressbar" aria-label="Importeren"><span /></div>
          </div>

          <div v-else-if="stap === 5" class="kaart mt-16" data-test="samenvatting">
            <h2 class="kaart-titel">Import klaar</h2>
            <p class="kaart-meta">{{ klaar.nieuw }} nieuw · {{ klaar.samengevoegd }} samengevoegd · {{ klaar.overgeslagen }} overgeslagen · {{ klaar.contacten }} contactpersonen<template v-if="klaar.verhuisd"> · {{ klaar.verhuisd }} verhuisd</template></p>
            <div class="dd-acties mt-16"><NuxtLink class="dd-act dd-act--primair" to="/prospects/alle">Naar je prospects</NuxtLink><button type="button" class="dd-act" @click="opnieuw">Nog een bestand</button></div>
          </div>
        </div>
      </section>
      <section class="section section--laatste">
        <div class="container">
          <span class="kicker kicker--streep">Importbatches</span>
          <LegeStaat v-if="!batches.filter((b) => b.status !== 'concept').length" titel="Nog geen imports." tekst="Start met een bestand uit Excel of CSV." />
          <div v-else class="tabel-wrap mt-16">
            <table class="tabel tabel--kaarten" data-test="batches">
              <thead><tr><th>Datum</th><th>Bestand en label</th><th>Door</th><th>Aantallen</th><th>Status</th><th><span class="sr-only">Acties</span></th></tr></thead>
              <tbody><tr v-for="b in batches.filter((x) => x.status !== 'concept')" :key="b.id" :data-batch="b.id">
                <td class="tnum">{{ datum(b.op) }}</td>
                <td><strong>{{ b.label }}</strong><br><span class="meta">{{ b.bestandsnaam }}</span></td>
                <td>{{ b.door.replace(/^Testgebruiker /, '') }}</td>
                <td class="meta">{{ b.aantallen.nieuw }} nieuw · {{ b.aantallen.samengevoegd }} samengevoegd · {{ b.aantallen.overgeslagen }} overgeslagen · {{ b.aantallen.fouten }} fouten</td>
                <td>{{ STATUS[b.status] }}</td>
                <td><button v-if="b.magTerugdraaien" type="button" class="dd-act" data-test="terugdraaien" @click="vraagTerug(b)">Draai import terug</button></td>
              </tr></tbody>
            </table>
          </div>
        </div>
      </section>
    </template>
    <section v-else class="section"><div class="container"><h1 class="title title--groot">Geen toegang</h1></div></section>
    <BevestigVenster :open="!!terug" :titel="`Import ${terug?.label} terugdraaien?`" :tekst="terug ? `${terug.verwijderd} accounts zonder activiteit worden verwijderd; ${terug.bleven} accounts met activiteit blijven staan.` : ''" bevestig="Terugdraaien" @geannuleerd="terug = null" @bevestigd="draaiTerug" />
  </div>
</template>
