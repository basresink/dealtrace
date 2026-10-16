<script setup lang="ts">
// Info-venster van de accountkaart in de opzet van DealDrive (InfoFlyout): kop "Bedrijfsgegevens" met naam,
// branche en plaats; blokken Adres, Bereik en Stamgegevens met per veld inline bewerken (potlood, en
// "+ Voeg ... toe" als het leeg is). Eigen velden staan onder hun eigen kopje, of onder een vast kopje met
// dezelfde naam. Daarna Extra bronnen (eigen webadressen die de agents volgen), en voor Expert de score en
// de herkomst. Verwijderen staat onderaan de inhoud. Elke wijziging bewaart zichzelf.
import { SCORE_DELEN } from '~/utils/accountWeergave'
const props = defineProps<{ open: boolean; account: any }>()
const emit = defineEmits<{ sluit: []; gewijzigd: []; verwijder: [] }>()
const toast = useToast()
const { me } = useMe()
const meer = ref(false)
const beginner = computed(() => me.value?.gebruiker.niveau === 'beginner' && !me.value?.organisatie?.iedereenAlles)
const beheerder = computed(() => me.value?.gebruiker.rol === 'beheerder')
const status = ref('')
async function bewaar(patch: Record<string, unknown>) {
  status.value = 'Opslaan…'
  try { await $fetch(`/api/accounts/${props.account.id}`, { method: 'PUT', body: patch }); status.value = 'Opgeslagen'; emit('gewijzigd') } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
}
const veld = (k: string) => (v: string) => bewaar({ [k]: v || null })
function bewaarNaam(v: string) { if (v.trim()) bewaar({ naam: v.trim() }) }
async function bewaarBronnen(bronnen: { label: string; url: string }[]) {
  status.value = 'Opslaan…'
  try { await $fetch(`/api/accounts/${props.account.id}/extra-bronnen`, { method: 'PUT', body: { bronnen } }); status.value = 'Opgeslagen'; emit('gewijzigd') } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
}

// Eigen velden: onder een vast kopje als de sectie zo heet, anders per eigen sectie.
const VAST = ['Adres', 'Bereik', 'Stamgegevens']
const normSectie = (s: string | null | undefined) => (s ?? '').trim().replace(/^Stam-gegevens$/i, 'Stamgegevens')
const eigenVoor = (titel: string) => (props.account?.eigenVelden ?? []).filter((v: any) => normSectie(v.sectie) === titel)
const eigenGroepen = computed(() => {
  const m = new Map<string, any[]>()
  for (const v of props.account?.eigenVelden ?? []) {
    const s = normSectie(v.sectie)
    if (VAST.includes(s)) continue
    const t = s || 'Eigen velden'
    ;(m.get(t) ?? m.set(t, []).get(t)!).push(v)
  }
  return [...m.entries()]
})
const veldUit = (v: any) => v.bewerkbaarDoor === 'beheerder' && !beheerder.value
function bewaarCf(sleutel: string, w: unknown) { bewaar({ customFields: { [sleutel]: w === '' ? null : w } }) }

// Account-ID kopiëren, handig bij support en bij verwijzen naar een account.
const gekopieerd = ref(false)
async function kopieer() {
  try { await navigator.clipboard.writeText(props.account.id); gekopieerd.value = true; setTimeout(() => { gekopieerd.value = false }, 2000) } catch { /* klembord geblokkeerd: het id staat leesbaar in beeld */ }
}
const klasseOpties = computed(() => [{ waarde: '', label: 'Geen klasse' }, ...(props.account?.klassen ?? []).map((k: any) => ({ waarde: k.id, label: k.naam }))])
const eigenaarOpties = computed(() => [{ waarde: '', label: 'Niemand' }, ...(props.account?.gebruikers ?? []).map((u: any) => ({ waarde: u.id, label: u.naam }))])
const ondertitel = computed(() => [props.account?.officieleNaam && props.account.officieleNaam !== props.account.naam ? props.account.officieleNaam : null, props.account?.branche, props.account?.plaats].filter(Boolean).join(' · '))
</script>

