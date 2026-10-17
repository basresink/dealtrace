<script setup lang="ts">
// Kanalen en consent (P26, F16 punt 6, F22, 7.2, 15.2; beheerder, Expert): per kanaal de afkoelperiode na een
// nee en aan of uit, het frequentieplafond, de mailvoorwaarden (SPF, DKIM, DMARC, afmeldlink,
// onderdrukkingslijst), WhatsApp Business (koppeling, test, opt-in-tekst, sjablonen) en de bel-me-niet-lijst.
// Op de telefoon "Beter op een groot scherm".
import { controleerSjabloon } from '~~/shared/kanalen'
import { KANAAL_LABEL, type Kanaal } from '~~/shared/nbStatus'
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.kanalen')?.beschikbaar)
const waMag = computed(() => !!functie('koppeling.whatsapp')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/instellingen/kanalen', { immediate: aan.value, default: () => null })
const zoek = ref('')
const { data: lijst, refresh: herlaadLijst } = await useFetch<any[]>('/api/instellingen/bel-me-niet', { query: { zoek }, immediate: aan.value, default: () => [] })

const afk = reactive<Record<string, number>>({})
const uit = ref<string[]>([])
const fp = reactive({ werkdagen: 3, maxBerichten: 1 })
watch(data, (d) => { if (!d) return; for (const k of d.kanalen) afk[k.kanaal] = k.afkoeling; uit.value = d.kanalen.filter((k: any) => !k.aan).map((k: any) => k.kanaal); Object.assign(fp, d.frequentieplafond) }, { immediate: true })
async function bewaar() {
  try { const r: any = await $fetch('/api/instellingen/kanalen', { method: 'PUT', body: { frequentieplafond: { ...fp }, uit: uit.value } }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const wissel = (k: Kanaal, w: boolean) => { uit.value = w ? uit.value.filter((x) => x !== k) : [...uit.value, k] }

// WhatsApp
const wa = reactive({ modus: 'mock', telefoonId: '', wabaId: '', token: '', optInTekst: '' })
watch(data, (d) => { if (d?.whatsapp) { wa.modus = d.whatsapp.modus ?? 'mock'; wa.optInTekst = d.whatsapp.optInTekst ?? '' } }, { immediate: true })
const webhook = ref<{ url: string; geheim: string | null } | null>(null)
async function koppelWa() {
  try { const r: any = await $fetch('/api/whatsapp/koppeling', { method: 'PUT', body: { ...wa, token: wa.token || undefined } }); toast.toon(r.tekst); webhook.value = r.webhook; wa.token = ''; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function ontkoppelWa() { try { const r: any = await $fetch('/api/whatsapp/koppeling', { method: 'PUT', body: { uit: true } }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function testWa() { try { const r: any = await $fetch('/api/whatsapp/test', { method: 'POST' }); toast.toon(r.tekst, r.ok ? 'succes' : 'fout') } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const sj = reactive({ naam: '', taal: 'nl', tekst: '' })
async function bewaarSjabloon() {
  const f = controleerSjabloon(sj)
  if (f.length) { toast.toon(f[0]!, 'fout'); return }
  try { const r: any = await $fetch('/api/whatsapp/sjablonen', { method: 'POST', body: sj }); toast.toon(r.tekst); Object.assign(sj, { naam: '', tekst: '' }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function dienIn(id: string) { try { const r: any = await $fetch(`/api/whatsapp/sjablonen/${id}/indienen`, { method: 'POST' }); toast.toon(r.tekst, r.status === 'afgewezen' ? 'fout' : 'succes'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const SJ_STATUS: Record<string, string> = { concept: 'Concept', ingediend: 'Ingediend', goedgekeurd: 'Goedgekeurd', afgewezen: 'Afgewezen' }

// Bel-me-niet
const nieuw = reactive({ nummer: '', reden: '' })
async function voegToe() {
  try { const r: any = await $fetch('/api/instellingen/bel-me-niet', { method: 'POST', body: nieuw }); toast.toon(r.tekst); Object.assign(nieuw, { nummer: '', reden: '' }); await Promise.all([herlaadLijst(), refresh()]) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const weg = ref<any | null>(null)
async function verwijder(reden: string) {
  try { const r: any = await $fetch('/api/instellingen/bel-me-niet', { method: 'DELETE', body: { nummer: weg.value.nummer, reden } }); toast.toon(r.tekst); weg.value = null; await Promise.all([herlaadLijst(), refresh()]) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const datum = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
useHead({ title: 'Kanalen en consent · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.kanalen" />
    <template v-else-if="data">
      <PaginaKop kicker="Data en AI" titel="Kanalen en consent" uitleg="Hoe lang een nee geldt, hoe vaak je iemand benadert en wie nooit gebeld wil worden. De Bewaker houdt zich hieraan." helpartikel="kanalen-en-consent" />
      <section class="section section--laatste">
        <div class="container stapel">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <article class="kaart" data-test="kanalen-tabel">
            <h2 class="kaart-titel">Per kanaal</h2>
            <table class="tabel tabel--kaarten"><thead><tr><th>Kanaal</th><th>Afkoelperiode na een nee</th><th>Aan</th></tr></thead>
              <tbody><tr v-for="k in data.kanalen" :key="k.kanaal"><td data-label="Kanaal">{{ KANAAL_LABEL[k.kanaal as Kanaal] }}</td>
                <td data-label="Afkoelperiode"><input v-model.number="afk[k.kanaal]" type="number" min="0" max="730" class="invoer kn-afk" disabled :aria-label="`Afkoelperiode ${KANAAL_LABEL[k.kanaal as Kanaal]} in dagen`" :data-test="`afk-${k.kanaal}`"> dagen</td>
                <td data-label="Aan"><Schakelaar :aan="!uit.includes(k.kanaal)" :label="`${KANAAL_LABEL[k.kanaal as Kanaal]} aan`" @wissel="wissel(k.kanaal, $event)" /></td></tr></tbody></table>
            <p class="kaart-meta mt-8" data-test="afkoeling-lezen">De afkoeling pas je aan op <FunctieLink to="/instellingen/terugkomen?tab=afkoeling" class="tekst-link">Instellingen, Terugkomen</FunctieLink>; daar zie je ook wat er verschuift.</p>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Frequentieplafond: hooguit</span><input v-model.number="fp.maxBerichten" type="number" min="1" max="5" class="invoer"><span class="veld-uitleg">bericht per kanaal</span></label>
              <label class="veld"><span class="veld-label">per</span><input v-model.number="fp.werkdagen" type="number" min="1" max="10" class="invoer" data-test="fp-werkdagen"><span class="veld-uitleg">werkdagen, buiten het ritme</span></label>
            </div>
            <button type="button" class="dd-act dd-act--primair mt-16" data-test="kanalen-bewaar" @click="bewaar">Bewaar</button>
          </article>

          <article class="kaart" data-test="kanalen-mail">
            <h2 class="kaart-titel">Mail</h2>
            <ul class="schakel-lijst">
              <li class="schakel-rij"><span>Afzender</span><span class="meta">{{ data.mail.status === 'actief' ? data.mail.van : 'Nog geen mailkoppeling' }}</span></li>
              <li class="schakel-rij"><span>SPF, DKIM en DMARC</span><span class="pil" :class="data.mail.status === 'actief' ? 'pil--groen' : 'pil--grijs'">{{ data.mail.status === 'actief' ? (data.mail.modus === 'mock' ? 'Testmailbox' : 'Gecontroleerd bij de test') : 'Voorwaarde, nog niet gecontroleerd' }}</span></li>
              <li class="schakel-rij"><span>Afmeldlink in elke eerste mail</span><span class="pil pil--groen">Aan</span></li>
              <li class="schakel-rij"><span>Onderdrukkingslijst (gehasht)</span><span class="meta tnum">{{ data.mail.onderdrukt }} {{ data.mail.onderdrukt === 1 ? 'adres' : 'adressen' }}</span></li>
            </ul>
            <FunctieLink to="/instellingen/mail" class="dd-act mt-8">Mail koppelen</FunctieLink>
          </article>

          <article v-if="waMag" class="kaart" data-test="kanalen-whatsapp">
            <h2 class="kaart-titel">WhatsApp Business</h2>
            <p class="kaart-meta">{{ data.whatsapp.status === 'actief' ? `Gekoppeld${data.whatsapp.modus === 'mock' ? ' (test: er gaat niets naar buiten)' : ''}.` : 'Nog niet gekoppeld. WhatsApp-concepten open je dan in WhatsApp.' }} Alleen uit goedgekeurde sjablonen, alleen met opt-in.</p>
            <div class="formulier-raster mt-8">
              <label class="veld"><span class="veld-label">Provider</span><select v-model="wa.modus" class="invoer"><option value="mock">Test (geen echte berichten)</option><option value="meta">Meta Cloud API</option></select></label>
              <template v-if="wa.modus === 'meta'">
                <label class="veld"><span class="veld-label">Telefoonnummer-id</span><input v-model="wa.telefoonId" class="invoer" autocomplete="off"></label>
                <label class="veld"><span class="veld-label">WABA-id</span><input v-model="wa.wabaId" class="invoer" autocomplete="off"></label>
                <label class="veld"><span class="veld-label">Token</span><input v-model="wa.token" type="password" class="invoer" autocomplete="new-password" :placeholder="data.whatsapp.status === 'actief' ? 'Bewaard; laat leeg om te houden' : ''"></label>
              </template>
              <label class="veld veld--breed"><span class="veld-label">Opt-in-tekst</span><textarea v-model="wa.optInTekst" class="invoer" rows="2" /></label>
            </div>
            <div class="dd-acties mt-8">
              <button type="button" class="dd-act dd-act--primair" data-test="wa-koppel" @click="koppelWa">{{ data.whatsapp.status === 'actief' ? 'Bewaar' : 'Koppel' }}</button>
              <button v-if="data.whatsapp.status === 'actief'" type="button" class="dd-act" data-test="wa-test" @click="testWa">Test verbinding</button>
              <button v-if="data.whatsapp.status === 'actief'" type="button" class="dd-act" @click="ontkoppelWa">Ontkoppel</button>
            </div>
            <p v-if="webhook" class="kaart kaart--geel mt-8" data-test="wa-webhook">Webhook voor de provider: <code>{{ webhook.url }}</code><template v-if="webhook.geheim"><br>Geheim (alleen nu zichtbaar): <code>{{ webhook.geheim }}</code></template></p>
            <template v-if="data.whatsapp.status === 'actief'">
              <h3 class="fo-blok-titel mt-16">Sjablonen</h3>
              <ul class="schakel-lijst" data-test="wa-sjablonen">
                <li v-for="s in data.whatsapp.sjablonen" :key="s.id" class="schakel-rij"><div><span class="schakel-naam">{{ s.naam }} · {{ s.taal }}</span><span class="veld-uitleg">{{ s.tekst }}</span><span v-if="s.reden" class="veld-uitleg">{{ s.reden }}</span></div>
                  <span class="dd-acties"><span class="pil" :class="{ 'pil--groen': s.status === 'goedgekeurd', 'pil--rood': s.status === 'afgewezen' }">{{ SJ_STATUS[s.status] }}</span><button v-if="s.status === 'concept' || s.status === 'afgewezen'" type="button" class="dd-act" :data-test="`wa-indienen-${s.naam}`" @click="dienIn(s.id)">Dien in</button></span></li>
              </ul>
              <p v-if="!data.whatsapp.sjablonen.length" class="kaart-meta">Nog geen sjablonen. Zonder goedgekeurd sjabloon gaat er niets via de koppeling.</p>
              <div class="formulier-raster mt-8">
                <label class="veld"><span class="veld-label">Naam</span><input v-model="sj.naam" class="invoer" placeholder="eerste_contact" data-test="wa-sj-naam"></label>
                <label class="veld"><span class="veld-label">Taal</span><select v-model="sj.taal" class="invoer"><option value="nl">Nederlands</option><option value="en">Engels</option></select></label>
                <label class="veld veld--breed"><span class="veld-label">Tekst (hooguit 60 woorden; {{ '{' + '{1}' + '}' }} wordt de tekst van het concept)</span><textarea v-model="sj.tekst" class="invoer" rows="3" data-test="wa-sj-tekst" /></label>
              </div>
              <button type="button" class="dd-act mt-8" data-test="wa-sj-bewaar" @click="bewaarSjabloon">Sjabloon bewaren</button>
            </template>
          </article>

          <article class="kaart" data-test="kanalen-belmeniet">
            <h2 class="kaart-titel">Bel-me-niet-lijst <span class="meta tnum">{{ data.belMeNiet }} {{ data.belMeNiet === 1 ? 'nummer' : 'nummers' }}</span></h2>
            <p class="kaart-meta">Een nummer op deze lijst verdwijnt uit elke bellijst. "Bel me niet" bij een contact zet het nummer hier ook op.</p>
            <div class="formulier-raster mt-8">
              <label class="veld"><span class="veld-label">Nummer</span><input v-model="nieuw.nummer" class="invoer" inputmode="tel" placeholder="06 12345678" data-test="bmn-nummer"></label>
              <label class="veld"><span class="veld-label">Reden</span><input v-model="nieuw.reden" class="invoer" placeholder="Vroeg om niet meer gebeld te worden"></label>
            </div>
            <div class="dd-acties mt-8">
              <button type="button" class="dd-act dd-act--primair" data-test="bmn-toevoegen" @click="voegToe">Toevoegen</button>
              <a class="dd-act" href="/api/instellingen/bel-me-niet?formaat=csv" download>Exporteren</a>
            </div>
            <input v-model="zoek" type="search" class="invoer mt-16" placeholder="Zoek op nummer" aria-label="Zoek op nummer">
            <ul class="schakel-lijst mt-8">
              <li v-for="b in lijst" :key="b.nummer" class="schakel-rij"><div><span class="schakel-naam tnum">{{ b.nummer }}</span><span class="veld-uitleg">{{ b.reden ?? 'Zonder reden' }} · {{ b.door ?? 'onbekend' }} · {{ datum(b.op) }}</span></div><button type="button" class="dd-act" @click="weg = b">Verwijder</button></li>
            </ul>
          </article>
        </div>
      </section>
      <BevestigVenster :open="!!weg" titel="Van de bel-me-niet-lijst halen?" :tekst="`${weg?.nummer ?? ''} kan daarna weer gebeld worden.`" bevestig="Verwijder" met-reden gevaar @bevestigd="verwijder" @geannuleerd="weg = null" />
    </template>
  </div>
</template>

<style scoped>
.kn-afk { width: 90px; display: inline-block; }
.veld--breed { grid-column: 1 / -1; }
</style>
