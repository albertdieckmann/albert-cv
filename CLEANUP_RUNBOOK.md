# Cleanup & Architecture Runbook — albert-cv

Du er Claude Code. Kør denne runbook **sekventielt fra trin 0**. Reglerne nedenfor er ufravigelige.

## Arbejdsregler (gælder hele vejen)

- **Stop ved hvert 🛑 STOP-punkt.** Skriv hvad du har gjort/fundet, og vent på mit eksplicitte "fortsæt" eller min godkendelse. Gå ALDRIG videre forbi et 🛑 af dig selv.
- **Verificér med `next build` mellem hvert trin.** Brækker et build, rul seneste commit tilbage og rapportér — fortsæt ikke.
- **Commit hyppigt**, små logiske commits, én pr. område/feature.
- **Kritisk begrænsning:** `/fringe`, `/roskilde` og `/madspild` skal forblive FULDSTÆNDIG adskilte. Ingen delte moduler mellem dem. Ægte delt infrastruktur (db, auth, api-klienter) må ligge i `lib/`.
- Slet eller flyt aldrig kode forbi et godkendelses-gate uden at have vist mig listen først.

---

## Trin 0 — Baseline
Lav branch `cleanup-arch`. Bekræft rent working tree. Kør `next build` + test-suite hvis den findes. Rapportér: antal filer, build-status, eksisterende warnings. Ingen ændringer.
🛑 STOP — vent på "fortsæt".

## Trin 1 — Linting & formatering
Tjek ESLint (eslint-config-next) og Prettier; sæt op hvis de mangler. Kør `next lint`, list fejl/warnings grupperet efter type. Ret kun trivielle/sikre ting. List alt der kræver vurdering.
🛑 STOP — vis listen.

## Trin 2 — Find ubrugt kode
Installér og kør `knip`. Rapportér ubrugte filer, exports, dependencies, typer. Slet INTET. Marker sikkerhed pr. post. Vær forsigtig med dynamisk brug og fil-baseret routing.
🛑 STOP — jeg godkender hvad der må slettes.

## Trin 3 — Slet ubrugt kode
Slet kun det godkendte. Små commits pr. område. `next build` efter hver gruppe; rul tilbage ved brud.
🛑 STOP — vent på "fortsæt".

## Trin 4 — Skærp TypeScript
Slå `strict`, `noUnusedLocals`, `noUnusedParameters` til hvis inaktive. Type-check, list nye fejl pr. fil. Ret de mekaniske. Beskriv (gæt ikke) fejl der afslører logiske svagheder.
🛑 STOP — vis logiske fund.

## Trin 5 — Kortlæg arkitektur
`npx madge --circular --extensions ts,tsx` på src. Rapportér cirkulære afhængigheder, filer der gør for meget, forretningslogik i komponenter, og ethvert sted /fringe, /roskilde, /madspild deler kode (kritisk). Analyse only, ingen ændringer.
🛑 STOP — vis analyse + anbefalinger.

## Trin 6 — Foreslå feature-struktur
Foreslå mappestruktur efter feature/domæne, der bevarer de tre ruters adskillelse. Vis som træ.
🛑 STOP — vent på godkendelse af strukturen.

## Trin 7 — Træk forretningslogik ud
Én feature ad gangen (start mest rodet). Flyt datahentning/transformationer/regler ud i rene funktioner. Komponent orkestrerer + rendrer kun. `next build` + commit pr. feature.
🛑 STOP efter HVER feature — vent på "fortsæt".

## Trin 8 — Adskil server/klient
Klar adskillelse: server-kode (DB-queries, SSE, capability-URLs, recovery-koder) vs. klient. Saml typer pr. feature. Del filer med flere ansvar. Mekaniske flyt, ingen logikændring. Build efter hvert skridt.
🛑 STOP — vent på "fortsæt".

## Trin 9 — Håndhæv grænser
Tilføj `import/no-restricted-paths` (eller eslint-plugin-boundaries): forbyd at /fringe, /roskilde, /madspild importerer fra hinanden. Tilføj `import/no-cycle`. Kør lint; hvis reglerne fanger eksisterende legitim kode, vis mig det.
🛑 STOP — vis resultat.

## Trin 10 — Slutverificering
Kør `next lint`, type-check, `next build`, test-suite. List manuelle klik-flows: gruppe-membership, willingness-niveauer pr. performance, recovery-koder, hver af de tre adskilte ruter. Opsummér ændringer som PR-beskrivelse.
🛑 STOP — færdig.
