<script setup lang="ts">
// Reis bekijken (F05): tabbladen Fases, Overgangen, Activiteiten en Stroom. De
// salesmanager stelt de accenten van de standaardreis bij; "Standaard terugzetten"
// zet fases, accenten, overgangen en startactiviteiten samen terug.
import { GEBEURTENIS_LABEL, type Gebeurtenis } from '~~/shared/nbStatus'
import { HOOFDFASEN, HOOFDFASE_LABEL } from '~~/shared/reis'
import { fasePil } from '~/utils/accountWeergave'
const route = useRoute()
const { functie } = useMe()
if (!functie('reis.overzicht')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Reis bekijken staat aan vanaf Gevorderd' })
const toast = useToast()
const { data: r, refresh } = await useFetch<any>(() => `/api/reizen/${route.params.id}`)
if (!r.value) throw createError({ statusCode: 404, statusMessage: 'Reis onbekend' })
const tab = ref<'fases' | 'overgangen' | 'activiteiten' | 'stroom'>('fases')
const lezen = computed(() => !r.value.kan.bewerken)
const accenten = reactive<Record<string, string>>({})
watchEffect(() => { for (const f of r.value.fases) accenten[f.id] = f.accent })
const gewijzigd = computed(() => r.value.fases.some((f: any) => accenten[f.id] !== f.accent))
async function bewaarAccenten() {
  try {
    await $fetch(`/api/reizen/${r.value.id}`, { method: 'PUT', body: { fases: r.value.fases.filter((f: any) => accenten[f.id] !== f.accent).map((f: any) => ({ id: f.id, accent: accenten[f.id] })) } })
    toast.toon('Accenten bewaard; nieuwe versie van de reis.'); await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const terugOpen = ref(false)
async function standaardTerug() {
  terugOpen.value = false
  try { await $fetch(`/api/reizen/${r.value.id}/standaard-terug`, { method: 'POST', body: { bevestigd: true } }); toast.toon('De reis staat weer op de standaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const label = (id: string | null) => (id ? r.value.fases.find((f: any) => f.id === id)?.label ?? id : 'Instap')
const g = (x: string) => GEBEURTENIS_LABEL[x as Gebeurtenis] ?? x
const verblijf = (f: any) => f.verwachtVerblijfDagen != null ? `${f.verwachtVerblijfDagen} dagen` : f.verblijfTekst ?? '–'
const ROL: Record<string, string> = { binnendienst: 'Binnendienst', buitendienst: 'Buitendienst', alle: 'Iedereen' }
useHead({ title: computed(() => `${r.value?.naam ?? 'Reis'} · Prospectreizen · Dealtrace`) })
</script>

<template>
  <div v-if="r">
    <PaginaKop :kicker="lezen ? 'Reis' : 'Prospectreizen · Reis'" :titel="r.naam" :uitleg="`Versie ${r.versie}. Tien fases tot en met de eerste afspraak en de overdracht.`" helpartikel="de-prospectreis-en-fases">
      <template #acties>
        <button v-if="r.kan.standaardTerug" type="button" class="dd-actie dd-actie--secundair" data-test="standaard-terug" @click="terugOpen = true"><Icoon naam="RefreshCw" class="dd-actie-icoon" />Standaard terugzetten</button>
      </template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <nav class="tabbalk" aria-label="Tabbladen">
          <button v-for="t in ([['fases', 'Fases'], ['overgangen', 'Overgangen'], ['activiteiten', 'Activiteiten'], ['stroom', 'Stroom']] as const)" :key="t[0]" type="button" class="tab" :class="{ 'tab--actief': tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button>
        </nav>
        <div v-if="tab === 'fases'" class="mt-16 ak-blokken" data-test="fases">
          <article v-for="f in r.fases" :key="f.id" class="fasekaart">
            <header class="kaart-kop"><span class="meta tnum">{{ f.volgorde }}</span><span class="pil" :class="fasePil(f.kleur)">{{ f.label }}</span><span class="meta">{{ HOOFDFASE_LABEL[f.hoofdfase as keyof typeof HOOFDFASE_LABEL] }}</span></header>
            <p class="kaart-meta">{{ f.omschrijving }}</p>
            <p class="kaart-meta">Verwacht verblijf: {{ verblijf(f) }} · <span class="tnum">{{ f.aantal }}</span> accounts</p>
            <label v-if="r.kan.accent" class="veld fasekaart-accent"><span class="veld-label">Pitstop-accent</span><textarea v-model="accenten[f.id]" class="invoer" rows="2" :data-test="`accent-${f.id}`" /></label>
            <p v-else class="fasekaart-accent">{{ f.accent }}</p>
          </article>
        </div>
        <div v-if="tab === 'fases' && r.kan.accent" class="mt-16"><button type="button" class="dd-act dd-act--primair" :disabled="!gewijzigd" data-test="accenten-bewaar" @click="bewaarAccenten">Accenten bewaren</button></div>
        <div v-else-if="tab === 'overgangen'" class="tabel-wrap mt-16">
          <table class="tabel tabel--kaarten" data-test="overgangen">
            <thead><tr><th>Vanuit</th><th>Gebeurtenis</th><th>Naar</th></tr></thead>
            <tbody><tr v-for="o in r.overgangen" :key="o.id"><td>{{ label(o.vanFaseId) }}</td><td>{{ g(o.gebeurtenis) }}</td><td><strong>{{ label(o.naarFaseId) }}</strong></td></tr></tbody>
          </table>
        </div>
        <div v-else-if="tab === 'activiteiten'" class="tabel-wrap mt-16">
          <p class="kaart-meta">Startactiviteiten bij "fase betreden". De motor voert ze uit.</p>
          <table class="tabel tabel--kaarten mt-16">
            <thead><tr><th>Fase</th><th>Activiteit</th><th>Voor</th><th>Termijn</th></tr></thead>
            <tbody><tr v-for="x in r.activiteiten" :key="x.id"><td>{{ label(x.faseId) }}</td><td>{{ x.naam }}<template v-if="x.belscript"> · script "{{ x.belscript }}"</template><br v-if="x.omschrijving"><span class="meta">{{ x.omschrijving }}</span></td><td>{{ ROL[x.rol] }}</td><td class="tnum">{{ x.termijnWerkdagen }} werkdagen</td></tr></tbody>
          </table>
        </div>
        <div v-else-if="tab === 'stroom'" class="fasebord mt-16" data-test="stroom">
          <div v-for="h in HOOFDFASEN" :key="h" class="fasebord-kolom">
            <span class="kicker">{{ HOOFDFASE_LABEL[h] }}</span>
            <div v-for="f in r.fases.filter((x: any) => x.hoofdfase === h)" :key="f.id" class="fasekaart">
              <span class="pil" :class="fasePil(f.kleur)">{{ f.label }}</span>
              <ul class="schakel-lijst mt-8"><li v-for="o in r.overgangen.filter((x: any) => x.vanFaseId === f.id)" :key="o.id" class="stroom-pijl">{{ g(o.gebeurtenis) }} → {{ label(o.naarFaseId) }}</li></ul>
            </div>
          </div>
          <p v-for="w in r.validatie.waarschuwingen" :key="w" class="kaart kaart--geel">{{ w }}</p>
        </div>
      </div>
    </section>
    <BevestigVenster :open="terugOpen" titel="Standaard terugzetten?" tekst="Fases, accenten, overgangen en startactiviteiten van deze reis gaan terug naar de standaard. Jullie aangepaste accenten gaan verloren." bevestig="Terugzetten" @geannuleerd="terugOpen = false" @bevestigd="standaardTerug" />
  </div>
</template>
