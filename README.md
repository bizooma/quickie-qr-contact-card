# QuickieQR (quickieqr.com)

Build "SignatureSurge" (working title — I'll rebrand later), a personal digital business
card + AI contacts platform. Think Blinq-style functionality but my own product.
Mobile-first PWA, clean modern SaaS design (generous whitespace, one accent color,
dark mode). Use Supabase for auth, database, and storage.

I am the primary user, but build it multi-user from the start (every table scoped to
user_id with RLS).

=== PHASE 1 — BUILD THIS NOW ===

1. AUTH: Email + Google sign-in. Simple onboarding that drops the user into creating
   their first card.

2. CARD BUILDER (the core):
   - Multiple cards per user (e.g. "Work", "Side business", "Personal")
   - Fields: name, job title, company, phone(s), email(s), website, location,
     headshot photo, company logo, and UNLIMITED custom links (label + URL + icon),
     including social profiles (LinkedIn, X, Instagram, YouTube, TikTok), booking
     links, and payment links
   - Customization: accent color, background color, font choice, 2–3 layout
     templates; live phone-frame preview while editing
   - Edits publish instantly — anyone viewing the card always sees current data

3. PUBLIC CARD PAGE at /c/:slug :
   - Beautiful mobile-first page, viewable with NO login and NO app
   - "Save contact" button that downloads a vCard (.vcf) with all details + photo
   - "Share your details back" form (name, email, phone, company, note) — submissions
     become contacts for the card owner, stamped with date/time and which card
     captured them
   - Subtle "Create your own card" footer link (the growth loop)

4. QR CODES: Auto-generate a QR code per card linking to its public page.
   Downloadable as PNG and SVG, color-matched to the card. Full-screen QR view in
   the app for in-person sharing.

5. CONTACTS DASHBOARD:
   - All captured contacts: photo/initials, name, company, where/when met
   - Notes and tags on each contact (e.g. Hot lead, Follow up, Met at [event])
   - Search, filter by tag/date/card, and CSV export
   - Manual "add contact" form

6. ANALYTICS: Per card — views, contact saves, share-backs over time. Simple chart
   + stat tiles.

7. SETTINGS: Profile, manage cards, delete account/data.

Database sketch: users/profiles, cards, card_links, contacts, contact_notes,
contact_tags, card_views. All with RLS.

=== ROADMAP — DO NOT BUILD YET, save to project knowledge ===
Phase 2 (AI layer, via edge functions + Anthropic Claude API):
  a) Card scanner: photo a paper business card → AI vision extracts name/company/
     email/phone → creates a contact
  b) Contact enrichment: from name+company or email, fill title/LinkedIn/company info
  c) AI notes: record/upload a voice memo after meeting someone → transcript +
     summary + suggested follow-up email, attached to the contact
Phase 3 (reach tools): email signature generator (HTML, matches card, copy-paste for
Gmail/Outlook); virtual meeting background generator (upload image, overlay card QR,
download); Apple/Google Wallet passes
Phase 4 (pro): lead qualifiers on share-back forms, event campaigns with per-event
tags and reporting, HubSpot sync, Zapier webhooks, team features

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://contactkickstart.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/47eb069c-46a5-4b91-8359-3b044f3e0bde).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
