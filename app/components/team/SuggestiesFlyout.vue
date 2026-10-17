<script setup lang="ts">
// Suggesties naar SalesDNA (P23, F25 kader 2): de wekelijkse bundel per sublaag met bewijs, Geef vrij,
// Pas aan en Wijs af; onderaan Geef alles vrij. Op de telefoon een schuifvenster met de knoppen plakkend
// onderaan; vrijgeven kost één tik per suggestie.
import { STATUS_LABEL, type SuggestieStatus } from '~~/shared/suggesties'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const data = ref<any>(null)
const bezig = ref<string | null>(null)
const aanpassen = ref<{ id: string; tekst: string } | null>(null)

async function laad() {
  try { data.value = await $fetch('/api/salesdna/suggesties') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
watch(() => props.open, (o) => { if (o) laad() }, { immediate: true })
const weeknummer = computed(() => Number(String(data.value?.week ?? '').split('-W')[1] ?? 0))
const wachtend = computed(() => (data.value?.groepen ?? []).flatMap((g: any) => g.suggesties).filter((s: any) => s.status === 'concept'))
const titel = computed(() => !data.value ? 'Laden…' : wachtend.value.length ? `${wachtend.value.length} ${wachtend.value.length === 1 ? 'suggestie wacht' : 'suggesties wachten'} op je besluit.` : 'Er wacht niets op je besluit.')

function melding(r: any) {
  const v = r?.verzonden ?? r
  if (!v) return null
  if (v.eigenInrichting) return `${v.eigenInrichting === 1 ? 'De suggestie staat' : `${v.eigenInrichting} suggesties staan`} als taak bij de beheerder voor de eigen inrichting.`
  if (v.mislukt) return v.melding ?? 'Versturen is niet gelukt.'
  if (v.verstuurd) return `${v.verstuurd === 1 ? 'De suggestie is' : `${v.verstuurd} suggesties zijn`} naar SalesDNA verstuurd.`
  return null
}
async function besluit(s: any, b: 'vrij' | 'af', tekst?: string) {
  bezig.value = s.id
  try {
    const r = await $fetch<any>(`/api/salesdna/suggesties/${s.id}`, { method: 'PUT', body: { besluit: b, ...(tekst != null ? { tekst } : {}) } })
    toast.toon(b === 'af' ? 'De suggestie is afgewezen.' : melding(r) ?? 'De suggestie is vrijgegeven.')
    aanpassen.value = null
    await laad(); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
async function allesVrij() {
  bezig.value = 'alles'
  try {
    const r = await $fetch<any>('/api/salesdna/suggesties/verstuur', { method: 'POST', body: { ids: wachtend.value.map((s: any) => s.id), vrijgeven: true } })
    toast.toon(melding(r) ?? 'Alles is vrijgegeven.')
    await laad(); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
async function naarBundel(v: any) {
  try { await $fetch('/api/salesdna/suggesties/uit-voorstel', { method: 'POST', body: { voorstelId: v.id } }); toast.toon('Het voorstel staat als concept in de bundel.'); await laad() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const pil = (st: SuggestieStatus) => ({ concept: 'pil--leeg', vrijgegeven: 'pil--geel', verstuurd: 'pil--leeg', overgenomen: 'pil--groen', afgewezen_salesdna: 'pil--rood', afgewezen: 'pil--leeg', mislukt: 'pil--rood' } as Record<string, string>)[st] ?? 'pil--leeg'
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="sg-titel" paneel-klasse="sg-panel" data-test="suggesties-flyout" @sluit="emit('sluit')">
      <template #kop>
            <span class="fo-kicker">Suggesties naar SalesDNA · week {{ weeknummer || '' }}</span>
            <h2 id="sg-titel" class="fo-titel">{{ titel }}</h2>
            <p class="fo-meta">Hooguit 10 per sublaag per week. Zonder namen van personen of prospects.</p></template>
        <div v-if="data" class="fo-body">
          <p v-if="!data.gekoppeld" class="fo-blok meta" data-test="sg-zonder-koppeling">SalesDNA is niet gekoppeld. Wat je vrijgeeft, wordt een taak voor de beheerder om het verkoopverhaal in de eigen inrichting aan te vullen.</p>
          <LegeStaat v-if="!data.groepen.length" titel="Er zijn deze week geen suggesties." tekst="Dealtrace stelt pas iets voor als er genoeg bewijs is." />
          <article v-for="g in data.groepen" :key="g.onderwerpId" class="fo-blok" :data-test="`sg-groep-${g.onderwerpId}`">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">{{ g.label }}</h3><span class="meta">{{ g.onderwerpId }} · kader 2</span></header>
            <div v-for="s in g.suggesties" :key="s.id" class="sg-rij" :data-test="`sg-${s.id}`">
              <div class="sg-kop"><span class="meta">{{ s.soort }}</span><span class="pil" :class="pil(s.status)">{{ STATUS_LABEL[s.status as SuggestieStatus] }}</span></div>
              <template v-if="aanpassen?.id === s.id">
                <textarea v-model="aanpassen!.tekst" class="invoer" rows="3" aria-label="Tekst van de suggestie" data-test="sg-tekst" />
                <div class="dd-acties mt-8"><button type="button" class="dd-act dd-act--primair" :disabled="bezig === s.id" @click="besluit(s, 'vrij', aanpassen!.tekst)">Bewaar en geef vrij</button><button type="button" class="dd-act" @click="aanpassen = null">Annuleer</button></div>
              </template>
              <p v-else class="sg-tekst">{{ s.tekst }}</p>
              <p v-if="s.bewijs?.aantallen?.length" class="meta">Bewijs: {{ s.bewijs.aantallen.map((a: any) => `${a.waarde} ${a.label}`).join(' · ') }}</p>
              <ul v-if="s.bewijs?.citaten?.length" class="sg-citaten"><li v-for="c in s.bewijs.citaten" :key="c">"{{ c }}"</li></ul>
              <p class="meta">Hoort bij {{ g.label }}, veld {{ s.veld }}<template v-if="s.regelExternId">, regel {{ s.regelExternId }}</template>.</p>
              <p v-if="s.fout" class="meta sg-fout">{{ s.fout }}</p>
              <div v-if="['concept', 'mislukt'].includes(s.status) && aanpassen?.id !== s.id" class="dd-acties sg-knoppen">
                <button type="button" class="dd-act dd-act--primair" :disabled="!!bezig" data-test="sg-vrij" @click="besluit(s, 'vrij')">Geef vrij</button>
                <button type="button" class="dd-act" :disabled="!!bezig" @click="aanpassen = { id: s.id, tekst: s.tekst }">Pas aan</button>
                <button type="button" class="dd-act" :disabled="!!bezig" data-test="sg-af" @click="besluit(s, 'af')">Wijs af</button>
              </div>
            </div>
          </article>
          <article v-if="data.voorstellen.length" class="fo-blok" data-test="sg-voorstellen">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Voorstellen uit je team</h3></header>
            <p class="meta">Een Expert stelde dit voor. Het gaat pas mee als jij het in de bundel zet.</p>
            <div v-for="v in data.voorstellen" :key="v.id" class="sg-rij">
              <p class="sg-tekst">{{ v.tekst }}</p>
              <p class="meta">{{ v.door }} · {{ v.onderdeel }} · {{ v.soort }}</p>
              <div class="dd-acties"><button type="button" class="dd-act" @click="naarBundel(v)">Zet in de bundel</button></div>
            </div>
          </article>
        </div>
      <template #voet>
        <footer v-if="wachtend.length" class="fo-foot fs-voet">
          <button type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!!bezig" data-test="sg-alles" @click="allesVrij"><Icoon naam="Check" :grootte="16" />Geef alles vrij</button>
          <span class="fo-foot-vul" />
          <button type="button" class="dd-act" @click="emit('sluit')">Later</button>
        </footer>
      </template>
    </FlyoutShell>
</template>

<style scoped>
:global(.fo-panel.sg-panel) { max-width: 640px; }
.sg-rij { padding: 12px 0; border-top: 1px solid var(--border); display: grid; gap: 6px; }
.sg-rij:first-of-type { border-top: 0; }
.sg-kop { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.sg-tekst { margin: 0; }
.sg-citaten { margin: 0; padding-left: 16px; color: var(--muted); font-style: italic; }
.sg-fout { color: var(--red); }
.sg-knoppen .dd-act { min-height: 44px; }
</style>
