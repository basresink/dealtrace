// De hulpflyout (F21): de knop "Hulp" in elke paginakop opent het artikel van dat scherm.
export function useHulp() {
  const open = useState<boolean>('hulpOpen', () => false)
  const slug = useState<string | null>('hulpSlug', () => null)
  return {
    open, slug,
    toon: (s?: string | null) => { slug.value = s || null; open.value = true },
    sluit: () => { open.value = false },
  }
}

