// PWA-basis (P27, 8.14): de service worker registreren en de handschoen- en zonlichtmodus
// (Mijn instellingen, blok Telefoon) op het html-element zetten. Lokaal in de browser bewaard.
export default defineNuxtPlugin(() => {
  try {
    const root = document.documentElement
    root.classList.toggle('handschoen', localStorage.getItem('dt_handschoen') === '1')
    root.classList.toggle('zonlicht', localStorage.getItem('dt_zonlicht') === '1')
    // Gebruiksdagen voor de installatievraag (na de tweede dag).
    const dagen = new Set(JSON.parse(localStorage.getItem('dt_dagen') ?? '[]') as string[])
    dagen.add(new Date().toISOString().slice(0, 10))
    localStorage.setItem('dt_dagen', JSON.stringify([...dagen].slice(-10)))
  } catch { /* privémodus */ }
  if ('serviceWorker' in navigator && !import.meta.dev) navigator.serviceWorker.register('/sw.js').catch(() => {})
})
