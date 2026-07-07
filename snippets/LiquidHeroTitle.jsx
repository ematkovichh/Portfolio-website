/**
 * LiquidHeroTitle.jsx
 *
 * Hero title with a liquid magnifying-glass distortion effect.
 *
 * Standalone React snippet — not used by the (framework-free) site itself,
 * kept here as a reusable component.
 *
 * How it works:
 *   Each character is wrapped in an inline-block <span> with a DOM ref.
 *   Character centres are measured once (in page coordinates) and cached;
 *   only a resize invalidates the cache, so the rAF loop does zero layout
 *   reads. A requestAnimationFrame loop computes lens displacement + scale
 *   from cursor proximity and drives those values through a
 *   critically-damped spring toward their target. The loop stops entirely
 *   once the cursor leaves and every spring has settled.
 *   Style writes bypass React re-renders for 60fps on any hardware.
 *
 * No external dependencies.
 *
 * Usage:
 *   import LiquidHeroTitle from "./LiquidHeroTitle";
 *   <LiquidHeroTitle />
 *
 * Customisation: edit the constants in the "Tuning" section below.
 */

import { useRef, useEffect, useCallback } from "react";

/* ── Tuning ──────────────────────────────────────────────────────────────── */
const LINES        = ["Eugen", "Matković"]; // text, split into lines
const LENS_RADIUS  = 120;   // distortion radius in px
const MAX_PUSH     = 32;    // max displacement toward cursor (px) — scales with font
const MAX_SCALE    = 0.22;  // max additional scale at lens centre (0.22 = +22%)
const CURSOR_LERP  = 0.16;  // cursor smoothing factor — higher feels more direct
const SPRING_K     = 260;   // spring stiffness — higher = snappier
const SPRING_D     = 26;    // spring damping — near-critical at 2√260 ≈ 32
const DT           = 1 / 60; // integration timestep (seconds)
const REST_EPS     = 0.02;  // below this displacement/velocity a spring counts as settled
/* ────────────────────────────────────────────────────────────────────────── */

/** Advance a 1-D damped spring one timestep. Mutates `s`. */
function springStep(s, target) {
  s.v += (-SPRING_K * (s.x - target) - SPRING_D * s.v) * DT;
  s.x += s.v * DT;
}

/* ── Static styles ───────────────────────────────────────────────────────── */
const h1Style = {
  fontFamily   : "'Inter', system-ui, sans-serif",
  fontWeight   : 600,
  fontSize     : "clamp(3rem, 12vw, 11rem)",
  letterSpacing: "-0.02em",
  lineHeight   : 0.9,
  color        : "#ebebeb",
  cursor       : "default",
  userSelect   : "none",
  margin       : 0,
  marginLeft   : "-2px",
  display      : "block",
};

const charStyle = {
  display        : "inline-block",
  willChange     : "transform",
  transformOrigin: "50% 75%", // scale from baseline — matches real magnification optics
};

const lensStyle = {
  position     : "fixed",
  pointerEvents: "none",
  zIndex       : 9999,
  width        : LENS_RADIUS * 2,
  height       : LENS_RADIUS * 2,
  borderRadius : "50%",
  // Glass-lens visual: faint bright core + barely-visible rim
  border       : "1px solid rgba(255,255,255,0.07)",
  background   : [
    "radial-gradient(circle,",
    "  rgba(255,255,255,0.025) 0%,",
    "  rgba(255,255,255,0.008) 45%,",
    "  transparent 70%",
    ")",
  ].join(""),
  marginLeft   : -LENS_RADIUS,
  marginTop    : -LENS_RADIUS,
  transition   : "opacity 0.5s ease",
  opacity      : 0,
  left         : 0,
  top          : 0,
};

