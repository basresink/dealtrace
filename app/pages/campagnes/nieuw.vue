<script setup lang="ts">
// Nieuwe campagne (F12): wizard in vijf stappen. Doelgroep, soort, winpunt, boodschap en script, doel
// en planning. De server rekent mee (overgeslagen met reden, dekking, branche, capaciteit). Opslaan als
// concept kan altijd; activeren boven capaciteit vraagt bevestiging van de salesmanager.
const { functie } = useMe()
const aan = !!functie('campagnes.maken')?.beschikbaar
const toast = useToast()
const router = useRouter()
const { data: ctx } = await useFetch<any>('/api/campagnes/context', { immediate: aan, default: () => ({ soorten: [], doelgroepen: [], fases: [], importbatches: [], leadrondes: [], branches: [], belscripts: [], verkopers: [], kan: {} }) })
const STAPPEN = ['Doelgroep', 'Soort', 'Winpunt', 'Boodschap en script', 'Doel en planning']
const stap = ref(0)
const vrij = ref<{ id: string; naam: string }[]>([])
const f = reactive<any>({ naam: '', bron: { soort: 'doelgroep', id: '' }, kanaalVia: 'direct', brancheId: '', soort: '', winpuntId: '', scriptId: '', boodschap: {}, mailreeks: [], doel: null, tussendoelen: [], startOp: '', eindOp: '', eigenaarId: '', verdeling: null, jaarkeuze: null })
const BRONNEN: Record<string, string> = { doelgroep: 'Doelgroep', fase: 'Fase in een reis', importbatch: 'Importbatch', leadronde: 'Leadronde', vrij: 'Vrije keuze' }
const bronOpties = computed(() => ({ doelgroep: ctx.value.doelgroepen, fase: ctx.value.fases, importbatch: ctx.value.importbatches, leadronde: ctx.value.leadrondes } as Record<string, any[]>)[f.bron.soort] ?? [])
const soort = computed(() => ctx.value.soorten.find((s: any) => s.sleutel === f.soort) ?? null)
const startsoorten = computed(() => ctx.value.soorten.filter((s: any) => s.startsoort))
const zoekSoort = ref('')
const overigeSoorten = computed(() => ctx.value.soorten.filter((s: any) => !s.startsoort && s.naam.toLowerCase().includes(zoekSoort.value.toLowerCase())))
const groepen = computed<string[]>(() => [...new Set<string>(overigeSoorten.value.map((s: any) => s.groep))])

// De server rekent mee bij elke wijziging in bron, soort, branche of verdeling.
const v = ref<any>(null)
const rekent = ref(false)
let timer: any
const invoer = () => ({ ...f, bron: f.bron.soort === 'vrij' ? { soort: 'vrij', accountIds: vrij.value.map((a) => a.id) } : f.bron, eigenaarId: f.eigenaarId || null, brancheId: f.brancheId || null, winpuntId: f.winpuntId || null, scriptId: f.scriptId || null, startOp: f.startOp || null, eindOp: f.eindOp || null })
watch(() => [f.bron.soort, f.bron.id, vrij.value.length, f.soort, f.brancheId, f.kanaalVia, f.eigenaarId, JSON.stringify(f.verdeling)], () => {
  clearTimeout(timer)
  if (f.bron.soort !== 'vrij' && !f.bron.id) { v.value = null; return }
  timer = setTimeout(async () => {
    rekent.value = true
    try { v.value = await $fetch('/api/campagnes/voorbereid', { method: 'POST', body: invoer() }) } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { rekent.value = false }
  }, 300)
})
watch(soort, (s) => { if (s && !f.doel) f.doel = { ...s.standaardDoel } })

