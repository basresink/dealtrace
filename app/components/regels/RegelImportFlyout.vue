<script setup lang="ts">
// Regels uit Excel inlezen (opzet van DealDrive): eerst lezen en laten zien, dan pas bewaren. Stap 1 kies je
// bestand (met een voorbeeldbestand), stap 2 wat er in staat (bruikbaar, overgeslagen met reden, bestaande
// regels geraakt), stap 3 Samenvoegen of Alles vervangen. Er wordt niets bewaard voordat je kiest; een rij
// met een fout wordt overgeslagen. Alleen de beheerder.
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ sluit: []; klaar: [] }>()
const toast = useToast()
const bestand = ref<File | null>(null)
const bezig = ref(false)
const fout = ref('')
const uitkomst = ref<any>(null)
const invoer = ref<HTMLInputElement | null>(null)
const vervangVraag = ref(false)
function herstel() { bestand.value = null; fout.value = ''; uitkomst.value = null; vervangVraag.value = false; if (invoer.value) invoer.value.value = '' }
watch(() => props.open, (aan) => { if (aan) herstel() })
const overgeslagen = computed(() => (uitkomst.value?.rijen ?? []).filter((r: any) => r.fouten.length))
const letOp = computed(() => (uitkomst.value?.rijen ?? []).filter((r: any) => !r.fouten.length && r.waarschuwingen.length))
const kanToepassen = computed(() => !bezig.value && (uitkomst.value?.bruikbaar ?? 0) > 0)

