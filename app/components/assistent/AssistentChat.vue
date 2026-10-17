<script setup lang="ts">
// De AI-assistent (F26): flyout van 480 px rechts op de laptop, schuifvenster op de telefoon.
// Kop met de contextchip en de creditstand, voorstellen bij een lege chat, antwoorden met
// bronchips en acties die alleen een concept of een link zijn. "De assistent voert niets uit."
const { open, context, voorvraag } = useAssistent()
const toast = useToast()
const tekst = ref('')
const chatId = ref<string | null>(null)
const berichten = ref<any[]>([])
const bezig = ref(false)
const kosten = ref<{ kosten: number; vraag: string } | null>(null)
const credits = ref<any>(null)
const nieuweTaak = ref<any>(null)
const online = ref(true)
const invoer = ref<HTMLTextAreaElement | null>(null)
const lijst = ref<HTMLElement | null>(null)

async function laadCredits() { try { credits.value = await ($fetch as any)('/api/assistent/credits') } catch { credits.value = null } }
watch(open, (o) => {
  if (!o) return
  online.value = navigator.onLine
  laadCredits()
  if (voorvraag.value) { tekst.value = voorvraag.value; voorvraag.value = '' }
  nextTick(() => invoer.value?.focus())
})
watch(() => context.value?.accountId, () => { chatId.value = null; berichten.value = [] })
const VOORSTELLEN = computed(() => context.value?.voorstellen?.length ? context.value.voorstellen : context.value?.accountId
  ? ['Hoe begin ik dit gesprek?', 'Welke bezwaren kan ik verwachten?', 'Wat weten we al over dit account?']
  : context.value?.label === 'Helpcenter' ? ['Hoe werkt een belblok?', 'Hoe rond ik een taak af?', 'Wat is een terugkomregel?']
    : ['Wat staat er vandaag voor mij klaar?', 'Hoe werkt een belblok?', 'Welke bezwaren kan ik verwachten?'])

