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

export const ScannedContactSchema = z.object({
  full_name: z.string(),
  job_title: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  // Anything else legible on the card: address, social handles, handwritten notes.
  extra: z.string().nullable(),
});

export const ScanResultSchema = z.object({
  contacts: z.array(ScannedContactSchema),
});

export type ScannedContact = z.infer<typeof ScannedContactSchema>;

export const FollowUpInputSchema = z.object({
  contactId: z.string().uuid(),
});

export const FollowUpDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;
