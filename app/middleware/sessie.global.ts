// Zonder sessie naar /login; met sessie de gebruiker en zijbalk laden.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return
  const { me, laad } = useMe()
  if (me.value) return
  let geladen
  try {
    geladen = await laad()
  } catch {
    return navigateTo('/login')
  }
  if (!geladen.organisatie && to.path !== '/platform') return navigateTo('/platform')
})
