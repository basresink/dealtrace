<script setup lang="ts">
// Nieuwe taak ("Wat moet er gebeuren?", F06). Beginner: klant, titel, actiesoort,
// vervaldatum. Gevorderd ook prioriteit, toegewezen aan, herhaling, herinnering en beschrijving.
import { ACTIE_LABEL } from '~~/shared/taken'
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null; teamleden?: { id: string; naam: string }[]; actiesoort?: string; voorgevuld?: { accountId?: string | null; titel?: string; actiesoort?: string; aanleiding?: string } | null }>()
const emit = defineEmits<{ sluit: []; gemaakt: [] }>()
const { functie } = useMe()
const toast = useToast()
const gevorderd = computed(() => !!functie('taken.herhaling')?.beschikbaar)
const leeg = () => ({ title: '', actionType: 'bellen', dueDate: '', priority: 'middel', ownerId: '', herhaling: '', herinnering: '', beschrijving: '' })
const f = reactive(leeg())
const klant = ref<{ id: string; naam: string } | null>(null)
const zoek = ref('')
const treffers = ref<any[]>([])
watch(() => props.open, async (o) => {
  if (!o) return
  const v = props.voorgevuld
  Object.assign(f, leeg(), props.actiesoort ? { actionType: props.actiesoort } : {}, v?.titel ? { title: v.titel } : {}, v?.actiesoort ? { actionType: v.actiesoort } : {})
  klant.value = props.account ?? null
  zoek.value = ''
  // Voorgevuld vanuit de AI-assistent: account, titel en aanleiding; pas Opslaan maakt de taak.
  if (v?.accountId && !klant.value) { try { const a: any = await ($fetch as any)(`/api/accounts/${v.accountId}`); klant.value = { id: a.id, naam: a.naam } } catch { klant.value = null } }
}, { immediate: true })
let timer: any
watch(zoek, (q) => { clearTimeout(timer); timer = setTimeout(async () => { treffers.value = q.length >= 2 ? await $fetch<any[]>('/api/accounts/kies', { query: { q } }) : [] }, 250) })
async function maak() {
  try {
    await $fetch('/api/tasks', { method: 'POST', body: { ...f, accountId: klant.value?.id, dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined, ownerId: f.ownerId || undefined, herhaling: f.herhaling || undefined, herinnering: f.herinnering ? { minuten: Number(f.herinnering), kanaal: 'in-app' } : undefined, ...(props.voorgevuld ? { aanleiding: props.voorgevuld.aanleiding, herkomst: 'assistent' } : {}) } })
    toast.toon('Taak gemaakt.'); emit('gemaakt')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="nt-titel" data-test="nieuwe-taak" @submit.prevent="maak">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Nieuwe taak</span><h2 id="nt-titel" class="fo-titel">Wat moet er gebeuren?</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <div class="veld"><span class="veld-label">Klant</span>
              <p v-if="klant" class="schakel-rij"><strong>{{ klant.naam }}</strong><button type="button" class="dd-act" @click="klant = null">Wijzig</button></p>
              <template v-else><input v-model="zoek" class="invoer" placeholder="Zoek een bedrijf" data-test="nt-klant"><ul v-if="treffers.length" class="schakel-lijst"><li v-for="a in treffers" :key="a.id" class="schakel-rij"><button type="button" class="taak-titel" @click="klant = a; treffers = []">{{ a.naam }} <span class="meta">{{ a.plaats }}</span></button></li></ul></template>
            </div>
            <label class="veld mt-16"><span class="veld-label">Titel <span class="veld-verplicht">*</span></span><input v-model="f.title" class="invoer" minlength="3" required data-test="nt-titel"></label>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Actiesoort</span><select v-model="f.actionType" class="invoer"><option v-for="(l, k) in ACTIE_LABEL" :key="k" :value="k">{{ l }}</option></select></label>
              <label class="veld"><span class="veld-label">Vervaldatum</span><input v-model="f.dueDate" type="datetime-local" class="invoer"><span class="veld-uitleg">Leeg: het volgende hele werkuur.</span></label>
            </div>
          </article>
          <article v-if="gevorderd" class="fo-blok">
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Prioriteit</span><select v-model="f.priority" class="invoer"><option value="hoog">Hoog</option><option value="middel">Middel</option><option value="laag">Laag</option></select></label>
              <label v-if="teamleden?.length" class="veld"><span class="veld-label">Toegewezen aan</span><select v-model="f.ownerId" class="invoer"><option value="">Mij</option><option v-for="u in teamleden" :key="u.id" :value="u.id">{{ u.naam }}</option></select></label>
              <label class="veld"><span class="veld-label">Herhaling</span><select v-model="f.herhaling" class="invoer"><option value="">Geen</option><option value="werkdag">Elke werkdag</option><option value="wekelijks">Wekelijks</option><option value="omdeweek">Om de week</option><option value="maandelijks">Maandelijks</option></select></label>
              <label class="veld"><span class="veld-label">Herinnering</span><select v-model="f.herinnering" class="invoer"><option value="">Geen</option><option value="5">5 minuten vooraf</option><option value="30">30 minuten vooraf</option><option value="60">1 uur vooraf</option><option value="1440">1 dag vooraf</option><option value="2880">2 dagen vooraf</option></select></label>
            </div>
            <label class="veld mt-16"><span class="veld-label">Beschrijving</span><textarea v-model="f.beschrijving" class="invoer" rows="2" /></label>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" class="dd-act dd-act--primair" :disabled="f.title.trim().length < 3" data-test="nt-maak">Taak maken</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
