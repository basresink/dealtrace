// Geplande functie op Netlify: elke 5 minuten de herinneringen bij taken (F06).
export default async () => {
  const basis = process.env.URL
  const geheim = process.env.MOTOR_SECRET
  if (!basis || !geheim) return
  const r = await fetch(`${basis}/api/motor/reminders-sweep`, { method: 'POST', headers: { 'x-motor-secret': geheim } })
  console.log(`herinneringen: ${r.status}`)
}

export const config = { schedule: '*/5 * * * *' }
