<script setup lang="ts">
// Klaargezet door AI (links) en Door AI agents gedaan (rechts), naast elkaar op dezelfde hoogte; op de
// telefoon onder elkaar. Links de concepten die op goedkeuring wachten en taakvoorstellen met een concept,
// met Bekijk en Goedkeuren (dezelfde besluitroute als /concepten). Rechts wat de agents sinds gisteren
// deden als tijdlijn met tellers. Data uit /api/vandaag/dashboard.
const props = defineProps<{ klaargezet: any | null; agents: any | null }>()
const emit = defineEmits<{ open: [taakId: string]; gewijzigd: [] }>()
const toast = useToast()
const { voegToe } = useSyncQueue()

const TYPE: Record<string, { label: string; icoon: string }> = {
  mail: { label: 'Mail', icoon: 'Mail' }, belscript: { label: 'Belscript', icoon: 'Phone' }, linkedin: { label: 'LinkedIn', icoon: 'Linkedin' },
  whatsapp: { label: 'WhatsApp', icoon: 'MessageCircle' }, briefing: { label: 'Briefing', icoon: 'FileText' }, taak: { label: 'Taakvoorstel', icoon: 'ListTodo' },
}
const SOORT: Record<string, { icoon: string; klasse: string }> = {
  taak: { icoon: 'SquareCheck', klasse: 'blauw' }, inzicht: { icoon: 'Lightbulb', klasse: 'paars' }, concept: { icoon: 'Sparkles', klasse: 'paars' },
  verrijkt: { icoon: 'Database', klasse: 'groen' }, geparkeerd: { icoon: 'Pause', klasse: 'grijs' }, tegengehouden: { icoon: 'ShieldCheck', klasse: 'rood' }, overig: { icoon: 'Sparkles', klasse: 'grijs' },
}
const tijd = (iso: string) => {
  const d = new Date(iso)
  const zelfdeDag = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeZone: 'Europe/Amsterdam' })
  const hm = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(d)
  return zelfdeDag.format(d) === zelfdeDag.format(new Date()) ? hm : `gisteren ${hm}`
}
const weg = ref(new Set<string>())
const zichtbaar = computed(() => (props.klaargezet?.lijst ?? []).filter((x: any) => !weg.value.has(x.id)))
async function keurGoed(x: any) {
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'concepten', op: 'patch', recordId: x.id, patch: { soort: 'concept.besluit', besluit: 'goedkeuren' } })
      toast.toon('Bewaard. Wordt verstuurd zodra je weer verbinding hebt.')
    } else {
      await $fetch(`/api/concepten/${x.id}/besluit`, { method: 'POST', body: { besluit: 'goedkeuren' } })
      toast.toon('Goedgekeurd. Versturen doe je bij Concepten.')
    }
    weg.value = new Set([...weg.value, x.id])
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <div class="va" :class="{ 'va--een': !klaargezet || !agents }">
    <section v-if="klaargezet" class="va-blok" data-test="concepten" aria-labelledby="va-klaar">
      <header class="va-kop">
        <span class="va-icoon va-icoon--paars"><Icoon naam="Sparkles" :grootte="18" /></span>
        <div class="va-kop-tekst">
          <span class="kicker">Klaargezet door AI</span>
          <h2 id="va-klaar" class="va-titel">{{ klaargezet.totaal ? `${klaargezet.totaal} ${klaargezet.totaal === 1 ? 'voorstel wacht' : 'voorstellen wachten'} op jou` : 'Niets wacht op je goedkeuring' }}</h2>
        </div>
        <NuxtLink to="/concepten" class="va-link">Alle concepten →</NuxtLink>
      </header>
      <p v-if="!zichtbaar.length" class="va-leeg">De Schrijver zet hier mails, belscripts en taakvoorstellen klaar zodra er een aanleiding is. Niets gaat zonder jou de deur uit.</p>
      <ul v-else class="va-lijst">
        <li v-for="x in zichtbaar" :key="x.id" class="va-item" :data-test="`klaargezet-${x.id}`">
          <span class="va-icoon" :class="x.bron === 'taak' ? 'va-icoon--blauw' : 'va-icoon--paars'" :title="TYPE[x.type]?.label ?? x.type"><Icoon :naam="TYPE[x.type]?.icoon ?? 'FileText'" :grootte="16" /></span>
          <span class="va-body">
            <span class="va-meta"><span class="va-soort">{{ TYPE[x.type]?.label ?? x.type }}</span><template v-if="x.account"> · <NuxtLink v-if="x.accountId" :to="`/accounts/${x.accountId}`" class="va-account">{{ x.account }}</NuxtLink><template v-else>{{ x.account }}</template></template></span>
            <span class="va-regel">{{ x.regel }}</span>
          </span>
          <span class="va-knoppen">
            <button v-if="x.bron === 'taak'" type="button" class="dd-act" @click="emit('open', x.id)">Bekijk</button>
            <template v-else>
              <NuxtLink :to="`/concepten${x.type && x.type !== 'taak' ? `?type=${x.type}` : ''}`" class="dd-act">Bekijk</NuxtLink>
              <button type="button" class="dd-act dd-act--primair" :data-test="`goedkeuren-${x.id}`" @click="keurGoed(x)">Goedkeuren</button>
            </template>
          </span>
        </li>
      </ul>
      <NuxtLink v-if="klaargezet.totaal > zichtbaar.length + weg.size" to="/concepten" class="va-meer">nog {{ klaargezet.totaal - zichtbaar.length - weg.size }} meer →</NuxtLink>
    </section>

    <section v-if="agents" class="va-blok" data-test="agents" aria-labelledby="va-agents">
      <header class="va-kop">
        <span class="va-icoon va-icoon--zwart"><Icoon naam="RefreshCw" :grootte="18" /></span>
        <div class="va-kop-tekst">
          <span class="kicker">Door AI agents gedaan · sinds gisteren</span>
          <h2 id="va-agents" class="va-titel">{{ agents.totaal ? `${agents.totaal} ${agents.totaal === 1 ? 'handeling' : 'handelingen'} voor je uitgevoerd` : 'Nog niets gedaan sinds gisteren' }}</h2>
        </div>
      </header>
      <div class="va-tellers" data-test="agents-samenvatting">
        <span v-for="t in agents.tellers" :key="t.soort" class="va-teller" :class="{ 'va-teller--rood': t.soort === 'tegengehouden' && t.aantal }">
          <strong class="tnum">{{ t.aantal }}</strong><span>{{ t.label }}</span>
        </span>
      </div>
      <p v-if="!agents.tijdlijn.length" class="va-leeg">De agents hebben sinds gisteren niets voor je gedaan. Zodra de motor taken klaarzet of de Waarnemer iets ziet, staat het hier.</p>
      <ol v-else class="va-tijdlijn">
        <li v-for="(g, i) in agents.tijdlijn" :key="i" class="va-stap" :data-test="`agent-stap-${g.soort}`">
          <span class="va-punt" :class="`va-icoon--${SOORT[g.soort]?.klasse ?? 'grijs'}`"><Icoon :naam="SOORT[g.soort]?.icoon ?? 'Sparkles'" :grootte="14" /></span>
          <span class="va-body">
            <span class="va-meta"><strong class="va-agent">{{ g.agent }}</strong> · <span class="tnum">{{ tijd(g.op) }}</span></span>
            <span class="va-regel">{{ g.actie }}</span>
            <NuxtLink v-if="g.accountId && g.account" :to="`/accounts/${g.accountId}`" class="va-account va-account--los">{{ g.account }}</NuxtLink>
          </span>
        </li>
      </ol>
      <NuxtLink to="/instellingen/agents" class="va-meer">Agents en mandaten →</NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.va { display: grid; gap: 24px; grid-template-columns: 1fr; align-items: stretch; }
