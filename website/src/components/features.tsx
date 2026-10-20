"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Clipboard, Search, Folder, HardDriveDownload, KeyRound, RefreshCw, Scale, ServerOff } from "lucide-react";
import { Reveal, SectionHeading } from "./ui/reveal";
import { SpotlightCard } from "./ui/spotlight-card";
import { PrBadge } from "./ui/icons";
import { licence } from "./mock/data";
import { SceneArt } from "./mock/thumbs";

const ease = [0.16, 1, 0.3, 1] as const;

function Card({
  className = "",
  label,
  title,
  body,
  children,
  delay = 0,
}: {
  className?: string;
  label: string;
  title: string;
  body: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <SpotlightCard className="flex h-full flex-col">
        {children && <div className="relative min-h-[220px] flex-1 overflow-hidden">{children}</div>}
        <div className="p-6 pt-5 sm:p-7 sm:pt-5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-3">{label}</span>
          <h3 className="mt-2 text-[19px] font-semibold tracking-[-0.02em] text-fg">{title}</h3>
          <p className="mt-1.5 max-w-md text-[14.5px] leading-relaxed text-fg-2">{body}</p>
        </div>
      </SpotlightCard>
    </Reveal>
  );
}

function useCycle(length: number, ms: number) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % length), ms);
    return () => window.clearInterval(id);
  }, [length, ms, reduce]);
  return i;
}

/* previews */

const TABS = ["Videos", "Images", "Music", "Sound effects", "GIFs"];
const SOURCES = [["Mixkit", "YouTube"], ["Flickr", "Wikimedia Commons"], ["Mixkit", "YouTube"], ["Mixkit"], ["Tenor"]];

