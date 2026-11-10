<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Public card data, view/save logging, and share-back submissions go only through SECURITY DEFINER RPCs (`get_public_card`, `log_card_event`, `submit_shareback`); anon has no direct table grants. Why: keeps owner data private while the public page stays login-free.
- Card images live in the private `card-media` bucket under `<user_id>/` and are shown via signed URLs. Why: workspace blocks public buckets.
- Authenticated app screens live under `/app` with `ssr: false` and query via the browser client (RLS). Why: session is client-side.
- Pure card logic (vCard, CSV, slugs) lives in `src/lib/card-model.ts` with unit tests. Why: testable without network.
- Team member names use the membership-scoped `team_member_names` RPC, not teammate profile reads. Why: expose names without revealing private billing, grants, or webhooks.
- Public RPC abuse tracking stays in private database functions/tables; the existing authorized reminders cron calls its cleanup RPC. Why: contain limits without a new service or schedule.
- Server-mediated public RPCs forward visitor IP through a request-scoped header trusted only for service-role calls; missing visitor headers skip per-IP limits. Why: the database's network headers otherwise identify the app server and merge visitors into one counter.
- Metered AI actions run everything after `reserveUsage` inside `runMetered` (usage.server.ts). Why: any thrown error must release the reservation and refund credits.
