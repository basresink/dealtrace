<script setup lang="ts">
// Contacten, top deze week (F04), in de opzet van DealDrive en gelijk aan /prospects: kop
// met paarse kicker en de week, daaronder een grijze band met zes portretkaarten. Eerst wie
// deze week iets heeft lopen (afspraak, open taak), aangevuld met beslissers, champions en
// beïnvloeders van je eigen accounts (GET /api/contacten/top).
import { datumActiviteit, initialen, klasseLabel, kleurUitNaam } from '~/utils/accountWeergave'

const { functie } = useMe()
if (!functie('contacten.basis')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const { data } = await useFetch<{ contacten: any[]; klassen: { id: string; naam: string }[]; week: { van: string; tot: string } | null }>('/api/contacten/top', { default: () => ({ contacten: [], klassen: [], week: null }) })
const top = computed(() => data.value.contacten)
const d = (x: string | Date) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(x)).replace('.', '')
const kicker = computed(() => data.value.week ? `Top deze week · ${d(data.value.week.van)} tot ${d(data.value.week.tot)}` : 'Top deze week')
const metProtocol = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)
useHead({ title: 'Contacten · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop
      accent="paars"
      :kicker="kicker"
      titel="Beslissers en beïnvloeders deze week"
      uitleg="De zes belangrijkste beslissers en beïnvloeders van deze week: wie een afspraak of open taak heeft staat bovenaan. Klik een kaart voor de contactkaart, of bekijk alle contacten."
      helpartikel="buying-committee"
      zonder-hulp
    >
      <template #acties>
        <NuxtLink class="dd-actie dd-actie--zwart" to="/contacten/alle" data-test="alle-contacten">Alle contacten →</NuxtLink>
      </template>
    </PaginaKop>
    <section class="section section--alt section--laatste">
      <div class="container">
        <LegeStaat v-if="!top.length" titel="Nog geen beslissers in beeld." tekst="Zodra je contacten toevoegt aan je eigen accounts, verschijnen ze hier." />
        <ul v-else class="portretten" data-test="top-contacten">
          <li v-for="c in top" :key="c.id" class="portret" :data-contact="c.id">
            <div class="portret-foto" :style="{ background: kleurUitNaam(c.naam) }">
              <Label class="portret-rol" soort="rol" :waarde="c.rol || 'onbekend'" />
              <img v-if="c.fotoUrl" :src="c.fotoUrl" alt="" class="portret-img" loading="lazy">
              <span v-else class="portret-initialen" aria-hidden="true">{{ initialen(c.naam) }}</span>
            </div>
            <div class="portret-body">
              <h2 class="portret-naam"><NuxtLink :to="`/contacten/${c.id}`" class="portret-link">{{ c.naam }}</NuxtLink></h2>
              <p class="portret-functie">{{ c.functie || 'Functie onbekend' }} · <NuxtLink :to="`/accounts/${c.account.id}`" class="portret-account">{{ c.account.naam }}</NuxtLink></p>
              <p class="portret-activiteit tnum">Inzichten: {{ c.inzichten }} · Laatste activiteit: {{ datumActiviteit(c.laatsteActiviteitOp) }}</p>
              <p v-if="c.reden" class="portret-reden" data-test="portret-reden">{{ c.reden }}</p>
              <div class="portret-meta">
                <span v-if="c.jarenInRol"><strong>{{ c.jarenInRol }} jr</strong> in rol</span>
                <a v-if="c.linkedin" :href="metProtocol(c.linkedin)" target="_blank" rel="noopener" class="portret-extern">LinkedIn ↗</a>
                <span><strong>{{ c.account.soort === 'klant' ? 'Klant' : 'Prospect' }}</strong></span>
                <Label v-if="c.account.klasse" soort="klasse" :waarde="klasseLabel(c.account.klasse, data.klassen)" />
                <span class="portret-open">Open →</span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.portretten { display: grid; gap: 24px; grid-template-columns: 1fr; margin: 0; padding: 0; list-style: none; }
@media (min-width: 700px) { .portretten { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1000px) { .portretten { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.portret { position: relative; display: flex; flex-direction: column; background: var(--wit); border: 1px solid var(--border); transition: border-color var(--transition-fast), transform var(--transition-fast); }
.portret:hover { border-color: var(--yellow); transform: translateY(-2px); }
.portret-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.portret-foto { position: relative; display: flex; align-items: center; justify-content: center; height: 150px; }
.portret-foto::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.15)); pointer-events: none; }
.portret-initialen { position: relative; z-index: 1; font-family: var(--font-serif); font-size: 52px; font-weight: 700; letter-spacing: -0.02em; color: var(--wit); }
.portret-rol { position: absolute; top: 14px; left: 14px; z-index: 2; }
.portret-rol.lbl--leeg { background: var(--wit); }
.portret-body { display: flex; flex: 1; flex-direction: column; padding: 20px 22px; }
.portret-naam { margin: 0 0 4px; font-family: var(--font-serif); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
.portret-link { color: inherit; text-decoration: none; }
.portret-link::after { content: ''; position: absolute; inset: 0; }
.portret-link:focus-visible { outline: none; }
.portret-link:focus-visible::after { outline: 2px solid var(--yellow); outline-offset: -2px; }
.portret-functie { margin: 0 0 4px; font-size: 13px; line-height: 1.4; color: var(--muted); }
.portret-account { position: relative; z-index: 1; color: var(--ink); font-weight: 600; text-decoration: none; border-bottom: 1px solid var(--border-strong); }
.portret-account:hover { border-bottom-color: var(--yellow); }
.portret-activiteit { margin: 0 0 14px; font-size: 12px; line-height: 1.4; color: var(--muted); }
.portret-reden { margin: 0 0 14px; padding-left: 12px; border-left: 3px solid var(--yellow); font-size: 14px; line-height: 1.45; color: var(--ink-soft); }
.portret-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }
.portret-meta strong { color: var(--ink); font-weight: 700; }
.portret-extern { position: relative; z-index: 1; color: var(--ink); font-weight: 700; text-decoration: none; }
.portret-extern:hover { color: var(--purple); }
.portret-open { margin-left: auto; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); }
@media (max-width: 719px) {
  .portret-foto { height: 110px; }
  .portret-account, .portret-extern { display: inline-flex; align-items: center; min-height: 44px; }
}
</style>
