import { useEffect, useRef, useState } from "react";
import { Check, Download, Mail, Send } from "lucide-react";
import { useQr } from "@/components/card/QrPanel";

// The hero's "how quick is it" demo: a phone camera finds a QuickieQR code,
// the card opens, one tap saves the contact, and a stopwatch shows how long
// that took. Purely illustrative and decorative; screen readers get a single
// sentence instead. Reduced motion shows the finished state, no loop.

type Stage = "aim" | "lock" | "card" | "tap" | "saved";

// When each stage starts (ms into the loop) and when the loop restarts.
const TIMELINE: [Stage, number][] = [
  ["aim", 0],
  ["lock", 1200],
  ["card", 1800],
  ["tap", 2500],
  ["saved", 2900],
];
const LOOP_MS = 6400;
const SAVED_AT_MS = 2900;

export type ScanHeroPerson = {
  name: string;
  title: string;
  company: string;
  photo: string;
  slug: string;
  /** The card as its owner set it up, so the demo looks like the real thing. */
  banner: string;
  logo: string;
  bio: string;
  email: string;
  accent: string;
};

function useScanLoop(reduced: boolean) {
  const [stage, setStage] = useState<Stage>(reduced ? "saved" : "aim");
  const [elapsed, setElapsed] = useState(reduced ? SAVED_AT_MS : 0);
  const start = useRef(0);

  useEffect(() => {
    if (reduced) {
      setStage("saved");
      setElapsed(SAVED_AT_MS);
      return;
    }
    let raf = 0;
    start.current = performance.now();
    const tick = (now: number) => {
      const t = (now - start.current) % LOOP_MS;
      let s: Stage = "aim";
      for (const [name, at] of TIMELINE) if (t >= at) s = name;
      setStage(s);
      setElapsed(Math.min(Math.floor(t / 100) * 100, SAVED_AT_MS));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return { stage, elapsed };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** The QR-bearing card someone holds up. */
function HeldCard({
  person,
  qr,
  className = "",
}: {
  person: ScanHeroPerson;
  qr: string;
  className?: string;
}) {
  return (
    <div className={`rounded-[1.4rem] bg-white p-4 text-[#0E1230] shadow-float ${className}`}>
      <div className="flex items-center gap-2.5">
        <img src={person.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-sm font-extrabold">{person.name}</p>
          <p className="truncate text-[11px] text-[#5A6080]">{person.title}</p>
        </div>
      </div>
      <div
        className="mt-3 aspect-square w-full [&>svg]:h-full [&>svg]:w-full"
        // SVG generated locally by the qrcode library from our own URL.
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <p className="mt-2 text-center text-[10px] font-semibold tracking-wide text-[#5A6080]">
        quickieqr.com
      </p>
    </div>
  );
}

export function ScanHero({ person }: { person: ScanHeroPerson }) {
  const reduced = usePrefersReducedMotion();
  const { stage, elapsed } = useScanLoop(reduced);
  const { svg } = useQr(person.slug, "#0E1230", "#FFFFFF");
  const qr = svg || "<svg viewBox='0 0 1 1'></svg>";

  const camera = stage === "aim" || stage === "lock";
  const locked = stage !== "aim";
  const done = stage === "saved";

  return (
    <div className="relative mx-auto h-[500px] w-full max-w-[520px] select-none sm:h-[600px]">
      <p className="sr-only">
        Animation: a phone camera scans a QuickieQR code, the card opens, and one tap saves the
        contact in about three seconds.
      </p>

      <div aria-hidden className="absolute inset-0">
        {/* The card being held up, behind the phone. */}
        <HeldCard
          person={person}
          qr={qr}
          className="absolute left-0 top-16 w-[200px] -rotate-[8deg] sm:left-2 sm:w-[230px]"
        />

        {/* Stopwatch */}
        <div
          className={`absolute right-0 top-0 z-20 flex items-center gap-2 rounded-full px-4 py-2 font-mono text-sm font-semibold tabular-nums shadow-float transition-colors duration-300 ${
            done ? "bg-pop-lime text-[#0E1230]" : "bg-white/10 text-white backdrop-blur"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${done ? "bg-[#0E1230]" : "animate-pulse bg-pop-rose"}`}
          />
          {done ? `Saved in ${(elapsed / 1000).toFixed(1)}s` : `${(elapsed / 1000).toFixed(1)}s`}
        </div>

        {/* The scanning phone */}
        <div className="absolute bottom-0 right-2 z-10 h-[470px] w-[236px] rotate-[4deg] rounded-[44px] bg-[#05060F] p-[10px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/15 sm:right-6 sm:h-[540px] sm:w-[268px]">
          <div className="relative h-full w-full overflow-hidden rounded-[35px] bg-[#0B0D1C]">
            <div className="absolute left-1/2 top-2.5 z-30 h-6 w-20 -translate-x-1/2 rounded-full bg-black" />

            {/* Camera view */}
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${camera ? "opacity-100" : "opacity-0"}`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#2A2F55,#0B0D1C_70%)]" />
              <div
                className={`absolute left-1/2 top-[42%] w-[150px] -translate-x-1/2 -translate-y-1/2 transition-transform duration-700 ${
                  locked ? "scale-105 rotate-0" : "scale-95 -rotate-6"
                }`}
              >
                <HeldCard person={person} qr={qr} className="!p-3 !shadow-none" />
              </div>
              {/* Viewfinder brackets */}
              <div
                className={`absolute left-1/2 top-[42%] h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                  locked ? "scale-[0.82]" : "scale-100"
                }`}
              >
                {[
                  "left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl",
                  "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
                ].map((c) => (
                  <span
                    key={c}
                    className={`absolute h-8 w-8 transition-colors duration-300 ${c} ${
                      locked ? "border-pop-lime" : "border-white/80"
                    }`}
                  />
                ))}
                {!locked && (
                  <span className="qq-scanline absolute inset-x-3 h-0.5 rounded-full bg-pop-lime shadow-[0_0_14px_2px] shadow-pop-lime" />
                )}
              </div>
              {/* The camera's "open link" chip */}
              <div
                className={`absolute inset-x-5 bottom-10 flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2.5 text-[#0E1230] shadow-float transition-all duration-300 ${
                  locked ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-[11px] font-extrabold text-white">
                  QR
                </span>
                <span className="min-w-0 truncate text-xs font-semibold">
                  quickieqr.com/c/{person.slug}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Camera
              </div>
            </div>

            {/* Card view: a mini copy of the real card (Banner layout). */}
            <div
              className={`absolute inset-0 flex flex-col bg-white text-[#0E1230] transition-all duration-500 ${
                camera ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
              }`}
            >
              {/* The phone browser's address bar, as on a real scan. */}
              <div className="flex h-[58px] shrink-0 items-end justify-center bg-white pb-1.5">
                <span className="rounded-full bg-[#F1F1F4] px-3 py-0.5 text-[8.5px] font-medium text-[#5A6080]">
                  quickieqr.com
                </span>
              </div>
              <img
                src={person.banner}
                alt=""
                className="h-[96px] w-full shrink-0 object-cover sm:h-[110px]"
              />
              <img
                src={person.photo}
                alt=""
                className="relative mx-auto -mt-11 h-[84px] w-[84px] rounded-full border-[3px] border-white object-cover shadow-soft sm:h-[96px] sm:w-[96px]"
              />
              <div className="flex flex-1 flex-col px-4 pb-4 sm:px-5">
                <p className="mt-2 text-center font-display text-[17px] font-extrabold leading-tight sm:text-lg">
                  {person.name}
                </p>
                <p className="mt-0.5 text-center text-[9.5px] text-[#5A6080] sm:text-[10.5px]">
                  {person.title} ·{" "}
                  <span className="font-semibold text-[#0E1230]">{person.company}</span>
                </p>
                <p className="mt-2 line-clamp-4 text-center text-[8.5px] leading-snug text-[#5A6080] sm:text-[9.5px]">
                  {person.bio}
                </p>
                <img src={person.logo} alt="" className="mx-auto mt-3 h-7 w-auto sm:h-8" />
                <div className="mt-auto grid grid-cols-2 gap-1.5">
                  <div
                    className={`relative flex h-8 items-center justify-center gap-1 overflow-hidden rounded-full text-[10px] font-bold transition-all duration-300 ${
                      done
                        ? "bg-pop-lime text-[#0E1230]"
                        : stage === "tap"
                          ? "scale-95 text-white"
                          : "text-white"
                    }`}
                    style={done ? undefined : { background: person.accent }}
                  >
                    {done ? (
                      <>
                        <Check className="h-3 w-3" strokeWidth={3} /> Saved
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" /> Save contact
                      </>
                    )}
                    {stage === "tap" && (
                      <span className="qq-ripple absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" />
                    )}
                  </div>
                  <div
                    className="flex h-8 items-center justify-center gap-1 rounded-full border text-[10px] font-semibold"
                    style={{ borderColor: person.accent }}
                  >
                    <Send className="h-3 w-3" /> Share yours
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#F3F3F5] px-2.5 py-2">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: person.accent }}
                  >
                    <Mail className="h-2.5 w-2.5" />
                  </span>
                  <span className="truncate text-[9.5px]">{person.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fingertip */}
        <span
          className={`absolute bottom-[70px] right-[164px] z-20 h-10 w-10 rounded-full border-2 border-white/70 bg-white/25 backdrop-blur-sm transition-all duration-300 sm:right-[204px] ${
            stage === "tap" ? "scale-90 opacity-100" : "scale-125 opacity-0"
          }`}
        />
      </div>
    </div>
  );
}