async function lees(ev: Event) {
  const b = (ev.target as HTMLInputElement).files?.[0]
  if (!b) return
  bestand.value = b
  fout.value = ''
  uitkomst.value = null
  bezig.value = true
  try {
    const fd = new FormData(); fd.append('bestand', b); fd.append('modus', 'samenvoegen'); fd.append('proef', '1')
    uitkomst.value = await $fetch('/api/regels/excel-import', { method: 'POST', body: fd })
  } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
async function pasToe(modus: 'samenvoegen' | 'vervangen') {
  if (!bestand.value || !kanToepassen.value) return
  vervangVraag.value = false
  bezig.value = true
  try {
    const fd = new FormData(); fd.append('bestand', bestand.value); fd.append('modus', modus)
    const r = await $fetch<any>('/api/regels/excel-import', { method: 'POST', body: fd })
    if (!r.toegepast) { fout.value = 'Er was geen bruikbare rij om te bewaren.'; return }
    toast.toon(modus === 'vervangen' ? `${r.bruikbaar} regels ingelezen; de vorige set is vervangen.` : `Import klaar: ${r.nieuw} nieuw, ${r.bijgewerkt} bijgewerkt.`)
    emit('klaar')
  } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
async function voorbeeld() {
  const r = await fetch('/api/regels/excel-voorbeeld')
  if (!r.ok) { toast.toon('Het voorbeeldbestand kon niet worden opgehaald.', 'fout'); return }
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement('a'); a.href = url; a.download = 'dealtrace-regels-voorbeeld.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}
</script>

<template>
  <FlyoutShell :open="open" titel-id="ri-titel" data-test="import-paneel" @sluit="emit('sluit')">
    <template #kop>
      <span class="fo-kicker">Regels · Importeren</span>
      <h2 id="ri-titel" class="fo-titel">Regels uit Excel inlezen</h2>
      <p class="fo-meta">Je ziet eerst wat eruit komt. Er wordt niets bewaard voordat je hieronder kiest.</p>
    </template>
    <div class="fo-body ri">
      <section class="ri-blok">
        <h3 class="ri-stap">1 · Kies je bestand</h3>
        <label class="ri-kies">
          <Icoon naam="Upload" :grootte="18" /><span>{{ bestand?.name ?? 'Bladeren…' }}</span>
          <input ref="invoer" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="ri-invoer" data-test="import-bestand" @change="lees">
        </label>
        <p class="meta">Hooguit 5 MB en 2.000 rijen. Nog geen bestand? Download het <button type="button" class="ri-link" data-test="import-voorbeeld" @click="voorbeeld">voorbeeldbestand</button>: daar staan alle kolommen in, met uitleg en keuzelijsten.</p>
      </section>
      <p v-if="bezig" class="meta" role="status">Bezig met lezen…</p>
      <p v-if="fout" class="veld-fout" role="alert">{{ fout }}</p>
      <section v-if="uitkomst" class="ri-blok" data-test="import-uitkomst">
        <h3 class="ri-stap">2 · Wat er in het bestand staat</h3>
        <div class="ri-cijfers">
          <div class="ri-cijfer"><strong class="tnum" data-test="import-bruikbaar">{{ uitkomst.bruikbaar }}</strong><span>bruikbaar</span></div>
          <div class="ri-cijfer" :class="{ 'ri-cijfer--let': uitkomst.overgeslagen }"><strong class="tnum">{{ uitkomst.overgeslagen }}</strong><span>overgeslagen</span></div>
          <div class="ri-cijfer"><strong class="tnum">{{ uitkomst.geraakt }}</strong><span>bestaande regels geraakt</span></div>
        </div>
        <div v-if="overgeslagen.length" class="ri-lijst"><h4 class="ri-lijst-kop">Overgeslagen rijen</h4>
          <ul><li v-for="r in overgeslagen" :key="r.rij"><span class="ri-rij tnum">rij {{ r.rij }}</span> {{ r.naam || 'zonder naam' }}: {{ r.fouten.join('; ') }}</li></ul>
        </div>
        <div v-if="letOp.length" class="ri-lijst ri-lijst--zacht"><h4 class="ri-lijst-kop">Let op</h4>
          <ul><li v-for="r in letOp" :key="r.rij"><span class="ri-rij tnum">rij {{ r.rij }}</span> {{ r.waarschuwingen.join('; ') }}</li></ul>
        </div>
      </section>
      <section v-if="uitkomst?.bruikbaar" class="ri-blok">
        <h3 class="ri-stap">3 · Hoe wil je ze toevoegen?</h3>
        <p class="meta"><strong>Samenvoegen</strong> laat je huidige regels staan en werkt alleen bij wat hetzelfde id heeft. <strong>Alles vervangen</strong> gooit de hele set weg en zet deze ervoor in de plaats.</p>
        <p v-if="vervangVraag" class="kaart kaart--geel" role="alert">Alle huidige regels gaan weg, ook persoonlijke en teamregels. Weet je het zeker? <button type="button" class="dd-act dd-act--gevaar mt-8" data-test="import-vervang-ja" @click="pasToe('vervangen')">Ja, alles vervangen</button></p>
      </section>
    </div>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!kanToepassen" data-test="import-samenvoegen" @click="pasToe('samenvoegen')"><Icoon naam="Merge" :grootte="16" />Samenvoegen</button>
        <button type="button" class="dd-actie dd-actie--secundair" :disabled="!kanToepassen" data-test="import-vervangen" @click="vervangVraag = true">Alles vervangen</button>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.ri { display: flex; flex-direction: column; gap: 18px; }
.ri-blok { display: flex; flex-direction: column; gap: 8px; }
.ri-stap { margin: 0; font-family: var(--font-mono); font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
.ri-kies { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 64px; border: 1px dashed var(--border-strong); background: var(--surface); font-weight: 600; cursor: pointer; }
.ri-kies:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
.ri-invoer { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.ri-link { padding: 0; background: none; border: 0; color: var(--ink); font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; min-height: 0; }
.ri-cijfers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.ri-cijfer { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--border); }
.ri-cijfer strong { font-family: var(--font-serif); font-size: 24px; }
.ri-cijfer span { font-size: 12px; color: var(--muted); }
.ri-cijfer--let { border-color: var(--orange); }
.ri-lijst ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; }
.ri-lijst-kop { margin: 0; font-size: 13px; }
.ri-lijst--zacht { color: var(--ink-soft); }
.ri-rij { font-family: var(--font-mono); font-size: 11px; }
@media (max-width: 767px) { .ri-link { min-height: var(--touch-target-min); } }
</style>
