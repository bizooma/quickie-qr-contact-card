import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Code, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCardPicker } from "@/components/tools/CardPicker";
import { publicCardUrl } from "@/components/card/QrPanel";
import { buildSignatureHtml, buildSignatureText, SIGNATURE_STYLES, type SignatureStyle } from "@/lib/signature";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/signature")({ component: SignaturePage });

const SETUP = [
  { app: "Gmail", steps: ["Click “Copy signature” above.", "In Gmail, open Settings (gear) → See all settings → General → Signature.", "Create new, paste into the editor, then Save Changes at the bottom."] },
  { app: "Outlook", steps: ["Click “Copy signature” above.", "Outlook web: Settings → Mail → Compose and reply. Desktop: File → Options → Mail → Signatures.", "Create a new signature, paste, and save."] },
  { app: "Apple Mail", steps: ["Click “Copy signature” above.", "Mail → Settings → Signatures, pick the account and press +.", "Uncheck “Always match my default message font”, paste into the right pane, then close settings."] },
];

function SignaturePage() {
  const { card, picker, hasCards, isLoading } = useCardPicker();
  const [style, setStyle] = useState<SignatureStyle>("classic");
  const url = card ? publicCardUrl(card.slug) : "";
  const html = useMemo(() => (card ? buildSignatureHtml(card, style, url) : ""), [card, style, url]);

  async function copyRich() {
    if (!card) return;
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("unsupported");
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([buildSignatureText(card, url)], { type: "text/plain" }),
        }),
      ]);
      toast.success("Signature copied — paste it into your email settings");
    } catch {
      try {
        await navigator.clipboard.writeText(html);
        toast.message("Copied as HTML code", { description: "Your browser blocked rich copy. Paste into an HTML signature field, or select the preview and copy it." });
      } catch {
        toast.error("Could not copy — select the preview and copy it manually");
      }
    }
  }
  async function copyHtml() {
    try { await navigator.clipboard.writeText(html); toast.success("HTML copied"); }
    catch { toast.error("Could not copy HTML"); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Email signature</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every email becomes a way to save your contact.</p>
      {!isLoading && !hasCards ? <p className="mt-8 text-sm">Create a card first.</p> : (
        <div className="mt-8 space-y-6">
          {picker}
          <div className="grid grid-cols-3 gap-3">
            {SIGNATURE_STYLES.map((s) => (
              <button key={s.id} onClick={() => setStyle(s.id)} aria-pressed={style === s.id}
                className={cn("rounded-xl border p-3 text-left text-sm transition", style === s.id ? "border-brand ring-2 ring-ring/30" : "hover:bg-muted")}>
                <span className="block font-semibold">{s.name}</span><span className="text-xs text-muted-foreground">{s.hint}</span>
              </button>
            ))}
          </div>
          {/* Email signatures render on white in most clients, so preview on white too. */}
          <div className="surface overflow-x-auto bg-white p-6">
            {card ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyRich} disabled={!card}><Copy className="h-4 w-4" />Copy signature</Button>
            <Button variant="outline" onClick={copyHtml} disabled={!card}><Code className="h-4 w-4" />Copy HTML</Button>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Set it up</h2>
            {SETUP.map((s) => (
              <Collapsible key={s.app} className="surface">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
                  {s.app}<ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{s.steps.map((t) => <li key={t}>{t}</li>)}</ol>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
