<script setup lang="ts">
// Later of Pas datum aan (Terug in beeld): een nieuwe terugkomdatum met een reden. Een datum binnen de afkoeling
// schuift naar het einde ervan; dat staat er meteen bij. De server bewaart de historie en schrijft de audit.
import { laterDatum, laterVoorstel, type TerugRij } from '~~/shared/terugInBeeld'
import { terugDagLang } from '~~/shared/terugkomBeheer'
import { plusDagen } from '~~/shared/datum'

const props = defineProps<{ open: boolean; rij: TerugRij | null; vandaag: string; later?: boolean }>()
const emit = defineEmits<{ sluit: []; bewaard: [tekst: string] }>()
const toast = useToast()
const vorm = reactive({ datum: '', reden: '' })
const fout = ref('')
const opslag = useFlyoutOpslag()
watch(() => [props.open, props.rij?.id] as const, ([o]) => {
  if (!o || !props.rij) return
  vorm.datum = laterVoorstel(props.rij, props.vandaag)
  vorm.reden = ''
  fout.value = ''
  opslag.basis()
}, { immediate: true })
opslag.volg(() => ({ ...vorm }))
const min = computed(() => plusDagen(props.vandaag, 1))
const melding = computed(() => {
  if (!props.rij || !vorm.datum) return ''
  const l = laterDatum(vorm.datum, props.rij, props.vandaag)
  return l.geschoven ? `Valt binnen de afkoeling; wordt ${terugDagLang(l.datum)}.` : ''
})
async function bewaar() {
  if (!props.rij) return
  if (!vorm.reden.trim()) { fout.value = 'Geef een reden'; return }
  try {
    const r = await opslag.bewaar(() => $fetch<any>(`/api/terug-in-beeld/${props.rij!.id}/datum`, { method: 'PUT', body: { datum: vorm.datum, reden: vorm.reden } }))
    emit('bewaard', `${props.rij.naam} komt terug op ${terugDagLang(r.terugOp)}.${r.melding ? ` ${r.melding}` : ''}`)
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <FlyoutShell v-if="open && rij" open titel-id="tib-datum-titel" data-test="tib-datum-flyout" :opslag="opslag" :ai="false" @sluit="emit('sluit')" @bewaar="bewaar">
    <template #kop>
      <span class="fo-kicker">{{ later ? 'Later' : 'Pas datum aan' }}</span>
      <h2 id="tib-datum-titel" class="fo-titel">{{ rij.naam }}</h2>
      <p class="fo-meta">Nu: terug op {{ terugDagLang(rij.terugOp) }}.<template v-if="rij.afkoelEind && rij.afkoelEind > vandaag"> Een datum binnen de afkoeling schuift naar {{ terugDagLang(rij.afkoelEind) }}.</template></p>
    </template>
    <form id="tib-datum-form" class="fs-form" @submit.prevent="bewaar">
      <div class="fo-body">
        <label class="veld">
          <span class="veld-label">Nieuwe terugkomdatum</span>
          <input v-model="vorm.datum" class="invoer" type="date" :min="min" required data-test="tib-datum">
        </label>
        <p class="meta mt-8" aria-live="polite" data-test="tib-datum-melding">{{ melding }}</p>
        <label class="veld mt-16">
          <span class="veld-label">Reden</span>
          <input v-model="vorm.reden" class="invoer" required maxlength="300" placeholder="Bijvoorbeeld: contactpersoon is tot half november weg" data-test="tib-datum-reden" @input="fout = ''">
        </label>
        <p v-if="fout" class="veld-fout mt-8" role="alert">{{ fout }}</p>
      </div>
    </form>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="submit" form="tib-datum-form" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="tib-datum-bewaar"><Icoon naam="Check" :grootte="16" />Bewaar</button>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </FlyoutShell>
</template>
