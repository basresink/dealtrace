<script setup lang="ts">
// Inloggen bij Dealtrace (P27, B12): e-mailadres, een code van zes cijfers per mail en voor de
// founder (en een beheerder met tweestapsverificatie) een code uit de authenticator-app. Geen
// wachtwoorden. In de ontwikkelmodus kies je daaronder ook een fictieve testgebruiker.
import { BEVESTIG_TEKST } from '~~/shared/inloggen'
import { NIVEAU_LABEL, ROL_LABEL, WERKPLEK_LABEL, type Niveau, type Rol, type Werkplek } from '~~/shared/types'
definePageMeta({ layout: 'leeg' })
const config = useRuntimeConfig()
const ontwikkel = config.public.authModus === 'ontwikkel'
const { data: gebruikers } = ontwikkel ? await useFetch<any[]>('/api/sessie/ontwikkel-gebruikers', { default: () => [] }) : { data: ref<any[]>([]) }

const stap = ref<'email' | 'code' | 'totp'>('email')
const email = ref('')
const code = ref('')
const totp = ref('')
const fout = ref('')
const melding = ref('')
const bezig = ref(false)
const instellen = ref<{ geheim: string; uri: string } | null>(null)

async function stuurCode() {
  fout.value = ''; bezig.value = true
  try {
    const r = await $fetch<any>('/api/auth/code', { method: 'POST', body: { email: email.value } })
    melding.value = r.tekst ?? BEVESTIG_TEKST
    stap.value = 'code'; code.value = ''
    await nextTick(); document.querySelector<HTMLInputElement>('[data-test="code"]')?.focus()
  } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
async function verifieer() {
  fout.value = ''; bezig.value = true
  try {
    const r = await $fetch<any>('/api/auth/verifieer', { method: 'POST', body: { email: email.value, code: code.value } })
    if (!r.totpNodig) return await navigateTo('/', { external: true })
    stap.value = 'totp'
    if (r.totpInstellen) instellen.value = await $fetch<any>('/api/auth/totp')
  } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
async function stuurTotp() {
  fout.value = ''; bezig.value = true
  try { await $fetch('/api/auth/totp', { method: 'POST', body: { code: totp.value } }); await navigateTo('/', { external: true }) } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
watch(code, (c) => { const d = c.replace(/\D/g, '').slice(0, 6); if (d !== c) code.value = d; if (d.length === 6 && !bezig.value) verifieer() })
watch(totp, (c) => { const d = c.replace(/\D/g, '').slice(0, 6); if (d !== c) totp.value = d; if (d.length === 6 && !bezig.value) stuurTotp() })
function anderAdres() { stap.value = 'email'; code.value = ''; fout.value = ''; melding.value = '' }

async function kies(id: string) {
  await $fetch('/api/sessie/ontwikkel', { method: 'POST', body: { gebruikerId: id } })
  await navigateTo('/', { external: true })
}
useHead({ title: 'Inloggen · Dealtrace' })
</script>

<template>
  <div class="login-pagina">
    <span class="kicker kicker--streep">Dealtrace</span>
    <form v-if="stap === 'email'" class="login-stap" data-test="stap-email" @submit.prevent="stuurCode">
      <h1 class="title title--groot">Inloggen bij Dealtrace</h1>
      <label class="veld mt-16"><span class="veld-label">E-mailadres</span><input v-model="email" class="invoer" type="email" inputmode="email" autocomplete="email" required autofocus data-test="email"></label>
      <button type="submit" class="dd-act dd-act--primair mt-16" :disabled="bezig || !email.trim()" data-test="stuur-code">Stuur mij een code</button>
      <p class="veld-uitleg mt-8">Je krijgt een code van zes cijfers per mail. Hij is 10 minuten geldig.</p>
    </form>
    <form v-else-if="stap === 'code'" class="login-stap" data-test="stap-code" @submit.prevent="verifieer">
      <h1 class="title title--groot">Vul je code in</h1>
      <p class="tekst mt-8" role="status" data-test="bevestiging">{{ melding }}</p>
      <label class="veld mt-16"><span class="veld-label">Code van zes cijfers</span><input v-model="code" class="invoer code-invoer" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\d{6}" required data-test="code"></label>
      <button type="submit" class="dd-act dd-act--primair mt-16" :disabled="bezig || code.length !== 6" data-test="inloggen">Inloggen</button>
      <div class="rijtje mt-16"><button type="button" class="dd-tekstknop" :disabled="bezig" @click="stuurCode">Andere code sturen</button><button type="button" class="dd-tekstknop" @click="anderAdres">Ander e-mailadres</button></div>
    </form>
    <form v-else class="login-stap" data-test="stap-totp" @submit.prevent="stuurTotp">
      <h1 class="title title--groot">Code uit je authenticator-app</h1>
      <div v-if="instellen" class="kaart kaart--geel mt-16" data-test="totp-instellen">
        <p>Voeg Dealtrace toe aan je authenticator-app met deze sleutel en vul daarna de code in.</p>
        <p class="mt-8"><code class="totp-geheim" data-test="totp-geheim">{{ instellen.geheim }}</code></p>
        <p class="mt-8"><a :href="instellen.uri">Open in je authenticator-app</a></p>
      </div>
      <label class="veld mt-16"><span class="veld-label">Code van zes cijfers</span><input v-model="totp" class="invoer code-invoer" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required autofocus data-test="totp"></label>
      <button type="submit" class="dd-act dd-act--primair mt-16" :disabled="bezig || totp.length !== 6" data-test="totp-inloggen">Inloggen</button>
    </form>
    <p v-if="fout" class="veld-fout mt-16" role="alert" data-test="login-fout">{{ fout }}</p>

    <template v-if="ontwikkel && gebruikers?.length">
      <h2 class="kop-blok mt-48">Ontwikkelmodus: kies een testgebruiker</h2>
      <p class="meta mt-8">Alleen lokaal en in de testomgeving. Alle gebruikers zijn fictief.</p>
      <div class="login-lijst">
        <button v-for="g in gebruikers" :key="g.id" type="button" class="login-rij" :data-test="`login-${g.id}`" @click="kies(g.id)">
          <span><strong>{{ g.name }}</strong><br><span class="meta">{{ g.organisatie }}</span></span>
          <span class="meta">{{ ROL_LABEL[g.role as Rol] }}<template v-if="g.role !== 'founder'"> · {{ NIVEAU_LABEL[g.niveau as Niveau] }} · {{ WERKPLEK_LABEL[g.werkplek as Werkplek] }}</template></span>
        </button>
      </div>
    </template>
  </div>
</template>
