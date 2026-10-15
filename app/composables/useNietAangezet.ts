// De uitlegflyout voor een functie die voor je niveau nog niet aanstaat (6.1).
export function useNietAangezet() {
  const open = useState<string | null>('nietAangezet', () => null)
  return { open, toon: (sleutel: string) => (open.value = sleutel), sluit: () => (open.value = null) }
}
