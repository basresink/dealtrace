<script setup lang="ts">
// Audit (P21): wie veranderde wat, met filters op wie, soort en periode, paging en CSV. De salesmanager
// ziet zijn teams. De beheerder heeft één auditscherm: /instellingen/audit (alles, ook wat Dealtrace deed,
// en de toegang van de leverancier); daar gaat hij heen.
const { functie } = useMe()
const aan = computed(() => !!functie('nav.audit')?.beschikbaar)
if (functie('instellingen.audit')?.beschikbaar) await navigateTo({ path: '/instellingen/audit', query: useRoute().query }, { replace: true })
useHead({ title: 'Audit · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.audit" />
    <template v-else>
      <PaginaKop kicker="Audit" titel="Wie veranderde wat" uitleg="Wijzigingen van en bij de mensen in je teams." helpartikel="audit" />
      <section class="section section--laatste">
        <div class="container">
          <AuditLijst bron="/api/audit" />
        </div>
      </section>
    </template>
  </div>
</template>
