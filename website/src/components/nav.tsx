"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { ArrowDownToLine, Menu, X } from "lucide-react";
import { Wordmark } from "./ui/logo";
import { GitHubIcon } from "./ui/icons";
import { ButtonLink } from "./ui/button";
import { site } from "@/lib/site";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#download", label: "Download" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <motion.nav
        aria-label="Main"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl pl-4 pr-2 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
          scrolled || open
            ? "bg-ink-2/70 shadow-[0_0_0_1px_rgb(255_255_255/0.07),0_20px_40px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150"
            : "bg-transparent"
        }`}
      >
        <a href="#top" aria-label="MediaDrop home" className="rounded-lg">
          <Wordmark />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-lg px-3 py-2 text-sm text-fg-2 transition-colors hover:text-fg">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <ButtonLink href={site.repo} variant="ghost" className="hidden sm:inline-flex" aria-label="MediaDrop on GitHub">
            <GitHubIcon className="size-[18px]" />
            <span className="hidden lg:inline">GitHub</span>
          </ButtonLink>
          <ButtonLink href={site.releases} className="hidden h-9 sm:inline-flex">
            <ArrowDownToLine className="size-4 transition-transform duration-300 group-hover/btn:translate-y-0.5" strokeWidth={2.2} />
            Download
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-10 place-items-center rounded-xl text-fg-2 transition-colors hover:bg-white/5 hover:text-fg md:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "x" : "menu"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-2 max-w-6xl origin-top overflow-hidden rounded-2xl bg-ink-2/90 p-2 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col">
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i + 0.05 }}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center rounded-xl px-4 text-[15px] text-fg-2 transition-colors hover:bg-white/5 hover:text-fg"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line p-2 pt-4">
              <ButtonLink href={site.repo} variant="secondary" size="lg">
                <GitHubIcon className="size-[18px]" /> GitHub
              </ButtonLink>
              <ButtonLink href={site.releases} size="lg">
                <ArrowDownToLine className="size-4" strokeWidth={2.2} /> Download
              </ButtonLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
