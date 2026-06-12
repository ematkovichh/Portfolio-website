/**
 * LiquidHeroTitle.jsx
 *
 * Hero title with a liquid magnifying-glass distortion effect.
 *
 * How it works:
 *   Each character is wrapped in an inline-block <span> with a DOM ref.
 *   A requestAnimationFrame loop reads each character's viewport position,
 *   computes lens displacement + scale from cursor proximity, and drives those
 *   values through a critically-damped spring toward their target.
 *   Style writes bypass React re-renders entirely for 60fps on any hardware.
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
  const rawCursor  = useRef({ x: -9999, y: -9999 });
  const smCursor   = useRef({ x: -9999, y: -9999 });
  const hovering   = useRef(false);
  const elRefs     = useRef([]);
  const springs    = useRef(null);
  const lensRef    = useRef(null);

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
      elRefs.current.forEach((el, i) => {
        if (!el) return;
        const sp = springs.current[i];

        // Character centre in viewport coords
        const rect = el.getBoundingClientRect();
        const cx   = rect.left + rect.width  * 0.5;
        const cy   = rect.top  + rect.height * 0.5;

        // Vector from character toward cursor
        const dvx  = sm.x - cx;
        const dvy  = sm.y - cy;
        const dist = Math.hypot(dvx, dvy);

        let tx = 0, ty = 0, ts = 1; // spring targets

        if (dist > 0 && dist < LENS_RADIUS) {
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
          Math.abs(sp.x.x) > 0.02 ||
          Math.abs(sp.y.x) > 0.02 ||
          Math.abs(sp.s.x - 1) > 0.001;

        if (dirty) {
          el.style.transform =
            `translate(${sp.x.x.toFixed(2)}px,${sp.y.x.toFixed(2)}px)` +
            ` scale(${sp.s.x.toFixed(4)})`;
        } else if (el.style.transform) {
          el.style.transform = "";
        }
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // stable — reads everything through refs

  const onMove = useCallback((e) => {
    rawCursor.current = { x: e.clientX, y: e.clientY };
    hovering.current  = true;
  }, []);

  const onLeave = useCallback(() => {
    // Reset cursor instantly so the springs settle back to rest naturally
    rawCursor.current = { x: -9999, y: -9999 };
    smCursor.current  = { x: -9999, y: -9999 };
    hovering.current  = false;
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
