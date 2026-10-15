# Mock van DealDrive

Vaste antwoorden voor de adapter `mock` uit `docs/api/dealdrive-koppeling.md` (hoofdstuk 7) en als fixtures voor de contracttests. Alle gegevens zijn fictief en horen bij de startset Voltvast (`seed/voltvast.json`).

| Bestand | Wat |
|---|---|
| `overdracht-verzoek.json` | Voorbeeld van `POST /overdrachten` |
| `overdracht-antwoord.json` | Antwoord 201 van DealDrive |
| `fout-al-klant.json` | Antwoord 409 als het bedrijf al klant is |
| `zoek-antwoord.json` | Antwoord van `GET /accounts/zoek` |
| `webhook-overdracht-verwerkt.json` | Terugmelding na verwerking |
| `webhook-deal-gewonnen.json` | Deal gewonnen in DealDrive |
| `webhook-deal-verloren.json` | Deal verloren, met reden en concurrent |
| `webhook-klant-slapend.json` | Klant bestelt al 6 maanden niet |
