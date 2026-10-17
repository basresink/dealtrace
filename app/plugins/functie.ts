// $aan(sleutel) en $magNaar(pad) in elke template: dezelfde helper als useFunctie(),
// zodat een knop of link naar een uitgezette functie zonder extra script verdwijnt.
export default defineNuxtPlugin(() => {
  const { aan, magNaar } = useFunctie()
  return { provide: { aan, magNaar } }
})
