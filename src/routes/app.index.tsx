import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrPanel } from "@/components/card/QrPanel";
import { useAuth } from "@/hooks/use-auth";
import { createCard, listCards, type CardRow } from "@/lib/cards-api";
import { initials } from "@/lib/card-model";
import { signedUrls } from "@/lib/media";

export const Route = createFileRoute("/app/")({ component: CardsPage });

function CardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cards, isLoading } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const [qrCard, setQrCard] = useState<CardRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Signed URLs for each card's headshot and logo (private bucket).
  const mediaPaths = useMemo(
    () =>
      (cards ?? []).flatMap((c) => [c.headshot_path, c.logo_path]).filter((p): p is string => !!p),
    [cards],
  );
  const { data: mediaUrls = {} } = useQuery({
    queryKey: ["card-tile-media", mediaPaths],
    enabled: mediaPaths.length > 0,
    queryFn: () => signedUrls(mediaPaths),
  });

  useEffect(() => {
    if (cards && cards.length === 0) navigate({ to: "/app/onboarding" });
  }, [cards, navigate]);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !label.trim() || creating) return;
    setCreating(true);
    try {
      const first = cards?.[0];
      const c = await createCard(user.id, {
        label: label.trim(),
        full_name: first?.full_name ?? "",
        job_title: first?.job_title ?? undefined,
      });
      await qc.invalidateQueries({ queryKey: ["cards"] });
      navigate({ to: "/app/cards/$id", params: { id: c.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create card");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your cards</h1>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {"Tap a card to edit.\nChanges go live instantly."}
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" />
          New card
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards?.map((c) => (
            <div key={c.id} className="surface overflow-hidden">
              <Link to="/app/cards/$id" params={{ id: c.id }} className="block">
                <div className="relative h-20" style={{ background: c.accent_color }}>
                  {c.logo_path && mediaUrls[c.logo_path] && (
                    <img
                      src={mediaUrls[c.logo_path]}
                      alt=""
                      className="absolute right-3 top-3 h-9 max-w-[96px] rounded-md object-contain"
                    />
                  )}
                </div>
                <div className="-mt-8 px-5 pb-4">
                  {c.headshot_path && mediaUrls[c.headshot_path] ? (
                    <img
                      src={mediaUrls[c.headshot_path]}
                      alt={c.full_name || c.label}
                      className="h-16 w-16 rounded-full border-4 border-card object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-muted font-semibold">
                      {initials(c.full_name || c.label)}
                    </div>
                  )}
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand">
                    {c.label}
                  </p>
                  <p className="font-display text-lg font-bold">{c.full_name || "Untitled"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[c.job_title, c.company].filter(Boolean).join(" · ") || "Add your details"}
                  </p>
                </div>
              </Link>
              <div className="flex border-t">
                <button
                  className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium hover:bg-muted"
                  onClick={() => setQrCard(c)}
                >
                  <QrCode className="h-4 w-4" />
                  QR
                </button>
                <a
                  className="flex flex-1 items-center justify-center gap-2 border-l py-3 text-sm font-medium hover:bg-muted"
                  href={`/c/${c.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  View
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!qrCard} onOpenChange={(o) => !o && setQrCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {qrCard?.label}</DialogTitle>
          </DialogHeader>
          {qrCard && (
            <QrPanel
              slug={qrCard.slug}
              accent={qrCard.accent_color}
              bg={qrCard.background_color}
              name={qrCard.full_name}
              logoPath={qrCard.logo_path}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New card</DialogTitle>
          </DialogHeader>
          <form onSubmit={addCard} className="space-y-4">
            <Input
              autoFocus
              placeholder="e.g. Side business, Personal"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
            />
            <Button type="submit" className="w-full" disabled={!label.trim() || creating}>
              Create card
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
