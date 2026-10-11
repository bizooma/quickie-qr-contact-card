import { supabase } from "@/integrations/supabase/client";

export type SiteEvent = "cta_click" | "demo_click" | "pricing_view" | "signup";

/** Fire-and-forget landing page event. The .then() matters: PostgREST builders
 *  are lazy and never execute unless awaited or .then()-ed. */
export function logSiteEvent(event: SiteEvent, meta?: string) {
  supabase
    .rpc("log_site_event", { _event_type: event, ...(meta ? { _meta: meta } : {}) })
    .then(undefined, () => {});
}
