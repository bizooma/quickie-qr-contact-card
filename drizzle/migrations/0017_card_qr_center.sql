-- Per-card QR center image (applied live on 2026-10-12; this file is the
-- record). Pro/Premium cards can show the owner's photo or logo in the
-- middle of their QR code; null = plain QR. Owners update it under the
-- existing "own cards all" policy.

alter table public.cards
  add column if not exists qr_center text check (qr_center in ('photo', 'logo'));
