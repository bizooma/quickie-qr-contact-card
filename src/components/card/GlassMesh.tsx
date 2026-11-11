import { useId, useRef } from "react";
import { useTilt } from "@/hooks/use-tilt";

/** The Liquid Glass backdrop: four soft lights in the card's mesh colours
 *  (--ck-mesh-*), leaning with the phone's tilt (the pointer on a computer),
 *  plus iPhone's "Tilt to explore" tap. Place it first inside an element
 *  with the .ck-glass-card class and resolveTheme() vars. */
export function GlassMesh() {
  // SVG gradient ids are page-global; useId keeps two meshes on one page apart.
  const meshId = `ck-mesh${useId().replace(/:/g, "")}`;
  const meshRef = useRef<HTMLDivElement>(null);
  const tilt = useTilt(meshRef);
  return (
    <>
      <div className="ck-mesh" ref={meshRef} aria-hidden>
        {/* Each blob's soft edge is drawn into the shape with a radial
            gradient. A CSS blur here made the frosted panels above re-blur
            a blurred layer while it moved or scrolled, which flickered on
            phones. */}
        {[1, 2, 3, 4].map((n) => (
          <svg key={n} className={`ck-blob ck-blob-${n}`} viewBox="0 0 200 200" focusable="false">
            <defs>
              <radialGradient id={`${meshId}-${n}`}>
                <stop offset="0" style={{ stopColor: `var(--ck-mesh-${n})` }} />
                <stop
                  offset="0.45"
                  style={{ stopColor: `var(--ck-mesh-${n})`, stopOpacity: 0.85 }}
                />
                <stop offset="1" style={{ stopColor: `var(--ck-mesh-${n})`, stopOpacity: 0 }} />
              </radialGradient>
            </defs>
            <ellipse
              cx="100"
              cy="100"
              rx={n % 2 ? 96 : 84}
              ry={n % 2 ? 80 : 96}
              transform={`rotate(${n * 37} 100 100)`}
              fill={`url(#${meshId}-${n})`}
            />
          </svg>
        ))}
      </div>

      {tilt.needsTap && (
        <button type="button" className="ck-glass ck-tilt-hint" onClick={tilt.enable}>
          ✨ Tilt to explore
        </button>
      )}
    </>
  );
}