<template>
  <Teleport to="body">
    <div v-if="open && account" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-labelledby="if-titel" data-test="info-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">Bedrijfsgegevens</span>
            <h2 id="if-titel" class="fo-titel">{{ account.naam }}</h2>
            <p v-if="ondertitel" class="fo-meta">{{ ondertitel }}</p>
            <p class="fo-meta if-status" aria-live="polite">{{ status }}</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body if-body">
          <section class="if-sectie" data-test="if-adres">
            <h3 class="if-sectie-titel">Adres</h3>
            <BewerkVeld label="Adres" :waarde="account.adres" test="if-adres-veld" @bewaar="veld('adres')($event)" />
            <BewerkVeld label="Postcode" :waarde="account.postcode" @bewaar="veld('postcode')($event)" />
            <BewerkVeld label="Plaats" :waarde="account.plaats" test="if-plaats" @bewaar="veld('plaats')($event)" />
            <BewerkVeld label="Land" :waarde="account.land" leeg="+ Voeg land toe (bv. NL)" @bewaar="veld('land')($event)" />
            <EigenVeldRegel v-for="v in eigenVoor('Adres')" :key="v.sleutel" :veld="v" :waarde="account.customFields?.[v.sleutel]" :uit="veldUit(v)" @bewaar="bewaarCf(v.sleutel, $event)" />
          </section>

          <section class="if-sectie" data-test="if-bereik">
            <h3 class="if-sectie-titel">Bereik</h3>
            <BewerkVeld label="Telefoon" :waarde="account.telefoon" type="tel" @bewaar="veld('telefoon')($event)" />
            <BewerkVeld label="Website" :waarde="account.website" type="url" leeg="+ Voeg website toe" test="if-website" @bewaar="veld('website')($event)" />
            <BewerkVeld label="Logo" :waarde="account.logoUrl" type="url" leeg="+ Eigen logo-URL (anders automatisch)" test="if-logo" @bewaar="veld('logoUrl')($event)">
              <template #na>
                <button v-if="!account.logoUrl && (account.website || account.domein)" type="button" class="if-logo-knop" :aria-pressed="!account.logoUit" data-test="if-logo-uit" @click="bewaar({ logoUit: !account.logoUit })">{{ account.logoUit ? 'Automatisch logo aanzetten' : 'Geen logo tonen' }}</button>
              </template>
            </BewerkVeld>
            <BewerkVeld label="LinkedIn" :waarde="account.linkedin" type="url" leeg="+ Voeg LinkedIn-pagina toe" @bewaar="veld('linkedin')($event)" />
            <BewerkVeld label="Instagram" :waarde="account.instagram" type="url" leeg="+ Voeg Instagram-profiel toe" @bewaar="veld('instagram')($event)" />
            <BewerkVeld label="Facebook" :waarde="account.facebook" type="url" leeg="+ Voeg Facebook-pagina toe" @bewaar="veld('facebook')($event)" />
            <EigenVeldRegel v-for="v in eigenVoor('Bereik')" :key="v.sleutel" :veld="v" :waarde="account.customFields?.[v.sleutel]" :uit="veldUit(v)" @bewaar="bewaarCf(v.sleutel, $event)" />
          </section>

          <section class="if-sectie" data-test="if-stam">
            <h3 class="if-sectie-titel">Stamgegevens</h3>
            <div class="if-vast">
              <span class="if-vast-label">Account-ID</span>
              <div class="if-vast-waarde">
                <code class="if-code" data-test="if-account-id">{{ account.id }}</code>
                <button type="button" class="if-kopieer" :title="gekopieerd ? 'Gekopieerd' : 'Kopieer ID'" :aria-label="`Kopieer account-ID ${account.id}`" data-test="if-kopieer" @click="kopieer"><Icoon :naam="gekopieerd ? 'Check' : 'Copy'" :grootte="14" /></button>
              </div>
            </div>
            <div class="if-vast">
              <span class="if-vast-label">Accounttype</span>
              <div class="if-vast-waarde"><span>{{ account.soort === 'klant' ? 'Klant' : 'Prospect' }}</span></div>
            </div>
            <BewerkVeld label="Klasse" :waarde="account.klasse ?? ''" type="select" :opties="klasseOpties" :uit="!account.kan.klasse" leeg="+ Kies een klasse" test="if-klasse" @bewaar="bewaar({ klasse: $event || null })" />
            <BewerkVeld label="Eigenaar" :waarde="account.eigenaar?.id ?? ''" type="select" :opties="eigenaarOpties" :uit="!account.kan.eigenaar" test="eigenaar" @bewaar="bewaar({ eigenaarId: $event || null })" />
            <BewerkVeld label="Bedrijfsnaam" :waarde="account.naam" test="if-naam" @bewaar="bewaarNaam" />
            <template v-if="!beginner || meer">
              <BewerkVeld label="Officiële naam" :waarde="account.officieleNaam" @bewaar="veld('officieleNaam')($event)" />
              <BewerkVeld label="KvK" :waarde="account.kvk" leeg="+ Voeg KvK-nummer toe" @bewaar="veld('kvk')($event)" />
              <BewerkVeld label="Branche" :waarde="account.branche" @bewaar="veld('branche')($event)" />
              <EigenVeldRegel v-for="v in eigenVoor('Stamgegevens')" :key="v.sleutel" :veld="v" :waarde="account.customFields?.[v.sleutel]" :uit="veldUit(v)" @bewaar="bewaarCf(v.sleutel, $event)" />
            </template>
          </section>

          <template v-if="!beginner || meer">
            <section v-for="[sectie, velden] in eigenGroepen" :key="sectie" class="if-sectie" data-test="eigen-velden-sectie">
              <h3 class="if-sectie-titel">{{ sectie }}</h3>
              <EigenVeldRegel v-for="v in velden" :key="v.sleutel" :veld="v" :waarde="account.customFields?.[v.sleutel]" :uit="veldUit(v)" @bewaar="bewaarCf(v.sleutel, $event)" />
            </section>
          </template>
          <EigenVeldVoorstel v-if="account.kan.voorstellen && (!beginner || meer)" class="if-voorstel" />

          <section class="if-sectie" data-test="if-extra-bronnen">
            <h3 class="if-sectie-titel">Extra bronnen</h3>
            <ExtraBronnen :bronnen="account.extraBronnen ?? []" uitleg="Eigen webadressen met meer over deze prospect, zoals een nieuwspagina, vacatures of een interview. De agents volgen ze als bron." @bewaar="bewaarBronnen" />
          </section>

          <template v-if="!beginner || meer">
            <section v-if="account.scoreOpbouw" class="if-sectie" data-test="scoreopbouw">
              <h3 class="if-sectie-titel">Score {{ account.score }}</h3>
              <ul class="if-lijst"><li v-for="(o, k) in account.scoreOpbouw" :key="k">{{ SCORE_DELEN[k] }}: {{ o.punten }}/{{ o.max }} · {{ o.uitleg }}</li></ul>
            </section>
            <section v-if="Object.keys(account.herkomst ?? {}).length" class="if-sectie">
              <h3 class="if-sectie-titel">Herkomst</h3>
              <ul class="if-lijst"><li v-for="(h, k) in account.herkomst" :key="k">{{ k }}: {{ h.bron }} · {{ h.op?.slice(0, 10) }}</li></ul>
            </section>
          </template>
          <button v-else type="button" class="dd-act if-meer" data-test="if-meer" @click="meer = true">Meer gegevens</button>

          <!-- Verwijderen onderaan de inhoud, niet in een vaste voet: bij het bewerken hoort geen rode knop in beeld. -->
          <div v-if="account.kan.verwijderen" class="if-verwijder-vak">
            <button type="button" class="dd-act dd-act--gevaar" data-test="verwijder" @click="emit('verwijder')"><Icoon naam="Trash2" class="dd-act-icoon" />Verwijder account</button>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.if-status:empty { display: none; }
