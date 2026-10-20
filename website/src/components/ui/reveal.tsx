"use client";

import { motion, type HTMLMotionProps } from "motion/react";

const ease = [0.16, 1, 0.3, 1] as const;

// Fades and lifts its children into place the first time they scroll into view.
export function Reveal({ delay = 0, y = 24, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, ease, delay }}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  id,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  id?: string;
  align?: "center" | "left";
}) {
  const center = align === "center";
  return (
    <Reveal className={`flex flex-col gap-4 ${center ? "mx-auto max-w-3xl items-center text-center" : "max-w-2xl"}`}>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-drop-soft/80">{eyebrow}</span>
      <h2 id={id} className="text-balance text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-fg">
        {title}
      </h2>
      {sub && <p className="max-w-xl text-balance text-[17px] leading-relaxed text-fg-2">{sub}</p>}
    </Reveal>
  );
}
