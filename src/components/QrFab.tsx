import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FAB_KEY,
  fabArea,
  isDrag,
  parseSpot,
  pixelsToSpot,
  spotToPixels,
  type FabSpot,
} from "@/lib/qr-fab";

const HINT_KEY = "ck-qr-fab-hint";

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The button just goes back to its default spot next visit.
  }
}

/** Height kept free at the bottom: the phone's tab bar. */
function bottomReserve(): number {
  const rect = document.querySelector("[data-tabbar]")?.getBoundingClientRect();
  if (!rect || rect.height === 0) return 72;
  return Math.max(0, window.innerHeight - rect.top);
}

function currentArea() {
  return fabArea(window.innerWidth, window.innerHeight, bottomReserve());
}

/** One-tap "scan me" from anywhere in the app on a phone. Press and drag to
 *  move it out of the way; it stays where it was dropped on this device. */
export function QrFab() {
  const [spot, setSpot] = useState<FabSpot | null>(() => parseSpot(load(FAB_KEY)));
  // Live position while dragging, in px.
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null);
  const [, relayout] = useState(0);
  const [hint, setHint] = useState(() => load(HINT_KEY) !== "1");
  const press = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const swallowClick = useRef(false);

  // Keep the saved spot on screen when the phone rotates or the window resizes.
  useEffect(() => {
    const onResize = () => relayout((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => {
      setHint(false);
      save(HINT_KEY, "1");
    }, 5000);
    return () => clearTimeout(t);
  }, [hint]);

  function onPointerDown(e: PointerEvent<HTMLAnchorElement>) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    press.current = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLAnchorElement>) {
    const p = press.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && !isDrag(dx, dy)) return;
    if (!p.moved) {
      p.moved = true;
      setHint(false);
      save(HINT_KEY, "1");
    }
    const area = currentArea();
    setDrag({
      left: Math.min(area.maxX, Math.max(area.minX, p.left + dx)),
      top: Math.min(area.maxY, Math.max(area.minY, p.top + dy)),
    });
  }

  function endPress(e: PointerEvent<HTMLAnchorElement>) {
    const p = press.current;
    press.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!p?.moved || !drag) {
      setDrag(null);
      return;
    }
    // A drag, not a tap: keep the new spot and don't open the QR screen.
    swallowClick.current = true;
    const next = pixelsToSpot(drag.left, drag.top, currentArea());
    setSpot(next);
    setDrag(null);
    save(FAB_KEY, JSON.stringify(next));
  }

  const pos = drag ?? (spot ? spotToPixels(spot, currentArea()) : null);

  return (
    <Link
      to="/app/qr"
      aria-label="Show my QR code (drag to move)"
      draggable={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onClick={(e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      className={cn(
        "fixed z-40 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-brand text-white shadow-float md:hidden [-webkit-touch-callout:none] [body:has([data-savebar])_&]:hidden",
        !pos && "bottom-24 right-4",
        drag ? "scale-110 cursor-grabbing opacity-90" : "transition-transform active:scale-95",
      )}
    >
      <QrCode className="h-6 w-6" />
      {hint && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background shadow"
        >
          Drag me anywhere
        </span>
      )}
    </Link>
  );
}