.if-body { display: flex; flex-direction: column; gap: 16px; }
.if-sectie { padding: 4px 16px 8px; background: var(--wit); border: 1px solid var(--border); }
.if-sectie-titel { margin: 12px 0 4px; padding-bottom: 6px; border-bottom: 1px solid var(--border); font-family: var(--font-serif); font-size: 14px; font-weight: 700; color: var(--ink); }
.if-vast { display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 12px; align-items: center; padding: 6px 0; }
.if-vast-label { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.if-vast-waarde { display: flex; align-items: center; gap: 8px; min-height: 32px; min-width: 0; font-size: 14px; color: var(--ink); }
.if-code { padding: 3px 8px; overflow-wrap: anywhere; font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; color: var(--ink-soft); background: var(--bg); border: 1px solid var(--border); border-radius: 2px; }
.if-kopieer { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; padding: 0; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--muted); cursor: pointer; }
.if-kopieer:hover { border-color: var(--border-strong); color: var(--ink); }
.if-logo-knop { flex-shrink: 0; padding: 0; border: 0; background: none; font: inherit; font-size: 12px; color: var(--muted); text-decoration: underline; cursor: pointer; }
.if-logo-knop:hover { color: var(--ink); }
.if-lijst { margin: 4px 0 8px; padding-left: 18px; font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.if-meer { align-self: flex-start; }
.if-verwijder-vak { padding-top: 4px; }
@media (max-width: 767px) {
  .if-vast { grid-template-columns: 1fr; gap: 2px; }
  .if-kopieer, .if-logo-knop { min-width: 44px; min-height: 44px; }
}
</style>
