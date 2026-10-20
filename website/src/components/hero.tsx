"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, MousePointerClick } from "lucide-react";
import { ButtonLink } from "./ui/button";
import { AppleIcon, WindowsIcon } from "./ui/icons";
import { SearchDemo } from "./mock/search-demo";
import { site } from "@/lib/site";

const ease = [0.16, 1, 0.3, 1] as const;

function Words({ text, delay, className = "" }: { text: string; delay: number; className?: string }) {
  return (
    <span className={`block ${className}`}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "105%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, ease, delay: delay + i * 0.08 }}
          >
            {w}
            {i < text.split(" ").length - 1 && " "}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const stage = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "start 0.25"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const glow = useTransform(scrollYProgress, [0, 1], [0.35, 0.9]);

  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-32 sm:pt-40">
      {/* backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(91_147_255/0.28),rgb(157_140_255/0.1)_55%,transparent)] blur-2xl" />
        <div className="grain absolute inset-0" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center sm:px-6">
        <motion.a
          href="#download"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="group mb-8 inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pl-1 pr-3 text-[13px] text-fg-2 ring-1 ring-inset ring-line-strong backdrop-blur transition-colors hover:bg-white/[0.07] hover:text-fg"
        >
          <span className="rounded-full bg-drop/15 px-2 py-0.5 font-mono text-[11px] text-drop-soft">v{site.version}{site.beta && " beta"}</span>
          Free and open source · Mac and Windows
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </motion.a>

        <h1
          id="hero-title"
          className="text-balance text-[clamp(2.75rem,9vw,6.4rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
        >
          <Words text="Stop Switching Tabs." delay={0.1} className="text-fg" />
          <Words text="Start Creating." delay={0.35} className="text-shimmer" />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.6 }}
          className="mt-7 max-w-[34rem] text-balance text-[17px] leading-relaxed text-fg-2 sm:text-lg"
        >
          Tired of jumping between tabs just to find the perfect asset? MediaDrop brings your creative resources closer to your
          workflow, so you can focus on creating.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.75 }}
          className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
        >
          <ButtonLink href={site.downloads.mac.href} size="lg" external={false}>
            <AppleIcon className="size-[18px]" />
            {site.downloads.mac.label}
          </ButtonLink>
          <ButtonLink href={site.downloads.windows.href} size="lg" external={false}>
            <WindowsIcon className="size-[17px]" />
            {site.downloads.windows.label}
          </ButtonLink>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-fg-3"
        >
          <span>{site.beta ? "Beta builds: expect a few rough edges." : "Built for creators. Available on GitHub."}</span>
          <span aria-hidden="true" className="hidden size-1 rounded-full bg-fg-3/60 sm:block" />
          <span>{site.requirements}</span>
        </motion.p>
      </div>

      {/* product showcase */}
      <div ref={stage} className="relative mx-auto mt-16 max-w-6xl px-3 [perspective:1400px] sm:mt-20 sm:px-6">
        <motion.div
          aria-hidden="true"
          style={{ opacity: glow }}
          className="absolute inset-x-10 -top-10 bottom-10 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_30%,rgb(91_147_255/0.35),rgb(157_140_255/0.12)_50%,transparent)] blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease, delay: 0.5 }}
        >
          <motion.div style={{ rotateX, scale, y, transformOrigin: "50% 0%" }} className="will-change-transform">
            <SearchDemo />
          </motion.div>
        </motion.div>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-[12.5px] text-fg-3">
          <MousePointerClick className="size-3.5" />
          Interactive illustration of MediaDrop&apos;s Search. Switch tabs, then pick a few results.
        </p>
      </div>
    </section>
  );
}
