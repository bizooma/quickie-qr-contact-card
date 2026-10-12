import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ImageIcon, PenLine } from "lucide-react";

export const Route = createFileRoute("/app/tools/")({ head: appHead('Tools', 'Tools to share your card further.'), component: ToolsIndex });

const TOOLS = [
  {
    to: "/app/tools/signature",
    icon: PenLine,
    name: "Email signature",
    desc: "A polished signature with a 'Save my contact' button that links to your card — in every email you send.",
    premium: true,
  },
  {
    to: "/app/tools/background",
    icon: ImageIcon,
    name: "Virtual background",
    desc: "A branded Zoom/Meet/Teams background with your card's QR code, so meetings capture contacts too.",
    premium: false,
  },
] as const;

function ToolsIndex() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Tools</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Put your card everywhere people already see you.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="surface block p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <t.icon className="h-6 w-6 text-brand" />
              {t.premium && (
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Premium
                </span>
              )}
            </div>
            <h2 className="mt-3 font-bold">{t.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
