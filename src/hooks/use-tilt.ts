import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  BASELINE_FOLLOW,
  easeTilt,
  tiltFromOrientation,
  tiltFromPointer,
  type Tilt,
} from "@/lib/tilt";

// Leans the Liquid Glass lights with the phone (or the pointer on a
// computer) by setting --ck-tx / --ck-ty on the element in `ref`; the CSS
// turns those into a few pixels per light. Off for reduced motion.
//
// Phones start listening straight away. iPhone only reports tilt after a tap
// that asks permission, so where no reading arrives and the browser offers
// that request, `needsTap` turns true until the visitor taps the "Tilt to
// explore" hint, which calls `enable`. (Some Android browsers also offer the
// request but report tilt without it, so they never see the hint.) The answer
// is remembered: once allowed, the next visit asks again silently on the
// first touch, which iOS requires.

const TILT_KEY = "ck-tilt";

type PermissionCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

function remembered(): string | null {
  try {
    return localStorage.getItem(TILT_KEY);
  } catch {
    return null;
  }
}

function remember(state: "granted" | "denied") {
  try {
    localStorage.setItem(TILT_KEY, state);
  } catch {
    // Without storage the hint simply shows again next visit.
  }
}

function askPermission(): Promise<"granted" | "denied"> | null {
  const ctor = (typeof DeviceOrientationEvent === "undefined"
    ? undefined
    : DeviceOrientationEvent) as unknown as PermissionCtor | undefined;
  return typeof ctor?.requestPermission === "function" ? ctor.requestPermission() : null;
}

export function useTilt(ref: RefObject<HTMLElement | null>) {
  const [needsTap, setNeedsTap] = useState(false);
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let current: Tilt = { x: 0, y: 0 };
    let target: Tilt = { x: 0, y: 0 };
    let frame = 0;
    const step = () => {
      current = easeTilt(current, target);
      const settled =
        Math.abs(current.x - target.x) < 0.002 && Math.abs(current.y - target.y) < 0.002;
      if (settled) current = target;
      el.style.setProperty("--ck-tx", current.x.toFixed(3));
      el.style.setProperty("--ck-ty", current.y.toFixed(3));
      frame = settled ? 0 : requestAnimationFrame(step);
    };
    const aim = (t: Tilt) => {
      target = t;
      if (!frame) frame = requestAnimationFrame(step);
    };

    const cleanups: (() => void)[] = [];
    const listen = <K extends keyof WindowEventMap>(
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      target: Window | Document = window,
    ) => {
      target.addEventListener(type, fn as EventListener, { passive: true });
      cleanups.push(() => target.removeEventListener(type, fn as EventListener));
    };

    let base: { beta: number; gamma: number } | null = null;
    let listening = false;
    let hintTimer = 0;
    const startOrientation = () => {
      if (listening) return;
      listening = true;
      listen("deviceorientation", (e) => {
        if (e.beta == null || e.gamma == null) return;
        if (!base) {
          // Tilt arrives without asking: no hint needed.
          clearTimeout(hintTimer);
          setNeedsTap(false);
        }
        const reading = { beta: e.beta, gamma: e.gamma };
        if (!base) base = reading;
        // Drift the resting angle towards how the phone is held now.
        base = {
          beta: base.beta + (reading.beta - base.beta) * BASELINE_FOLLOW,
          gamma: base.gamma + (reading.gamma - base.gamma) * BASELINE_FOLLOW,
        };
        aim(tiltFromOrientation(reading, base, screen.orientation?.angle ?? 0));
      });
    };
    startRef.current = startOrientation;

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      // Computers: the lights lean towards the pointer.
      listen("pointermove", (e) => aim(tiltFromPointer(e, el.getBoundingClientRect())));
      listen("mouseout", (e) => {
        if (!e.relatedTarget) aim({ x: 0, y: 0 });
      });
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      startOrientation();
      const iosAsk = (DeviceOrientationEvent as unknown as PermissionCtor).requestPermission;
      if (typeof iosAsk !== "function") {
        // Android and other phones: no permission needed.
      } else if (remembered() === "granted") {
        // iPhone, allowed before: iOS still wants a gesture, so ask silently
        // on the first touch.
        const onTouch = () => {
          document.removeEventListener("touchend", onTouch);
          askPermission()
            ?.then((s) => (s === "granted" ? startOrientation() : remember("denied")))
            .catch(() => {});
        };
        document.addEventListener("touchend", onTouch, { passive: true });
        cleanups.push(() => document.removeEventListener("touchend", onTouch));
      } else if (remembered() !== "denied") {
        // Offer the tap only if tilt hasn't started arriving on its own.
        hintTimer = window.setTimeout(() => {
          if (!base) setNeedsTap(true);
        }, 1000);
      }
    }

    return () => {
      clearTimeout(hintTimer);
      cancelAnimationFrame(frame);
      cleanups.forEach((c) => c());
      startRef.current = () => {};
    };
  }, [ref]);

  // Must run inside the tap's own handler: iOS refuses the request otherwise.
  const enable = useCallback(() => {
    setNeedsTap(false);
    askPermission()
      ?.then((state) => {
        remember(state);
        if (state === "granted") startRef.current();
      })
      .catch(() => {});
  }, []);

  return { needsTap, enable };
}
