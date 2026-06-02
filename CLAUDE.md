## Vigtigt — projektkontekst
Dette er albert-cv, sitet albertdieckmann.dk.
- Strukturen er src/app/ (Next.js App Router). Opret ALDRIG en root app/-mappe — det overskriver sitet med forkert indhold (rf-pressecenter).
- Hver underside er en mappe under src/app/ (fringe, roskilde, madspild osv.).
- Deploy med `vercel --prod` fra denne mappe (koblet til Vercel-projektet albert-cv).
- rf-pressecenter er et SEPARAT projekt i ~/rf-pressecenter — bland aldrig de to.

@AGENTS.md
