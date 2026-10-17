<script setup lang="ts">
// Gebruiker wijzigen (pakket B): naam, e-mail en, voor een salesmanager, of hij een eigen portefeuille heeft.
// Rol, niveau, werkplek en team staan in de tabel; het AI-plafond op Verbruik.
import { ROL_LABEL, type Rol } from '~~/shared/types'

interface Gebruiker { id: string; naam: string; email: string; rol: Rol; status: string; eigenPortefeuille: boolean | null }
const props = defineProps<{ gebruiker: Gebruiker | null }>()
const emit = defineEmits<{ sluit: []; opgeslagen: [] }>()
const toast = useToast()

const vorm = reactive({ naam: '', email: '', eigenPortefeuille: false })
const fout = ref('')
const bezig = ref(false)
watch(() => props.gebruiker, (g) => {
  fout.value = ''
  if (g) Object.assign(vorm, { naam: g.naam, email: g.email, eigenPortefeuille: g.eigenPortefeuille === true })
}, { immediate: true })

async function bewaar() {
  const g = props.gebruiker
  if (!g || bezig.value) return
  fout.value = ''
  const body: Record<string, unknown> = {}
  if (vorm.naam.trim() !== g.naam) body.naam = vorm.naam
  if (vorm.email.trim().toLowerCase() !== g.email) body.email = vorm.email
  if (g.rol === 'salesmanager' && vorm.eigenPortefeuille !== (g.eigenPortefeuille === true)) body.eigenPortefeuille = vorm.eigenPortefeuille
  if (!Object.keys(body).length) { emit('sluit'); return }
  bezig.value = true
  try {
    await $fetch(`/api/gebruikers/${g.id}`, { method: 'PUT', body })
    toast.toon(`${vorm.naam.trim()} is bijgewerkt.`)
    emit('opgeslagen')
  } catch (e: any) { fout.value = e?.data?.statusMessage ?? 'Opslaan mislukt' } finally { bezig.value = false }
}
</script>

<template>
  <FlyoutShell :open="!!gebruiker" breedte="smal" kicker="Gebruiker wijzigen" :titel="gebruiker?.naam ?? ''" :meta="gebruiker ? ROL_LABEL[gebruiker.rol] : null" data-test="gebruiker-flyout" @sluit="emit('sluit')" @bewaar="bewaar">
    <form id="gf-form" class="fs-form" @submit.prevent="bewaar">
      <div class="fo-body fo-body--formulier">
        <article class="fo-blok">
          <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="vorm.naam" class="invoer" required data-test="gf-naam"></label>
          <label class="veld mt-16"><span class="veld-label">E-mail <span class="veld-verplicht">*</span></span><input v-model="vorm.email" class="invoer" type="email" required data-test="gf-email"></label>
          <p class="veld-uitleg mt-8">Met dit adres logt {{ gebruiker?.naam }} in. Na een wijziging gaat de inlogcode naar het nieuwe adres.</p>
        </article>
        <article v-if="gebruiker?.rol === 'salesmanager'" class="fo-blok">
          <div class="gf-schakel">
            <span><strong>Eigen portefeuille</strong><br><small class="veld-uitleg">Aan: deze salesmanager werkt ook zelf prospects en krijgt de werkbalk van een accountmanager. Uit: alleen sturen.</small></span>
            <Schakelaar :aan="vorm.eigenPortefeuille" label="Eigen portefeuille" data-test="gf-portefeuille" @wissel="(a) => (vorm.eigenPortefeuille = a)" />
          </div>
        </article>
        <article class="fo-blok">
          <p class="veld-uitleg">AI-plafond en dagplafond per gebruiker stel je in bij Verbruik.</p>
          <FunctieLink to="/instellingen/verbruik" class="dd-act mt-8">Naar AI-verbruik</FunctieLink>
        </article>
        <p v-if="fout" class="gf-fout" role="alert" data-test="gf-fout">{{ fout }}</p>
      </div>
    </form>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="submit" form="gf-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig" data-test="gf-bewaar"><Icoon naam="Check" :grootte="16" />Bewaren</button>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.gf-schakel { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.gf-fout { margin: 0; color: var(--red); font-size: 13px; font-weight: 600; }
.fo-blok .dd-act { display: inline-flex; align-items: center; min-height: var(--touch-target-min); }
</style>
