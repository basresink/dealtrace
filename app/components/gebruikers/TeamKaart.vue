<script setup lang="ts">
// Eén team (pakket B): hernoemen, salesmanagers koppelen, gekoppelde teams kiezen en een leeg team
// verwijderen. Met leden of teamregels legt de server uit wat er eerst moet; dat staat dan in de kaart.
interface Team { id: string; naam: string; managerIds: string[]; gekoppeldeTeams: string[] }
const props = defineProps<{
  team: Team
  leden: number
  beheerder: boolean
  managers: { id: string; naam: string }[]
  teams: Team[]
  naamVan: (id: string) => string
}>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()

const hernoem = ref(false)
const naam = ref(props.team.naam)
const fout = ref('')
const verwijderVraag = ref(false)
const andere = computed(() => props.teams.filter((t) => t.id !== props.team.id))

async function zet(body: Partial<Team>, melding?: string) {
  fout.value = ''
  try {
    await $fetch(`/api/teams/${props.team.id}`, { method: 'PUT', body })
    if (melding) toast.toon(melding)
    emit('gewijzigd')
    return true
  } catch (e: any) { fout.value = e?.data?.statusMessage ?? 'Opslaan mislukt'; return false }
}
async function bewaarNaam() {
  const n = naam.value.trim()
  if (!n || n === props.team.naam) { hernoem.value = false; naam.value = props.team.naam; return }
  if (await zet({ naam: n }, `Team heet nu ${n}.`)) hernoem.value = false
}
function wisselManager(id: string) {
  const ids = props.team.managerIds.includes(id) ? props.team.managerIds.filter((m) => m !== id) : [...props.team.managerIds, id]
  void zet({ managerIds: ids })
}
function wisselKoppeling(id: string) {
  const ids = props.team.gekoppeldeTeams.includes(id) ? props.team.gekoppeldeTeams.filter((m) => m !== id) : [...props.team.gekoppeldeTeams, id]
  void zet({ gekoppeldeTeams: ids })
}
async function verwijder() {
  verwijderVraag.value = false
  fout.value = ''
  try {
    await $fetch(`/api/teams/${props.team.id}`, { method: 'DELETE' })
    toast.toon(`${props.team.naam} is verwijderd.`)
    emit('gewijzigd')
  } catch (e: any) { fout.value = e?.data?.statusMessage ?? 'Verwijderen mislukt' }
}
watch(() => props.team.naam, (n) => { if (!hernoem.value) naam.value = n })
</script>

<template>
  <article class="kaart tk" :data-team="team.id" data-test="team-kaart">
    <header class="kaart-kop">
      <form v-if="hernoem" class="tk-hernoem" @submit.prevent="bewaarNaam">
        <label class="sr-only" :for="`tk-naam-${team.id}`">Naam van het team</label>
        <input :id="`tk-naam-${team.id}`" v-model="naam" class="invoer" required data-test="team-naam-invoer">
        <button type="submit" class="dd-act" data-test="team-naam-bewaar">Bewaar</button>
        <button type="button" class="dd-act" @click="hernoem = false; naam = team.naam">Annuleer</button>
      </form>
      <h2 v-else class="kaart-titel">{{ team.naam }}</h2>
      <span class="pil pil--grijs">{{ leden }} {{ leden === 1 ? 'lid' : 'leden' }}</span>
    </header>
    <p class="kaart-meta">Salesmanager: {{ team.managerIds.map(naamVan).join(', ') || 'nog niemand' }}</p>
    <p v-if="team.gekoppeldeTeams.length" class="kaart-meta">Werkt samen met: {{ team.gekoppeldeTeams.map((id) => teams.find((t) => t.id === id)?.naam ?? id).join(', ') }}</p>

    <template v-if="beheerder">
      <div class="tk-groep">
        <span class="veld-label">Salesmanagers</span>
        <div v-if="managers.length" class="keuzechips">
          <button v-for="s in managers" :key="s.id" type="button" class="pil pil--knop" :class="team.managerIds.includes(s.id) ? 'pil--zwart' : 'pil--leeg'" :aria-pressed="team.managerIds.includes(s.id)" :data-test="`team-manager-${s.id}`" @click="wisselManager(s.id)">{{ s.naam }}</button>
        </div>
        <p v-else class="veld-uitleg">Nog geen salesmanagers. Geef iemand de rol Salesmanager op het tabblad Gebruikers.</p>
      </div>
      <div v-if="andere.length" class="tk-groep">
        <span class="veld-label">Gekoppelde teams</span>
        <div class="keuzechips">
          <button v-for="t in andere" :key="t.id" type="button" class="pil pil--knop" :class="team.gekoppeldeTeams.includes(t.id) ? 'pil--zwart' : 'pil--leeg'" :aria-pressed="team.gekoppeldeTeams.includes(t.id)" :data-test="`team-koppel-${t.id}`" @click="wisselKoppeling(t.id)">{{ t.naam }}</button>
        </div>
        <p class="veld-uitleg">Bijvoorbeeld een binnendienst die afspraken plant voor een buitendienstteam.</p>
      </div>
      <p v-if="leden" class="veld-uitleg tk-uitleg">Verwijderen kan als het team leeg is. Zet eerst {{ leden === 1 ? 'het lid' : `de ${leden} leden` }} in een ander team.</p>
      <p v-if="fout" class="tk-fout" role="alert" data-test="team-fout">{{ fout }}</p>
      <div class="reis-knoppen tk-acties">
        <button v-if="!hernoem" type="button" class="dd-act" data-test="team-hernoem" @click="hernoem = true"><Icoon naam="Pencil" :grootte="14" />Hernoem</button>
        <button type="button" class="dd-act" data-test="team-verwijder" @click="verwijderVraag = true"><Icoon naam="Trash2" :grootte="14" />Verwijder</button>
      </div>
    </template>
    <BevestigVenster :open="verwijderVraag" titel="Team verwijderen" bevestig="Verwijder" gevaar :tekst="`${team.naam} verdwijnt. Dit kan alleen als er niemand meer in het team zit.`" @geannuleerd="verwijderVraag = false" @bevestigd="verwijder" />
  </article>
</template>

<style scoped>
.tk { display: flex; flex-direction: column; gap: 10px; }
.tk .kaart-meta { margin: 0; }
.tk-groep { display: flex; flex-direction: column; gap: 6px; }
.tk-hernoem { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; flex: 1 1 auto; min-width: 0; }
.tk-hernoem .invoer { flex: 1 1 160px; min-width: 0; min-height: var(--touch-target-min); }
.tk-hernoem .dd-act { min-height: var(--touch-target-min); }
.tk-acties .dd-act { display: inline-flex; align-items: center; gap: 6px; }
.tk-fout { margin: 0; color: var(--red); font-size: 13px; font-weight: 600; }
.tk-uitleg { margin: 0; }
.tk .pil--knop { min-height: var(--touch-target-min); }
</style>