async function stuur(vraag = tekst.value, akkoordKosten = false) {
  const t = vraag.trim()
  if (!t || bezig.value) return
  if (!navigator.onLine) { online.value = false; return }
  bezig.value = true
  if (!akkoordKosten) { berichten.value.push({ id: `v-${Date.now()}`, rol: 'gebruiker', tekst: t }); tekst.value = '' }
  kosten.value = null
  try {
    const r = await ($fetch as any)('/api/assistent/vraag', { method: 'POST', body: { chatId: chatId.value, tekst: t, context: context.value ? { route: context.value.route, accountId: context.value.accountId } : null, akkoordKosten } })
    chatId.value = r.chatId
    berichten.value.push(r.bericht)
    credits.value = { ...(credits.value ?? {}), over: r.credits.over, pot: r.credits.pot, eigen: r.credits.eigen }
  } catch (e: any) {
    if (e?.statusCode === 409 && e?.data?.data?.kostenBevestigen) kosten.value = { kosten: e.data.data.kosten, vraag: t }
    else if (e?.statusCode === 402) { credits.value = { ...(credits.value ?? {}), geblokt: foutTekst(e) }; berichten.value.push({ id: `f-${Date.now()}`, rol: 'assistent', tekst: foutTekst(e), bronnen: [], acties: [] }) }
    else toast.toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
    nextTick(() => lijst.value?.scrollTo({ top: lijst.value.scrollHeight, behavior: 'smooth' }))
  }
}
function actie(a: any) {
  if (a.soort === 'artikel') navigateTo(`/helpcenter/${a.slug}`)
  else if (a.soort === 'account') { navigateTo(`/accounts/${a.accountId}`); open.value = false }
  else if (a.soort === 'taak') nieuweTaak.value = { accountId: a.accountId, titel: a.titel, actiesoort: a.actiesoort, aanleiding: a.aanleiding }
  else if (a.soort === 'mailconcept') { navigator.clipboard?.writeText(`${a.onderwerp}\n\n${a.tekst}`); toast.toon('Mailconcept gekopieerd. Er is niets verstuurd.') }
}
function bronLink(b: any) { return b.soort === 'help' && b.ref ? `/helpcenter/${b.ref}` : b.soort === 'verhaal' ? '/richting' : null }
const blok = computed(() => credits.value?.geblokt as string | null)
function sluit() { open.value = false }
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay fo-overlay--licht ai-overlay" @click.self="sluit">
      <section class="fo-panel fo-panel--hulp ai-chat" role="dialog" aria-modal="true" aria-label="AI-assistent" data-test="ai-chat">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">AI-assistent</span>
            <div class="ai-kop-regel">
              <span v-if="context" class="chip" data-test="ai-context">{{ context.accountId ? 'Bij: ' : 'Scherm: ' }}{{ context.label }}<button type="button" class="chip-weg" aria-label="Context weghalen" data-test="ai-context-weg" @click="context = null">×</button></span>
              <span v-if="credits" class="meta tnum" data-test="ai-credits">{{ credits.over }} credits over deze maand</span>
            </div>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="sluit"><Icoon naam="X" /></button>
        </header>
        <div ref="lijst" class="fo-body ai-berichten">
          <div v-if="!berichten.length" class="ai-voorstellen" data-test="ai-voorstellen">
            <button v-for="v in VOORSTELLEN" :key="v" type="button" class="dd-act ai-voorstel" @click="stuur(v)">{{ v }}</button>
          </div>
          <div v-for="b in berichten" :key="b.id" class="ai-bericht" :class="`ai-bericht--${b.rol}`" :data-test="`ai-${b.rol}`">
            <p class="ai-tekst">{{ b.tekst }}</p>
            <div v-if="b.bronnen?.length" class="ai-bronnen">
              <template v-for="(x, i) in b.bronnen" :key="i"><FunctieLink v-if="bronLink(x)" :to="bronLink(x)!" class="chip ai-bron" data-test="ai-bron">{{ x.label }}</FunctieLink><span v-else class="chip ai-bron" data-test="ai-bron">{{ x.label }}</span></template>
            </div>
            <div v-if="b.acties?.length" class="ai-acties">
              <button v-for="(a, i) in b.acties" :key="i" type="button" class="dd-act" :data-test="`ai-actie-${a.soort}`" @click="actie(a)">{{ a.label }}</button>
            </div>
            <p v-if="b.credits" class="meta">{{ b.credits }} {{ b.credits === 1 ? 'credit' : 'credits' }}</p>
          </div>
          <p v-if="bezig" class="meta" role="status">De assistent denkt na…</p>
          <div v-if="kosten" class="kaart kaart--geel" data-test="ai-kosten">
            <p>Dit kost ongeveer {{ kosten.kosten }} credits. Doorgaan?</p>
            <div class="mt-8"><button type="button" class="dd-act dd-act--primair" data-test="ai-doorgaan" @click="stuur(kosten.vraag, true)">Doorgaan</button> <button type="button" class="dd-act" @click="kosten = null">Annuleren</button></div>
          </div>
        </div>
        <footer class="fo-foot ai-invoer">
          <p v-if="!online" class="meta" data-test="ai-offline">Je bent offline. De AI-assistent werkt alleen met verbinding.</p>
          <p v-else-if="blok" class="meta tekst-rood" data-test="ai-geblokt">{{ blok }}</p>
          <form class="ai-form" @submit.prevent="stuur()">
            <textarea ref="invoer" v-model="tekst" class="invoer" rows="2" :disabled="!online || !!blok" placeholder="Stel je vraag" data-test="ai-invoer" @keydown.enter.exact.prevent="stuur()" />
            <button type="submit" class="dd-act dd-act--primair" :disabled="!tekst.trim() || bezig || !online || !!blok" data-test="ai-verstuur">Verstuur</button>
          </form>
          <p class="meta">De assistent voert niets uit. Jij beslist.</p>
        </footer>
      </section>
    </div>
    <NieuweTaakFlyout v-if="nieuweTaak" :open="!!nieuweTaak" bovenop :voorgevuld="nieuweTaak" @sluit="nieuweTaak = null" @gemaakt="nieuweTaak = null; toast.toon('Taak opgeslagen.')" />
  </Teleport>
</template>

<style scoped>
/* De assistent opent ook vanuit een flyout (Vraag AI) en ligt dan boven die flyout. */
.ai-overlay { z-index: calc(var(--z-modal-boven) + 1); }
</style>
