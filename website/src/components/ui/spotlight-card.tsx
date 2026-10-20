"use client";

import { useRef, type ReactNode } from "react";

// A card with a soft light that follows the cursor across its face and border.
export function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={`group/card relative isolate overflow-hidden rounded-3xl bg-panel/70 ring-1 ring-inset ring-line transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-0.5 hover:shadow-[0_30px_80px_-40px_rgb(91_147_255/0.35)] ${className}`}
    >
      {/* border glow: a masked gradient ring */}
      <div
        aria-hidden="true"
        className="spotlight-border pointer-events-none absolute inset-0 -z-10 rounded-[inherit] p-px opacity-0 transition-opacity duration-500 [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] group-hover/card:opacity-100"
      />
      <div aria-hidden="true" className="spotlight pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />
      {children}
    </div>
  );
}
