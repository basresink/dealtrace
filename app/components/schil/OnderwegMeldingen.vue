<script setup lang="ts">
// Meldingen voor onderweg in Mijn instellingen (/mijn-instellingen, P31, 8.10): per soort aan of uit, stille uren, de
// tijd van de dagstart, push op dit toestel aan of uit; Expert ook een eigen dagplafond en stille
// uren per soort. Opgeslagen in de persoonlijke instellingen via de wachtrij (werkt offline).
import { MELDING_STANDAARD, ONDERWEG_LABEL, ONDERWEG_SOORTEN, type MeldingInstelling, type OnderwegSoort } from '~~/shared/meldingsregels'
const props = defineProps<{ pers: { id: string; data: Record<string, any> } | null }>()
const { functie } = useMe()
const { voegToe } = useSyncQueue()
const toast = useToast()
const expert = computed(() => !!functie('meldingen.perSoort')?.beschikbaar)
const rij = useRijmodus()
const i = computed<MeldingInstelling>(() => ({ ...MELDING_STANDAARD, ...(props.pers?.data.onderweg ?? {}) }))
async function zet(deel: Partial<MeldingInstelling>) {
  if (!props.pers) return
  props.pers.data = { ...props.pers.data, onderweg: { ...(props.pers.data.onderweg ?? {}), ...deel } }
  await voegToe({ tabel: 'persoonlijke_instellingen', op: 'patch', recordId: props.pers.id, patch: { onderweg: props.pers.data.onderweg } })
}
const wissel = (s: OnderwegSoort, aan: boolean) => zet({ uit: aan ? i.value.uit.filter((x) => x !== s) : [...new Set([...i.value.uit, s])] })
// Push op dit toestel.
const pushStand = ref<'onbekend' | 'aan' | 'uit' | 'niet'>('onbekend')
const iosZonderPwa = computed(() => import.meta.client && /iphone|ipad/i.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches))
onMounted(async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { pushStand.value = 'niet'; return }
  const reg = await navigator.serviceWorker.getRegistration()
  pushStand.value = (await reg?.pushManager.getSubscription()) ? 'aan' : 'uit'
})
const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))) }
async function wisselPush(aan: boolean) {
  try {
    const reg = await navigator.serviceWorker.ready
    if (!aan) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) { await $fetch('/api/push/abonneer', { method: 'DELETE', body: { endpoint: sub.endpoint } }); await sub.unsubscribe() }
      pushStand.value = 'uit'; return
    }
    const { sleutel } = await $fetch<{ sleutel: string | null }>('/api/push/sleutel')
    if (!sleutel) { toast.toon('Pushmeldingen zijn nog niet ingericht. Je ziet je meldingen in de app.', 'let-op'); return }
    if ((await Notification.requestPermission()) !== 'granted') { toast.toon('Je toestel staat meldingen niet toe. Zet ze aan in je instellingen.', 'fout'); return }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(sleutel) })
    await $fetch('/api/push/abonneer', { method: 'POST', body: sub.toJSON() })
    pushStand.value = 'aan'; toast.toon('Pushmeldingen staan aan op dit toestel.')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <article v-if="functie('meldingen.onderweg')?.beschikbaar" id="onderweg" class="kaart mi-sectie" data-test="onderweg-meldingen">
    <header class="kaart-kop"><h2 class="kaart-titel">Meldingen voor onderweg</h2></header>
    <p class="kaart-meta">Hooguit {{ i.dagplafond }} per dag. Stil van {{ String(i.stilVan).padStart(2, '0') }}:00 tot {{ String(i.stilTot).padStart(2, '0') }}:00{{ i.weekendStil ? ' en in het weekend' : '' }}.</p>
    <p v-if="rij.mag.value" class="schakel-rij"><span>Rijmodus <span class="veld-uitleg">Grote knoppen; meldingen wachten tot je stopt. Gaat ook aan na "Navigeer".</span></span><Schakelaar :aan="rij.aan.value" label="Rijmodus" data-test="rijmodus-schakelaar" @wissel="rij.zet($event)" /></p>
    <p class="schakel-rij"><span>Push op dit toestel</span><Schakelaar :aan="pushStand === 'aan'" :uit="pushStand === 'niet'" label="Push op dit toestel" @wissel="wisselPush" /></p>
    <p v-if="pushStand === 'niet' && iosZonderPwa" class="meta">Op een iPhone werken pushmeldingen alleen als je Dealtrace op je beginscherm zet (iOS 16.4 of nieuwer).</p>
    <p v-else-if="pushStand === 'niet'" class="meta">Deze browser ondersteunt geen pushmeldingen.</p>
    <ul class="schakel-lijst">
      <li v-for="s in ONDERWEG_SOORTEN" :key="s" class="schakel-rij"><span class="schakel-naam">{{ ONDERWEG_LABEL[s] }}</span><Schakelaar :aan="!i.uit.includes(s)" :label="`Melding ${ONDERWEG_LABEL[s]}`" @wissel="wissel(s, $event)" /></li>
    </ul>
    <div class="formulier-raster mt-8">
      <label class="veld"><span class="veld-label">Dagstart om</span><input type="time" class="invoer" :value="i.dagstart" data-test="dagstart-tijd" @change="zet({ dagstart: ($event.target as HTMLInputElement).value })"></label>
      <label class="veld"><span class="veld-label">Stil vanaf</span><select class="invoer" :value="i.stilVan" @change="zet({ stilVan: Number(($event.target as HTMLSelectElement).value) })"><option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option></select></label>
      <label class="veld"><span class="veld-label">Stil tot</span><select class="invoer" :value="i.stilTot" @change="zet({ stilTot: Number(($event.target as HTMLSelectElement).value) })"><option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option></select></label>
      <label v-if="expert" class="veld"><span class="veld-label">Mijn dagplafond</span><input type="number" min="0" max="20" class="invoer" :value="i.dagplafond" @change="zet({ dagplafond: Number(($event.target as HTMLInputElement).value) })"></label>
    </div>
    <p class="schakel-rij mt-8"><span>Stil in het weekend</span><Schakelaar :aan="i.weekendStil" label="Stil in het weekend" @wissel="zet({ weekendStil: $event })" /></p>
  </article>
</template>
