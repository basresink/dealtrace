<script setup lang="ts">
// Eén accountplan (opzet van DealDrive /accountplannen/[id]): kop met kruimel, status, account, geldigheid,
// eigenaar, titel en de voortgang van het actieplan; rechts Markeer als afgerond (of Heropenen) en Verwijderen.
// Daaronder de kerngegevens, de beslissers, de zes blokken met elk een potlood, en het actieplan: een actie
// toevoegen maakt een echte taak op het account (met datum en contact), zichtbaar op de accountkaart, op
// Vandaag en bij Acties.
import { ACCOUNTPLAN_SECTIES, ACTIEPLAN_UITLEG, WEERGAVE_LABEL, dagKort, geldigheidLabel, type AccountplanSectie } from '~~/shared/accountplannen'
import { nlMoment } from '~~/shared/datum'
const route = useRoute()
const { functie } = useMe()
const aan = !!functie('nav.accountplannen')?.beschikbaar
const toast = useToast()
const id = computed(() => String(route.params.id))
const { data: p, refresh, error } = await useFetch<any>(() => `/api/accountplannen/${id.value}`, { immediate: aan })
const kan = computed(() => !!p.value?.kan.bewerken)
const pilKlas = (w: string) => ({ actueel: 'pil--geel', verlopen: 'pil--rood', afgerond: 'pil--zwart' } as Record<string, string>)[w]
const dag = (iso: string | null) => (iso ? dagKort(nlMoment(new Date(iso)).datum) : 'geen datum')
const vandaag = nlMoment(new Date()).datum
const telaat = (a: any) => !a.klaar && a.dueDate && nlMoment(new Date(a.dueDate)).datum < vandaag
useHead({ title: computed(() => `${p.value?.titel ?? 'Accountplan'} · Dealtrace`) })

async function zet(body: Record<string, unknown>, tekst?: string) {
  try { await $fetch(`/api/accountplannen/${id.value}`, { method: 'PUT', body }); if (tekst) toast.toon(tekst); await refresh(); return true } catch (e) { toast.toon(foutTekst(e), 'fout'); return false }
}

// Kerngegevens
const kernOpen = ref(false)
const kern = reactive({ titel: '', geldigVan: '', geldigTot: '' })
function startKern() { Object.assign(kern, { titel: p.value.titel, geldigVan: p.value.geldigVan ?? '', geldigTot: p.value.geldigTot ?? '' }); kernOpen.value = true }
async function bewaarKern() { if (await zet({ titel: kern.titel, geldigVan: kern.geldigVan || null, geldigTot: kern.geldigTot || null }, 'Kerngegevens bewaard.')) kernOpen.value = false }

// Blokken: één potlood tegelijk.
const open = ref<AccountplanSectie | null>(null)
const tekst = ref('')
function startBlok(s: AccountplanSectie) { open.value = s; tekst.value = p.value.secties[s] ?? '' }
async function bewaarBlok() { if (open.value && await zet({ secties: { [open.value]: tekst.value } }, 'Bewaard.')) open.value = null }

// Beslissers
const teKiezen = ref('')
const keuzes = computed(() => (p.value?.contacten ?? []).filter((c: any) => !c.vertrokken && !p.value.beslissers.some((b: any) => b.id === c.id)))
async function zetBeslissers(ids: string[]) { await zet({ contactIds: ids }); teKiezen.value = '' }

