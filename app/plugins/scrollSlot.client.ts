// Scrollslot: zolang er een flyout, venster of zoekvenster open staat, scrollt de pagina erachter
// niet en toont ze geen eigen scrollbalk. Zo staat er op de laptop maar één scrollbalk (die van
// de flyout). Centraal geregeld: elke overlay (.fo-overlay, .cd-overlay, .venster-overlay,
// .zoek-overlay) telt mee, ook geneste flyouts. Bij sluiten of navigeren herstelt de pagina.
// Had de pagina een scrollbalk, dan vult padding-right op body precies die breedte op zodat de
// layout niet verspringt (en de overlay tot de rand van het scherm loopt).
const OVERLAYS = ['.fo-overlay', '.cd-overlay', '.venster-overlay', '.zoek-overlay']
  .map((s) => `${s}:not(.is-statisch)`)
  .join(', ')

export default defineNuxtPlugin(() => {
  const root = document.documentElement
  let vast = false

  function werkBij() {
    const open = document.querySelector(OVERLAYS) !== null
    if (open === vast) return
    vast = open
    if (open) {
      // Meet vóór het vastzetten of de pagina zelf een scrollbalk had.
      const balk = Math.max(0, window.innerWidth - root.clientWidth)
      root.style.setProperty('--scroll-slot-balk', `${balk}px`)
      root.classList.add('scroll-slot')
    } else {
      root.classList.remove('scroll-slot')
      root.style.removeProperty('--scroll-slot-balk')
    }
  }

  new MutationObserver(werkBij).observe(document.body, { childList: true, subtree: true })
  useRouter().afterEach(() => nextTick(werkBij))
  werkBij()
})
