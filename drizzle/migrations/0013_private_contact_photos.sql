-- Storage: the bucket-wide read policy let anyone holding the public anon
-- key list and download every object in card-media, including contact
-- photos. Split it: card assets stay anon-signable (they appear on public
-- card pages by design); contact photos are readable only by their owner.
-- Applied live on 2026-10-11; this file is the record.

drop policy "card-media read" on storage.objects;

create policy "card-media public card read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'card-media'
    and coalesce((storage.foldername(name))[2], '') <> 'contact-photos'
  );

create policy "card-media owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-media'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
