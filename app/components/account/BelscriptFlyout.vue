<script setup lang="ts">
// Belscript van dit prospect (Meer op de accountkaart en de contactkaart): de laatst bewaarde versie voor
// dit prospect, of anders het standaardscript dat bij de fase en het contact past, met de waarden van dit
// account ingevuld. Bewerken, met AI laten vullen en versies vergelijken gaan in de Belscript Studio
// (/belscripts, tabblad Per prospect).
import { BLOK_LABEL, voorbeeldSegmenten, type BlokSoortScript } from '~~/shared/belscripts'
const props = defineProps<{ open: boolean; accountId: string; naam: string; contactId?: string | null }>()
const emit = defineEmits<{ sluit: [] }>()
const p = ref<any>(null)
const laden = ref(false)
const fout = ref('')
watch(() => props.open, async (o) => {
  if (!o) return
  laden.value = true; fout.value = ''
  try { p.value = await $fetch<any>('/api/belscripts/prospect', { query: { accountId: props.accountId, contactId: props.contactId ?? undefined } }) } catch (e) { fout.value = foutTekst(e) } finally { laden.value = false }
}, { immediate: true })
const versie = computed(() => p.value?.versies?.[0] ?? null)
const blokken = computed<any[]>(() => (versie.value ? versie.value.data?.blokken ?? [] : p.value?.script?.data?.blokken ?? []))
const studio = computed(() => `/belscripts?tab=prospect&prospect=${encodeURIComponent(props.accountId)}`)
const datum = (s: string | null) => (s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(s)).replace('.', '') : '')
</script>

<template>
  <KaartFlyout :open="open" kicker="Belscript" :titel="naam" meta="Het script voor je volgende gesprek met dit prospect." test="belscript-flyout" maat="breed" :account-id="accountId" @sluit="emit('sluit')">
    <p v-if="laden" class="fo-leeg">Laden…</p>
    <p v-else-if="fout" class="fo-fout">{{ fout }}</p>
    <template v-else-if="p">
      <div class="bsf-stand" data-test="bsf-stand">
        <template v-if="versie"><span class="pil pil--groen">Versie {{ versie.versie }}</span><span class="meta">Bewaard voor dit prospect op {{ datum(versie.op) }}<template v-if="versie.door"> door {{ versie.door }}</template><template v-if="versie.samenvatting"> · {{ versie.samenvatting }}</template></span></template>
        <template v-else-if="p.script"><span class="pil pil--grijs">Standaardscript</span><span class="meta">{{ p.script.naam }}<template v-if="p.voorstel?.reden"> · {{ p.voorstel.reden }}</template>. Nog geen eigen versie voor dit prospect.</span></template>
      </div>
      <LegeStaat v-if="!blokken.length" titel="Nog geen belscript." tekst="Er is nog geen actief script voor je team. Je salesmanager zet het standaardscript klaar in de Belscript Studio." />
      <ol v-else class="bsf-blokken" data-test="bsf-blokken">
        <li v-for="b in blokken" :key="b.id" class="bsf-blok">
          <span class="bsf-label">{{ b.titel || BLOK_LABEL[b.soort as BlokSoortScript] || 'Blok' }}<Label v-if="b.vanAi" soort="ai" waarde="ai" /></span>
          <p class="bsf-tekst"><template v-for="(seg, j) in voorbeeldSegmenten(b.status === 'verworpen' ? (b.terugval ?? '') : (b.tekst ?? ''), p.waarden ?? {})" :key="j"><span v-if="seg.variabele" class="bsf-var" :class="{ 'bsf-var--onbekend': seg.onbekend }">{{ seg.tekst || '…' }}</span><template v-else>{{ seg.tekst }}</template></template></p>
        </li>
      </ol>
    </template>
    <template v-if="p && !laden && !fout" #voet>
      <footer class="fo-foot fs-voet">
        <FunctieLink :to="studio" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="bsf-studio" @click="emit('sluit')"><Icoon naam="ScrollText" :grootte="16" />{{ versie ? 'Open in de Belscript Studio' : 'Maak een versie voor dit prospect' }}</FunctieLink>
        <span class="fo-foot-vul" />
      </footer>
    </template>
  </KaartFlyout>
</template>

<style scoped>
.bsf-stand { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.bsf-blokken { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.bsf-blok { padding: 12px 14px; border: 1px solid var(--border); background: var(--wit); }
.bsf-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.bsf-tekst { margin: 6px 0 0; font-size: 14px; line-height: 1.5; white-space: pre-line; }
.bsf-var { padding: 0 2px; background: var(--yellow-soft, #fff6cc); }
.bsf-var--onbekend { background: var(--bg); color: var(--muted); font-style: italic; }
</style>
