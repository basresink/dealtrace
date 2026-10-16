// Geplande functie op Netlify: elk kwartier de mails van het dagritme (weekreview op vrijdag, weekstart
// op maandag, dagstart op elke werkdag). Roept POST /api/motor/dagritme-mail aan met MOTOR_SECRET.
export default async () => {
  const basis = process.env.URL
  const geheim = process.env.MOTOR_SECRET
  if (!basis || !geheim) return
  const r = await fetch(`${basis}/api/motor/dagritme-mail`, { method: 'POST', headers: { 'x-motor-secret': geheim } })
  console.log(`dagritme-mail: ${r.status}`)
}

export const config = { schedule: '*/15 * * * *' }
