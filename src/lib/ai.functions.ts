import { createServerFn } from "@tanstack/react-start";
import { requireActiveAuth } from "@/lib/auth-guard";
import {
  NoteSummarySchema,
  SummarizeNoteInputSchema,
  EnrichInputSchema,
  EnrichmentResultSchema,
  FollowUpDraftSchema,
  FollowUpInputSchema,
  OwnCardScanSchema,
  ScanCardsInputSchema,
  ScanMyCardInputSchema,
  ScanResultSchema,
  SELF_SCANS_PER_DAY,
} from "./ai-model";
import { usageUnits } from "./plans";

// Card OCR, drafts and summaries run on Sonnet: about half of Opus's price per
// unit, which is what the plan allowances and top-up packs are priced against
// (plans.ts). Enrichment keeps Opus for the research and verification quality.
const FAST_MODEL = "claude-sonnet-5-5";
const RESEARCH_MODEL = "claude-opus-5-5";

// Load inside handlers only: *.functions.ts ships to the client bundle (same rule
// as client.server.ts), and the SDK must never leak there.
async function getAnthropic() {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    throw new Error(
      "AI is not configured yet: add an ANTHROPIC_API_KEY secret to this project's server environment.",
    );
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic();
}

/** Reads photos of paper business cards and returns one structured contact per card. */
export const scanCards = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(ScanCardsInputSchema)
  .handler(async ({ data, context }) => {
    const { reserveUsage, settleUsage, logAiCall } = await import("./usage.server");
    // 1 card = 1 scan: every photo holds at least one card. Reserved before
    // the call so parallel requests can't all slip past the allowance.
    const reservation = await reserveUsage(context.userId, "scan", data.images.length);
    const client = await getAnthropic();
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");

    const response = await client.messages.parse({
      model: FAST_MODEL,
      max_tokens: 16000,
      system:
        "You extract contact details from photos of paper business cards. " +
        "Each photo may show one card or several; return one entry per distinct card. " +
        "Copy values exactly as printed (correct obvious OCR-style misreads only). " +
        "Normalize phone numbers to include the country code when it is printed. " +
        "Put the postal address in `address` as a single line, exactly as printed. " +
        "Put social handles, taglines, or handwritten text in `extra`. " +
        "Use null for anything not on the card — never invent a value. " +
        "Skip anything that is clearly not a business card. " +
        "`source_image_index` is the zero-based position, in the order given, of the photo " +
        "the card was found in. If the card itself shows a photo of the person (a printed " +
        "headshot), set `headshot_box` to a tight bounding box around that printed photo, " +
        "with x/y/w/h as fractions (0–1) of the full photo's width and height, x/y being the " +
        "top-left corner. Only box a photographic human face printed on the card — never a " +
        "logo, icon, illustration, or QR code, and never the whole card. Use null when unsure.",
      messages: [
        {
          role: "user",
          content: [
            ...data.images.map(
              (img) =>
                ({
                  type: "image",
                  source: { type: "base64", media_type: img.media_type, data: img.data },
                }) as const,
            ),
            {
              type: "text",
              text: `Extract every business card in these ${data.images.length} photo(s).`,
            },
          ],
        },
      ],
      // Structured extraction: medium effort keeps reasoning tokens (the main cost) down.
      output_config: { format: zodOutputFormat(ScanResultSchema), effort: "medium" },
    });
    void logAiCall(context.userId, "scan", FAST_MODEL, response.usage);

    if (response.stop_reason === "refusal") {
      await settleUsage(reservation, 0);
      throw new Error("The AI declined to process these images. Try different photos.");
    }
    if (!response.parsed_output) {
      await settleUsage(reservation, 0);
      throw new Error("Could not read the cards from these photos. Try clearer, closer shots.");
    }
    await settleUsage(reservation, usageUnits("scan", response.parsed_output.contacts.length));
    return response.parsed_output;
  });

/** Reads the user's OWN paper business card (front, optionally back) to build
 *  their digital card. Free on every plan, so it skips the monthly scan
 *  allowance; a daily cap guards against misuse instead. */
