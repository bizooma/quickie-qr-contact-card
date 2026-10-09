import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, ChevronRight, Mail, MonitorPlay } from "lucide-react";

export const Route = createFileRoute("/app/tools")({ component: ToolsPage });

const TOOLS = [
  { to: "/app/signature", title: "Email signature", desc: "Copy-paste signature for Gmail, Outlook and Apple Mail", icon: Mail },
  { to: "/app/background", title: "Meeting background", desc: "Video-call backdrop with your QR code", icon: MonitorPlay },
  { to: "/app/analytics", title: "Analytics", desc: "Views, saves and share-backs per card", icon: BarChart3 },
] as const;

function ToolsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Tools</h1>
      <p className="mt-1 text-sm text-muted-foreground">More ways to share your card.</p>
      <ul className="surface mt-8 divide-y">
        {TOOLS.map((t) => (
          <li key={t.to}>
            <Link to={t.to} className="flex items-center gap-4 px-4 py-4 hover:bg-muted/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><t.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{t.title}</span><span className="block text-sm text-muted-foreground">{t.desc}</span></span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
