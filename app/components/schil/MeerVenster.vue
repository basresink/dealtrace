<script setup lang="ts">
// "Meer" (P27, 8.4): de rest van de zijbalk van je niveau in dezelfde groepen en volgorde,
// "Nog niet aangezet" ingeklapt onderaan; Instellingen en Platformbeheer met "Beter op een
// groot scherm". Een schuifvenster van onderen.
import { meerItems, tabsVoor } from '~~/shared/onderbalk'
const { me, functie } = useMe()
const { toon: toonNietAangezet } = useNietAangezet()
const open = useState<boolean>('meerOpen', () => false)
const uitgeklapt = ref(false)
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
const { openen: openAi } = useAssistent()
const lijst = computed(() => me.value ? meerItems(me.value.zijbalk, tabsVoor(me.value.gebruiker.werkplek, me.value.gebruiker.rol, me.value.gebruiker.eigenPortefeuille !== false)) : { groepen: [], nietAangezet: [] })
async function uitloggen() {
  await $fetch('/api/auth/uitloggen', { method: 'POST', body: {} })
  await navigateTo('/login', { external: true })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay meer-overlay" @click.self="open = false">
      <section class="fo-panel fo-panel--smal meer-venster" role="dialog" aria-modal="true" aria-label="Meer" data-test="meer-venster">
        <header class="fo-head"><div class="fo-head-tekst"><h2 class="fo-titel">Meer</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="open = false"><Icoon naam="X" /></button></header>
        <div class="fo-body">
          <button v-if="aiAan" type="button" class="meer-item" data-test="meer-ai" @click="open = false; openAi()"><Icoon naam="Sparkles" :grootte="20" /><span>AI-assistent</span></button>
          <section v-for="g in lijst.groepen" :key="g.naam" class="meer-groep">
            <h3 class="meer-kop">{{ g.naam }}</h3>
            <NuxtLink v-for="i in g.items" :key="i.sleutel" :to="i.route" class="meer-item" :data-route="i.route" @click="open = false">
              <Icoon :naam="i.icoon" :grootte="20" /><span>{{ i.naam }}</span><span v-if="i.grootScherm" class="meta">Beter op een groot scherm</span><span v-else-if="i.label" class="meta">{{ i.label }}</span>
            </NuxtLink>
          </section>
          <section class="meer-groep">
            <h3 class="meer-kop">Jij</h3>
            <NuxtLink to="/help" class="meer-item" @click="open = false"><Icoon naam="CircleHelp" :grootte="20" /><span>Helpcenter</span></NuxtLink>
            <NuxtLink to="/mij" class="meer-item" data-route="/mij" @click="open = false"><Icoon naam="UserCog" :grootte="20" /><span>Mijn instellingen</span></NuxtLink>
            <button type="button" class="meer-item" data-test="meer-uitloggen" @click="uitloggen"><Icoon naam="LogOut" :grootte="20" /><span>Uitloggen</span></button>
          </section>
          <section v-if="lijst.nietAangezet.length" class="meer-groep" data-test="meer-niet-aangezet">
            <button type="button" class="meer-kop meer-kop--knop" :aria-expanded="uitgeklapt" @click="uitgeklapt = !uitgeklapt">Nog niet aangezet <span class="pil-teller">{{ lijst.nietAangezet.length }}</span></button>
            <template v-if="uitgeklapt">
              <button v-for="i in lijst.nietAangezet" :key="i.sleutel" type="button" class="meer-item meer-item--slot" @click="open = false; toonNietAangezet(i.sleutel)"><Icoon naam="Lock" :grootte="18" /><span>{{ i.naam }}</span></button>
            </template>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>
