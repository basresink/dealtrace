<script setup lang="ts">
// Info-flyout (520 px, F03): basisvelden, eigen velden per sectie, eigenaar (gat 9),
// klasse, herkomst en scoreopbouw (Expert). Elke wijziging bewaart zichzelf.
import { SCORE_DELEN } from '~/utils/accountWeergave'
const props = defineProps<{ open: boolean; account: any }>()
const emit = defineEmits<{ sluit: []; gewijzigd: []; verwijder: [] }>()
const toast = useToast()
const { me } = useMe()
const meer = ref(false)
const beginner = computed(() => me.value?.gebruiker.niveau === 'beginner' && !me.value?.organisatie?.iedereenAlles)
const f = reactive<Record<string, any>>({})
const cf = reactive<Record<string, any>>({})
watch(() => [props.open, props.account], () => {
  if (!props.account) return
  Object.assign(f, { naam: props.account.naam, plaats: props.account.plaats, postcode: props.account.postcode, adres: props.account.adres, telefoon: props.account.telefoon, website: props.account.website, linkedin: props.account.linkedin, branche: props.account.branche, kvk: props.account.kvk })
  for (const k of Object.keys(cf)) delete cf[k]
  Object.assign(cf, props.account.customFields)
}, { immediate: true })
const status = ref('')
async function bewaar(patch: Record<string, unknown>) {
  status.value = 'Opslaan…'
  try { await $fetch(`/api/accounts/${props.account.id}`, { method: 'PUT', body: patch }); status.value = 'Opgeslagen'; emit('gewijzigd') } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
}
const secties = computed(() => {
  const m = new Map<string, any[]>()
  for (const v of props.account?.eigenVelden ?? []) (m.get(v.sectie) ?? m.set(v.sectie, []).get(v.sectie)!).push(v)
  return [...m.entries()]
})
function bewaarCf(sleutel: string) { bewaar({ customFields: { [sleutel]: cf[sleutel] === '' ? null : cf[sleutel] } }) }
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-labelledby="if-titel" data-test="info-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Info</span><h2 id="if-titel" class="fo-titel">{{ account.naam }}</h2><p class="fo-meta" aria-live="polite">{{ status }}</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Gegevens</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Naam</span><input v-model="f.naam" class="invoer" @change="bewaar({ naam: f.naam })"></label>
              <label class="veld"><span class="veld-label">Plaats</span><input v-model="f.plaats" class="invoer" @change="bewaar({ plaats: f.plaats || null })"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer" type="tel" @change="bewaar({ telefoon: f.telefoon || null })"></label>
              <label class="veld"><span class="veld-label">Website</span><input v-model="f.website" class="invoer" @change="bewaar({ website: f.website || null })"></label>
              <template v-if="!beginner">
                <label class="veld"><span class="veld-label">Adres</span><input v-model="f.adres" class="invoer" @change="bewaar({ adres: f.adres || null })"></label>
                <label class="veld"><span class="veld-label">Postcode</span><input v-model="f.postcode" class="invoer" @change="bewaar({ postcode: f.postcode || null })"></label>
                <label class="veld"><span class="veld-label">Branche</span><input v-model="f.branche" class="invoer" @change="bewaar({ branche: f.branche || null })"></label>
                <label class="veld"><span class="veld-label">LinkedIn</span><input v-model="f.linkedin" class="invoer" @change="bewaar({ linkedin: f.linkedin || null })"></label>
                <label class="veld"><span class="veld-label">KvK</span><input v-model="f.kvk" class="invoer" @change="bewaar({ kvk: f.kvk || null })"></label>
              </template>
            </div>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Eigenaar en klasse</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Eigenaar</span>
                <select v-if="account.kan.eigenaar" class="invoer" :value="account.eigenaar?.id ?? ''" data-test="eigenaar" @change="bewaar({ eigenaarId: ($event.target as HTMLSelectElement).value || null })"><option value="">Niemand</option><option v-for="u in account.gebruikers" :key="u.id" :value="u.id">{{ u.naam }}</option></select>
                <span v-else class="invoer invoer--lees">{{ account.eigenaar?.naam ?? 'Niemand' }}</span>
              </label>
              <label v-if="account.kan.klasse" class="veld"><span class="veld-label">Klasse</span>
                <select class="invoer" :value="account.klasse ?? ''" @change="bewaar({ klasse: ($event.target as HTMLSelectElement).value || null })"><option value="">Geen klasse</option><option v-for="k in account.klassen" :key="k.id" :value="k.id">{{ k.naam }}</option></select>
              </label>
            </div>
          </article>
          <template v-if="!beginner || meer">
            <article v-for="[sectie, velden] in secties" :key="sectie" class="fo-blok" data-test="eigen-velden-sectie">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">{{ sectie }}</h3></header>
              <div class="formulier-raster">
                <EigenVeldInvoer v-for="v in velden" :key="v.sleutel" v-model="cf[v.sleutel]" :veld="v" @change="bewaarCf(v.sleutel)" />
              </div>
            </article>
            <article v-if="account.scoreOpbouw" class="fo-blok" data-test="scoreopbouw">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Score {{ account.score }}</h3></header>
              <ul class="fo-tekst"><li v-for="(o, k) in account.scoreOpbouw" :key="k">{{ SCORE_DELEN[k] }}: {{ o.punten }}/{{ o.max }} · {{ o.uitleg }}</li></ul>
            </article>
            <article v-if="Object.keys(account.herkomst ?? {}).length" class="fo-blok">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">Herkomst</h3></header>
              <ul class="fo-tekst"><li v-for="(h, k) in account.herkomst" :key="k">{{ k }}: {{ h.bron }} · {{ h.op?.slice(0, 10) }}</li></ul>
            </article>
          </template>
          <button v-else type="button" class="dd-act" @click="meer = true">Meer</button>
        </div>
        <footer class="fo-foot dd-acties">
          <button v-if="account.kan.verwijderen" type="button" class="dd-act dd-act--gevaar" data-test="verwijder" @click="emit('verwijder')"><Icoon naam="Trash2" class="dd-act-icoon" />Verwijderen</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="emit('sluit')">Sluiten</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
