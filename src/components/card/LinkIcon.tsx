import {
  CalendarDays, CreditCard, Facebook, Github, Globe, Instagram, Link as LinkIcon2, Linkedin,
  MessageCircle, Music2, Twitter, Youtube, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  link: LinkIcon2, linkedin: Linkedin, x: Twitter, instagram: Instagram, youtube: Youtube,
  tiktok: Music2, facebook: Facebook, github: Github, calendar: CalendarDays, payment: CreditCard,
  website: Globe, message: MessageCircle,
};

export const ICON_LABELS: Record<string, string> = {
  link: "Link", linkedin: "LinkedIn", x: "X", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok",
  facebook: "Facebook", github: "GitHub", calendar: "Booking", payment: "Payment", website: "Website", message: "Message",
};

export function LinkIcon({ icon, className }: { icon: string; className?: string }) {
  const I = MAP[icon] ?? LinkIcon2;
  return <I className={className} aria-hidden />;
}
