// Geplande functie op Netlify: elke 5 minuten de meldingen voor onderweg (P31).
export default async () => {
  const basis = process.env.URL
  const geheim = process.env.MOTOR_SECRET
  if (!basis || !geheim) return
  const r = await fetch(`${basis}/api/motor/onderweg-meldingen`, { method: 'POST', headers: { 'x-motor-secret': geheim } })
  console.log(`onderweg-meldingen: ${r.status}`)
}

export const config = { schedule: '*/5 * * * *' }
