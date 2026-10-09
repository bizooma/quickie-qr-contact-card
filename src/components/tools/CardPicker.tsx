import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCard, listCards, rowToCard } from "@/lib/cards-api";
import type { CardData } from "@/lib/card-model";

/** Selects one of the user's cards and loads it (with links) as CardData. */
export function useCardPicker() {
  const { data: cards = [], isLoading } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const [cardId, setCardId] = useState<string>("");
  useEffect(() => {
    if (!cardId && cards[0]) setCardId(cards[0].id);
  }, [cards, cardId]);
  const { data } = useQuery({ queryKey: ["card", cardId], queryFn: () => getCard(cardId), enabled: !!cardId });
  const card: CardData | null = data?.card ? rowToCard(data.card, data.links) : null;

  const picker = (
    <Select value={cardId} onValueChange={setCardId} disabled={!cards.length}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Card"><SelectValue placeholder={isLoading ? "Loading…" : "No cards yet"} /></SelectTrigger>
      <SelectContent>{cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.label} — {c.full_name || "Untitled"}</SelectItem>)}</SelectContent>
    </Select>
  );
  return { card, picker, isLoading, hasCards: cards.length > 0 };
}