export const scanMyCard = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(ScanMyCardInputSchema)
  .handler(async ({ data, context }) => {
    const { assertSelfScanAllowance, recordSelfScan, logAiCall } = await import("./usage.server");
    await assertSelfScanAllowance(context.userId, SELF_SCANS_PER_DAY);
    await recordSelfScan(context.userId); // counts whatever the photo turns out to be
    const client = await getAnthropic();
    const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");

    const response = await client.beta.messages.parse({
      model: FAST_MODEL,
      max_tokens: 16000,
      // On a policy decline the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You read a person's own paper business card so it can be turned into their " +
        "digital business card. The photos show the front and, if given, the back of ONE " +
        "card. Set `is_business_card` false if the photos don't show a business card.\n" +
        "Copy text exactly as printed (correct obvious OCR-style misreads only) and use " +
        "null or an empty list for anything not on the card — never invent a value.\n" +
        "- phones / emails: every one printed, each with a short label from the card " +
        '("Mobile", "Office", "Fax", "Work"…) or a sensible one if unlabeled.\n' +
        "- website: the main company or personal site. address: the postal address as one " +
        "line. tagline: a slogan or tagline, if printed.\n" +
        "- social_links: social profiles or handles as full URLs (an @handle next to a " +
        "LinkedIn icon becomes https://linkedin.com/in/handle); skip ones you can't resolve.\n" +
        "- brand_color: the card's dominant brand color (logo, colored band or accent text) " +
        'as "#RRGGBB"; background_color: the card stock behind the main text as "#RRGGBB".\n' +
        "- logo: a tight box around the company logo (symbol plus wordmark when they sit " +
        "together). headshot: a tight box around a printed photo of the person's face. " +
        "Boxes are x/y/w/h fractions (0–1) of that photo's width and height, x/y the " +
        "top-left corner, with image_index the zero-based photo it is on. Never box the " +
        "whole card, a QR code, or a decorative icon; use null when unsure.",
      messages: [
        {
          role: "user",
          content: [
            ...data.images.map(
              (img) =>
                ({
                  type: "image",
                  source: { type: "base64", media_type: img.media_type, data: img.data },
                }) as const,
            ),
            {
              type: "text",
              text:
                data.images.length > 1
                  ? "Read my business card: photo 0 is the front, photo 1 the back."
                  : "Read my business card.",
            },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(OwnCardScanSchema) },
    });
    void logAiCall(context.userId, "self_scan", FAST_MODEL, response.usage);

    if (response.stop_reason === "refusal") {
      throw new Error("The AI declined to read this photo. Try a different shot of your card.");
    }
    if (!response.parsed_output) {
      throw new Error("Could not read your card. Try a clearer, closer photo in good light.");
    }
    if (!response.parsed_output.is_business_card) {
      throw new Error("That doesn't look like a business card. Try a photo of your card.");
    }
    return response.parsed_output;
  });

/** Drafts a personalized follow-up email for one captured contact. */
export const draftFollowUp = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(FollowUpInputSchema)
  .handler(async ({ data, context }) => {
    const { reserveUsage, settleUsage, logAiCall } = await import("./usage.server");
    const reservation = await reserveUsage(context.userId, "follow_up");
    const { supabase } = context;
    const [c, n, t, card] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", data.contactId).maybeSingle(),
      supabase
        .from("contact_notes")
        .select("body, created_at")
        .eq("contact_id", data.contactId)
        .order("created_at"),
      supabase.from("contact_tags").select("tag").eq("contact_id", data.contactId),
      supabase
        .from("cards")
        .select("full_name, job_title, company")
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);
    if (c.error) throw c.error;
    if (!c.data) throw new Error("Contact not found");

    const contact = c.data;
    const sender = card.data;
    const facts = [
      `Name: ${contact.full_name}`,
      contact.job_title && `Title: ${contact.job_title}`,
      contact.company && `Company: ${contact.company}`,
      contact.met_at && `Where we met: ${contact.met_at}`,
      contact.note && `Message they left when sharing details: ${contact.note}`,
      (t.data ?? []).length && `Tags: ${(t.data ?? []).map((x) => x.tag).join(", ")}`,
      (n.data ?? []).length &&
        `My notes about them/our conversation:\n${(n.data ?? []).map((x) => `- ${x.body}`).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const client = await getAnthropic();
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");

    const response = await client.messages.parse({
      model: FAST_MODEL,
      max_tokens: 16000,
      system:
        "You write short, warm, specific follow-up emails after networking conversations. " +
        "Rules: under 120 words; reference where we met and what we discussed when known; " +
        "one clear, low-pressure next step; no flattery, no buzzwords, no exclamation marks; " +
        "plain text only; never fabricate details — if something is unknown, leave it out " +
        "rather than using a placeholder. Sign off with the sender's first name.",
      messages: [
        {
          role: "user",
          content:
            `Draft a follow-up email from me to this person.\n\n` +
            `About them:\n${facts}\n\n` +
            `About me (the sender): ${
              sender
                ? [sender.full_name, sender.job_title, sender.company].filter(Boolean).join(", ")
                : "unknown"
            }`,
        },
      ],
      output_config: { format: zodOutputFormat(FollowUpDraftSchema) },
    });
    void logAiCall(context.userId, "follow_up", FAST_MODEL, response.usage);

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      await settleUsage(reservation, 0);
      throw new Error("Could not draft a follow-up for this contact. Try again.");
    }
    await settleUsage(reservation, 1);
    return response.parsed_output;
  });

/** Researches a contact on the web and returns verified field SUGGESTIONS only; never writes. */
export const enrichContact = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(EnrichInputSchema)
  .handler(async ({ data, context }) => {
    const { reserveUsage, settleUsage, logAiCall } = await import("./usage.server");
    const reservation = await reserveUsage(context.userId, "enrich");
    const { data: contact, error } = await context.supabase
      .from("contacts")
      .select("full_name, email, company, job_title, website, linkedin_url")
      .eq("id", data.contactId)
      .maybeSingle();
    if (error) throw error;
    if (!contact) throw new Error("Contact not found");
    const hasNameCompany = !!contact.full_name.trim() && !!contact.company?.trim();
    if (!hasNameCompany && !contact.email?.trim()) {
      throw new Error("Add a company or an email to this contact before enriching.");
    }

    const known = [
      `Name: ${contact.full_name}`,
      contact.email &&
        `Email: ${contact.email} (domain: ${contact.email.split("@")[1] ?? "unknown"})`,
      contact.company && `Company: ${contact.company}`,
      contact.job_title && `Title: ${contact.job_title}`,
      contact.website && `Website: ${contact.website}`,
      contact.linkedin_url && `LinkedIn: ${contact.linkedin_url}`,
    ]
      .filter(Boolean)
      .join("\n");

    const client = await getAnthropic();
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    type Params = Parameters<typeof client.messages.parse>[0];
    const messages: Params["messages"] = [
      {
        role: "user",
        content:
          `Research this professional contact and suggest values for job_title, company, website ` +
          `(company website) and linkedin_url (their personal LinkedIn profile).\n\nKnown:\n${known}`,
      },
    ];

    // Server-side web search can pause long turns; continue a bounded number of times.
    for (let turn = 0; turn < 3; turn++) {
      const response = await client.messages.parse({
        model: RESEARCH_MODEL,
        max_tokens: 16000,
        system:
          "You enrich contact records using web search. Search for the person by name + company, " +
          "or by the email domain to identify their company. Before suggesting anything, verify the " +
          "result is the SAME person (name plus company, domain, or role must match) — common names " +
          "need extra corroboration. Prefer official sources: LinkedIn, the company's own website, " +
          "reputable press. For every field you cannot verify with high confidence, return null — " +
          "never guess or infer from patterns. Returning all nulls is correct when nothing reliable " +
          "is found. For each non-null field, `source` names the exact URL or evidence it came from. " +
          "`summary` is one sentence on how identity was verified, or why nothing reliable was found.",
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages,
        output_config: { format: zodOutputFormat(EnrichmentResultSchema) },
      });
      void logAiCall(context.userId, "enrich", RESEARCH_MODEL, response.usage);

      if (response.stop_reason === "refusal") {
        await settleUsage(reservation, 0);
        throw new Error("The AI declined to research this contact.");
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (!response.parsed_output) {
        await settleUsage(reservation, 0);
        throw new Error("Could not enrich this contact. Try again.");
      }
      await settleUsage(reservation, 1);
      return response.parsed_output;
    }
    await settleUsage(reservation, 0);
    throw new Error("Research took too long. Try again.");
  });

/** Summarizes one contact note into key points and next steps; does not write anything. */
export const summarizeNote = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(SummarizeNoteInputSchema)
  .handler(async ({ data, context }) => {
    const { reserveUsage, settleUsage, logAiCall } = await import("./usage.server");
    const reservation = await reserveUsage(context.userId, "summarize");
    const { data: note, error } = await context.supabase
      .from("contact_notes")
      .select("body")
      .eq("id", data.noteId)
      .maybeSingle();
    if (error) throw error;
    if (!note) throw new Error("Note not found");

    const client = await getAnthropic();
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");

    const response = await client.messages.parse({
      model: FAST_MODEL,
      max_tokens: 16000,
      system:
        "You summarize notes a professional took after meeting someone (often raw voice " +
        "transcripts with filler words and no punctuation). Return concise key_points (facts, " +
        "needs, interests, context) and next_steps (concrete follow-up actions). Each item is one " +
        "short sentence. Use only what the note says — never invent details. Return an empty " +
        "next_steps array if none are implied.",
      messages: [{ role: "user", content: `Summarize this note:\n\n${note.body}` }],
      output_config: { format: zodOutputFormat(NoteSummarySchema), effort: "medium" },
    });
    void logAiCall(context.userId, "summarize", FAST_MODEL, response.usage);

    if (response.stop_reason === "refusal") {
      await settleUsage(reservation, 0);
      throw new Error("The AI declined to summarize this note.");
    }
    if (!response.parsed_output) {
      await settleUsage(reservation, 0);
      throw new Error("Could not summarize this note. Try again.");
    }
    await settleUsage(reservation, 1);
    return response.parsed_output;
  });
