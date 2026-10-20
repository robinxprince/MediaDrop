"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowLeftRight, Hourglass, Unplug, X } from "lucide-react";
import { Reveal, SectionHeading } from "./ui/reveal";
import { SpotlightCard } from "./ui/spotlight-card";
import { Logo } from "./ui/logo";

type Page = "results" | "convert" | "files" | "video" | "thumb" | "audio" | "editor";

// The detours MediaDrop removes: searching site by site, converting, unzipping, thumbnails instead of originals.
const TABS: { title: string; page: Page; dot: string }[] = [
  { title: "Untitled sequence · Premiere Pro", page: "editor", dot: "#9999ff" },
  { title: "free rain stock footage", page: "results", dot: "#4285f4" },
  { title: "Rain videos · stock site", page: "results", dot: "#30a46c" },
  { title: "rain city 4k", page: "video", dot: "#ff3b3b" },
  { title: "webm to mp4 converter", page: "convert", dot: "#f5a524" },
  { title: "Downloads", page: "files", dot: "#8b93a7" },
  { title: "rain sound effect free", page: "audio", dot: "#4285f4" },
  { title: "is this free to use commercially?", page: "results", dot: "#ff6b35" },
  { title: "elements-download.zip", page: "files", dot: "#87e64b" },
  { title: "image (236×177)", page: "thumb", dot: "#4285f4" },
  { title: "lofi rain no copyright", page: "audio", dot: "#ff3b3b" },
  { title: "Rain photos · page 3", page: "results", dot: "#e5484d" },
  { title: "avif to png", page: "convert", dot: "#f5a524" },
  { title: "thunder sfx", page: "audio", dot: "#4285f4" },
  { title: "Downloads", page: "files", dot: "#8b93a7" },
  { title: "rain window gif", page: "results", dot: "#00c2ff" },
  { title: "storm footage free", page: "results", dot: "#4285f4" },
  { title: "Untitled sequence · Premiere Pro", page: "editor", dot: "#9999ff" },
  { title: "wav vs mp3 premiere", page: "results", dot: "#4285f4" },
  { title: "Rain videos · page 6", page: "results", dot: "#30a46c" },
];

const START = 5;

type Chaos = { count: number; active: number; seconds: number };

function useTabChaos(running: boolean, still: boolean): Chaos {
  // Server and first client render must match, so reduced motion is applied after mount.
  const [state, setState] = useState<Chaos>({ count: START, active: 1, seconds: 312 });
  const current = useRef(state);
  const held = useRef(0);

  useEffect(() => {
    if (still) setState({ count: TABS.length, active: 0, seconds: 1421 });
  }, [still]);

  useEffect(() => {
    if (!running || still) return;
    const id = window.setInterval(() => {
      const { count, active, seconds } = current.current;
      let next: Chaos;
      if (count < TABS.length) {
        next = { count: count + 1, active: count, seconds: seconds + 37 };
      } else if (++held.current > 6) {
        // all tabs open for a while: start over
        held.current = 0;
        next = { count: START, active: 1, seconds: seconds + 37 };
      } else {
        next = { count, active: (active * 7 + 3) % count, seconds: seconds + 37 };
      }
      current.current = next;
      setState(next);
    }, 820);
    return () => window.clearInterval(id);
  }, [running, still]);

  return state;
}

function TabChaos() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = !!useReducedMotion();
  const { count, active, seconds } = useTabChaos(inView, reduce);
  const tab = TABS[active];
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div ref={ref} className="relative">
      <div className="overflow-hidden rounded-2xl bg-[#0c0e13] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_100px_-40px_rgb(0_0_0/0.9)]">
        {/* tab strip */}
        <div className="flex h-10 items-end gap-0 bg-[#07080b] pl-3 pr-2">
          <div className="mb-3.5 mr-3 flex shrink-0 gap-[5px]">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <div className="flex min-w-0 flex-1 items-end">
            <AnimatePresence initial={false}>
              {TABS.slice(0, count).map((t, i) => (
                <motion.div
                  key={`${i}-${t.title}`}
                  layout
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={`relative flex h-8 min-w-0 flex-1 basis-0 items-center gap-1.5 overflow-hidden rounded-t-lg px-2 text-[11px] transition-colors duration-200 ${
                    i === active ? "bg-[#0c0e13] text-fg" : "text-fg-3"
                  }`}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: t.dot }} />
                  <span className="truncate">{t.title}</span>
                  {i !== active && <span className="absolute right-0 top-2 h-4 w-px bg-white/10" />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        {/* address bar */}
        <div className="flex h-9 items-center gap-2 border-b border-white/5 px-3">
          <span className="h-5 flex-1 truncate rounded-md bg-white/[0.04] px-2.5 font-mono text-[10.5px] leading-5 text-fg-3">{tab.title}</span>
        </div>
        {/* page */}
        <div className="relative h-[220px] sm:h-[260px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 p-4 sm:p-5"
            >
              <PageSkeleton page={tab.page} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* readouts */}
      <div className="absolute -bottom-5 left-4 flex gap-2 sm:left-6">
        <span className="rounded-full bg-ink-2 px-3 py-1.5 font-mono text-[11px] tabular-nums text-fg-2 ring-1 ring-line-strong" aria-live="off">
          <span className="text-fg">{count}</span> tabs open
        </span>
        <span className="rounded-full bg-ink-2 px-3 py-1.5 font-mono text-[11px] tabular-nums text-fg-2 ring-1 ring-line-strong">
          searching <span className="text-lic-check">{mm}:{ss}</span>
        </span>
      </div>
    </div>
  );
}

