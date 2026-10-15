<script setup lang="ts">
// Conflictvenster (F24): beide versies, "Houd mijn versie" of "Neem de andere over".
const { conflict, losConflictOp } = useSyncQueue()
</script>

<template>
  <Teleport to="body">
    <div v-if="conflict" class="venster-overlay">
      <aside class="venster" role="dialog" aria-modal="true" aria-labelledby="conflict-titel">
        <header class="venster-kop">
          <div><span class="venster-kicker">Synchronisatie</span><h2 id="conflict-titel" class="venster-titel">Iemand anders wijzigde dit ook.</h2></div>
        </header>
        <div class="venster-body">
          <p class="tekst">Jouw wijziging en de versie op de server verschillen. Kies welke blijft.</p>
          <h3 class="kop-klein mt-16">Jouw versie</h3>
          <pre class="mono">{{ JSON.stringify(conflict.mutatie.patch, null, 2) }}</pre>
          <h3 class="kop-klein mt-16">Versie op de server</h3>
          <pre class="mono">{{ JSON.stringify(conflict.serverStand, null, 2) }}</pre>
        </div>
        <footer class="venster-voet dd-acties">
          <button type="button" class="dd-act dd-act--primair" @click="losConflictOp('mijn')">Houd mijn versie</button>
          <button type="button" class="dd-act" @click="losConflictOp('ander')">Neem de andere over</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