/* ── Component ───────────────────────────────────────────────────────────── */
export default function LiquidHeroTitle() {
  const rafRef     = useRef(null);
  const runningRef = useRef(false);
  const rawCursor  = useRef({ x: -9999, y: -9999 });
  const smCursor   = useRef({ x: -9999, y: -9999 });
  const hovering   = useRef(false);
  const elRefs     = useRef([]);
  const rectsRef   = useRef([]);   // cached char centres in PAGE coordinates
  const springs    = useRef(null);
  const lensRef    = useRef(null);
  const startRef   = useRef(() => {});

  // Flatten all characters into a single indexed list
  const chars = LINES.flatMap((line, li) =>
    [...line].map((ch) => ({ ch, li }))
  );

  // Lazily initialise spring states (one per character)
  if (!springs.current || springs.current.length !== chars.length) {
    springs.current = chars.map(() => ({
      x: { x: 0, v: 0 }, // horizontal displacement
      y: { x: 0, v: 0 }, // vertical displacement
      s: { x: 1, v: 0 }, // scale
    }));
  }

  useEffect(() => {
    // Measure once in page coordinates: scrolling never invalidates the
    // cache (viewport position is derived per frame), only resize does.
    const computeRects = () => {
      rectsRef.current = elRefs.current.map((el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          px: r.left + r.width  * 0.5 + window.scrollX,
          py: r.top  + r.height * 0.5 + window.scrollY,
        };
      });
    };

    const loop = () => {
      // ── 1. Smooth cursor ─────────────────────────────────────────────────
      const raw = rawCursor.current;
      const sm  = smCursor.current;
      sm.x += (raw.x - sm.x) * CURSOR_LERP;
      sm.y += (raw.y - sm.y) * CURSOR_LERP;

      // ── 2. Move lens indicator ───────────────────────────────────────────
      if (lensRef.current) {
        lensRef.current.style.left    = `${sm.x}px`;
        lensRef.current.style.top     = `${sm.y}px`;
        lensRef.current.style.opacity = hovering.current ? "1" : "0";
      }

      // ── 3. Update each character ─────────────────────────────────────────
      let anyActive = false;

      elRefs.current.forEach((el, i) => {
        if (!el) return;
        const sp   = springs.current[i];
        const rect = rectsRef.current[i];
        if (!rect) return;

        // Cached page coords → current viewport coords
        const cx = rect.px - window.scrollX;
        const cy = rect.py - window.scrollY;

        // Vector from character toward cursor
        const dvx  = sm.x - cx;
        const dvy  = sm.y - cy;
        const dist = Math.hypot(dvx, dvy);

        let tx = 0, ty = 0, ts = 1; // spring targets

        if (hovering.current && dist > 0 && dist < LENS_RADIUS) {
          const t = dist / LENS_RADIUS; // 0 = centre, 1 = edge

          // Displacement falloff shape:
          //   zero at cursor centre (t=0) — centre doesn't move
          //   peaks at t ≈ 0.5 (halfway out) — max lens pull
          //   zero at radius edge (t=1) — effect fades cleanly
          // sin(π(1−t)) gives exactly this single-bump profile.
          const df = Math.sin(Math.PI * (1 - t));

          // Scale falloff: quadratic, max at centre
          const sf = (1 - t) * (1 - t);

          const nx = dvx / dist; // unit vector toward cursor
          const ny = dvy / dist;

          tx = nx * df * MAX_PUSH;
          ty = ny * df * MAX_PUSH;
          ts = 1 + sf * MAX_SCALE;
        }

        // Advance springs toward targets
        springStep(sp.x, tx);
        springStep(sp.y, ty);
        springStep(sp.s, ts);

        // Skip DOM write if change is below perception threshold
        const dirty =
          Math.abs(sp.x.x) > REST_EPS ||
          Math.abs(sp.y.x) > REST_EPS ||
          Math.abs(sp.s.x - 1) > 0.001;

        if (dirty) {
          anyActive = true;
          el.style.transform =
            `translate(${sp.x.x.toFixed(2)}px,${sp.y.x.toFixed(2)}px)` +
            ` scale(${sp.s.x.toFixed(4)})`;
        } else if (el.style.transform) {
          el.style.transform = "";
        }

        if (
          Math.abs(sp.x.v) > REST_EPS ||
          Math.abs(sp.y.v) > REST_EPS ||
          Math.abs(sp.s.v) > 0.001
        ) {
          anyActive = true;
        }
      });

      // ── 4. Idle stop: nothing moving, cursor gone → park the loop ────────
      if (!hovering.current && !anyActive) {
        runningRef.current = false;
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!runningRef.current) {
        runningRef.current = true;
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    startRef.current = start;

    computeRects();
    window.addEventListener("resize", computeRects);

    return () => {
      window.removeEventListener("resize", computeRects);
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
  }, []); // stable — reads everything through refs

  const onMove = useCallback((e) => {
    rawCursor.current = { x: e.clientX, y: e.clientY };
    hovering.current  = true;
    startRef.current(); // wake the loop if it was parked
  }, []);

  const onLeave = useCallback(() => {
    // Keep the smoothed cursor where it is; springs relax to rest and the
    // loop parks itself once everything has settled.
    hovering.current = false;
  }, []);

  // Mutable counter for flattened char index across lines
  let charIdx = 0;

  return (
    <>
      {/* Ghost lens ring — barely visible, reinforces the glass metaphor */}
      <div ref={lensRef} style={lensStyle} aria-hidden="true" />

      <h1
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={h1Style}
      >
        {LINES.map((line, li) => (
          <span key={li} style={{ display: "block" }}>
            {[...line].map((ch) => {
              const i = charIdx++;
              return (
                <span
                  key={i}
                  ref={(el) => { elRefs.current[i] = el; }}
                  style={charStyle}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        ))}
      </h1>
    </>
  );
}
