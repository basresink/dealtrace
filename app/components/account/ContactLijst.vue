<script setup lang="ts">
// Contactlijst (F04): zoeken, rol, prospects of klanten, "Van mijn accounts" (standaard aan),
// en vanaf Gevorderd zonder e-mail, zonder telefoon en geen contact in 30 of 90 dagen.
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
import { datumKort, telLink } from '~/utils/accountWeergave'
const props = defineProps<{ top?: boolean }>()
const route = useRoute()
const router = useRouter()
const q = computed(() => ({ ...route.query, ...(props.top ? { top: '1' } : {}) }))
const { data } = await useFetch<any>('/api/contacten', { query: q, default: () => ({ contacten: [], aantal: 0, kan: {} }) })
const zoek = ref(String(route.query.q ?? ''))
let t: any
watch(zoek, (v) => { clearTimeout(t); t = setTimeout(() => zet({ q: v || undefined }), 300) })
function zet(p: Record<string, string | undefined>) {
  const n: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === '') delete n[k]
  router.replace({ query: n })
}
const aan = (k: string, w = '1') => route.query[k] === w
</script>

<template>
  <div>
    <div v-if="!top" class="werkbalk">
      <input v-model="zoek" class="invoer zoekinvoer" type="search" placeholder="Zoek op naam, functie of bedrijf" aria-label="Zoeken">
      <select class="invoer invoer--klein" :value="route.query.rol ?? ''" aria-label="Rol" @change="zet({ rol: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle rollen</option><option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option></select>
      <select class="invoer invoer--klein" :value="route.query.sort ?? ''" aria-label="Sortering" @change="zet({ sort: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Rol</option><option value="laatsteContact">Laatste contact</option><option value="bedrijf">Bedrijf</option></select>
    </div>
    <div v-if="!top" class="filters mt-16">
      <div class="filter-groep">
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !aan('mijn', '0') }" data-test="van-mijn" @click="zet({ mijn: aan('mijn', '0') ? undefined : '0' })">Van mijn accounts</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': aan('soort', 'prospect') }" @click="zet({ soort: aan('soort', 'prospect') ? undefined : 'prospect' })">Bij prospects</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': aan('soort', 'klant') }" @click="zet({ soort: aan('soort', 'klant') ? undefined : 'klant' })">Bij klanten</button>
      </div>
      <div v-if="data.kan.filters" class="filter-groep">
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': aan('zonderEmail') }" @click="zet({ zonderEmail: aan('zonderEmail') ? undefined : '1' })">Zonder e-mail</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': aan('zonderTelefoon') }" @click="zet({ zonderTelefoon: aan('zonderTelefoon') ? undefined : '1' })">Zonder telefoon</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': aan('geenContact', '30') }" @click="zet({ geenContact: aan('geenContact', '30') ? undefined : '30' })">Geen contact in 30 dagen</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': aan('geenContact', '90') }" @click="zet({ geenContact: aan('geenContact', '90') ? undefined : '90' })">Geen contact in 90 dagen</button>
      </div>
    </div>
    <p class="meta mt-16">{{ data.aantal }} contactpersonen</p>
    <LegeStaat v-if="!data.contacten.length" titel="Niets gevonden." :tekst="top ? 'Beslissers en beïnvloeders van je eigen accounts verschijnen hier.' : 'Pas de filters aan.'" />
    <div v-else class="tabel-wrap mt-16">
      <table class="tabel tabel--kaarten" data-test="contacten-tabel">
        <thead><tr><th>Naam</th><th>Rol</th><th>Bedrijf</th><th>Telefoon</th><th>Laatste contact</th></tr></thead>
        <tbody>
          <tr v-for="c in data.contacten" :key="c.id" :class="{ 'contact-vertrokken': c.status === 'vertrokken' }">
            <td><NuxtLink :to="`/contacten/${c.id}`"><strong>{{ c.naam }}</strong></NuxtLink><br><span class="meta">{{ c.functie }}</span></td>
            <td>{{ CONTACTROL_LABEL[c.rol as keyof typeof CONTACTROL_LABEL] }}</td>
            <td><NuxtLink :to="`/accounts/${c.accountId}`">{{ c.bedrijf }}</NuxtLink></td>
            <td><a v-if="(c.mobiel || c.telefoon) && !c.belMeNiet" :href="telLink(c.mobiel ?? c.telefoon)">{{ c.mobiel ?? c.telefoon }}</a><span v-else-if="c.belMeNiet" class="meta">Bel me niet</span></td>
            <td>{{ datumKort(c.laatsteContactOp) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
