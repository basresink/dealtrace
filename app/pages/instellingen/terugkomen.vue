<script setup lang="ts">
// Instellingen, Terugkomen: wanneer een verloren prospect terugkomt en wat de accountmanager dan doet, op één
// scherm. Bovenaan "Zo werkt het" in drie stappen; tabbladen Regels, Verliesredenen, Afkoeling en
// Hercontactritme (in de URL als ?tab=). Regels en ritmes: salesmanager en beheerder; redenen en afkoeling:
// alleen de beheerder (de server dwingt dat ook af). Komen de regels uit SalesDNA, dan vul je hier alleen het
// ritme, wie het oppakt en de afkoeling aan.
const { functie } = useMe()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const aan = computed(() => ['verkoopverhaal.inrichten', 'verkoopverhaal.mappings', 'instellingen.afkoeling', 'ritme.beheer'].some((f) => !!functie(f)?.beschikbaar))
const { data, refresh, error } = await useFetch<any>('/api/instellingen/terugkomen', { immediate: aan.value })
const TABS = [{ k: 'regels', t: 'Regels' }, { k: 'redenen', t: 'Verliesredenen' }, { k: 'afkoeling', t: 'Afkoeling' }, { k: 'ritme', t: 'Hercontactritme' }] as const
const tab = computed(() => TABS.find((t) => t.k === route.query.tab)?.k ?? 'regels')
function kiesTab(k: string) { router.replace({ query: { ...route.query, tab: k === 'regels' ? undefined : k } }) }

async function startset() {
  try { await $fetch('/api/instellingen/verkoopverhaal/startset', { method: 'POST' }); toast.toon('De startset staat klaar als concept. Bevestig de regels om ze te laten gelden.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function bevestigRegels() {
  try { const r: any = await $fetch('/api/instellingen/verkoopverhaal/terugkomregels/bevestig', { method: 'POST' }); toast.toon(`Terugkomregels bevestigd als versie ${r.versie}.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const concept = computed(() => !!data.value && data.value.bron === 'eigen' && data.value.regels.length > 0 && (data.value.status !== 'bevestigd' || data.value.regels.some((r: any) => !r.actief)))
useHead({ title: 'Terugkomen · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="verkoopverhaal.inrichten" />
    <template v-else>
      <InstellingenKop groep="Verkoop" titel="Terugkomregels en ritme" uitleg="Hier leg je vast wanneer een verloren prospect terugkomt en wat de accountmanager dan doet. De regel bepaalt de wachttijd, het kanaal, wie het oppakt en de aanpak. Het ritme bepaalt de stappen na de terugkomdatum." helpartikel="wanneer-we-iemand-terugbellen">
        <template #acties>
          <FunctieLink to="/planning?tab=terugkom" class="dd-actie dd-actie--secundair" data-test="tk-naar-planning">Bekijk wie terugkomt<Icoon naam="ArrowRight" class="dd-actie-icoon" /></FunctieLink>
        </template>
      </InstellingenKop>
      <section class="section section--laatste">
        <div class="container">
          <nav class="tabbalk tabbalk--schuif" aria-label="Onderdelen van terugkomen">
            <button v-for="t in TABS" :key="t.k" type="button" class="tab" :class="{ 'tab--actief': tab === t.k }" :aria-current="tab === t.k ? 'page' : undefined" :data-test="`tk-tab-${t.k}`" @click="kiesTab(t.k)">{{ t.t }}</button>
          </nav>

          <ol class="tk-stappen mt-16" aria-label="Zo werkt het">
            <li class="tk-stap"><strong>Een prospect gaat verloren</strong><p class="meta">De accountmanager zet nee met een reden, of DealDrive meldt een verloren deal. De reden wijst naar één regel.</p></li>
            <li class="tk-stap"><strong>De regel kiest de datum</strong><p class="meta">Verloren op dag X plus de wachttijd van de regel. Valt dat binnen de afkoeling van het kanaal, dan schuift de datum naar het einde van de afkoeling.</p></li>
            <li class="tk-stap"><strong>Het ritme neemt het over</strong><p class="meta">Op de terugkomdatum komt de prospect terug in de reis en in Vandaag. Daarna volgen de stappen van het hercontactritme van de regel.</p></li>
          </ol>

          <p v-if="error" class="waarschuwing mt-16">{{ foutTekst(error) }}</p>
          <template v-else-if="data">
            <p v-if="data.bron === 'salesdna'" class="kaart tk-melding mt-16" data-test="tk-spiegel"><Icoon naam="Info" :grootte="16" /><span>De terugkomregels komen uit SalesDNA (versie {{ data.versie }}). Reden, termijn, kanaal en aanpak wijzig je daar. Hier vul je het ritme, wie het oppakt, de verliesredenen en de afkoeling aan.</span></p>
            <p v-else-if="concept" class="kaart tk-melding mt-16" data-test="tk-concept"><Icoon naam="Info" :grootte="16" /><span>Een deel van de regels staat nog als concept en geldt nog niet. Bewaar een regel of bevestig ze allemaal.</span><button v-if="data.kan.regels" type="button" class="dd-act" data-test="tk-bevestig" @click="bevestigRegels">Bevestig de regels</button></p>

            <div class="mt-16">
              <TerugkomRegels v-if="tab === 'regels'" :data="data" @bewaard="refresh" @startset="startset" />
              <TerugkomRedenen v-else-if="tab === 'redenen'" :data="data" @bewaard="refresh" />
              <TerugkomAfkoeling v-else-if="tab === 'afkoeling'" :data="data" @bewaard="refresh" />
              <TerugkomRitme v-else :data="data" @bewaard="refresh" />
            </div>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.tk-stappen { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; counter-reset: stap; }
@media (max-width: 899px) { .tk-stappen { grid-template-columns: minmax(0, 1fr); } }
.tk-stap { position: relative; padding: 14px 16px 14px 52px; border: 1px solid var(--border); background: var(--wit); counter-increment: stap; }
.tk-stap::before { content: counter(stap); position: absolute; left: 14px; top: 14px; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; background: var(--ink); color: var(--yellow); font-weight: 700; font-size: 13px; }
.tk-stap p { margin: 4px 0 0; }
.tk-melding { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 16px; margin-bottom: 0; background: var(--surface); }
.tk-melding span { flex: 1 1 260px; }
</style>
