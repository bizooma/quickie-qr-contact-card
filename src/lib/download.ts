/** Trigger a browser download. On phones, tapping a downloaded .vcf opens the
 * native "add to contacts" flow (iOS Contacts / Android import). */
export function downloadFile(filename: string, content: string, mime: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const VCF_MIME = "text/vcard;charset=utf-8";
