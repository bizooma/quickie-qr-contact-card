import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardCheck, ImageIcon, PenLine } from "lucide-react";

export const Route = createFileRoute("/app/tools/")({
  head: appHead("Tools", "Tools to share your card further."),
  component: ToolsIndex,
});

const TOOLS = [
  {
    to: "/app/tools/prep",
    icon: ClipboardCheck,
    name: "Event prep",
    desc: "Your pre-event checklist, 20 conversation openers and goal sheet, ready on your phone at the event.",
    badge: "Paid plans",
    tint: "bg-pop-teal-soft text-pop-teal",
    use: "Before an event",
  },
  {
    to: "/app/tools/signature",
    icon: PenLine,
    name: "Email signature",
    desc: "A polished signature with a 'Save my contact' button that links to your card — in every email you send.",
    badge: "Premium",
    tint: "bg-pop-rose-soft text-pop-rose",
    use: "Every email",
  },
  {
    to: "/app/tools/background",
    icon: ImageIcon,
    name: "Virtual background",
    desc: "A branded Zoom/Meet/Teams background with your card's QR code, so meetings capture contacts too.",
    badge: null,
    tint: "bg-brand-soft text-brand",
    use: "Every video call",
  },
] as const;

function ToolsIndex() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="dark relative mb-6 overflow-hidden rounded-[2rem] bg-[#0B0D1C] p-6 text-foreground sm:p-10">
        <div className="qq-dots pointer-events-none absolute inset-0 opacity-[0.07]" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/40 blur-3xl" />
        <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-pop-lime">Tools</p>
        <h1 className="relative mt-3 max-w-xl font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          Put your card everywhere
          <span className="text-white/45"> people already see you.</span>
        </h1>
        <p className="relative mt-4 max-w-lg text-sm text-white/60">
          Your inbox, your video calls, the event you're walking into. Each one is another place
          someone can save you in a tap.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group surface flex flex-col rounded-3xl p-6 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-float"
          >
            <div className="flex items-start justify-between">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${t.tint}`}>
                <t.icon className="h-6 w-6" />
              </span>
              {t.badge && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t.badge}
                </span>
              )}
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {t.use}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight">{t.name}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{t.desc}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
              Open
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