@media (min-width: 900px) { .va { grid-template-columns: 1fr 1fr; } .va--een { grid-template-columns: 1fr; } }
.va-blok { display: flex; flex-direction: column; min-width: 0; padding: 24px; background: #fff; border: 1px solid var(--border); }
.va-kop { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.va-kop-tekst { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.va-titel { margin: 0; font-family: var(--font-serif); font-size: 20px; font-weight: 700; line-height: 1.25; color: var(--ink); }
.va-link, .va-meer { font-size: 13px; font-weight: 700; color: var(--ink); text-decoration: none; border-bottom: 2px solid var(--yellow); white-space: nowrap; }
.va-link { align-self: center; }
.va-meer { align-self: flex-start; margin-top: auto; padding-top: 14px; border-bottom: none; text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 2px; text-underline-offset: 4px; }
.va-leeg { padding: 16px 0; font-size: 13px; font-style: italic; color: var(--muted); }
.va-icoon { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 2px; background: var(--surface); color: var(--ink); }
.va-icoon--paars { background: #ede9fe; color: #4c1d95; }
.va-icoon--blauw { background: rgba(37, 99, 235, 0.1); color: var(--blue); }
.va-icoon--groen { background: var(--green-zacht); color: var(--green); }
.va-icoon--rood { background: rgba(220, 38, 38, 0.1); color: var(--red); }
.va-icoon--grijs { background: var(--surface); color: var(--muted); }
.va-icoon--zwart { background: var(--ink); color: var(--yellow); }
.va-lijst { list-style: none; margin: 0; padding: 0; }
.va-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.va-item:last-child { border-bottom: none; }
.va-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.va-meta { font-size: 12px; color: var(--muted); }
.va-soort { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); }
.va-account { color: var(--ink); font-weight: 600; text-decoration: none; }
.va-account:hover { text-decoration: underline; }
.va-account--los { font-size: 12px; }
.va-regel { overflow: hidden; font-size: 14px; font-weight: 600; line-height: 1.35; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
.va-knoppen { flex-shrink: 0; display: flex; gap: 6px; }
.va-tellers { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 0 8px; }
.va-teller { display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 10px; background: var(--surface); font-size: 12px; color: var(--muted); }
.va-teller strong { font-family: var(--font-serif); font-size: 18px; color: var(--ink); }
.va-teller--rood strong { color: var(--red); }
.va-tijdlijn { position: relative; list-style: none; margin: 8px 0 0; padding: 0; }
.va-tijdlijn::before { content: ''; position: absolute; top: 14px; bottom: 14px; left: 13px; width: 2px; background: var(--border); }
.va-stap { position: relative; display: flex; gap: 12px; padding: 8px 0; }
.va-punt { position: relative; z-index: 1; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; box-shadow: 0 0 0 3px #fff; }
.va-agent { color: var(--ink); }
.va-stap .va-regel { white-space: normal; font-weight: 500; }
@media (max-width: 767px) {
  .va { gap: 16px; }
  .va-blok { padding: 16px; }
  .va-item { flex-wrap: wrap; }
  .va-knoppen { width: 100%; padding-left: 48px; }
  .va-knoppen > * { flex: 1; min-height: 44px; justify-content: center; }
  .va-link { display: none; }
  .va-meer, .va-account { display: inline-flex; align-items: center; min-height: 44px; }
}
</style>