function PageSkeleton({ page }: { page: Page }) {
  const bar = "rounded-md bg-white/[0.06]";
  switch (page) {
    case "results":
      return (
        <div className="flex h-full flex-col gap-3">
          <div className={`${bar} h-3 w-1/3`} />
          <div className="grid flex-1 grid-cols-3 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`${bar} ${i > 5 ? "hidden sm:block" : ""}`} />
            ))}
          </div>
        </div>
      );
    case "convert":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="font-mono text-[11px] text-fg-3">clip.webm → clip.mp4</div>
          <div className="h-1.5 w-2/3 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full bg-[#f5a524]/70" initial={{ width: "8%" }} animate={{ width: "41%" }} transition={{ duration: 0.8 }} />
          </div>
          <div className="text-[11px] text-fg-3">Uploading… please wait</div>
        </div>
      );
    case "files":
      return (
        <div className="flex flex-col gap-2 font-mono text-[11px] text-fg-3">
          {["rain-city(1).mp4", "rain-city(2).webm", "download.zip", "image (3).webp", "thunder_final_FINAL.wav", "untitled.avif"].map((f) => (
            <div key={f} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 odd:bg-white/[0.03]">
              <span className="size-3 rounded-sm bg-white/10" />
              {f}
            </div>
          ))}
        </div>
      );
    case "video":
      return (
        <div className="flex h-full gap-3">
          <div className={`${bar} flex-[2]`} />
          <div className="hidden flex-1 flex-col gap-2 sm:flex">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${bar} flex-1`} />
            ))}
          </div>
        </div>
      );
    case "thumb":
      return (
        <div className="grid h-full place-items-center">
          <div className="h-[70px] w-[94px] rounded bg-gradient-to-br from-[#26344f] to-[#121826] [image-rendering:pixelated] ring-1 ring-white/10" />
        </div>
      );
    case "audio":
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="size-7 shrink-0 rounded-full bg-white/[0.06]" />
              <div className="flex h-6 flex-1 items-center gap-[3px]">
                {Array.from({ length: 40 }, (_, j) => (
                  <span key={j} className="flex-1 rounded-full bg-white/10" style={{ height: `${20 + Math.abs(Math.sin(j * 0.7 + i)) * 80}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "editor":
      return (
        <div className="flex h-full flex-col gap-2">
          <div className="flex flex-1 gap-2">
            <div className={`${bar} flex-1`} />
            <div className={`${bar} flex-[1.4]`} />
          </div>
          <div className="flex h-16 flex-col gap-1.5 rounded-md bg-white/[0.03] p-2">
            <div className="flex h-full gap-1">
              <div className="w-1/4 rounded-sm bg-[#9999ff]/30" />
              <div className="w-1/6 rounded-sm bg-[#9999ff]/30" />
              <div className="flex-1 rounded-sm border border-dashed border-white/15" />
            </div>
          </div>
        </div>
      );
  }
}

