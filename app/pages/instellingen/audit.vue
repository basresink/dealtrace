<script setup lang="ts">
// Audit en toegang leverancier (F23, spiegel voor de beheerder): het eigen auditlog met filters, paging
// en CSV (AuditLijst, dezelfde lijst als /audit), ook wat de leverancier deed (soort "Wat Dealtrace deed");
// de stand "Altijd" of "Alleen na toestemming" en verzoeken.
const { me, functie } = useMe()
if (!functie('instellingen.audit')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const toast = useToast()
const { data: toegang, refresh: herlaadToegang } = await useFetch<any>('/api/instellingen/toegang-leverancier')
const doorLeverancier = computed(() => !!me.value?.werkIn)
async function zetStand(stand: string) {
  try { await $fetch('/api/instellingen/toegang-leverancier', { method: 'PUT', body: { stand } }); await herlaadToegang(); await refreshNuxtData() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function besluit(id: string, b: 'goedkeuren' | 'afwijzen') {
  try { await $fetch(`/api/instellingen/toegangsverzoeken/${id}`, { method: 'POST', body: { besluit: b } }); toast.toon(b === 'goedkeuren' ? 'Toegang goedgekeurd (24 uur).' : 'Toegang afgewezen.'); await herlaadToegang(); await refreshNuxtData() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const tijd = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t))
const open = computed(() => (toegang.value?.verzoeken ?? []).filter((v: any) => v.status === 'open' && !v.verlopen))
useHead({ title: 'Audit · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <InstellingenKop groep="Organisatie" titel="Audit en toegang leverancier" :uitleg="`Wie wat wijzigde, ook Dealtrace, en wanneer Dealtrace mag meekijken. ${toegang?.stand === 'altijd' ? 'Dealtrace mag altijd meekijken voor support.' : 'Dealtrace kijkt alleen mee na jouw toestemming.'}`" helpartikel="als-dealtrace-meekijkt" />
    <section class="section">
      <div class="container">
        <article class="kaart" data-test="toegang-leverancier">
          <header class="kaart-kop"><h2 class="kaart-titel">Toegang leverancier</h2></header>
          <p class="kaart-meta">Dealtrace kijkt alleen mee voor support, met een reden. Je krijgt bij elke start een melding.</p>
          <div class="keuzegroep mt-16" role="group" aria-label="Toegang leverancier">
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': toegang?.stand === 'altijd' }" :disabled="doorLeverancier" @click="zetStand('altijd')">Altijd</button>
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': toegang?.stand === 'na_toestemming' }" :disabled="doorLeverancier" data-test="na-toestemming" @click="zetStand('na_toestemming')">Alleen na toestemming</button>
          </div>
          <ul v-if="open.length" class="schakel-lijst mt-16">
            <li v-for="v in open" :key="v.id" class="schakel-rij" data-test="toegangsverzoek">
              <div><span class="schakel-naam">{{ v.founderNaam }} vraagt toegang</span><span class="veld-uitleg">{{ v.reden }} · {{ v.modus === 'meekijken' ? 'alleen meekijken' : 'ook wijzigen' }} · {{ tijd(v.aangevraagdOp) }}</span></div>
              <div class="dd-acties"><button type="button" class="dd-act dd-act--primair" :disabled="doorLeverancier" @click="besluit(v.id, 'goedkeuren')">Goedkeuren</button><button type="button" class="dd-act" :disabled="doorLeverancier" @click="besluit(v.id, 'afwijzen')">Afwijzen</button></div>
            </li>
          </ul>
        </article>
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <AuditLijst bron="/api/instellingen/audit" />
      </div>
    </section>
  </div>
</template>
