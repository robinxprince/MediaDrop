import { ArrowDownToLine, ArrowUpRight, BookOpen, FlaskConical, Package, Scale, ShieldCheck, Tag } from "lucide-react";
import { Reveal } from "./ui/reveal";
import { ButtonLink } from "./ui/button";
import { AppleIcon, GitHubIcon, WindowsIcon } from "./ui/icons";
import { Logo } from "./ui/logo";
import { site } from "@/lib/site";

// Install steps from the README.
const install = [
  {
    platform: "Mac",
    steps: [
      { title: "Unzip and run the installer", body: "Double-click Install MediaDrop.command." },
      { title: "Allow it once", body: "macOS can't verify the developer yet. Open System Settings › Privacy & Security and click Open Anyway." },
      { title: "Restart Premiere Pro", body: "Open MediaDrop. The Pr light turns green when Premiere is connected." },
    ],
  },
  {
    platform: "Windows",
    steps: [
      { title: "Extract and run the installer", body: "Right-click the zip, choose Extract All, then double-click Install MediaDrop.cmd." },
      { title: "Allow it once", body: "If Windows protected your PC appears, click More info › Run anyway. No administrator rights needed." },
      { title: "Restart Premiere Pro", body: "Open MediaDrop from the Start menu. The Pr light turns green when Premiere is connected." },
    ],
  },
];
const builds = [
  { ...site.downloads.mac, Icon: AppleIcon },
  { ...site.downloads.windows, Icon: WindowsIcon },
];

export function Download() {
  return (
    <section id="download" aria-labelledby="download-title" className="relative overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-44">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute bottom-[-20rem] left-1/2 h-[44rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(91_147_255/0.22),rgb(157_140_255/0.08)_60%,transparent)] blur-2xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="relative mb-8">
            <div aria-hidden="true" className="absolute inset-0 scale-150 rounded-full bg-drop/30 blur-3xl" />
            <div className="relative grid size-20 place-items-center rounded-[24px] bg-white/[0.04] shadow-[0_0_0_1px_rgb(255_255_255/0.1)] backdrop-blur">
              <Logo size={52} />
            </div>
          </div>
          <h2 id="download-title" className="text-balance text-[clamp(2.2rem,6vw,4.2rem)] font-semibold leading-[1] tracking-[-0.04em]">
            Ready to Get Your <span className="text-shimmer">Creative Flow</span> Back?
          </h2>
          <p className="mt-5 max-w-lg text-balance text-[17px] leading-relaxed text-fg-2">
            Pick your computer and the download starts right away. Free, for Mac and Windows.
          </p>
          {site.beta && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3.5 py-1.5 text-[13px] text-amber-200 ring-1 ring-inset ring-amber-300/25">
              <FlaskConical className="size-3.5" />
              These are beta builds. Expect a few rough edges, and updates arrive in the app.
            </p>
          )}
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {builds.map(({ href, label, Icon }) => (
              <ButtonLink key={label} href={href} size="lg" external={false}>
                <Icon className="size-[18px]" />
                {label}
              </ButtonLink>
            ))}
          </div>
          <p className="mt-5 text-[13px] text-fg-3">Free · {site.requirements}</p>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-16 max-w-4xl">
          <div className="grid overflow-hidden rounded-3xl bg-panel/70 ring-1 ring-line md:grid-cols-[1.1fr_1fr]">
            {/* repository card */}
            <a
              href={site.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-5 p-6 transition-colors hover:bg-white/[0.02] sm:p-8"
            >
              <div className="flex items-center gap-2.5 text-[15px]">
                <GitHubIcon className="size-5 text-fg-2" />
                <span className="text-fg-2">robinxprince</span>
                <span className="text-fg-3">/</span>
                <span className="font-semibold text-fg">MediaDrop</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] text-fg-3 ring-1 ring-line-strong">Public</span>
                <ArrowUpRight className="ml-auto size-4 text-fg-3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" />
              </div>
              <p className="text-[14.5px] leading-relaxed text-fg-2">
                Search stock media from many sites, browse Envato, YouTube and Google Images, and import straight into Adobe Premiere Pro.
              </p>
              <div className="flex flex-col gap-2">
                {builds.map(({ file, system, Icon }) => (
                  <div key={file} className="flex items-center gap-3 rounded-xl bg-ink/60 px-3.5 py-3 ring-1 ring-line">
                    <Icon className="size-4 shrink-0 text-drop-soft" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-[12px] text-fg-2">{file}</span>
                      <span className="text-[11.5px] text-fg-3">{system}</span>
                    </span>
                    <Package className="ml-auto size-3.5 shrink-0 text-fg-3" />
                  </div>
                ))}
              </div>
              <ul className="mt-auto grid gap-2.5 text-[13px] text-fg-2 sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <Tag className="size-3.5 text-drop-soft" /> Latest release <span className="font-mono text-fg">v{site.version}{site.beta && " beta"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Scale className="size-3.5 text-drop-soft" /> MIT License
                </li>
                <li className="flex items-center gap-2">
                  <ArrowDownToLine className="size-3.5 text-drop-soft" /> Updates in the app
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-drop-soft" /> No data collected
                </li>
              </ul>
            </a>

            {/* install steps */}
            <div className="border-t border-line bg-ink-2/60 p-6 sm:p-8 md:border-l md:border-t-0">
              {install.map(({ platform, steps }, p) => (
                <div key={platform} className={p ? "mt-7" : ""}>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-3">Install on {platform}</p>
                  <ol className="mt-4 flex flex-col gap-4">
                    {steps.map((s, i) => (
                      <li key={s.title} className="flex gap-3.5">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.05] font-mono text-[11px] text-fg-2 ring-1 ring-line-strong">
                          {i + 1}
                        </span>
                        <span>
                          <span className="block text-[14px] font-medium text-fg">{s.title}</span>
                          <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-3">{s.body}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              <a
                href={site.readme}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-drop-soft transition-colors hover:text-fg"
              >
                <BookOpen className="size-3.5" /> Full instructions in the README
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
