import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  NoteSummarySchema,
  SummarizeNoteInputSchema,
  EnrichInputSchema,
  EnrichmentResultSchema,
  FollowUpDraftSchema,
  FollowUpInputSchema,
  ScanCardsInputSchema,
  ScanResultSchema,
} from "./ai-model";

const MODEL = "claude-opus-5-5";

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
  .middleware([requireSupabaseAuth])
  .validator(ScanCardsInputSchema)
  .handler(async ({ data }) => {
    const client = await getAnthropic();
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system:
        "You extract contact details from photos of paper business cards. " +
        "Each photo may show one card or several; return one entry per distinct card. " +
        "Copy values exactly as printed (correct obvious OCR-style misreads only). " +
        "Normalize phone numbers to include the country code when it is printed. " +
        "Put addresses, social handles, taglines, or handwritten text in `extra`. " +
        "Use null for anything not on the card — never invent a value. " +
        "Skip anything that is clearly not a business card.",
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
      output_config: { format: zodOutputFormat(ScanResultSchema) },
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The AI declined to process these images. Try different photos.");
    }
    if (!response.parsed_output) {
      throw new Error("Could not read the cards from these photos. Try clearer, closer shots.");
    }
    return response.parsed_output;
  });

/** Drafts a personalized follow-up email for one captured contact. */
export const draftFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(FollowUpInputSchema)
  .handler(async ({ data, context }) => {
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
      model: MODEL,
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

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error("Could not draft a follow-up for this contact. Try again.");
    }
    return response.parsed_output;
  });

/** Researches a contact on the web and returns verified field SUGGESTIONS only; never writes. */
export const enrichContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(EnrichInputSchema)
  .handler(async ({ data, context }) => {
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
      contact.email && `Email: ${contact.email} (domain: ${contact.email.split("@")[1] ?? "unknown"})`,
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
        model: MODEL,
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

      if (response.stop_reason === "refusal") {
        throw new Error("The AI declined to research this contact.");
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (!response.parsed_output) {
        throw new Error("Could not enrich this contact. Try again.");
      }
      return response.parsed_output;
    }
    throw new Error("Research took too long. Try again.");
  });

/** Summarizes one contact note into key points and next steps; does not write anything. */
export const summarizeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(SummarizeNoteInputSchema)
  .handler(async ({ data, context }) => {
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
      model: MODEL,
      max_tokens: 16000,
      system:
        "You summarize notes a professional took after meeting someone (often raw voice " +
        "transcripts with filler words and no punctuation). Return concise key_points (facts, " +
        "needs, interests, context) and next_steps (concrete follow-up actions). Each item is one " +
        "short sentence. Use only what the note says — never invent details. Return an empty " +
        "next_steps array if none are implied.",
      messages: [{ role: "user", content: `Summarize this note:\n\n${note.body}` }],
      output_config: { format: zodOutputFormat(NoteSummarySchema) },
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The AI declined to summarize this note.");
    }
    if (!response.parsed_output) {
      throw new Error("Could not summarize this note. Try again.");
    }
    return response.parsed_output;
  });
