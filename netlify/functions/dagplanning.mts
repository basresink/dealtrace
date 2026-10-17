// Geplande functie op Netlify: elk kwartier de automatische dagplanning (F3 Dagplanner). Plant de dag van
// wie "Plan mijn dag automatisch" aanzette op zijn tijdstip, één keer per werkdag, en herplant bij een
// wijziging in de gekoppelde agenda. Roept POST /api/motor/dagplanning aan met MOTOR_SECRET.
export default async () => {
  const basis = process.env.URL
  const geheim = process.env.MOTOR_SECRET
  if (!basis || !geheim) return
  const r = await fetch(`${basis}/api/motor/dagplanning`, { method: 'POST', headers: { 'x-motor-secret': geheim } })
  console.log(`dagplanning: ${r.status}`)
}

export const config = { schedule: '*/15 * * * *' }