// Stap 3: winpunt (AI-voorstel of zelf kiezen).
const voorstel = ref<any>(null)
async function stelWinpuntVoor() {
  try { voorstel.value = (await $fetch<any>('/api/campagnes/winpunt', { method: 'POST', body: { faseId: f.bron.soort === 'fase' ? f.bron.id : null } })).voorstel; if (voorstel.value && !f.winpuntId) f.winpuntId = voorstel.value.winpuntId } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
watch(stap, (s) => { if (s === 2 && !voorstel.value && ctx.value.kan.boodschapAI) stelWinpuntVoor() })

// Stap 4: boodschap per kanaal.
const toon = ref<'Zakelijk' | 'Persoonlijk' | 'Kort'>('Zakelijk')
const scores = ref<Record<string, number>>({})
const schrijft = ref('')
const tekstKanalen = computed(() => (soort.value?.kanalen ?? []).filter((k: string) => ['mail', 'linkedin', 'kaart'].includes(k)))
async function schrijf(kanaal: string) {
  schrijft.value = kanaal
  try {
    const r = await $fetch<any>('/api/campagnes/boodschap', { method: 'POST', body: { kanaal, toon: toon.value, winpuntId: f.winpuntId || null, brancheId: f.brancheId || null } })
    f.boodschap = { ...f.boodschap, [kanaal]: r.tekst }; scores.value = { ...scores.value, [kanaal]: r.stijlscore }
    if (kanaal === 'mail') f.mailreeks = [{ dag: 0, onderwerp: r.onderwerp ?? f.naam ?? 'Kennismaking', tekst: r.tekst, winpuntId: f.winpuntId || null }, ...f.mailreeks.slice(1)]
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { schrijft.value = '' }
}
function nieuweMail() { f.mailreeks.push({ dag: (f.mailreeks.at(-1)?.dag ?? 0) + 4, onderwerp: '', tekst: '', winpuntId: null }) }

// Navigatie en bewaren.
const kanVerder = computed(() => [
  !!v.value && v.value.mee.length > 0 && !!f.brancheId,
  !!soort.value,
  true,
  true,
  !!f.doel?.waarde,
][stap.value])
const bezig = ref(false)
const capaciteitVraag = ref<any>(null)
async function bewaar(activeren: boolean) {
  bezig.value = true
  try {
    const c = await $fetch<any>('/api/campagnes', { method: 'POST', body: invoer() })
    if (!activeren) { toast.toon('Campagne bewaard als concept.'); return router.push(`/campagnes/${c.id}`) }
    await activeer(c.id, false)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function activeer(id: string, bevestiging: boolean) {
  try {
    const r = await $fetch<any>(`/api/campagnes/${id}/activeer`, { method: 'POST', body: { bevestiging } })
    toast.toon(r.tekst); capaciteitVraag.value = null
    router.push(`/campagnes/${id}`)
  } catch (e: any) {
    if (e?.data?.data?.reden === 'capaciteit') capaciteitVraag.value = { id, tekst: foutTekst(e) }
    else { toast.toon(foutTekst(e), 'fout'); router.push(`/campagnes/${id}`) }
  }
}
const winpuntTitel = (id: string) => v.value?.winpunten?.find((w: any) => w.id === id)?.titel ?? ''
useHead({ title: 'Nieuwe campagne · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="campagnes.maken" />
    <template v-else>
      <PaginaKop kicker="Campagnes" titel="Nieuwe campagne" uitleg="Vijf stappen: doelgroep, soort, winpunt, boodschap en doel. Opslaan als concept kan altijd." helpartikel="een-campagne-opzetten" />
      <section class="section">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel" data-test="groot-scherm">Beter op een groot scherm.</p>
          <ol class="cp-stappen" aria-label="Stappen">
            <li v-for="(s, i) in STAPPEN" :key="s" :class="{ 'is-actief': i === stap, 'is-klaar': i < stap }"><button type="button" :disabled="i > stap" @click="stap = i">{{ i + 1 }}. {{ s }}</button></li>
          </ol>

          <!-- 1. Doelgroep -->
          <div v-if="stap === 0" class="kaart cp-stap" data-test="stap-doelgroep">
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Bron</span>
                <select v-model="f.bron.soort" class="invoer" data-test="bron-soort" @change="f.bron.id = ''"><option v-for="(l, k) in BRONNEN" :key="k" :value="k">{{ l }}</option></select></label>
              <label v-if="f.bron.soort !== 'vrij'" class="veld"><span class="veld-label">{{ BRONNEN[f.bron.soort] }}</span>
                <select v-model="f.bron.id" class="invoer" data-test="bron-id"><option value="" disabled>Kies</option><option v-for="o in bronOpties" :key="o.id" :value="o.id">{{ o.naam }}</option></select></label>
              <label class="veld"><span class="veld-label">Branche <span class="veld-verplicht">*</span></span>
                <select v-model="f.brancheId" class="invoer" data-test="branche"><option value="" disabled>Kies</option><option v-for="b in ctx.branches" :key="b.id" :value="b.id">{{ b.naam }}</option></select></label>
              <label class="veld"><span class="veld-label">Kanaal</span>
                <select v-model="f.kanaalVia" class="invoer"><option value="direct">Direct</option><option value="partner">Via partner</option></select></label>
            </div>
            <AccountKiezer v-if="f.bron.soort === 'vrij'" v-model="vrij" class="mt-16" />
            <div v-if="v" class="cp-telling mt-16" data-test="telling">
              <p class="cp-groot"><strong>{{ v.mee.length }}</strong> {{ v.mee.length === 1 ? 'account gaat' : 'accounts gaan' }} mee<template v-if="v.overgeslagen.length">, {{ v.overgeslagen.length }} overgeslagen</template>.</p>
              <ul v-if="v.samenvatting.length" class="cp-overgeslagen" data-test="overgeslagen"><li v-for="s in v.samenvatting" :key="s">{{ s }}</li></ul>
              <p v-if="v.omvang" class="kaart kaart--geel">{{ v.omvang }}</p>
              <p v-if="v.brancheMelding" class="kaart kaart--geel" data-test="branche-melding">{{ v.brancheMelding }} <NuxtLink to="/instellingen/verkoopverhaal" class="filter-link">Naar de inrichting</NuxtLink></p>
              <p v-if="v.brancheAdvies" class="kaart kaart--geel" data-test="branche-advies">{{ v.brancheAdvies }}</p>
            </div>
            <p v-else-if="rekent" class="rij-sub mt-16">Rekenen…</p>
          </div>

          <!-- 2. Soort -->
          <div v-else-if="stap === 1" class="cp-stap" data-test="stap-soort">
            <div class="cp-soorten">
              <button v-for="s in startsoorten" :key="s.sleutel" type="button" class="cp-soortkaart" :class="{ 'is-gekozen': f.soort === s.sleutel }" :data-test="`soort-${s.sleutel}`" @click="f.soort = s.sleutel">
                <strong>{{ s.naam }}</strong><span class="rij-sub">{{ s.standaardDoel.type === 'afspraken' ? `${s.standaardDoel.waarde} afspraken` : `${s.standaardDoel.waarde}% afspraken` }} · {{ s.pogingen }} pogingen in {{ s.weken }} weken · {{ s.uitvoerder }}</span>
              </button>
            </div>
            <template v-if="ctx.kan.alleSoorten && ctx.soorten.some((s: any) => !s.startsoort)">
              <h3 class="fo-blok-titel mt-16">Alle soorten</h3>
              <input v-model="zoekSoort" class="invoer" placeholder="Zoek een soort" aria-label="Zoek een soort">
              <div v-for="g in groepen" :key="g" class="mt-16"><h4 class="filter-label">{{ g }}</h4>
                <div class="cp-soorten"><button v-for="s in overigeSoorten.filter((x: any) => x.groep === g)" :key="s.sleutel" type="button" class="cp-soortkaart" :class="{ 'is-gekozen': f.soort === s.sleutel }" @click="f.soort = s.sleutel"><strong>{{ s.naam }}</strong></button></div>
              </div>
            </template>
            <p v-if="v?.dekking && soort && !v.dekking.mag" class="kaart kaart--geel mt-16" data-test="dekking">{{ v.dekking.tekst }}</p>
          </div>

          <!-- 3. Winpunt -->
          <div v-else-if="stap === 2" class="kaart cp-stap" data-test="stap-winpunt">
            <div v-if="voorstel" class="aanleiding-blok" data-test="winpunt-voorstel"><strong>Voorstel: {{ winpuntTitel(voorstel.winpuntId) }}</strong><p class="rij-sub">{{ voorstel.motivatie }}</p></div>
            <label class="veld"><span class="veld-label">Winpunt</span>
              <select v-model="f.winpuntId" class="invoer" data-test="winpunt"><option value="">Geen winpunt</option><option v-for="w in v?.winpunten ?? []" :key="w.id" :value="w.id">{{ w.titel }}</option></select></label>
            <p v-if="!(v?.winpunten ?? []).length" class="rij-sub">Er zijn nog geen bevestigde winpunten. Je beheerder vult ze bij Verkoopverhaal.</p>
          </div>

          <!-- 4. Boodschap en script -->
          <div v-else-if="stap === 3" class="kaart cp-stap" data-test="stap-boodschap">
            <label v-if="soort?.kanalen.includes('bellen')" class="veld"><span class="veld-label">Belscript</span>
              <select v-model="f.scriptId" class="invoer" data-test="script"><option value="">Standaardscript van de soort</option><option v-for="s in ctx.belscripts" :key="s.id" :value="s.id">{{ s.naam }}</option></select></label>
            <template v-if="tekstKanalen.length">
              <div class="cp-tonen" role="radiogroup" aria-label="Toon"><button v-for="t in ['Zakelijk', 'Persoonlijk', 'Kort']" :key="t" type="button" class="filter-pil" :class="{ 'filter-pil--aan': toon === t }" :aria-pressed="toon === t" @click="toon = t as any">{{ t }}</button></div>
              <div v-for="k in tekstKanalen" :key="k" class="mt-16">
                <div class="veld-label">{{ k === 'mail' ? 'Eerste mail' : k === 'linkedin' ? 'LinkedIn-bericht' : 'Kaart' }}<span v-if="scores[k] !== undefined" class="pil pil--leeg">stijlscore {{ scores[k] }}</span></div>
                <textarea v-model="f.boodschap[k]" class="invoer" rows="6" :data-test="`boodschap-${k}`" />
                <button v-if="ctx.kan.boodschapAI" type="button" class="dd-act mt-8" :disabled="schrijft === k" :data-test="`schrijf-${k}`" @click="schrijf(k)">{{ f.boodschap[k] ? 'Maak opnieuw' : 'Schrijf een voorstel' }}</button>
              </div>
              <div v-if="soort?.kanalen.includes('mail')" class="mt-16">
                <h3 class="fo-blok-titel">Mailreeks</h3>
                <div v-for="(m, i) in f.mailreeks.slice(1)" :key="i" class="formulier-raster mt-8">
                  <label class="veld"><span class="veld-label">Dag</span><input v-model.number="m.dag" type="number" min="1" class="invoer"></label>
                  <label class="veld"><span class="veld-label">Onderwerp</span><input v-model="m.onderwerp" class="invoer"></label>
                  <label class="veld"><span class="veld-label">Winpunt (een ander dan bericht 1)</span><select v-model="m.winpuntId" class="invoer"><option :value="null">Geen</option><option v-for="w in (v?.winpunten ?? []).filter((x: any) => x.id !== f.winpuntId)" :key="w.id" :value="w.id">{{ w.titel }}</option></select></label>
                  <label class="veld veld--breed"><span class="veld-label">Tekst</span><textarea v-model="m.tekst" class="invoer" rows="3" /></label>
                </div>
                <button type="button" class="dd-act mt-8" @click="nieuweMail">+ Mail</button>
                <p class="rij-sub mt-8">{{ ctx.kan.mailreeksB ? 'Mail 2 en verder verstuurt de Verzender zelf als je organisatie dat aanzet; de eerste mail en elke mail aan een beslisser keur je per stuk goed.' : 'Elke mail staat als concept klaar en je verstuurt hem zelf.' }}</p>
              </div>
            </template>
            <p v-else-if="!soort?.kanalen.includes('bellen')" class="rij-sub">Deze soort heeft geen tekst nodig.</p>
          </div>

          <!-- 5. Doel en planning -->
          <div v-else class="kaart cp-stap" data-test="stap-doel">
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Naam</span><input v-model="f.naam" class="invoer" :placeholder="soort?.naam" data-test="naam"></label>
              <label class="veld"><span class="veld-label">Einddoel</span>
                <span class="cp-doel"><input v-model.number="f.doel.waarde" type="number" min="1" class="invoer" data-test="doel-waarde"><select v-model="f.doel.type" class="invoer"><option value="afspraken">afspraken</option><option value="procent">procent afspraken</option></select></span></label>
              <label class="veld"><span class="veld-label">Startdatum</span><input v-model="f.startOp" type="date" class="invoer"></label>
              <label class="veld"><span class="veld-label">Einddatum</span><input v-model="f.eindOp" type="date" class="invoer" :placeholder="`${soort?.weken ?? 3} weken na de start`"></label>
              <label v-if="ctx.kan.team" class="veld"><span class="veld-label">Eigenaar</span>
                <select v-model="f.eigenaarId" class="invoer"><option value="">Ik</option><option v-for="u in ctx.verkopers" :key="u.id" :value="u.id">{{ u.naam }}</option></select></label>
              <label v-if="ctx.kan.team" class="veld"><span class="veld-label">Verdeling</span>
                <select class="invoer" :value="f.verdeling?.wijze ?? ''" @change="f.verdeling = ($event.target as HTMLSelectElement).value ? { wijze: ($event.target as HTMLSelectElement).value, eigenaars: ctx.verkopers.filter((u: any) => u.werkplek !== 'buitendienst').map((u: any) => u.id) } : null">
                  <option value="">Geen, alles bij de eigenaar</option><option value="gelijk">Gelijk over de verkopers</option><option value="gebied">Op gebied</option><option value="capaciteit">Op capaciteit</option></select></label>
            </div>
            <p v-if="v?.capaciteit" class="kaart mt-16" :class="{ 'kaart--geel': v.capaciteit.boven }" data-test="capaciteit">{{ v.capaciteit.tekst }}<template v-if="v.capaciteit.boven">. Boven capaciteit bevestigt je salesmanager de campagne.</template></p>
          </div>

          <div class="cp-wizard-voet">
            <button v-if="stap > 0" type="button" class="dd-actie dd-actie--secundair" @click="stap--">Terug</button>
            <span class="dd-acties-vul" />
            <button type="button" class="dd-actie dd-actie--secundair" :disabled="bezig || !v?.mee.length || !f.soort || !f.brancheId" data-test="bewaar-concept" @click="bewaar(false)">Opslaan als concept</button>
            <button v-if="stap < 4" type="button" class="dd-actie dd-actie--primair" :disabled="!kanVerder" data-test="volgende" @click="stap++">Volgende</button>
            <button v-else type="button" class="dd-actie dd-actie--primair" :disabled="bezig || !kanVerder || (v?.dekking && !v.dekking.mag)" data-test="activeer" @click="bewaar(true)">Activeer</button>
          </div>
          <p v-if="stap === 4 && v?.dekking && !v.dekking.mag" class="kaart kaart--geel mt-16">{{ v.dekking.tekst }}</p>
        </div>
      </section>
    </template>
    <BevestigVenster :open="!!capaciteitVraag" titel="Boven capaciteit" :tekst="capaciteitVraag?.tekst ?? ''" bevestig="Vraag bevestiging" @bevestigd="activeer(capaciteitVraag.id, true)" @geannuleerd="router.push(`/campagnes/${capaciteitVraag.id}`)" />
  </div>
</template>
