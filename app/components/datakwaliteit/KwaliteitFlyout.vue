<script setup lang="ts">
// Datakwaliteit: de prospects, contacten, taken of afspraken achter één controle, in een flyout.
// Per regel naam, account (of plaats), wat er ontbreekt en een klik naar de accountkaart of het
// contact. Zijn er meer dan de eerste 50, dan laadt de flyout de rest (hooguit 500). Met een passend
// filter staat "Toon in lijst" in de voet. Op de telefoon een schuifvenster.
import type { KwaliteitRij } from '~~/shared/datakwaliteit'

const props = defineProps<{ categorie: any | null }>()
const emit = defineEmits<{ sluit: [] }>()
const regels = ref<KwaliteitRij[]>([])
const meer = ref(0)
const laden = ref(false)
const fout = ref('')
const zoek = ref('')
const getal = (n: number) => n.toLocaleString('nl-NL')
const EENHEID: Record<string, string> = { prospects: 'prospects', onbeheerd: 'prospects', accounts: 'accounts', contacten: 'contacten', contactenMetMail: 'contacten met een e-mailadres', taken: 'open taken', afspraken: 'afgelopen afspraken' }

watch(() => props.categorie, async (c) => {
  zoek.value = ''; fout.value = ''
  if (!c) { regels.value = []; return }
  regels.value = c.voorbeelden ?? []
  meer.value = c.meer ?? 0
  if (!c.meer) return
  laden.value = true
  try {
    const r = await $fetch<any>('/api/data-kwaliteit', { query: { categorie: c.sleutel } })
    if (props.categorie?.sleutel !== c.sleutel) return
    regels.value = r.regels; meer.value = r.meer
  } catch (e) { fout.value = foutTekst(e) } finally { laden.value = false }
}, { immediate: true })

const zichtbaar = computed(() => {
  const q = zoek.value.trim().toLowerCase()
  if (!q) return regels.value
  return regels.value.filter((r) => [r.naam, r.account, r.plaats, r.ontbreekt].some((x) => x?.toLowerCase().includes(q)))
})
</script>

<template>
  <FlyoutShell v-if="categorie" open titel-id="dkf-titel" breedte="smal" paneel-klasse="dkf" :sluit-test="'dk-flyout-sluit'" data-test="dk-flyout" :data-categorie="categorie.sleutel" @sluit="emit('sluit')">
      <template #kop>
            <span class="fo-kicker">Datakwaliteit · {{ categorie.groep }}</span>
            <h2 id="dkf-titel" class="fo-titel">{{ categorie.titel }}</h2></template>
        <div class="fo-body">
          <p class="dkf-uitleg">{{ categorie.uitleg }}</p>
          <p class="dkf-telling" data-test="dk-flyout-telling">
            <strong class="tnum">{{ getal(categorie.aantal) }}</strong><template v-if="categorie.noemer"> van de {{ getal(categorie.noemer) }} {{ EENHEID[categorie.basis] ?? 'regels' }}</template>.
            {{ categorie.aantal ? 'Klik op een regel om het op te lossen.' : '' }}
          </p>
          <LegeStaat v-if="!categorie.aantal" titel="Alles in orde." tekst="Bij deze controle ontbreekt niets." />
          <template v-else>
            <label v-if="regels.length > 8" class="dkf-zoek">
              <span class="sr-only">Zoek in deze lijst</span>
              <Icoon naam="Search" :grootte="16" />
              <input v-model="zoek" class="invoer" type="search" placeholder="Zoek op naam, account of plaats" data-test="dk-flyout-zoek">
            </label>
            <p v-if="fout" class="veld-fout" role="alert">{{ fout }}</p>
            <ul class="dkf-lijst" data-test="dk-flyout-lijst">
              <li v-for="r in zichtbaar" :key="r.id">
                <NuxtLink :to="r.link" class="dkf-rij" data-test="dk-flyout-rij">
                  <span class="dkf-rij-tekst">
                    <span class="dkf-naam">{{ r.naam }}</span>
                    <span v-if="r.account || r.plaats" class="dkf-sub">
                      <Icoon :naam="r.account ? 'Building2' : 'MapPin'" :grootte="12" />{{ r.account ?? r.plaats }}
                    </span>
                    <span class="dkf-ontbreekt" data-test="dk-ontbreekt"><span class="dkf-ontbreekt-label">Ontbreekt</span>{{ r.ontbreekt }}</span>
                  </span>
                  <Icoon naam="ArrowRight" :grootte="16" class="dkf-pijl" />
                </NuxtLink>
              </li>
            </ul>
            <p v-if="zoek && !zichtbaar.length" class="meta">Niets gevonden voor "{{ zoek }}".</p>
            <p v-if="laden" class="meta">De rest laden...</p>
            <p v-else-if="meer" class="meta dkf-meer" data-test="dk-flyout-meer">En nog {{ getal(meer) }}. Los eerst deze op<template v-if="categorie.link">, of open de hele lijst</template>.</p>
          </template>
        </div>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <NuxtLink v-if="categorie.link" :to="categorie.link" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="dk-filter"><Icoon naam="Filter" :grootte="16" />Toon in lijst</NuxtLink>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>

<style scoped>
.dkf-uitleg { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.dkf-telling { margin: 12px 0 16px; font-size: 14px; }
.dkf-zoek { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--muted); }
.dkf-zoek .invoer { flex: 1; min-width: 0; }
.dkf-lijst { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--border); }
.dkf-rij { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 4px; border-bottom: 1px solid var(--border); color: inherit; text-decoration: none; }
.dkf-rij:hover, .dkf-rij:focus-visible { background: var(--surface); }
.dkf-rij:hover .dkf-naam { text-decoration: underline; }
.dkf-rij-tekst { display: flex; flex: 1; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; min-width: 0; }
.dkf-naam { flex: 1 1 100%; min-width: 0; overflow: hidden; font-size: 14px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.dkf-sub { display: inline-flex; align-items: center; gap: 4px; min-width: 0; color: var(--muted); font-size: 12px; }
.dkf-ontbreekt { display: flex; flex: 1 1 100%; align-items: baseline; gap: 6px; min-width: 0; color: var(--red); font-size: 12px; font-weight: 600; }
.dkf-ontbreekt-label { color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.dkf-pijl { flex: 0 0 auto; color: var(--muted); }
.dkf-meer { padding: 12px 0 0; }
</style>
