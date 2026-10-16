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
  // Founder buiten een organisatie: Platformbeheer, en verder alleen notificaties (/meldingen stuurt door).
  if (!geladen.organisatie && !to.path.startsWith('/platform') && to.path !== '/notificaties' && to.path !== '/meldingen') return navigateTo('/platform/klanten')
})
