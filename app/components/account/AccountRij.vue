<script setup lang="ts">
// Eén rij in de lijst van prospects en klanten, in de opzet van DealDrive: logovlak met het
// logo (eigen logo-URL of favicon van de website) of anders de initialen, naam met klasselabel, kanalen en feiten, een regel met gekleurde streep
// (aanleiding of achterstallige next-action), de labels fase en status, en rechts de contactpersonen.
// De naam is de link; de streklink maakt de hele rij klikbaar zonder geneste links. Bij prospects is elk
// contacticoon een eigen link naar de contactpersoon (boven de streklink, op de telefoon 44 px).
import { CONTACTROL_LABEL } from '~~/shared/contactgegevens'
import { ordenLabels } from '~~/shared/labels'
import { reeksStrip } from '~~/shared/opvolgreeks'
import { datumActiviteit, initialen, klasseLabel, kleurUitNaam, telLink, toonTelefoon } from '~/utils/accountWeergave'

const props = defineProps<{
  rij: any
  klassen: { id: string; naam: string }[]
  weergave?: 'lijst' | 'compact' | 'kaarten'
  toonScore?: boolean
}>()

const website = computed(() => {
  const w = props.rij.website as string | null
  return w ? (/^https?:\/\//i.test(w) ? w : `https://${w}`) : null
})
const linkedin = computed(() => {
  const l = props.rij.linkedin as string | null
  return l ? (/^https?:\/\//i.test(l) ? l : `https://${l}`) : null
})

/** De regel onder de feiten: aanleiding, dan een achterstallige next-action. */
const regel = computed<{ tekst: string; kleur: string } | null>(() => {
  const r = props.rij
  if (r.aanleiding?.tekst) return { tekst: r.aanleiding.tekst, kleur: r.aanleiding.heet ? 'var(--red)' : 'var(--border-strong)' }
  if (r.nextActionDagenOver) return { tekst: `Next-action ${r.nextActionDagenOver} ${r.nextActionDagenOver === 1 ? 'dag' : 'dagen'} overschreden`, kleur: 'var(--orange)' }
  return null
})
/** Labels in vaste volgorde: fase met stappen, de status en de status prospect (alleen bij prospects); de reeks wacht op jou. */
const labels = computed(() => ordenLabels([
  props.rij.fase?.label ? { soort: 'fase', waarde: props.rij.fase.hoofdfase ?? null, tekst: props.rij.fase.label } : null,
  props.rij.kind === 'prospect' && props.rij.nbStatus ? { soort: 'status', waarde: props.rij.reeks?.wacht && props.rij.nbStatus === 'in reis' ? 'wacht op jou' : props.rij.nbStatus } : null,
  props.rij.kind === 'prospect' && props.rij.prospectStatus ? { soort: 'prospectstatus', waarde: props.rij.prospectStatus } : null,
]))

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
    <AccountLogo class="acc-logo" :naam="rij.name" :initialen="initialen(rij.name)" :kleur="kleurUitNaam(rij.name)" :logo-url="rij.logoUrl" :website="rij.website" :domein="rij.domein" :logo-uit="rij.logoUit" :grootte="weergave === 'compact' ? 40 : 56" />
    <div class="acc-info">
      <h3 class="acc-naam">
        <NuxtLink :to="`/accounts/${rij.id}`" class="acc-link">{{ rij.name }}</NuxtLink>
        <Label soort="klasse" :waarde="rij.klasse ? klasseLabel(rij.klasse, klassen) : null" data-test="rij-klasse" />
        <Label v-if="rij.gedeactiveerd" soort="status" waarde="gedeactiveerd" data-test="rij-gedeactiveerd" />
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
      <div v-if="labels.length && weergave !== 'compact'" class="lbl-rij acc-labels" data-test="rij-labels"><Label v-for="l in labels" :key="l.soort" :soort="l.soort" :waarde="(l.waarde as string | null)" :tekst="l.tekst ?? null" /></div>
      <FunctieLink als-tekst v-if="rij.reeks" :to="`/opvolgreeksen?reeks=${rij.reeks.id}`" class="acc-reeks" :class="{ 'acc-reeks--wacht': rij.reeks.wacht }" data-test="rij-reeks"><Icoon naam="Repeat" :grootte="13" /><span>Opvolgreeks {{ reeksStrip(rij.reeks) }}<template v-if="rij.reeks.wacht"> · wacht op jou</template></span></FunctieLink>
    </div>
    <div class="acc-contacten">
      <template v-if="contacten.length">
        <template v-if="rij.kind === 'prospect'">
          <FunctieLink v-for="c in contacten" :key="c.id" :to="`/contacten/${c.id}`" class="acc-contact acc-contact--link" :style="{ background: kleurUitNaam(c.id) }" :title="`${c.naam} · ${rolLabel(c.rol)}`" :aria-label="`Open contactpersoon ${c.naam}`" data-test="rij-contact"><img v-if="c.fotoUrl" :src="c.fotoUrl" alt="" class="acc-contact-foto" loading="lazy"><template v-else>{{ initialen(c.naam) }}</template></FunctieLink>
        </template>
        <template v-else>
          <span v-for="c in contacten" :key="c.id" class="acc-contact" :style="{ background: kleurUitNaam(c.id) }" :title="`${c.naam} · ${rolLabel(c.rol)}`"><img v-if="c.fotoUrl" :src="c.fotoUrl" alt="" class="acc-contact-foto" loading="lazy"><template v-else>{{ initialen(c.naam) }}</template><span class="sr-only">{{ c.naam }}</span></span>
        </template>
        <span v-if="rest" class="acc-contact acc-contact--rest" :title="`Nog ${rest} ${rest === 1 ? 'contactpersoon' : 'contactpersonen'}`">+{{ rest }}</span>
      </template>
      <span v-else class="acc-geen-contact">Geen contactpersoon</span>
    </div>
  </li>
</template>

<style scoped>
/* F7: de lopende opvolgreeks onder de regel (stap x van y en de volgende stap). */
.acc-reeks { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 12px; line-height: 1.4; color: var(--ink-soft); text-decoration: none; }
.acc-reeks:hover span { text-decoration: underline; }
.acc-reeks--wacht { font-weight: 700; }
@media (max-width: 719px) { .acc-reeks { min-height: var(--touch-target-min); } }
.acc-contact { overflow: hidden; }
.acc-labels { margin-top: 6px; }
.acc-contact-foto { width: 100%; height: 100%; object-fit: cover; }
.acc-contact--link { position: relative; z-index: 1; text-decoration: none; cursor: pointer; }
.acc-contact--link:hover { z-index: 2; outline: 2px solid var(--ink); outline-offset: -2px; }
.acc-contact--link:focus-visible { z-index: 2; outline: 2px solid var(--ink); outline-offset: 1px; }
@media (max-width: 719px) {
  .acc-contact--link { width: 44px; height: 44px; margin-left: 6px; font-size: 13px; }
  .acc-contact--link:first-child { margin-left: 0; }
}
</style>
