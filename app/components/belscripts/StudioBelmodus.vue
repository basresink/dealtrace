<script setup lang="ts">
// Belscript Studio, tabblad In de belmodus: zo staat het script tijdens het bellen. Het huidige blok
// groot, de rest ingeklapt op één regel, vragen als vinkjes, bezwaren als uitklapknoppen, de
// gesprekskaart en de uitkomstknoppen. Een bewaarde versie per prospect staat voorop. Dit is een
// voorbeeld: in een belblok leggen de knoppen de uitkomst vast, met script, versie en de
// opengeklapte bezwaren in de activiteit.
import { telLink } from '~/utils/accountWeergave'
import { UITKOMST_KNOPPEN } from '~~/shared/belblokken'
import type { ScriptStaat } from '~~/shared/belscripts'

const props = defineProps<{ accountId: string | null }>()
defineEmits<{ kies: [id: string] }>()
const toast = useToast()
const p = ref<any>(null)
const staat = ref<ScriptStaat | null>(null)
const laatste = ref<{ knop: string; script: ScriptStaat } | null>(null)
watch(() => props.accountId, async (id) => {
  p.value = null; laatste.value = null
  if (!id) return
  try { p.value = await $fetch<any>('/api/belscripts/prospect', { query: { accountId: id } }) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}, { immediate: true })
const item = computed(() => p.value?.item ?? null)
const { data: blokken } = await useFetch<any>('/api/belblokken', { default: () => ({ gepland: [] }) })
const volgend = computed(() => (blokken.value?.gepland ?? []).find((s: any) => s.open > 0 && Date.parse(s.eind) > Date.now()))
const LABEL = Object.fromEntries(UITKOMST_KNOPPEN.map((k) => [k.sleutel, k.label]))
function uitkomst(knop: string) {
  if (!staat.value) return
  laatste.value = { knop, script: JSON.parse(JSON.stringify(staat.value)) }
  toast.toon(`Voorbeeld: ${LABEL[knop]}. In een belblok gaan script, versie en opengeklapte bezwaren mee naar de activiteit.`)
}
const scriptNaam = (id: string) => p.value?.scripts.find((s: any) => s.id === id)?.naam ?? 'het script'
</script>

<template>
  <div>
    <p class="meta">Zo staat het script in de belmodus: het huidige blok groot, de rest ingeklapt op één regel, bezwaren als knoppen. Klik een blok of gebruik Volgende blok.</p>
    <LegeStaat v-if="!accountId" class="mt-16" titel="Kies eerst een prospect." tekst="In het tabblad Per prospect kies je wie je belt; hier zie je het script zoals het in de belmodus staat." />
    <p v-else-if="!p" class="meta mt-16">Laden…</p>
    <LegeStaat v-else-if="!item" class="mt-16" titel="Geen gegevens voor dit prospect." tekst="Kies een ander prospect in Per prospect." />
    <div v-else class="sb mt-12" data-test="studio-belmodus">
      <div class="sb-balk">
        <strong>Belmodus</strong><span>Voorbeeld voor {{ p.account.naam }}</span>
        <NuxtLink v-if="volgend" :to="`/belblokken/${volgend.id}`" class="dd-act sb-open" data-test="sb-open-blok"><Icoon naam="Phone" :grootte="14" />Open je belblok</NuxtLink>
        <NuxtLink v-else to="/belblokken" class="dd-act sb-open">Naar Belblokken</NuxtLink>
      </div>
      <div class="sb-raster">
        <div class="sb-script">
          <BelScript v-model:staat="staat" :scripts="p.scripts" :voorstel="item.voorstel" :waarden="item.waarden" :extra-bezwaren="item.extraBezwaren" :meldingen="item.meldingen" :account-id="item.accountId" :contact-id="item.contactId" :prospect-versie="item.prospectVersie" stappen />
        </div>
        <div class="sb-kaart" data-test="sb-gesprekskaart">
          <span class="bloklabel">Gesprekskaart</span>
          <h2 class="kop-blok mt-4"><NuxtLink :to="`/accounts/${item.accountId}`">{{ item.kaart.account.naam }}</NuxtLink></h2>
          <p class="meta">{{ [item.kaart.account.plaats, item.kaart.account.klasse ? `klasse ${item.kaart.account.klasse}` : null, item.kaart.account.fase].filter(Boolean).join(' · ') }}</p>
          <p v-if="item.kaart.contact" class="mt-12"><strong>{{ item.kaart.contact.naam }}</strong>{{ item.kaart.contact.functie ? ` · ${item.kaart.contact.functie}` : '' }}{{ item.kaart.contact.rol ? ` · ${item.kaart.contact.rol}` : '' }}</p>
          <a v-if="item.kaart.contact?.telefoon" class="dd-actie dd-actie--zwart mt-8" :href="telLink(item.kaart.contact.telefoon)"><Icoon naam="Phone" class="dd-actie-icoon" />Bel {{ item.kaart.contact.telefoon }}</a>
          <p v-if="item.kaart.account.aanleiding?.tekst" class="kaart kaart--geel mt-12 sb-aanleiding"><strong>Aanleiding:</strong> {{ item.kaart.account.aanleiding.tekst }}</p>
          <dl class="defs mt-12">
            <div class="def-rij"><dt>Leverancier</dt><dd>{{ item.waarden['concurrent.naam'] ?? 'onbekend' }}</dd></div>
            <div class="def-rij"><dt>Winpunt</dt><dd>{{ item.waarden['winpunt.naam'] ?? 'geen' }}</dd></div>
            <div class="def-rij"><dt>Branche</dt><dd>{{ item.waarden['account.branche'] ?? 'onbekend' }}</dd></div>
          </dl>
        </div>
      </div>
      <div class="sb-voet">
        <div class="uitkomstraster" role="group" aria-label="Uitkomst van het gesprek">
          <button v-for="k in UITKOMST_KNOPPEN" :key="k.sleutel" type="button" class="uitkomst" :class="{ 'uitkomst--aan': laatste?.knop === k.sleutel }" :data-test="`sb-uitkomst-${k.sleutel}`" @click="uitkomst(k.sleutel)">{{ k.label }}</button>
        </div>
        <div v-if="laatste" class="kaart kaart--vlak mt-12" data-test="sb-activiteit">
          <span class="bloklabel">Gaat mee naar de activiteit</span>
          <dl class="defs mt-8">
            <div class="def-rij"><dt>Script</dt><dd>{{ scriptNaam(laatste.script.scriptId) }}, versie {{ laatste.script.versie }}<template v-if="laatste.script.prospectVersie">, persoonlijke versie {{ laatste.script.prospectVersie }}</template></dd></div>
            <div class="def-rij"><dt>Bezwaren</dt><dd>{{ laatste.script.bezwaren.length ? laatste.script.bezwaren.map((z) => `"${z.bezwaar}"`).join(', ') : 'geen opengeklapt' }}</dd></div>
            <div class="def-rij"><dt>Vragen</dt><dd>{{ laatste.script.vragen.length }} afgevinkt</dd></div>
            <div class="def-rij"><dt>Blokken</dt><dd>{{ laatste.script.blokkenGebruikt?.length ?? 0 }} open geweest</dd></div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sb { border: 1px solid var(--ink); background: var(--bg); }
.sb-balk { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 16px; background: var(--ink); color: var(--wit); }
.sb-balk strong { color: var(--yellow); }
.sb-open { margin-left: auto; }
.sb-raster { display: grid; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 960px) { .sb-raster { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); } .sb-script { border-right: 1px solid var(--border); } }
.sb-script, .sb-kaart { padding: 16px 20px; min-width: 0; }
.sb-aanleiding { padding: 10px 12px; }
.sb-voet { padding: 12px 20px 16px; background: var(--wit); border-top: 1px solid var(--ink); }
.sb-voet .uitkomstraster { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
</style>
