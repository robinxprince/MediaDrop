"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, Search } from "lucide-react";
import { AppWindow, Badge } from "./chrome";
import { collections, licence, type Result } from "./data";
import { SceneArt, Waveform } from "./thumbs";
import { PrBadge } from "../ui/icons";

const QUERY = "rain";
const ease = [0.16, 1, 0.3, 1] as const;

type Job = { count: number; progress: number; done: boolean } | null;

export function SearchDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotion();

  const [typed, setTyped] = useState("");
  const [tab, setTab] = useState(0);
  const [freeOnly, setFreeOnly] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<Job>(null);

  // Type the query once the window is on screen.
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setTyped(QUERY);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(QUERY.slice(0, i));
      if (i >= QUERY.length) window.clearInterval(id);
    }, 140);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  // Download progress for the toast.
  useEffect(() => {
    if (!job || job.done) return;
    const id = window.setTimeout(() => {
      setJob((j) => (j ? { ...j, progress: Math.min(1, j.progress + 0.08), done: j.progress + 0.08 >= 1 } : j));
    }, 90);
    return () => window.clearTimeout(id);
  }, [job]);

  useEffect(() => {
    if (!job?.done) return;
    const id = window.setTimeout(() => setJob(null), 3200);
    return () => window.clearTimeout(id);
  }, [job?.done]);

  const searched = typed === QUERY;
  const collection = collections[tab];
  const results = useMemo(
    () => collection.results.filter((r) => !freeOnly || r.tier !== "check"),
    [collection, freeOnly],
  );
  const countFor = (i: number) => collections[i].results.filter((r) => !freeOnly || r.tier !== "check").length;

  function toggle(key: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function downloadAll() {
    setJob({ count: picked.size, progress: 0, done: false });
    setPicked(new Set());
  }

  return (
    <div ref={ref}>
      <AppWindow active="search" connected={searched} className="h-[440px] sm:h-[500px] lg:h-[560px]">
        <div className="flex h-full flex-col">
          {/* search header */}
          <div className="flex flex-col gap-2.5 px-3 pb-2.5 pt-3 @lg:px-5 @lg:pt-4">
            <div className="flex h-10 items-center gap-2.5 rounded-xl border border-[#2d364d] bg-[#0d1017] pl-3 pr-1.5 @lg:h-11">
              <Search className="size-4 shrink-0 text-[#9aa3b8]" strokeWidth={2.2} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium @lg:text-sm">
                {typed ? (
                  <span className="text-white">{typed}</span>
                ) : (
                  <span className="text-[#5e667b]">Search videos, music, sound effects, images and GIFs</span>
                )}
                {!searched && <span className="ml-px inline-block h-[1.05em] w-px translate-y-[2px] animate-pulse bg-[#00e5ff]" />}
              </span>
              <span className="grid h-7 place-items-center rounded-lg bg-[#00e5ff] px-3 text-[11.5px] font-semibold text-[#03141a] @lg:h-8">Search</span>
            </div>

            <div className="flex items-center gap-2">
              <div role="tablist" aria-label="Media type" className="no-scrollbar flex min-w-0 gap-0.5 overflow-x-auto rounded-full bg-[#11141c] p-[3px]">
                {collections.map((c, i) => (
                  <button
                    key={c.id}
                    role="tab"
                    type="button"
                    aria-selected={tab === i}
                    onClick={() => setTab(i)}
                    className={`relative flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors ${
                      tab === i ? "text-[#090b10]" : "text-[#9aa3b8] hover:text-white"
                    }`}
                  >
                    {tab === i && <motion.span layoutId="sv-tab" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                    <span className="relative">{c.label}</span>
                    {searched && <span className="relative tabular-nums opacity-55">{countFor(i)}</span>}
                  </button>
                ))}
              </div>
              <label className="ml-auto hidden shrink-0 cursor-pointer items-center gap-1.5 text-[11.5px] text-[#9aa3b8] @2xl:flex">
                <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-[#00e5ff]" />
                Free to use only
              </label>
            </div>

            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="shrink-0 rounded-full border border-[#00e5ff]/60 bg-[#00e5ff]/[0.08] px-2.5 py-1 font-medium text-white">All</span>
              {collection.picks.map((p) => (
                <span key={p} className="shrink-0 rounded-full border border-[#1e2433] px-2.5 py-1 text-[#9aa3b8]">
                  {p}
                </span>
              ))}
              <span className="mx-1 h-4 w-px shrink-0 bg-[#1e2433]" />
              {collection.more.map((p) => (
                <span key={p} className="shrink-0 rounded-full border border-[#1e2433] px-2.5 py-1 text-[#5e667b]">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* results */}
          <div className="relative min-h-0 flex-1 overflow-hidden px-3 @lg:px-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {searched && (
                <motion.div
                  key={`${collection.id}${freeOnly}`}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  variants={{ show: { transition: { staggerChildren: 0.045 } } }}
                  className={collection.kind === "audio" ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2.5 @2xl:grid-cols-3 @lg:gap-3"}
                >
                  {results.map((r) => {
                    const key = `${collection.id}:${r.title}`;
                    return collection.kind === "audio" ? (
                      <AudioRow key={key} r={r} picked={picked.has(key)} onToggle={() => toggle(key)} />
                    ) : (
                      <Tile key={key} r={r} picked={picked.has(key)} onToggle={() => toggle(key)} gif={collection.kind === "gif"} />
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#090b10] to-transparent" />
          </div>
        </div>

        {/* selection bar */}
        <AnimatePresence>
          {picked.size > 0 && (
            <motion.div
              initial={{ y: 24, opacity: 0, x: "-50%" }}
              animate={{ y: 0, opacity: 1, x: "-50%" }}
              exit={{ y: 24, opacity: 0, x: "-50%" }}
              transition={{ duration: 0.35, ease }}
              className="absolute bottom-3 left-1/2 z-10 flex items-center gap-2 rounded-full border border-[#2d364d] bg-[#181c28]/95 py-1.5 pl-3.5 pr-1.5 text-[11.5px] text-white shadow-2xl backdrop-blur"
            >
              <span className="whitespace-nowrap tabular-nums">{picked.size} selected</span>
              <button type="button" onClick={() => setPicked(new Set())} className="rounded-full px-2.5 py-1 text-[#9aa3b8] hover:text-white">
                Clear
              </button>
              <button type="button" onClick={downloadAll} className="whitespace-nowrap rounded-full bg-[#00e5ff] px-3 py-1 font-semibold text-[#03141a] transition-transform active:scale-95">
                Download all
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* download toast */}
        <AnimatePresence>
          {job && (
            <motion.div
              role="status"
              initial={{ y: 16, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4, ease }}
              className="absolute bottom-3 right-3 z-20 w-[230px] rounded-xl border border-[#2d364d] bg-[#11141c]/95 p-3 shadow-2xl backdrop-blur"
            >
              <div className="flex items-center gap-2.5">
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${job.done ? "bg-[#00f59b]/15 text-[#00f59b]" : "bg-[#00e5ff]/10"}`}>
                  {job.done ? <Check className="size-4" strokeWidth={2.6} /> : <PrBadge />}
                </span>
                <div className="min-w-0 text-[11.5px] leading-tight">
                  <p className="font-semibold text-white">{job.done ? "Imported to Premiere Pro" : `Downloading ${job.count} item${job.count > 1 ? "s" : ""}`}</p>
                  <p className="mt-0.5 truncate text-[#9aa3b8]">{job.done ? "Placed on the timeline" : "Converting to an edit-ready format"}</p>
                </div>
              </div>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#1e2433]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#0091ff] to-[#00e5ff] transition-[width] duration-150" style={{ width: `${job.progress * 100}%` }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AppWindow>
    </div>
  );
}

const item = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease } },
};

function Tile({ r, picked, onToggle, gif }: { r: Result; picked: boolean; onToggle: () => void; gif: boolean }) {
  return (
    <motion.button
      layout
      variants={item}
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      aria-label={`Select ${r.title}`}
      className="group/tile flex min-w-0 flex-col gap-1.5 rounded-xl text-left"
    >
      <span
        className={`relative block aspect-[16/10] w-full overflow-hidden rounded-[10px] ring-1 transition-[box-shadow,transform] duration-300 ${
          picked ? "ring-2 ring-[#00e5ff]" : "ring-[#1e2433] group-hover/tile:ring-[#2d364d]"
        }`}
      >
        <SceneArt scene={r.scene} className="absolute inset-0 size-full transition-transform duration-700 ease-out-expo group-hover/tile:scale-[1.04]" />
        <span
          className={`absolute left-1.5 top-1.5 grid size-4 place-items-center rounded-[5px] border transition-all ${
            picked ? "border-[#00e5ff] bg-[#00e5ff] text-[#03141a]" : "border-white/50 bg-black/30 opacity-0 group-hover/tile:opacity-100"
          }`}
        >
          {picked && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/90 backdrop-blur">
          {gif ? "GIF" : r.meta}
        </span>
      </span>
      <span className="truncate text-[11.5px] font-medium text-white/90">{r.title}</span>
      <span className="flex gap-1">
        <Badge className="bg-[#181c28] text-[#9aa3b8]">{r.site}</Badge>
        <Badge className={licence[r.tier].cls}>{licence[r.tier].label}</Badge>
      </span>
    </motion.button>
  );
}

function AudioRow({ r, picked, onToggle }: { r: Result; picked: boolean; onToggle: () => void }) {
  return (
    <motion.button
      layout
      variants={item}
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      aria-label={`Select ${r.title}`}
      className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
        picked ? "border-[#00e5ff]/70 bg-[#00e5ff]/[0.05]" : "border-[#1e2433] bg-[#11141c] hover:border-[#2d364d]"
      }`}
    >
      <span className="relative size-10 shrink-0 overflow-hidden rounded-lg">
        <SceneArt scene={r.scene} className="size-full" />
        {picked && (
          <span className="absolute inset-0 grid place-items-center bg-[#00e5ff]/80 text-[#03141a]">
            <Check className="size-4" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[12px] font-medium text-white/90">{r.title}</span>
        <span className="flex gap-1">
          <Badge className="bg-[#181c28] text-[#9aa3b8]">{r.site}</Badge>
          <Badge className={licence[r.tier].cls}>{licence[r.tier].label}</Badge>
        </span>
      </span>
      <Waveform seed={r.title.length} bars={36} className="hidden h-7 w-40 text-[#5b93ff] @xl:flex" />
      <span className="w-12 shrink-0 text-right font-mono text-[10.5px] text-[#9aa3b8]">{r.meta}</span>
    </motion.button>
  );
}
