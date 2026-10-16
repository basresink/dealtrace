<script setup lang="ts">
// Eén rij in de lijst van prospects en klanten, in de opzet van DealDrive: logovlak met
// initialen, naam met klassepil, kanalen en feiten, een regel met gekleurde streep
// (aanleiding, achterstallige next-action of fase) en rechts de contactpersonen.
// De naam is de link; de streklink maakt de hele rij klikbaar zonder geneste links.
import { CONTACTROL_LABEL } from '~~/shared/contactgegevens'
import { STATUS_LABEL, datumActiviteit, initialen, klasseKleur, klasseLabel, kleurUitNaam, telLink, toonTelefoon } from '~/utils/accountWeergave'

const props = defineProps<{
  rij: any
  klassen: { id: string; naam: string }[]
  weergave?: 'lijst' | 'compact' | 'kaarten'
  toonScore?: boolean
}>()

const FASE_KLEUR: Record<string, string> = { geel: 'var(--yellow)', zwart: 'var(--ink)', rood: 'var(--red)', paars: 'var(--purple)', oranje: 'var(--orange)', groen: 'var(--green)', blauw: 'var(--blue)', grijs: 'var(--muted)' }

const website = computed(() => {
  const w = props.rij.website as string | null
  return w ? (/^https?:\/\//i.test(w) ? w : `https://${w}`) : null
})
const linkedin = computed(() => {
  const l = props.rij.linkedin as string | null
  return l ? (/^https?:\/\//i.test(l) ? l : `https://${l}`) : null
})

/** De regel onder de feiten: aanleiding, dan een achterstallige next-action, dan de fase. */
const regel = computed<{ tekst: string; kleur: string } | null>(() => {
  const r = props.rij
  if (r.aanleiding?.tekst) return { tekst: r.aanleiding.tekst, kleur: r.aanleiding.heet ? 'var(--red)' : 'var(--yellow)' }
  if (r.nextActionDagenOver) return { tekst: `Next-action ${r.nextActionDagenOver} ${r.nextActionDagenOver === 1 ? 'dag' : 'dagen'} overschreden`, kleur: 'var(--orange)' }
  if (r.fase?.label) return { tekst: `Fase: ${r.fase.label}`, kleur: FASE_KLEUR[r.fase.kleur] ?? 'var(--muted)' }
  if (r.kind === 'prospect' && r.nbStatus && STATUS_LABEL[r.nbStatus]) return { tekst: `Status: ${STATUS_LABEL[r.nbStatus]}`, kleur: 'var(--border-strong)' }
  return null
})

/** Primaire contactpersoon eerst, daarna de rest (de API levert er hoogstens drie). */
const contacten = computed(() => {
  const l = [...(props.rij.contacten ?? [])]
  const i = l.findIndex((c: any) => c.id === props.rij.primairContact)
  if (i > 0) l.unshift(...l.splice(i, 1))
  return l
})
const rest = computed(() => Math.max(0, (props.rij.contactenTotaal ?? contacten.value.length) - contacten.value.length))
const rolLabel = (rol: string) => CONTACTROL_LABEL[rol as keyof typeof CONTACTROL_LABEL] ?? rol
</script>

<template>
  <li class="acc-rij" :class="`acc-rij--${weergave ?? 'lijst'}`" :data-account="rij.id">
    <span class="acc-logo" :style="{ background: kleurUitNaam(rij.name) }" aria-hidden="true">{{ initialen(rij.name) }}</span>
    <div class="acc-info">
      <h3 class="acc-naam">
        <NuxtLink :to="`/accounts/${rij.id}`" class="acc-link">{{ rij.name }}</NuxtLink>
        <span v-if="rij.klasse" class="klasse-pil" :class="`klasse-pil--${klasseKleur(rij.klasse, klassen)}`">{{ klasseLabel(rij.klasse, klassen) }}</span>
        <span v-else class="klasse-pil klasse-pil--geen">Geen klasse</span>
      </h3>
      <div class="acc-sub">
        <a v-if="website" :href="website" target="_blank" rel="noopener" class="acc-kanaal" :title="rij.website" :aria-label="`Website van ${rij.name}`"><Icoon naam="Globe" :grootte="13" /></a>
        <span v-else class="acc-kanaal acc-kanaal--leeg" title="Geen website bekend"><Icoon naam="Globe" :grootte="13" /><span class="sr-only">Geen website bekend</span></span>
        <a v-if="linkedin" :href="linkedin" target="_blank" rel="noopener" class="acc-kanaal" :aria-label="`LinkedIn-pagina van ${rij.name}`"><Icoon naam="Linkedin" :grootte="13" /></a>
        <span v-else class="acc-kanaal acc-kanaal--leeg" title="Geen LinkedIn-pagina bekend"><Icoon naam="Linkedin" :grootte="13" /><span class="sr-only">Geen LinkedIn-pagina bekend</span></span>
        <span v-if="rij.branche">{{ rij.branche }}</span>
        <span v-if="rij.city">{{ rij.city }}</span>
        <a v-if="rij.telefoon && weergave !== 'compact'" :href="telLink(rij.telefoon)" class="acc-tel tnum">{{ toonTelefoon(rij.telefoon) }}</a>
        <span class="tnum">Inzichten: {{ rij.inzichten ?? 0 }}</span>
        <span class="tnum">Laatste activiteit: {{ datumActiviteit(rij.laatsteActiviteitOp) }}</span>
        <span v-if="toonScore" class="tnum">Score {{ rij.score }}</span>
      </div>
      <div v-if="regel && weergave !== 'compact'" class="acc-regel" :style="{ borderLeftColor: regel.kleur }" data-test="rij-regel">{{ regel.tekst }}</div>
    </div>
    <div class="acc-contacten">
      <template v-if="contacten.length">
        <span v-for="c in contacten" :key="c.id" class="acc-contact" :style="{ background: kleurUitNaam(c.id) }" :title="`${c.naam} · ${rolLabel(c.rol)}`">{{ initialen(c.naam) }}<span class="sr-only">{{ c.naam }}</span></span>
        <span v-if="rest" class="acc-contact acc-contact--rest" :title="`Nog ${rest} ${rest === 1 ? 'contactpersoon' : 'contactpersonen'}`">+{{ rest }}</span>
      </template>
      <span v-else class="acc-geen-contact">Geen contactpersoon</span>
    </div>
  </li>
</template>
