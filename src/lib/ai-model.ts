// zod/v4: the Anthropic SDK's zodOutputFormat helper and TanStack's standard-schema
// validators both want v4 schemas (bundled with the zod 3.25+ package).
import { z } from "zod/v4";

// Shared between the scan UI and the AI server functions. Client-safe: no SDK imports.

export const SCAN_IMAGE_LIMIT = 12;
// ~2.8 MB of base64 per image; images are downscaled client-side well below this.
export const SCAN_IMAGE_MAX_CHARS = 2_800_000;

export const ScanImageSchema = z.object({
  data: z.string().min(1).max(SCAN_IMAGE_MAX_CHARS),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const ScanCardsInputSchema = z.object({
  images: z.array(ScanImageSchema).min(1).max(SCAN_IMAGE_LIMIT),
});

// Normalized (0–1) box, relative to the photo the card appears in, around a
// person's headshot printed on the card. Null when the card shows no face.
export const HeadshotBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const ScannedContactSchema = z.object({
  full_name: z.string(),
  job_title: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  // The person's LinkedIn profile, as a full URL.
  linkedin_url: z.string().nullable(),
  // Postal/street address as printed on the card, single line.
  address: z.string().nullable(),
  // Anything else legible on the card: other social handles, taglines, handwritten notes.
  extra: z.string().nullable(),
  // Zero-based index of the uploaded photo this card was found in.
  source_image_index: z.number().int().min(0),
  headshot_box: HeadshotBoxSchema.nullable(),
});

export const ScanResultSchema = z.object({
  contacts: z.array(ScannedContactSchema),
});

export type ScannedContact = z.infer<typeof ScannedContactSchema>;
export type HeadshotBox = z.infer<typeof HeadshotBoxSchema>;

// ---- Scan my own card ------------------------------------------------------
// The user photographs their own paper business card (front, optionally back)
// to build their digital card: details, brand colors, logo and photo.

export const SELF_SCAN_IMAGE_LIMIT = 2;
// Own-card scans don't use the monthly scan allowance; this daily cap is
// the abuse guard instead.
export const SELF_SCANS_PER_DAY = 10;

export const ScanMyCardInputSchema = z.object({
  images: z.array(ScanImageSchema).min(1).max(SELF_SCAN_IMAGE_LIMIT),
});

// Normalized box (0–1) on the photo at `image_index`.
export const ImageBoxSchema = HeadshotBoxSchema.extend({
  image_index: z.number().int().min(0),
});

const LabeledSchema = z.object({ label: z.string(), value: z.string() });

export const OwnCardScanSchema = z.object({
  // False when the photo isn't a business card at all.
  is_business_card: z.boolean(),
  full_name: z.string(),
  job_title: z.string().nullable(),
  company: z.string().nullable(),
  phones: z.array(LabeledSchema),
  emails: z.array(LabeledSchema),
  website: z.string().nullable(),
  // Postal/street address as printed, single line.
  address: z.string().nullable(),
  // A tagline or slogan printed on the card.
  tagline: z.string().nullable(),
  social_links: z.array(z.object({ label: z.string(), url: z.string() })),
  // "#RRGGBB": the card's main brand color, and its background color.
  brand_color: z.string().nullable(),
  background_color: z.string().nullable(),
  headshot: ImageBoxSchema.nullable(),
  logo: ImageBoxSchema.nullable(),
});

export type OwnCardScan = z.infer<typeof OwnCardScanSchema>;
export type ImageBox = z.infer<typeof ImageBoxSchema>;

export const FollowUpInputSchema = z.object({
  contactId: z.string().uuid(),
});

export const FollowUpDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;

export const EnrichInputSchema = z.object({
  contactId: z.string().uuid(),
});

// Each field is null unless the model verified it; `source` cites the URL/evidence.
const EnrichedFieldSchema = z.object({ value: z.string(), source: z.string() }).nullable();

export const EnrichmentResultSchema = z.object({
  job_title: EnrichedFieldSchema,
  company: EnrichedFieldSchema,
  website: EnrichedFieldSchema,
  linkedin_url: EnrichedFieldSchema,
  // One-line explanation of how identity was verified (or why nothing was found).
  summary: z.string(),
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

export const SummarizeNoteInputSchema = z.object({
  noteId: z.string().uuid(),
});

export const NoteSummarySchema = z.object({
  key_points: z.array(z.string()),
  next_steps: z.array(z.string()),
});

export type NoteSummary = z.infer<typeof NoteSummarySchema>;