// Actieplan
const nieuw = reactive({ titel: '', datum: '', contactId: '' })
const toevoegen = ref(false)
async function voegToe() {
  toevoegen.value = true
  try {
    await $fetch(`/api/accountplannen/${id.value}/acties`, { method: 'POST', body: { titel: nieuw.titel, datum: nieuw.datum || null, contactId: nieuw.contactId || null } })
    toast.toon('Actie toegevoegd. Hij staat als taak op het account.')
    Object.assign(nieuw, { titel: '', datum: '', contactId: '' })
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { toevoegen.value = false }
}
async function zetActie(a: any, klaar: boolean) {
  try { await $fetch(`/api/accountplannen/${id.value}/acties/${a.id}`, { method: 'PUT', body: { klaar } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout'); await refresh() }
}
const weg = ref<any>(null)
async function haalWeg() {
  const a = weg.value; weg.value = null
  try { await $fetch(`/api/accountplannen/${id.value}/acties/${a.id}`, { method: 'DELETE' }); toast.toon('Actie uit het plan gehaald; de taak is geannuleerd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Afronden en verwijderen
const verwijderOpen = ref(false)
async function verwijder() {
  verwijderOpen.value = false
  try { await $fetch(`/api/accountplannen/${id.value}`, { method: 'DELETE' }); toast.toon('Accountplan verwijderd. De acties staan nog als taak op het account.'); await navigateTo('/accountplannen') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.accountplannen" />
    <section v-else-if="error || !p" class="section">
      <div class="container container--smal">
        <span class="kicker kicker--streep">Onbekend accountplan</span>
        <h1 class="title title--groot">Dit accountplan bestaat niet (meer).</h1>
        <p class="subtitle">Misschien is het verwijderd.</p>
        <NuxtLink to="/accountplannen" class="dd-actie dd-actie--secundair mt-16">Terug naar alle accountplannen</NuxtLink>
      </div>
    </section>
    <template v-else>
      <header class="apd-kop">
        <div class="container">
          <div class="apd-kop-binnen">
            <div class="apd-kop-info">
              <NuxtLink to="/accountplannen" class="apd-kruimel" data-test="apd-terug"><Icoon naam="ArrowLeft" :grootte="12" /> Alle accountplannen</NuxtLink>
              <p class="apd-eyebrow">
                <span class="pil" :class="pilKlas(p.weergave)" data-test="apd-status">{{ WEERGAVE_LABEL[p.weergave as 'actueel'].toUpperCase() }}</span>
                <span v-if="p.account" class="pil" :class="p.account.soort === 'klant' ? 'pil--blauw' : 'pil--paars'">{{ p.account.soort === 'klant' ? 'KLANT' : 'PROSPECT' }}</span>
                <NuxtLink v-if="p.account" :to="`/accounts/${p.account.id}`" class="apd-account" data-test="apd-account">{{ p.account.naam }}</NuxtLink>
                <span class="tnum">{{ geldigheidLabel(p) }}</span>
                <span>{{ p.eigenaar?.naam ?? 'Niet toegewezen' }}</span>
              </p>
              <h1 class="apd-titel" data-test="apd-titel">{{ p.titel }}</h1>
              <div class="apd-voortgang" data-test="apd-voortgang">
                <div class="apd-cijfers tnum"><span><strong>{{ p.voortgang.klaar }}</strong> van {{ p.voortgang.totaal }} acties klaar</span><span>{{ p.voortgang.percentage }}%</span></div>
                <div class="apd-balk" role="progressbar" :aria-valuenow="p.voortgang.percentage" aria-valuemin="0" aria-valuemax="100" aria-label="Voortgang van het actieplan"><div class="apd-vul" :style="{ width: `${p.voortgang.percentage}%` }" /></div>
              </div>
            </div>
            <div class="toolbar-buttons apd-knoppen" data-test="kop-knoppen">
              <KopIconen artikel="accountplannen" :ai="p.account ? { accountId: p.account.id, label: p.account.naam } : undefined" />
              <template v-if="kan">
              <a href="#actieplan" class="dd-actie dd-actie--primair" data-test="apd-naar-actie"><Icoon naam="Plus" class="dd-actie-icoon" />Actie</a>
              <button type="button" class="dd-actie dd-actie--secundair" data-test="apd-afronden" @click="zet({ status: p.status === 'afgerond' ? 'actueel' : 'afgerond' }, p.status === 'afgerond' ? 'Plan heropend.' : 'Plan afgerond.')">{{ p.status === 'afgerond' ? 'Heropenen' : 'Markeer als afgerond' }}</button>
              <button type="button" class="dd-actie dd-actie--gevaar" data-test="apd-verwijder" @click="verwijderOpen = true">Verwijderen</button>
              </template>
            </div>
          </div>
        </div>
      </header>

      <section class="section section--laatste">
        <div class="container apd-raster">
          <div class="apd-hoofd">
            <article v-for="(s, i) in ACCOUNTPLAN_SECTIES" :key="s.sleutel" class="kaart apd-blok" :data-test="`apd-blok-${s.sleutel}`">
              <header class="kaart-kop">
                <h2 class="kaart-titel"><span class="apd-nr tnum">{{ i + 1 }}</span>{{ s.titel }}</h2>
                <button v-if="kan && open !== s.sleutel" type="button" class="dd-act dd-act--icoon" :aria-label="`Bewerk ${s.titel}`" :title="`Bewerk ${s.titel}`" :data-test="`apd-bewerk-${s.sleutel}`" @click="startBlok(s.sleutel)"><Icoon naam="Pencil" :grootte="14" /></button>
              </header>
              <form v-if="open === s.sleutel" class="apd-editor" @submit.prevent="bewaarBlok">
                <textarea v-model="tekst" class="invoer apd-tekstvak" rows="7" :placeholder="s.uitleg" :aria-label="s.titel" :data-test="`apd-tekst-${s.sleutel}`" />
                <div class="dd-acties"><button type="submit" class="dd-act dd-act--geel" :data-test="`apd-bewaar-${s.sleutel}`">Opslaan</button><button type="button" class="dd-act" @click="open = null">Annuleren</button><span class="meta">Leeg opslaan wist dit blok.</span></div>
              </form>
              <template v-else>
                <p v-if="p.secties[s.sleutel]" class="apd-tekst">{{ p.secties[s.sleutel] }}</p>
                <p v-else class="apd-uitleg">{{ s.uitleg }}</p>
              </template>
            </article>

            <article id="actieplan" class="kaart apd-blok apd-actieplan" data-test="apd-actieplan">
              <header class="kaart-kop"><h2 class="kaart-titel"><span class="apd-nr tnum">7</span>Actieplan</h2><span class="apd-teller tnum">{{ p.voortgang.klaar }}/{{ p.voortgang.totaal }}</span></header>
              <p class="apd-uitleg">{{ ACTIEPLAN_UITLEG }}</p>
              <ul v-if="p.acties.length" class="apd-acties" role="list">
                <li v-for="a in p.acties" :key="a.id" class="apd-actie" :data-test="`apd-actie-${a.id}`">
                  <label class="apd-vink"><input type="checkbox" :checked="a.klaar" :disabled="!kan" :aria-label="`Markeer ${a.titel} als klaar`" data-test="apd-vink" @change="zetActie(a, ($event.target as HTMLInputElement).checked)"></label>
                  <span class="apd-actie-tekst">
                    <span class="apd-actie-titel" :class="{ 'apd-actie-titel--klaar': a.klaar }">{{ a.titel }}</span>
                    <span class="apd-actie-meta tnum"><span :class="{ 'apd-telaat': telaat(a) }">{{ dag(a.dueDate) }}</span><template v-if="a.contactNaam"> · <NuxtLink :to="`/contacten/${a.contactId}`" class="apd-link">{{ a.contactNaam }}</NuxtLink></template></span>
                  </span>
                  <button v-if="kan" type="button" class="dd-act dd-act--icoon apd-weg" :aria-label="`Verwijder actie ${a.titel}`" title="Verwijder actie" @click="weg = a"><Icoon naam="Trash2" :grootte="14" /></button>
                </li>
              </ul>
              <p v-else class="apd-uitleg apd-leeg">Nog geen acties. Een strategie zonder acties met een datum blijft een voornemen.</p>
              <form v-if="kan" class="apd-nieuw" data-test="apd-actie-nieuw" @submit.prevent="voegToe">
                <label class="veld apd-nieuw-titel"><span class="veld-label">Nieuwe actie</span><input v-model="nieuw.titel" class="invoer" maxlength="200" placeholder="Begin met een werkwoord, bijvoorbeeld Plan het jaargesprek" data-test="apd-actie-titel"></label>
                <label class="veld"><span class="veld-label">Datum</span><input v-model="nieuw.datum" type="date" class="invoer tnum" data-test="apd-actie-datum"></label>
                <label class="veld"><span class="veld-label">Contactpersoon</span>
                  <select v-model="nieuw.contactId" class="invoer" data-test="apd-actie-contact"><option value="">Geen</option><option v-for="c in p.contacten.filter((x: any) => !x.vertrokken)" :key="c.id" :value="c.id">{{ c.naam }}{{ c.functie ? ` · ${c.functie}` : '' }}</option></select>
                </label>
                <button type="submit" class="dd-act dd-act--geel apd-nieuw-knop" :disabled="toevoegen || nieuw.titel.trim().length < 3" data-test="apd-actie-toevoegen"><Icoon naam="Plus" :grootte="14" />Toevoegen</button>
              </form>
            </article>
          </div>

          <aside class="apd-zij">
            <article class="kaart apd-blok" data-test="apd-kern">
              <header class="kaart-kop"><h2 class="kaart-titel">Kerngegevens</h2>
                <button v-if="kan && !kernOpen" type="button" class="dd-act dd-act--icoon" aria-label="Bewerk kerngegevens" title="Bewerk kerngegevens" data-test="apd-bewerk-kern" @click="startKern"><Icoon naam="Pencil" :grootte="14" /></button>
              </header>
              <form v-if="kernOpen" class="apd-editor" @submit.prevent="bewaarKern">
                <label class="veld"><span class="veld-label">Titel</span><input v-model="kern.titel" class="invoer" maxlength="160" required data-test="apd-kern-titel"></label>
                <label class="veld"><span class="veld-label">Geldig van</span><input v-model="kern.geldigVan" type="date" class="invoer tnum"></label>
                <label class="veld"><span class="veld-label">Geldig tot</span><input v-model="kern.geldigTot" type="date" class="invoer tnum"></label>
                <div class="dd-acties"><button type="submit" class="dd-act dd-act--geel" data-test="apd-kern-bewaar">Opslaan</button><button type="button" class="dd-act" @click="kernOpen = false">Annuleren</button></div>
              </form>
              <dl v-else class="defs apd-defs">
                <div class="def-rij"><dt>Account</dt><dd><NuxtLink v-if="p.account" :to="`/accounts/${p.account.id}`" class="apd-link">{{ p.account.naam }}</NuxtLink></dd></div>
                <div class="def-rij"><dt>Eigenaar</dt><dd>{{ p.eigenaar?.naam ?? 'Niet toegewezen' }}</dd></div>
                <div class="def-rij"><dt>Geldigheid</dt><dd class="tnum">{{ geldigheidLabel(p) }}</dd></div>
                <div class="def-rij"><dt>Status</dt><dd>{{ WEERGAVE_LABEL[p.weergave as 'actueel'] }}</dd></div>
              </dl>
            </article>

            <article class="kaart apd-blok" data-test="apd-beslissers">
              <header class="kaart-kop"><h2 class="kaart-titel">Beslissers</h2></header>
              <p class="apd-uitleg">Wie beslist er mee, en wie heeft invloed op die beslissing?</p>
              <ul v-if="p.beslissers.length" class="apd-beslissers" role="list">
                <li v-for="b in p.beslissers" :key="b.id" class="apd-beslisser">
                  <span class="apd-actie-tekst"><NuxtLink :to="`/contacten/${b.id}`" class="apd-link">{{ b.naam }}</NuxtLink><span class="apd-actie-meta">{{ b.functie ?? 'Functie onbekend' }}</span></span>
                  <button v-if="kan" type="button" class="dd-act dd-act--icoon apd-weg" :aria-label="`Haal ${b.naam} van het plan`" @click="zetBeslissers(p.beslissers.filter((x: any) => x.id !== b.id).map((x: any) => x.id))"><Icoon naam="X" :grootte="14" /></button>
                </li>
              </ul>
              <div v-if="kan && keuzes.length" class="apd-kies">
                <select v-model="teKiezen" class="invoer" aria-label="Beslisser toevoegen" data-test="apd-beslisser-kies"><option value="">Kies een contactpersoon</option><option v-for="c in keuzes" :key="c.id" :value="c.id">{{ c.naam }}{{ c.functie ? ` · ${c.functie}` : '' }}</option></select>
                <button type="button" class="dd-act" :disabled="!teKiezen" data-test="apd-beslisser-toevoegen" @click="zetBeslissers([...p.beslissers.map((x: any) => x.id), teKiezen])">Toevoegen</button>
              </div>
            </article>
          </aside>
        </div>
      </section>

      <BevestigVenster :open="verwijderOpen" titel="Accountplan verwijderen?" :tekst="`${p.titel} verdwijnt. De acties blijven als taak op het account staan.`" bevestig="Verwijderen" gevaar @bevestigd="verwijder" @geannuleerd="verwijderOpen = false" />
      <BevestigVenster :open="!!weg" titel="Actie uit het plan halen?" :tekst="`${weg?.titel ?? ''}: de taak wordt geannuleerd.`" bevestig="Uit het plan halen" gevaar @bevestigd="haalWeg" @geannuleerd="weg = null" />
    </template>
  </div>
</template>

<style scoped>
.apd-kop { padding: 28px 0; background: var(--wit); border-bottom: 1px solid var(--border); }
.apd-kop-binnen { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
.apd-kop-info { flex: 1 1 420px; min-width: 0; }
.apd-kruimel { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; font-size: 12px; font-weight: 600; color: var(--muted); text-decoration: none; }
.apd-kruimel:hover { color: var(--ink); }
.apd-eyebrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin: 4px 0 0; font-size: 13px; color: var(--ink-soft); }
.apd-account { font-weight: 700; color: var(--ink); }
.apd-titel { margin: 10px 0 0; font-family: var(--font-serif); font-size: clamp(26px, 3.5vw, 38px); line-height: 1.15; overflow-wrap: anywhere; }
.apd-voortgang { max-width: 520px; margin-top: 14px; }
.apd-cijfers { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink-soft); }
.apd-balk { margin-top: 6px; height: 6px; background: var(--surface); }
.apd-vul { height: 100%; background: var(--green); transition: width var(--transition-base); }
.apd-knoppen { justify-content: flex-end; }
/* Vanaf 720 px twee kolommen: de knoppen rechts op de hoogte van de titel (onder kruimel en
   eyebrow); de info loopt nooit onder de knoppen door. */
@media (min-width: 720px) {
  .apd-kop-binnen { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; column-gap: var(--pagina-marge); }
  .apd-knoppen { max-width: min(620px, 52vw); margin-top: 68px; }
}
.apd-raster { display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); align-items: start; }
@media (min-width: 1024px) { .apd-raster { grid-template-columns: minmax(0, 1fr) 340px; } }
.apd-hoofd, .apd-zij { display: flex; flex-direction: column; gap: var(--kaart-gap); min-width: 0; }
.apd-nr { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-right: 8px; background: var(--ink); color: var(--yellow); font-family: var(--font-sans, inherit); font-size: 11px; font-weight: 800; vertical-align: 3px; }
.apd-tekst { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.apd-uitleg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.apd-editor { display: flex; flex-direction: column; gap: 10px; }
.apd-tekstvak { width: 100%; resize: vertical; min-height: 140px; }
.apd-teller { font-size: 12px; font-weight: 700; color: var(--muted); }
.apd-acties, .apd-beslissers { list-style: none; margin: 10px 0 0; padding: 0; }
.apd-actie, .apd-beslisser { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.apd-actie:last-child, .apd-beslisser:last-child { border-bottom: 0; }
.apd-vink { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; min-height: 36px; cursor: pointer; }
.apd-vink input { width: 18px; height: 18px; accent-color: var(--ink); }
.apd-actie-tekst { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.apd-actie-titel { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.apd-actie-titel--klaar { text-decoration: line-through; color: var(--muted); }
.apd-actie-meta { font-size: 12px; color: var(--muted); }
.apd-telaat { color: var(--red); font-weight: 700; }
.apd-link { color: var(--ink); font-weight: 600; }
.apd-leeg { margin-top: 10px; }
.apd-nieuw { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.apd-nieuw-titel { grid-column: 1 / -1; }
.apd-nieuw-knop { min-height: 40px; }
.apd-defs { margin: 0; }
.apd-kies { display: flex; gap: 8px; margin-top: 10px; }
.apd-kies .invoer { flex: 1; min-width: 0; }
@media (max-width: 719px) {
  .apd-kop { padding: 20px 0; }
  .apd-nieuw { grid-template-columns: 1fr; }
  .apd-vink, .apd-weg, .apd-kruimel, .apd-nieuw-knop { min-width: var(--touch-target-min); min-height: var(--touch-target-min); }
  .apd-knoppen { width: 100%; justify-content: flex-start; }
}
</style>
