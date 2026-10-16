// Geplande functie op Netlify: elke 15 minuten de opvolgreeksen bijwerken (F7): stoppen bij een reactie,
// vervallen stappen klaarzetten en bij mandaat B een mail op de dag zelf versturen.
export default async () => {
  const basis = process.env.URL
  const geheim = process.env.MOTOR_SECRET
  if (!basis || !geheim) return
  const r = await fetch(`${basis}/api/motor/reeksen-sweep`, { method: 'POST', headers: { 'x-motor-secret': geheim } })
  console.log(`opvolgreeksen: ${r.status}`)
}

export const config = { schedule: '*/15 * * * *' }
