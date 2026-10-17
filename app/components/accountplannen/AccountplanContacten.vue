<script setup lang="ts">
// Contactpersonen van een accountplan: echte contacten van het account met hun rol (Label rol) en functie.
// Lezen: een rij per persoon met een link naar de contactkaart. Bewerken: weghalen met het kruisje en
// toevoegen uit de contacten van het account (beslissers eerst). Met `rolKiezen` wijzig je de rol van het
// contact zelf (dezelfde rol als op de contactkaart en de invloedskaart, PUT /api/contacten/:id/invloed).
import { CONTACTEN_LEEG } from '~~/shared/accountplannen'
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
interface PlanContact { id: string; naam: string; rol: string; functie?: string | null; vertrokken?: boolean }
const props = withDefaults(defineProps<{ contacten: PlanContact[]; bewerk?: boolean; rolKiezen?: boolean; leegTekst?: string; prefix?: string }>(), { bewerk: false, rolKiezen: false, leegTekst: CONTACTEN_LEEG, prefix: 'apc' })
const ids = defineModel<string[]>({ default: () => [] })
const emit = defineEmits<{ rol: [] }>()
const toast = useToast()
const gekozen = computed(() => ids.value.map((id) => props.contacten.find((c) => c.id === id)).filter(Boolean) as PlanContact[])
const VOLGORDE = ['beslisser', 'beinvloeder', 'champion', 'poortwachter', 'gebruiker', 'blokkeerder', 'onbekend']
const keuzes = computed(() => props.contacten.filter((c) => !c.vertrokken && !ids.value.includes(c.id)).sort((a, b) => VOLGORDE.indexOf(a.rol) - VOLGORDE.indexOf(b.rol) || a.naam.localeCompare(b.naam)))
function voegToe(id: string) { if (id && !ids.value.includes(id)) ids.value = [...ids.value, id] }
function haalWeg(id: string) { ids.value = ids.value.filter((x) => x !== id) }
async function zetRol(c: PlanContact, rol: string) {
  try { await $fetch(`/api/contacten/${c.id}/invloed`, { method: 'PUT', body: { rol } }); c.rol = rol; toast.toon(`Rol van ${c.naam} is nu ${CONTACTROL_LABEL[rol as 'beslisser']?.toLowerCase() ?? rol}.`); emit('rol') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <div class="apc" :data-test="`${prefix}-contacten`">
    <ul v-if="gekozen.length" class="apc-lijst" role="list">
      <li v-for="c in gekozen" :key="c.id" class="apc-rij" :data-test="`${prefix}-contact-${c.id}`">
        <span class="apc-tekst">
          <FunctieLink als-tekst :to="`/contacten/${c.id}`" class="apc-naam">{{ c.naam }}</FunctieLink>
          <span class="apc-meta">{{ c.functie || 'Functie onbekend' }}<template v-if="c.vertrokken"> · vertrokken</template></span>
        </span>
        <span v-if="rolKiezen" class="lbl-kies">
          <Label soort="rol" :waarde="c.rol" />
          <select :value="c.rol" :aria-label="`Rol van ${c.naam}`" :data-test="`${prefix}-rol-${c.id}`" @change="zetRol(c, ($event.target as HTMLSelectElement).value)">
            <option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option>
          </select>
        </span>
        <Label v-else soort="rol" :waarde="c.rol" />
        <button v-if="bewerk" type="button" class="dd-act dd-act--icoon apc-weg" :aria-label="`Haal ${c.naam} van het plan`" :title="`Haal ${c.naam} van het plan`" @click="haalWeg(c.id)"><Icoon naam="X" :grootte="14" /></button>
      </li>
    </ul>
    <p v-else class="apc-leeg" :data-test="`${prefix}-contacten-leeg`">{{ leegTekst }}</p>
    <label v-if="bewerk && keuzes.length" class="apc-kies">
      <span class="sr-only">Contactpersoon toevoegen</span>
      <select class="invoer" :value="''" :data-test="`${prefix}-contact-kies`" @change="voegToe(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
        <option value="">+ Contactpersoon toevoegen</option>
        <option v-for="c in keuzes" :key="c.id" :value="c.id">{{ c.naam }} · {{ CONTACTROL_LABEL[c.rol as 'beslisser'] ?? 'Rol onbekend' }}{{ c.functie ? ` · ${c.functie}` : '' }}</option>
      </select>
    </label>
    <p v-else-if="bewerk && !contacten.length" class="apc-leeg">Dit account heeft nog geen contactpersonen. Voeg ze toe op de accountkaart.</p>
  </div>
</template>

<style scoped>
.apc-lijst { list-style: none; margin: 0; padding: 0; }
.apc-rij { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.apc-rij:last-child { border-bottom: 0; }
.apc-tekst { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.apc-naam { font-size: 14px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.apc-meta { font-size: 12px; color: var(--muted); }
.apc-leeg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.apc-kies { display: block; margin-top: 10px; }
.apc-kies .invoer { width: 100%; }
@media (max-width: 719px) { .apc-weg, .apc-naam { min-height: var(--touch-target-min); min-width: var(--touch-target-min); display: inline-flex; align-items: center; } }
</style>
