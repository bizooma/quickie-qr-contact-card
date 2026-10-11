import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listCards, getCard, rowToCard } from "@/lib/cards-api";
import { buildSignatureHtml, SIGNATURE_STYLES, type SignatureStyle } from "@/lib/signature";
import { publicCardUrl } from "@/components/card/QrPanel";
import { PremiumGate } from "@/components/PremiumGate";

export const Route = createFileRoute("/app/tools/signature")({ component: SignaturePage });

const SETUP = [
  {
    client: "Gmail",
    steps:
      "Gmail → Settings (gear) → See all settings → General → Signature → Create new. Paste with Ctrl/Cmd+V, save changes at the bottom.",
  },
  {
    client: "Outlook",
    steps:
      "Outlook → Settings → Account → Signatures → New signature. Paste into the editor and save. (Desktop Outlook: File → Options → Mail → Signatures.)",
  },
  {
    client: "Apple Mail",
    steps:
      "Mail → Settings → Signatures → +. Paste into the signature box. If formatting is lost, use Edit → Paste and Match Style OFF (plain Cmd+V).",
  },
] as const;

function SignaturePage() {
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const [cardId, setCardId] = useState<string | null>(null);
  const [style, setStyle] = useState<SignatureStyle>("classic");
  const [copied, setCopied] = useState<"rich" | "html" | null>(null);

  const activeId = cardId ?? cards?.[0]?.id ?? null;
  const { data: full } = useQuery({
    queryKey: ["card", activeId],
    queryFn: () => getCard(activeId!),
    enabled: !!activeId,
  });

  const html = useMemo(() => {
    if (!full?.card) return "";
    const card = rowToCard(full.card, full.links);
    return buildSignatureHtml(card, publicCardUrl(card.slug), style);
  }, [full, style]);

  async function copyRich() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([html], { type: "text/plain" }),
        }),
      ]);
      setCopied("rich");
      toast.success("Signature copied — paste it into your email settings");
    } catch {
      await navigator.clipboard.writeText(html).catch(() => undefined);
      toast.message("Copied as HTML source", {
        description:
          "Your browser blocked rich copy; paste into a signature editor that accepts HTML.",
      });
    }
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied("html");
      toast.success("HTML copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — select the preview and copy manually");
    }
  }

  if (cards && !cards.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a card first — your signature is built from it.{" "}
        <Link to="/app" className="underline">
          Go to cards
        </Link>
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/tools"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Tools
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Email signature</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Built from your card, with a "Save my contact" button in every email. (Email clients can't
        load your private card photo, so the badge uses your initials.)
      </p>

      <PremiumGate feature="The email signature builder">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sig-card">Card</Label>
            <select
              id="sig-card"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={activeId ?? ""}
              onChange={(e) => setCardId(e.target.value)}
            >
              {(cards ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Style</Label>
            <div className="flex gap-2">
              {SIGNATURE_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  title={s.hint}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${style === s.id ? "border-brand bg-brand-soft" : "hover:bg-muted"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="surface mb-4 overflow-x-auto bg-white p-5">
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <Button onClick={copyRich} disabled={!html}>
            {copied === "rich" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy signature
          </Button>
          <Button variant="outline" onClick={copyHtml} disabled={!html}>
            {copied === "html" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy HTML
          </Button>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">Add it to your email</h2>
          {SETUP.map((s) => (
            <details key={s.client} className="surface p-4">
              <summary className="cursor-pointer text-sm font-semibold">{s.client}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{s.steps}</p>
            </details>
          ))}
        </section>
      </PremiumGate>
    </div>
  );
}
