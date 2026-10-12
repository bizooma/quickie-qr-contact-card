# Use support@myaisummit.dev everywhere

support@myaisummit.dev, run by MyAiSummit.dev LLC (the parent company), is the one official support address.

## Current state
- The Help, Privacy and Terms pages already show support@myaisummit.dev.
- The Security page shows support@contactkickstart.com in 3 places: GDPR requests, vendor security reviews and vulnerability reports. That inbox may not exist.

## Changes
1. Security page: replace all 3 support@contactkickstart.com links with support@myaisummit.dev. Only the email text and link change; the rest of the page stays as it is.
2. Save a permanent project rule: the support email is support@myaisummit.dev, and MyAiSummit.dev LLC is the parent company. Never swap it for a contactkickstart.com address.
3. SEO finding "Replace placeholder contact email": leave it as is, with no edits for it and no "fixed" mark. The address is your intentional choice. You can mark the finding as ignored in the SEO & AI search tab.

## Not changed
Help, Privacy and Terms pages, other text, page titles and descriptions, and structured data.

## Technical details
- File: `src/routes/security.tsx`, lines 57-58, 75-76 and 83-84 (each link's `mailto:` and its visible text).
- Memory: `mem://constraints/support-email`, plus a Core line in `mem://index.md`.
- Check afterwards: search `src/` for `contactkickstart.com` email addresses (expect none), and run the existing test suite.