function SearchPreview() {
  const i = useCycle(TABS.length, 2200);
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-4 px-6 pt-6 sm:px-7">
      <div className="flex h-11 items-center gap-2.5 rounded-xl bg-ink/70 px-3.5 ring-1 ring-line-strong">
        <Search className="size-4 text-fg-3" strokeWidth={2.2} />
        <span className="text-[14px] text-fg">city at night</span>
        <span className="ml-auto hidden font-mono text-[11px] text-fg-3 sm:block">one search · every tab</span>
      </div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-ink/60 p-1 ring-1 ring-line">
        {TABS.map((t, n) => (
          <span key={t} className={`relative shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium ${n === i ? "text-ink" : "text-fg-3"}`}>
            {n === i && <motion.span layoutId="feat-tab" className="absolute inset-0 rounded-full bg-fg" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
            <span className="relative">{t}</span>
          </span>
        ))}
      </div>
      <div className="flex h-7 items-center gap-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {SOURCES[i].map((s) => (
            <motion.span
              key={`${i}${s}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease }}
              className="rounded-full px-2.5 py-1 text-[11.5px] text-fg-2 ring-1 ring-line-strong"
            >
              {s}
            </motion.span>
          ))}
        </AnimatePresence>
        <span className="ml-1 hidden items-center gap-1 text-[11.5px] text-fg-3 sm:flex">
          + open the same search on Pexels, Pixabay, Unsplash, Envato <ArrowRight className="size-3" />
        </span>
      </div>
    </div>
  );
}

function BinsPreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-[260px] rounded-xl bg-[#1d1d1d] p-3 text-[12px] text-[#c8c8c8] ring-1 ring-white/10 transition-transform duration-500 ease-out-expo group-hover/card:-translate-y-1">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8a8a8a]">
          <PrBadge className="!size-4 !text-[8px]" /> Project
        </div>
        <div className="flex items-center gap-1.5 text-[#e0e0e0]">
          <Folder className="size-3.5 text-[#e8b84a]" /> MediaDrop Imports
        </div>
        {["Videos", "Images", "GIFs", "Music"].map((b, i) => (
          <div key={b} className="mt-1 flex items-center gap-1.5 pl-5">
            <Folder className="size-3.5 text-[#e8b84a]/80" />
            {b}
            <span
              className="ml-auto h-1.5 rounded-full bg-[#7a7af0]/60 transition-[width] duration-700 ease-out-expo group-hover/card:w-10"
              style={{ width: `${14 + i * 6}px`, transitionDelay: `${i * 60}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LicencePreview() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-6">
      {(["free", "credit", "check"] as const).map((t, i) => (
        <div
          key={t}
          className="flex w-full max-w-[250px] items-center gap-2.5 rounded-xl bg-ink/60 p-2 ring-1 ring-line transition-transform duration-500 ease-out-expo group-hover/card:translate-x-1"
          style={{ transitionDelay: `${i * 50}ms` }}
        >
          <span className="h-8 w-12 shrink-0 overflow-hidden rounded-md">
            <SceneArt scene={(["puddle", "umbrella", "neon"] as const)[i]} className="size-full" />
          </span>
          <span className={`rounded-full px-2 py-[3px] text-[10.5px] font-semibold ${licence[t].cls}`}>{licence[t].label}</span>
        </div>
      ))}
    </div>
  );
}

const CONVERSIONS: [string, string][] = [
  ["clip.webm", "clip.mp4"],
  ["photo.avif", "photo.png"],
  ["loop.webp", "loop.png"],
  ["track.ogg", "track.wav"],
];

function ConvertPreview() {
  const i = useCycle(CONVERSIONS.length, 2000);
  const [from, to] = CONVERSIONS[i];
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-3 p-6 font-mono text-[12.5px]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={from}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease }}
          className="rounded-lg bg-lic-check/10 px-2.5 py-1.5 text-lic-check/90 ring-1 ring-lic-check/20"
        >
          {from}
        </motion.span>
      </AnimatePresence>
      <RefreshCw className="size-4 shrink-0 text-fg-3 transition-transform duration-700 group-hover/card:rotate-180" />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={to}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease, delay: 0.12 }}
          className="rounded-lg bg-lic-free/10 px-2.5 py-1.5 text-lic-free ring-1 ring-lic-free/20"
        >
          {to}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function YouTubePreview() {
  const chips = ["4K · 60 fps", "H.264 MP4", "ProRes 422", "Original", "WAV", "MP3", "Trim", "Playlists"];
  return (
    <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-1.5 p-6">
      {chips.map((c, i) => (
        <span
          key={c}
          className="rounded-lg bg-ink/60 px-2.5 py-1.5 text-[12px] text-fg-2 ring-1 ring-line-strong transition-[transform,color] duration-500 ease-out-expo group-hover/card:-translate-y-0.5 group-hover/card:text-fg"
          style={{ transitionDelay: `${i * 35}ms` }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function ClipboardPreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="flex w-full max-w-[340px] items-center gap-3 rounded-2xl bg-[#11141c] p-3 ring-1 ring-[#2d364d] transition-transform duration-500 ease-out-expo group-hover/card:-translate-y-1 group-hover/card:scale-[1.02]">
        <Clipboard className="size-4 shrink-0 text-[#9aa3b8]" />
        <span className="min-w-0 flex-1 text-[12px] leading-tight">
          <span className="block font-semibold text-white">Copied link</span>
          <span className="block truncate font-mono text-[11px] text-[#5e667b]">youtube.com/watch?v=…</span>
        </span>
        <span className="rounded-lg bg-[#00e5ff] px-3 py-1.5 text-[11.5px] font-semibold text-[#03141a]">Download</span>
      </div>
    </div>
  );
}

function OfflinePreview() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
      <div className="flex items-center gap-2 rounded-xl bg-ink/60 px-3.5 py-2.5 font-mono text-[12px] text-fg-2 ring-1 ring-line-strong">
        <HardDriveDownload className="size-4 text-drop-soft" />
        Downloads/MediaDrop_Imports
      </div>
      <div className="flex items-center gap-2 text-[12px] text-fg-3">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-lic-credit transition-colors duration-700 group-hover/card:bg-lic-free" />
          <PrBadge className="!size-4 !text-[8px]" />
        </span>
        <span className="grid">
          <span className="[grid-area:1/1] transition-opacity duration-500 group-hover/card:opacity-0">Waiting for Premiere…</span>
          <span className="[grid-area:1/1] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100">Imported. Nothing lost.</span>
        </span>
      </div>
    </div>
  );
}

const trust = [
  { icon: ServerOff, text: "No server. Collects nothing." },
  { icon: KeyRound, text: "Logins stay on your Mac, encrypted with Keychain" },
  { icon: RefreshCw, text: "One-click updates from GitHub releases" },
  { icon: Scale, text: "MIT licensed, open source" },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative pt-32 sm:pt-44">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="features-title"
          eyebrow="Features"
          title="Everything You Need. Nothing You Don't."
          sub="Find it, check you can use it, and drop it into your edit, all from one window."
        />

        <div className="mt-14 grid gap-3 sm:mt-16 md:grid-cols-6">
          <Card
            className="md:col-span-4"
            label="Less context switching"
            title="One search, every site"
            body="One search fills tabs for videos, images, music, sound effects and GIFs from Mixkit, Flickr, Wikimedia Commons, YouTube and Tenor."
          >
            <SearchPreview />
          </Card>
          <Card
            className="md:col-span-2"
            delay={0.06}
            label="Straight into the edit"
            title="Lands where you need it"
            body="On the timeline, in the Source Monitor, or in MediaDrop Imports bins sorted by type."
          >
            <BinsPreview />
          </Card>

          <Card
            className="md:col-span-2"
            label="Faster asset discovery"
            title="Know what you can use"
            body="Every result shows its site and whether it's copyright-free, free with credit, or copyrighted."
          >
            <LicencePreview />
          </Card>
          <Card
            className="md:col-span-2"
            delay={0.06}
            label="Nothing to fix later"
            title="Converted on import"
            body="WebM, VP9, AV1, WebP, AVIF, OGG and other formats Premiere struggles with are converted with Apple's hardware encoder."
          >
            <ConvertPreview />
          </Card>
          <Card
            className="md:col-span-2"
            delay={0.12}
            label="Creator-focused"
            title="YouTube, your format"
            body="Any resolution and frame rate, H.264, ProRes 422 or the original. Audio only, trimmed clips and whole playlists."
          >
            <YouTubePreview />
          </Card>

          <Card
            className="md:col-span-3"
            label="Easy access"
            title="Copy a link, get the file"
            body="Copy a YouTube or media link anywhere and MediaDrop offers to download it."
          >
            <ClipboardPreview />
          </Card>
          <Card
            className="md:col-span-3"
            delay={0.06}
            label="Distraction-free"
            title="Works without Premiere"
            body="Everything is saved to your Downloads or beside your project, and imported as soon as Premiere is back."
          >
            <OfflinePreview />
          </Card>
        </div>

        <Reveal className="mt-3">
          <ul className="grid gap-px overflow-hidden rounded-3xl bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4">
            {trust.map((t) => (
              <li key={t.text} className="flex items-center gap-3 bg-ink-2 px-5 py-4 text-[13.5px] text-fg-2">
                <t.icon className="size-4 shrink-0 text-drop-soft" strokeWidth={1.8} />
                {t.text}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
