# Roadmap
## Share-back visitor-counter fix
- [ ] Forward request-scoped visitor identity; keep missing-header requests on the per-card ceiling only.
- [ ] Apply and verify a narrow database helper change and regression tests.
## Security audit — database (part 1)
- [x] Apply the nine approved database fixes in one generated migration without changing history.
- [x] Replace teammate profile reads and extend existing reminder cleanup in app code.
- [x] Verify live policies, grants, functions, and focused/full tests; provide applied SQL.
- [ ] Publish the teammate-name RPC integration and reminder cleanup call (requires user publication request).
## Phase 1 (built)
- [x] Auth (email + Google), onboarding
- [x] Card builder, live preview, autosave
- [x] Public card /c/:slug, vCard, share-back, growth footer
- [x] QR (PNG/SVG, full screen)
- [x] Contacts dashboard (notes, tags, filters, CSV, manual add)
- [x] Analytics, Settings (delete account)
## Phase 2 — AI (in progress)
- [x] 2a Card scanner: photos of paper cards → AI-extracted contacts (/app/scan)
- [x] 2c (part) AI follow-up email drafts on contact detail
- [x] 2b Contact enrichment: suggest-and-confirm on contact detail (web search)
- [x] 2c (rest) Voice notes (browser dictation) + AI note summaries
Requires the ANTHROPIC_API_KEY secret in the server environment.
## Phase 3 — reach tools
- [x] Email signature generator (/app/tools/signature): 3 email-safe layouts, save-contact link, Gmail/Outlook/Apple Mail setup
- [x] Virtual background generator (/app/tools/background): 1920x1080 PNG with card QR, corner/size options, custom upload
- [ ] Apple/Google Wallet passes — deferred: needs an Apple Developer account + pass signing certs (or Google Wallet issuer)
## Later (not started — see project memory): Phase 4 pro
