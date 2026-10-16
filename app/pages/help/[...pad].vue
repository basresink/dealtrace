<script setup lang="ts">
// /help en /help/... zijn verhuisd naar /helpcenter: zelfde pad, zelfde query en anker (oude links,
// bladwijzers en artikelen die nog naar /help wijzen).
definePageMeta({
  redirect: (to) => {
    const pad = ([] as string[]).concat((to.params.pad as string | string[] | undefined) ?? []).filter(Boolean).join('/')
    return { path: pad ? `/helpcenter/${pad}` : '/helpcenter', query: to.query, hash: to.hash }
  },
})
</script>

<template>
  <div />
</template>
