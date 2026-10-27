"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowDownToLine, Check, Folder, Scissors, Search } from "lucide-react";
import { Reveal, SectionHeading } from "./ui/reveal";
import { AppWindow } from "./mock/chrome";
import { SceneArt, Waveform } from "./mock/thumbs";
import { PrBadge } from "./ui/icons";

const ease = [0.16, 1, 0.3, 1] as const;
const STEP_MS = 6000;

const steps = [
  {
    title: "Open MediaDrop",
    body: "One window beside Premiere, with every source a click away. Press ⌥ Space (Alt+Space on Windows) to bring it up from any app.",
  },
  {
    title: "Find What You Need",
    body: "Search every site at once, or browse Envato, YouTube and Google Images with download buttons built in.",
  },
  {
    title: "Keep Creating",
    body: "MediaDrop converts what you pick and places it on your Premiere Pro timeline, sorted into bins.",
  },
];

export function Meet() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const auto = inView && !paused && !reduce;

  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % steps.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [auto, step]);

  return (
    <section id="how-it-works" aria-labelledby="meet-title" className="relative pt-16 sm:pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="meet-title"
          eyebrow="How it works"
          title={
            <>
              Meet MediaDrop. <span className="text-shimmer">Your Creative Shortcut.</span>
            </>
          }
          sub="Spend less time searching and more time making something incredible."
        />

        <Reveal className="mt-14 sm:mt-16">
          <div
            ref={ref}
            onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            className="relative"
          >
            <div aria-hidden="true" className="absolute inset-x-[10%] -top-8 bottom-1/3 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(157_140_255/0.22),transparent)] blur-3xl" />
            <div className="relative h-[400px] sm:h-[480px] lg:h-[540px]" role="tabpanel" id="meet-panel" aria-labelledby={`meet-step-${step}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.5, ease }}
                  className="absolute inset-0"
                >
                  {step === 0 && <StepOpen />}
                  {step === 1 && <StepFind />}
                  {step === 2 && <StepCreate />}
                </motion.div>
              </AnimatePresence>
            </div>

            <div role="tablist" aria-label="How MediaDrop works" className="mt-6 grid gap-2 sm:mt-8 md:grid-cols-3 md:gap-3">
              {steps.map((s, i) => (
                <button
                  key={s.title}
                  id={`meet-step-${i}`}
                  role="tab"
                  type="button"
                  aria-selected={step === i}
                  aria-controls="meet-panel"
                  onClick={() => setStep(i)}
                  className={`group relative overflow-hidden rounded-2xl p-5 text-left ring-1 ring-inset transition-colors duration-300 ${
                    step === i ? "bg-panel ring-line-strong" : "ring-transparent hover:bg-panel/50"
                  }`}
                >
                  <span className="absolute inset-x-0 top-0 h-px bg-line">
                    {step === i && (
                      <motion.span
                        key={`${step}-${auto}`}
                        className="block h-full origin-left bg-gradient-to-r from-drop to-lilac"
                        initial={{ scaleX: auto ? 0 : 1 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: auto ? STEP_MS / 1000 : 0, ease: "linear" }}
                      />
                    )}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className={`font-mono text-[12px] transition-colors ${step === i ? "text-drop-soft" : "text-fg-3"}`}>0{i + 1}</span>
                    <span className="flex flex-col gap-1.5">
                      <span className={`text-[16px] font-semibold tracking-[-0.01em] transition-colors ${step === i ? "text-fg" : "text-fg-2 group-hover:text-fg"}`}>
                        {s.title}
                      </span>
                      <span className={`text-[14px] leading-relaxed transition-colors ${step === i ? "text-fg-2" : "text-fg-3"}`}>{s.body}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* Step 1: the window and its sources */
function StepOpen() {
  const sources = [
    { name: "Search", sub: "Video, images, music, SFX, GIFs", el: <Search className="size-4" strokeWidth={2.4} />, tint: "from-[#00e5ff]/20" },
    { name: "Envato Elements", sub: "Downloads unzip automatically", el: <span className="block h-3.5 w-2 rotate-[25deg] rounded-full bg-[#1a4200]" />, tint: "from-[#87e64b]/25", box: "bg-[#87e64b]" },
    { name: "YouTube", sub: "Download button on every video", el: <span className="ml-0.5 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />, tint: "from-[#ff0000]/20", box: "bg-[#ff0000]" },
    { name: "Google Images", sub: "Import the original, not the thumbnail", el: <span className="font-bold text-[#4285f4]">G</span>, tint: "from-[#4285f4]/20", box: "bg-white" },
  ];
  return (
    <AppWindow active="search" className="h-full" address="MediaDrop">
      <div className="flex h-full flex-col items-center justify-center gap-7 p-5">
        <div className="flex items-center gap-2 text-[12px] text-[#9aa3b8]">
          <span className="flex gap-1">
            {["⌘", "⇧", "M"].map((k, i) => (
              <motion.kbd
                key={k}
                initial={{ y: -4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.08, ease }}
                className="grid h-7 min-w-7 place-items-center rounded-md border border-[#2d364d] border-b-[3px] bg-[#181c28] px-1.5 font-sans text-[12px] text-white"
              >
                {k}
              </motion.kbd>
            ))}
          </span>
          brings MediaDrop up from any app
        </div>
        <div className="grid w-full max-w-2xl grid-cols-2 gap-2.5 @2xl:grid-cols-4">
          {sources.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease }}
              className={`flex flex-col gap-3 rounded-xl border border-[#1e2433] bg-gradient-to-b ${s.tint} to-[#11141c] to-60% p-3.5`}
            >
              <span className={`grid size-8 place-items-center rounded-lg ${s.box ?? "bg-[#222738] text-white"}`}>{s.el}</span>
              <span>
                <span className="block text-[12.5px] font-semibold text-white">{s.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[#9aa3b8]">{s.sub}</span>
              </span>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#5e667b]"
        >
          <span>Pin any other site to the sidebar</span>
          <span>Keep on top of Premiere Pro</span>
        </motion.div>
      </div>
    </AppWindow>
  );
}

/* Step 2: browsing YouTube with the built-in download dialog */
function StepFind() {
  return (
    <AppWindow active="youtube" className="h-full" address="youtube.com/results?search_query=rain+city+4k">
      <div className="grid h-full grid-cols-2 gap-3 p-4 opacity-60 @2xl:grid-cols-3">
        {(["city", "neon", "storm", "window", "dusk", "forest"] as const).map((s, i) => (
          <div key={s} className={`flex flex-col gap-1.5 ${i > 3 ? "hidden @2xl:flex" : ""}`}>
            <div className="relative aspect-video overflow-hidden rounded-lg">
              <SceneArt scene={s} className="size-full" />
              <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md bg-black/70 text-white">
                <ArrowDownToLine className="size-3" />
              </span>
            </div>
            <span className="h-2 w-4/5 rounded bg-white/10" />
            <span className="h-2 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 grid place-items-center bg-black/45 p-3 backdrop-blur-[2px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease }}
          className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-[#2d364d] bg-[#11141c] shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-[#1e2433] p-3.5">
            <span className="h-11 w-[72px] shrink-0 overflow-hidden rounded-md">
              <SceneArt scene="city" className="size-full" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-white">Walking in Tokyo rain, 4K</span>
              <span className="text-[11px] text-[#9aa3b8]">12:48</span>
            </span>
          </div>
          <div className="flex flex-col gap-3 p-3.5 text-[11.5px]">
            <Row label="Quality">
              {["4K", "1440p", "1080p", "720p"].map((q) => (
                <Opt key={q} on={q === "1080p"}>{q}</Opt>
              ))}
            </Row>
            <Row label="Format">
              <Opt on>H.264 MP4</Opt>
              <Opt>ProRes 422</Opt>
              <Opt>Original</Opt>
            </Row>
            <Row label="Audio only">
              {["WAV", "M4A", "MP3", "FLAC"].map((q) => (
                <Opt key={q}>{q}</Opt>
              ))}
            </Row>
            <div className="flex items-center gap-2 rounded-lg bg-[#090b10] px-2.5 py-2 text-[#9aa3b8]">
              <Scissors className="size-3.5" />
              Trim to a clip
              <span className="ml-auto font-mono text-[10.5px] text-white/80">03:12 → 03:24</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#1e2433] p-3">
            <span className="rounded-lg px-3 py-1.5 text-[11.5px] text-[#9aa3b8]">Cancel</span>
            <motion.span
              animate={{ boxShadow: ["0 0 0 0 rgb(0 229 255 / 0.5)", "0 0 0 8px rgb(0 229 255 / 0)"] }}
              transition={{ repeat: Infinity, duration: 1.6, delay: 1 }}
              className="rounded-lg bg-[#00e5ff] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#03141a]"
            >
              Download
            </motion.span>
          </div>
        </motion.div>
      </div>
    </AppWindow>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-[70px] shrink-0 text-[#5e667b]">{label}</span>
      {children}
    </div>
  );
}

function Opt({ children, on = false }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span className={`rounded-md border px-2 py-1 ${on ? "border-[#00e5ff]/70 bg-[#00e5ff]/10 text-white" : "border-[#1e2433] text-[#9aa3b8]"}`}>{children}</span>
  );
}

/* Step 3: the clip lands in Premiere Pro */
function StepCreate() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[14px] bg-[#1d1d1d] text-left text-[11px] text-[#c8c8c8] shadow-[0_0_0_1px_rgb(255_255_255/0.09),0_40px_120px_-30px_rgb(0_0_0/0.9)]">
      <div className="flex h-9 items-center gap-2 border-b border-black/40 bg-[#252525] px-3">
        <PrBadge />
        <span className="text-[11.5px] text-[#e0e0e0]">Premiere Pro</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[#00f59b]/10 px-2 py-0.5 text-[10px] text-[#00f59b]">
          <span className="size-1.5 rounded-full bg-[#00f59b]" />
          MediaDrop connected
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* project panel */}
        <div className="hidden w-[38%] flex-col gap-1 border-r border-black/40 p-3 sm:flex">
          <span className="mb-1 text-[10px] uppercase tracking-wider text-[#8a8a8a]">Project</span>
          <span className="flex items-center gap-1.5 text-[#e0e0e0]">
            <Folder className="size-3.5 text-[#e8b84a]" /> MediaDrop Imports
          </span>
          {["Videos", "Images", "GIFs", "Music"].map((b, i) => (
            <span key={b} className="flex items-center gap-1.5 pl-5">
              <Folder className="size-3.5 text-[#e8b84a]/80" /> {b}
              {i === 0 && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 }}
                  className="ml-auto rounded bg-[#00f59b]/15 px-1.5 text-[9.5px] text-[#00f59b]"
                >
                  +1
                </motion.span>
              )}
            </span>
          ))}
        </div>
        {/* program monitor */}
        <div className="flex flex-1 items-center justify-center bg-[#141414] p-4">
          <div className="relative aspect-video w-full max-w-[460px] overflow-hidden rounded bg-black">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.6 }} className="absolute inset-0">
              <SceneArt scene="city" className="size-full" />
            </motion.div>
          </div>
        </div>
      </div>
      {/* timeline */}
      <div className="relative flex h-[38%] min-h-[120px] flex-col gap-1.5 border-t border-black/50 bg-[#232323] p-3">
        <div className="flex items-center justify-between font-mono text-[9.5px] text-[#8a8a8a]">
          <span>00:00:00:00</span>
          <span>00:00:15:00</span>
          <span>00:00:30:00</span>
        </div>
        {[
          { t: "V2", clips: [] as number[] },
          { t: "V1", clips: [0, 1] },
          { t: "A1", clips: [0, 1], audio: true },
        ].map((track) => (
          <div key={track.t} className="flex h-full items-stretch gap-2">
            <span className="w-6 shrink-0 pt-1 text-[9.5px] text-[#8a8a8a]">{track.t}</span>
            <div className="relative flex flex-1 gap-1 rounded-sm bg-[#1a1a1a] p-[2px]">
              {track.clips.map((c) => (
                <span
                  key={c}
                  className={`h-full rounded-[3px] ${track.audio ? "bg-[#2d8a5b]/70" : "bg-[#6b6bd6]/70"}`}
                  style={{ width: c === 0 ? "26%" : "18%" }}
                />
              ))}
              {track.t !== "V2" && (
                <motion.span
                  initial={{ opacity: 0, y: track.audio ? 0 : -46, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.7, duration: 0.7, ease }}
                  className={`relative flex h-full w-[24%] items-center overflow-hidden rounded-[3px] px-1.5 ring-1 ring-[#00e5ff] ${track.audio ? "bg-[#2d8a5b]" : "bg-[#7a7af0]"}`}
                >
                  {track.audio ? (
                    <Waveform seed={3} bars={28} className="h-3/4 w-full text-white/60" />
                  ) : (
                    <span className="truncate text-[9.5px] text-white">Tokyo rain 4K.mp4</span>
                  )}
                </motion.span>
              )}
            </div>
          </div>
        ))}
        <motion.span
          initial={{ left: "50%" }}
          animate={{ left: "58%" }}
          transition={{ delay: 1.4, duration: 3, ease: "linear" }}
          className="absolute bottom-2 top-6 w-px bg-[#4a9eff]"
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, ease }}
        className="pointer-events-none absolute right-3 top-12 flex items-center gap-2 rounded-xl border border-[#2d364d] bg-[#11141c]/95 py-2 pl-2 pr-3 shadow-2xl"
      >
        <span className="grid size-6 place-items-center rounded-md bg-[#00f59b]/15 text-[#00f59b]">
          <Check className="size-3.5" strokeWidth={2.6} />
        </span>
        <span className="text-[11px] leading-tight">
          <span className="block font-semibold text-white">Placed on the timeline</span>
          <span className="text-[#9aa3b8]">Converted to H.264 MP4</span>
        </span>
      </motion.div>
    </div>
  );
}
