<script setup lang="ts">
// Tweestapsverificatie op Account (/mij), in de opzet van SalesDNA: de stand als tag met uitleg,
// instellen in een venster in drie stappen (app, sleutel, code) en uitzetten na bevestigen.
// Voor de beheerder optioneel, voor de founder verplicht; andere rollen loggen in met alleen de code.
const props = defineProps<{ stand: { aan: boolean; verplicht: boolean; mag: boolean }; alleenLezen?: boolean }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const { laad } = useMe()
const toast = useToast()

const open = ref(false)
const uitVragen = ref(false)
const nieuw = ref<{ geheim: string; uri: string } | null>(null)
const code = ref('')
const fout = ref<string | null>(null)
const bezig = ref(false)
const melding = ref<string | null>(null)

/** Alleen cijfers, hooguit zes. */
function zetCode(el: HTMLInputElement) {
  code.value = el.value.replace(/\D/g, '').slice(0, 6)
  if (el.value !== code.value) el.value = code.value
}

async function start() {
  fout.value = null; code.value = ''; melding.value = null
  try {
    nieuw.value = await $fetch<{ geheim: string; uri: string }>('/api/mij/totp', { method: 'POST', body: { stap: 'start' } })
    open.value = true
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function bevestig() {
  fout.value = null; bezig.value = true
  try {
    await $fetch('/api/mij/totp', { method: 'POST', body: { stap: 'bevestig', code: code.value } })
    open.value = false; nieuw.value = null; code.value = ''
    melding.value = 'Tweestapsverificatie staat aan.'
    await laad(); emit('gewijzigd')
  } catch (e) { fout.value = foutTekst(e); code.value = '' } finally { bezig.value = false }
}
async function zetUit() {
  uitVragen.value = false
  try {
    await $fetch('/api/mij/totp', { method: 'POST', body: { stap: 'uit' } })
    melding.value = 'Tweestapsverificatie staat uit.'
    await laad(); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const uitleg = computed(() => {
  if (props.stand.aan) return 'Na de code uit je mail vraagt Dealtrace ook om een code uit je authenticator-app.'
  if (props.stand.verplicht) return 'Voor jouw rol is dit verplicht.'
  if (!props.stand.mag) return 'Je logt in met een code uit je mail. Een tweede stap is er voor beheerders.'
  return 'Met een code uit een app op je telefoon kan niemand inloggen met alleen toegang tot je mail.'
})
function sluit() { open.value = false }
function opToets(e: KeyboardEvent) { if (e.key === 'Escape' && open.value) sluit() }
onMounted(() => window.addEventListener('keydown', opToets))
onBeforeUnmount(() => window.removeEventListener('keydown', opToets))
// De focus naar het codeveld zodra het venster opent.
watch(open, (o) => { if (o) nextTick(() => document.getElementById('ts-code')?.focus()) })
</script>

<template>
  <section class="kaart" data-test="totp" aria-labelledby="ts-kop">
    <header class="kaart-kop"><h2 id="ts-kop" class="kaart-titel">Tweestapsverificatie</h2></header>
    <p class="ts-status">
      <span class="pil" :class="stand.aan ? 'pil--groen' : 'pil--grijs'" data-test="totp-stand">{{ stand.aan ? 'Aan' : 'Uit' }}</span>
      <span>{{ uitleg }}</span>
    </p>
    <div v-if="stand.mag && !alleenLezen" class="reis-knoppen mt-16">
      <button v-if="!stand.aan" type="button" class="dd-act dd-act--primair" data-test="totp-start" @click="start">Instellen</button>
      <button v-else-if="!stand.verplicht" type="button" class="dd-act dd-act--gevaar" data-test="totp-uit" @click="uitVragen = true">Uitzetten</button>
    </div>
    <p v-if="melding" class="ts-melding" role="status">{{ melding }}</p>

    <Teleport to="body">
      <div v-if="open && nieuw" class="cd-overlay" @click.self="sluit">
        <div class="cd-dialog ts-dialoog" role="dialog" aria-modal="true" aria-labelledby="ts-dlg" data-test="totp-venster">
          <div class="cd-head"><h2 id="ts-dlg" class="cd-title">Tweestapsverificatie instellen</h2></div>
          <ol class="ts-stappen">
            <li><strong>Installeer een authenticator-app</strong><span class="veld-uitleg">Bijvoorbeeld Microsoft Authenticator, Google Authenticator of 1Password.</span></li>
            <li>
              <strong>Voeg Dealtrace toe met deze sleutel</strong>
              <code class="totp-geheim" data-test="totp-geheim">{{ nieuw.geheim }}</code>
              <a class="tekst-link" :href="nieuw.uri">Open in je authenticator-app</a>
            </li>
            <li>
              <strong>Voer de zes cijfers uit de app in</strong>
              <form class="ts-code-rij" @submit.prevent="bevestig">
                <label class="sr-only" for="ts-code">Code uit de app</label>
                <input id="ts-code" :value="code" class="invoer ts-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" data-test="totp-code" :aria-invalid="fout ? 'true' : undefined" @input="zetCode($event.target as HTMLInputElement)">
                <button type="submit" class="dd-act dd-act--primair" :disabled="code.length !== 6 || bezig" data-test="totp-bevestig">Bevestigen</button>
              </form>
              <p v-if="fout" class="veld-fout veld-fout--regel" role="alert">{{ fout }}</p>
            </li>
          </ol>
          <div class="cd-foot"><button type="button" class="cd-btn cd-btn--ghost" @click="open = false">Annuleren</button></div>
        </div>
      </div>
    </Teleport>
    <BevestigVenster :open="uitVragen" titel="Tweestapsverificatie uitzetten?" tekst="Daarna is de code uit je mail weer genoeg om in te loggen." bevestig="Uitzetten" gevaar @geannuleerd="uitVragen = false" @bevestigd="zetUit" />
  </section>
</template>

<style scoped>
.ts-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin: 0; font-size: var(--fs-body); }
.ts-melding { margin: 12px 0 0; font-size: var(--fs-meta); font-weight: 600; color: var(--green); }
.ts-dialoog { max-width: 520px; }
.ts-stappen { display: grid; gap: 16px; margin: 8px 0 16px; padding-left: 20px; }
.ts-stappen li { display: grid; gap: 6px; }
.ts-code-rij { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ts-code { width: 140px; font-size: 18px; letter-spacing: 0.2em; text-align: center; }
</style>
