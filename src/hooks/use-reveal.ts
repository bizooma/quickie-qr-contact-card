import { useEffect } from "react";

/** Scroll-reveal for elements marked `data-reveal` (value = stagger slot).
 *  SSR HTML stays fully visible; the hidden state is only ever applied on the
 *  client, and never when the visitor prefers reduced motion. */
export function useRevealOnScroll(): void {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("reveal-in");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px 0px" },
    );
    for (const el of els) {
      el.style.setProperty("--reveal-delay", el.dataset["reveal"] || "0");
      el.classList.add("reveal-pre");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
}
