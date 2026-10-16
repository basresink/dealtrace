<script setup lang="ts">
// Het dagritme per mail: drie schakelaars met een tijdstip (Weekreview op vrijdag, Weekstart op maandag,
// Dagstart elke werkdag). Opslag in persoonlijke_instellingen.data.dagritmeMail via de sync-wachtrij,
// net als de kanalen per soort. "Stuur een voorbeeld" mailt hem nu naar je eigen adres. De verzender
// (POST /api/motor/dagritme-mail, elk kwartier) houdt rekening met stille uren, rijmodus en belblok.
import { controleerMailTijd, DAGRITME_MAIL_DAG, DAGRITME_MAIL_LABEL, DAGRITME_MAIL_UITLEG, DAGRITME_MAILS, mailVoorkeuren, type DagritmeMail } from '~~/shared/dagritmeMail'
const { voegToe } = useSyncQueue()
const { functie } = useMe()
const toast = useToast()
const aan = computed(() => !!functie('dagritme.mail')?.beschikbaar)
const FUNCTIE: Record<DagritmeMail, string> = { weekreview: 'dagritme.weekreview', weekstart: 'dagritme.weekstart', dagstart: 'dagritme.dagstart' }
const soorten = computed(() => DAGRITME_MAILS.filter((s) => functie(FUNCTIE[s])?.beschikbaar))
const { data: pers } = await useFetch<{ id: string; data: Record<string, any>; versie: number }>('/api/mij/instellingen', { key: 'dagritme-mail' })
const vk = computed(() => mailVoorkeuren(pers.value?.data.dagritmeMail))
const TIJDEN = Array.from({ length: 57 }, (_, i) => { const m = 6 * 60 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })
async function bewaar(s: DagritmeMail, patch: Partial<{ aan: boolean; tijd: string }>) {
  if (!pers.value) return
  if (patch.tijd) { const f = controleerMailTijd(patch.tijd); if (f) { toast.toon(f, 'fout'); return } }
  const nieuw = { ...vk.value, [s]: { ...vk.value[s], ...patch } }
  pers.value = { ...pers.value, data: { ...pers.value.data, dagritmeMail: nieuw } }
  await voegToe({ tabel: 'persoonlijke_instellingen', op: 'patch', recordId: pers.value.id, patch: { dagritmeMail: nieuw } })
}
const bezig = ref<string | null>(null)
async function voorbeeld(s: DagritmeMail) {
  bezig.value = s
  try { const r = await $fetch<any>('/api/mij/dagritme-mail/voorbeeld', { method: 'POST', body: { soort: s } }); toast.toon(`Voorbeeld verstuurd naar ${r.aan}: ${r.onderwerp}`) } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = null }
}
</script>

<template>
  <section v-if="aan && soorten.length" class="dm" data-test="dagritme-mail">
    <header class="dm-kop">
      <h2 class="dm-titel">Je ritme per mail</h2>
      <p class="dm-uitleg">Krijg je weekreview, weekstart of dagstart in je mailbox, op het tijdstip dat jij kiest. Valt dat in je stille uren, dan komt hij erna.</p>
    </header>
    <div v-if="pers" class="dm-rijen">
      <div v-for="s in soorten" :key="s" class="dm-rij" :data-test="`dagritme-mail-${s}`">
        <div class="dm-soort"><span class="dm-naam">{{ DAGRITME_MAIL_LABEL[s] }} <span class="dm-dag">({{ DAGRITME_MAIL_DAG[s].toLowerCase() }})</span></span><span class="dm-soort-uitleg">{{ DAGRITME_MAIL_UITLEG[s] }}</span></div>
        <label class="dm-tijd"><span class="sr-only">Tijdstip voor {{ DAGRITME_MAIL_LABEL[s] }}</span>
          <select :disabled="!vk[s].aan" :data-test="`dagritme-mail-${s}-tijd`" @change="bewaar(s, { tijd: ($event.target as HTMLSelectElement).value })">
            <option v-for="t in TIJDEN" :key="t" :value="t" :selected="t === vk[s].tijd">{{ t }}</option>
          </select>
        </label>
        <Schakelaar :aan="vk[s].aan" :label="DAGRITME_MAIL_LABEL[s]" :data-test="`dagritme-mail-${s}-aan`" @wissel="bewaar(s, { aan: $event })" />
        <button type="button" class="dd-act dm-voorbeeld" :disabled="bezig === s" :data-test="`dagritme-mail-${s}-voorbeeld`" @click="voorbeeld(s)"><Icoon naam="Mail" />Stuur een voorbeeld</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dm { padding: 20px 22px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); }
.dm-kop { margin-bottom: 10px; }
.dm-titel { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0 0 4px; }
.dm-uitleg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); max-width: 64ch; }
.dm-rij { display: grid; grid-template-columns: minmax(0, 1fr) 96px auto auto; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--border); }
.dm-soort { display: flex; flex-direction: column; min-width: 0; }
.dm-naam { font-size: 14px; font-weight: 600; }
.dm-dag { font-weight: 400; color: var(--muted); }
.dm-soort-uitleg { font-size: 12px; color: var(--muted); line-height: 1.45; }
.dm-tijd select { width: 100%; min-height: 44px; padding: 0 8px; border: 1px solid var(--border-strong); background: var(--wit); font: inherit; font-size: 14px; color: var(--ink); }
.dm-tijd select:disabled { color: var(--muted); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 719px) {
  .dm { padding: 16px; }
  .dm-rij { grid-template-columns: minmax(0, 1fr) auto; }
  .dm-soort { grid-column: 1 / -1; }
  .dm-voorbeeld { grid-column: 1 / -1; justify-self: start; min-height: 44px; }
}
</style>
