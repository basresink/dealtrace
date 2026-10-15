// Geplande functie op Netlify: elk uur de motor voor alle organisaties (F15).
// Roept POST /api/motor/run-all aan met het geheim uit MOTOR_SECRET.
export default async () => {
  const basis = process.env.URL
  const geheim = process.env.MOTOR_SECRET
  if (!basis || !geheim) {
    console.error('motor-uur: URL of MOTOR_SECRET ontbreekt')
    return
  }
  const r = await fetch(`${basis}/api/motor/run-all`, { method: 'POST', headers: { 'x-motor-secret': geheim } })
  console.log(`motor-uur: ${r.status}`)
}

export const config = { schedule: '@hourly' }