const pains = [
  {
    icon: ArrowLeftRight,
    title: "Endless Tab Switching",
    body: "Jumping between websites and folders interrupts your creative momentum.",
  },
  {
    icon: Unplug,
    title: "Lost Creative Flow",
    body: "Every unnecessary interruption makes it harder to stay focused on the edit.",
  },
  {
    icon: Hourglass,
    title: "Too Much Time Searching",
    body: "Finding the right assets shouldn't take longer than using them.",
  },
];

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className="relative pt-32 sm:pt-44">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="problem-title"
          eyebrow="The problem"
          title={
            <>
              Your Creativity Deserves Better Than <span className="whitespace-nowrap text-lic-check/90">20 Open Tabs.</span>
            </>
          }
          sub="Search here, convert there, unzip, rename, import. The edit waits while you hunt."
        />

        <Reveal className="mx-auto mt-14 max-w-4xl sm:mt-16">
          <TabChaos />
        </Reveal>

        <div className="mt-20 grid gap-3 sm:mt-24 md:grid-cols-3">
          {pains.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <SpotlightCard className="h-full p-6 sm:p-7">
                <span className="grid size-10 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-inset ring-line-strong transition-transform duration-500 ease-out-expo group-hover/card:-rotate-6 group-hover/card:scale-110">
                  <p.icon className="size-[18px] text-fg-2 transition-colors group-hover/card:text-drop-soft" strokeWidth={1.8} />
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-fg">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{p.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>

      <Converge />
    </section>
  );
}

// Scattered tabs pulled into one window as the visitor scrolls: the hand-off to "Meet MediaDrop".
const SCATTER = [
  { label: "stock footage", x: -330, y: -90, r: -8 },
  { label: "Downloads", x: 300, y: -110, r: 6 },
  { label: "webm to mp4", x: -260, y: 80, r: 5 },
  { label: "sound effects", x: 250, y: 90, r: -5 },
  { label: "Google Images", x: -120, y: -150, r: 3 },
  { label: "download.zip", x: 130, y: 150, r: -4 },
  { label: "rain 4k", x: 380, y: 10, r: 8 },
  { label: "free music", x: -400, y: 10, r: -6 },
];

function Converge() {
  const ref = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState(1);
  useEffect(() => {
    const fit = () => setSpread(Math.min(1, window.innerWidth / 1000));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "center 0.5"] });
  const logoScale = useTransform(scrollYProgress, [0.55, 1], [0.6, 1]);
  const logoOpacity = useTransform(scrollYProgress, [0.5, 0.9], [0, 1]);
  const textOpacity = useTransform(scrollYProgress, [0.7, 1], [0, 1]);
  const textY = useTransform(scrollYProgress, [0.7, 1], [12, 0]);

  return (
    <div ref={ref} className="relative mx-auto mt-28 flex h-[420px] max-w-6xl items-center justify-center overflow-hidden px-4 sm:mt-36" aria-hidden="true">
      <div className="absolute size-[340px] rounded-full bg-[radial-gradient(closest-side,rgb(91_147_255/0.22),transparent)] blur-2xl" />
      {SCATTER.map((s) => (
        <Chip key={s.label} {...s} x={s.x * spread} y={s.y * Math.max(spread, 0.7)} progress={scrollYProgress} />
      ))}
      <motion.div style={{ scale: logoScale, opacity: logoOpacity }} className="relative flex flex-col items-center gap-5">
        <div className="grid size-24 place-items-center rounded-[28px] bg-white/[0.04] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_20px_60px_-10px_rgb(91_147_255/0.5)] backdrop-blur">
          <Logo size={60} />
        </div>
        <motion.p style={{ opacity: textOpacity, y: textY }} className="text-center text-xl font-medium tracking-[-0.02em] text-fg sm:text-2xl">
          One window. <span className="text-fg-3">Every source.</span>
        </motion.p>
      </motion.div>
    </div>
  );
}

function Chip({ label, x, y, r, progress }: { label: string; x: number; y: number; r: number; progress: MotionValue<number> }) {
  const tx = useTransform(progress, [0, 0.7], [x, 0]);
  const ty = useTransform(progress, [0, 0.7], [y, 0]);
  const rot = useTransform(progress, [0, 0.7], [r, 0]);
  const scale = useTransform(progress, [0.4, 0.7], [1, 0.4]);
  const opacity = useTransform(progress, [0, 0.15, 0.55, 0.7], [0, 1, 1, 0]);
  return (
    <motion.span
      style={{ x: tx, y: ty, rotate: rot, scale, opacity }}
      className="absolute flex items-center gap-2 whitespace-nowrap rounded-lg bg-panel-2 px-3 py-2 text-[12px] text-fg-2 shadow-lg ring-1 ring-line-strong max-sm:text-[11px]"
    >
      {label}
      <X className="size-3 text-fg-3" />
    </motion.span>
  );
}
