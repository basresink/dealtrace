<script setup lang="ts">
// Bellen op de telefoon (8.5.4): de bellijst van vandaag met per regel een belknop (mobiel
// eerst). Na terugkeer in de app vraagt "Hoe ging het?" met vier tegels de uitkomst; bij
// "Gesproken" volgt de uitkomst uit het script. Offline gaat de uitkomst via de wachtrij.
import { telLink } from '~/utils/accountWeergave'
import { HOE_GING_HET, uitkomstNaarCode, type TegelSleutel } from '~~/shared/belblokken'
import { NEE_REDENEN } from '~~/shared/nbStatus'
import { voegWerkdagenToe } from '~~/shared/datum'
const { functie } = useMe()
const aan = !!functie('belblok.uitvoeren')?.beschikbaar
const { rondAf } = useAfronden()
const { data, refresh } = await useFetch<any>('/api/bellen', { immediate: aan, default: () => ({ items: [], kop: 'Bellijst van vandaag' }) })
const bezig = ref<{ taskId: string; accountNaam: string } | null>(null)
const vraag = ref(false)
const stap = ref<'tegels' | 'gesproken' | 'datum' | 'reden'>('tegels')
const code = ref<string>('')
const laterOp = ref(voegWerkdagenToe(new Date().toISOString().slice(0, 10), 1))
const reden = ref('')
const notitie = ref('')
const klaar = ref<Set<string>>(new Set())

function bel(i: any) {
  bezig.value = { taskId: i.taskId, accountNaam: i.accountNaam }
  try { sessionStorage.setItem('dt-bellen', JSON.stringify(bezig.value)) } catch {}
}
function terug() {
  if (document.visibilityState !== 'visible') return
  let b = bezig.value
  if (!b) { try { b = JSON.parse(sessionStorage.getItem('dt-bellen') ?? 'null') } catch {} }
  if (b) { bezig.value = b; stap.value = 'tegels'; vraag.value = true }
}
onMounted(() => document.addEventListener('visibilitychange', terug))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', terug))

async function rond(c: string, extra: { laterOp?: string; reden?: string } = {}) {
  const b = bezig.value
  if (!b) return
  vraag.value = false
  klaar.value = new Set([...klaar.value, b.taskId])
  bezig.value = null
  try { sessionStorage.removeItem('dt-bellen') } catch {}
  await rondAf(b.taskId, { uitkomst: c, laterOp: extra.laterOp ?? null, reden: extra.reden ?? null, toelichting: notitie.value || null })
  notitie.value = ''
}
function tegel(t: TegelSleutel) {
  if (t === 'gesproken') { stap.value = 'gesproken'; return }
  const v = uitkomstNaarCode(t)!
  if (v.vraagtDatum) { code.value = v.code; stap.value = 'datum'; return }
  void rond(v.code)
}
function gesproken(c: 'afspraak' | 'later' | 'geen_interesse') {
  if (c === 'afspraak') return rond('afspraak')
  code.value = c
  stap.value = c === 'later' ? 'datum' : 'reden'
}
const zichtbaar = computed(() => data.value.items.filter((i: any) => !klaar.value.has(i.taskId)))
useHead({ title: 'Bellen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="belblok.uitvoeren" />
    <template v-else>
      <PaginaKop kicker="Bellen" :titel="data.kop" :uitleg="`${zichtbaar.length} ${zichtbaar.length === 1 ? 'gesprek' : 'gesprekken'} staan klaar.`" helpartikel="de-belmodus" />
      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!zichtbaar.length" titel="Er staat niemand op je bellijst." tekst="De motor zet nieuwe belpogingen klaar zodra ze aan de beurt zijn." />
          <div class="lijst" data-test="bellen-lijst">
            <div v-for="i in zichtbaar" :key="i.taskId" class="rij bel-rij" :data-test="`bellen-${i.accountId}`">
              <div class="rij-info">
                <h3 class="rij-titel">{{ i.accountNaam }} <span v-if="i.prioriteit === 'hoog' || i.prioriteit === 'urgent'" class="pil pil--rood">Urgent</span></h3>
                <div class="rij-sub">{{ i.contactNaam ?? 'geen contact' }} · {{ i.reden }}</div>
                <p v-if="i.eersteRegel" class="bel-eerste-regel">{{ i.eersteRegel }}</p>
              </div>
              <a v-if="i.telefoon" :href="telLink(i.telefoon)" class="dd-actie dd-actie--primair bel-knop" :data-test="`bel-${i.accountId}`" @click="bel(i)"><Icoon naam="Phone" class="dd-actie-icoon" />Bel {{ i.telefoon }}</a>
              <button v-else type="button" class="dd-act bel-knop" @click="bel(i); vraag = true">Geen nummer · uitkomst</button>
            </div>
          </div>
        </div>
      </section>
      <Teleport to="body">
        <div v-if="vraag && bezig" class="fo-overlay" @click.self="vraag = false">
          <aside class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-label="Hoe ging het?" data-test="hoe-ging-het">
            <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">{{ bezig.accountNaam }}</span><h2 class="fo-titel">Hoe ging het?</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="vraag = false"><Icoon naam="X" /></button></header>
            <div class="fo-body">
              <div v-if="stap === 'tegels'" class="uitkomstraster uitkomstraster--2">
                <button v-for="t in HOE_GING_HET" :key="t.sleutel" type="button" class="uitkomst uitkomst--tegel" :data-test="`tegel-${t.sleutel}`" @click="tegel(t.sleutel)">{{ t.label }}</button>
              </div>
              <div v-else-if="stap === 'gesproken'" class="uitkomstraster uitkomstraster--2">
                <button type="button" class="uitkomst uitkomst--tegel" data-test="gesproken-afspraak" @click="gesproken('afspraak')">Afspraak</button>
                <button type="button" class="uitkomst uitkomst--tegel" data-test="gesproken-later" @click="gesproken('later')">Interesse, later</button>
                <button type="button" class="uitkomst uitkomst--tegel" data-test="gesproken-nee" @click="gesproken('geen_interesse')">Nee</button>
                <button type="button" class="uitkomst uitkomst--tegel" @click="stap = 'tegels'">Terug</button>
              </div>
              <div v-else-if="stap === 'datum'">
                <label class="veld"><span class="veld-label">Wanneer?</span><input v-model="laterOp" type="date" class="invoer" data-test="hoe-datum"></label>
                <button type="button" class="dd-actie dd-actie--primair mt-8 bel-knop" data-test="hoe-klaar" @click="rond(code, { laterOp })">Klaar</button>
              </div>
              <div v-else>
                <label class="veld"><span class="veld-label">Reden</span><select v-model="reden" class="invoer" data-test="hoe-reden"><option value="" disabled>Kies een reden</option><option v-for="r in NEE_REDENEN" :key="r">{{ r }}</option></select></label>
                <button type="button" class="dd-actie dd-actie--primair mt-8 bel-knop" :disabled="!reden" @click="rond('geen_interesse', { reden })">Klaar</button>
              </div>
              <label class="veld mt-16"><span class="veld-label">Notitie (Inspreken komt later)</span><textarea v-model="notitie" class="invoer" rows="2" /></label>
            </div>
          </aside>
        </div>
      </Teleport>
    </template>
  </div>
</template>
