<script setup lang="ts">
// Accountkaart zonder verbinding (P30, 8.8): uit het dagpakket, of "Niet op je telefoon bewaard".
import { kaartLink } from '~~/shared/route'
const props = defineProps<{ id: string }>()
const { pakket, uitOpslag, account } = useDagpakket()
onMounted(async () => { if (!pakket.value) pakket.value = await uitOpslag() })
const a = computed(() => account(props.id))
const tel = (n?: string | null) => (n ? `tel:${n.replace(/[^\d+]/g, '')}` : undefined)
</script>

<template>
  <section class="section">
    <div class="container" data-test="offline-account">
      <template v-if="a">
        <span class="kicker kicker--streep">Offline · uit je dagpakket</span>
        <h1 class="title">{{ a.naam }}</h1>
        <p class="meta">{{ [a.adres, a.plaats].filter(Boolean).join(', ') }}</p>
        <p class="dd-acties mt-8"><a v-if="a.telefoon" class="dd-act" :href="tel(a.telefoon)"><Icoon naam="Phone" />Bel</a><a class="dd-act" :href="kaartLink({ adres: [a.adres, a.plaats].filter(Boolean).join(', '), punt: a.punt }) ?? undefined" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a></p>
        <h2 class="kop-blok mt-16">Contacten</h2>
        <ul class="schakel-lijst kaart"><li v-for="c in a.contacten" :key="c.id" class="schakel-rij"><span>{{ c.naam }} <span class="meta">{{ [c.rol, c.functie].filter(Boolean).join(' · ') }}</span></span><a v-if="c.telefoon" class="dd-act" :href="tel(c.telefoon)" aria-label="Bel"><Icoon naam="Phone" /></a></li></ul>
        <h2 class="kop-blok mt-16">Laatste contactmomenten</h2>
        <ul class="schakel-lijst kaart"><li v-for="(m, i) in a.momenten" :key="i" class="schakel-rij"><span>{{ m.soort }}<template v-if="m.uitkomst"> · {{ m.uitkomst }}</template><template v-if="m.tekst"> · {{ m.tekst }}</template></span><span class="meta">{{ new Date(m.op).toLocaleDateString('nl-NL') }}</span></li></ul>
        <h2 v-if="a.taken.length" class="kop-blok mt-16">Open taken</h2>
        <ul v-if="a.taken.length" class="schakel-lijst kaart"><li v-for="t in a.taken" :key="t.id" class="schakel-rij">{{ t.titel }}</li></ul>
      </template>
      <LegeStaat v-else titel="Niet op je telefoon bewaard." tekst="Met verbinding kun je dit account bewaren voor offline." />
    </div>
  </section>
</template>
