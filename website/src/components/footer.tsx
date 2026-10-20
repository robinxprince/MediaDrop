import { Wordmark } from "./ui/logo";
import { GitHubIcon } from "./ui/icons";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="text-[14px] text-fg-2">Made for creators who value their flow.</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <a
            href={site.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[14px] text-fg-2 transition-colors hover:text-fg"
          >
            <GitHubIcon className="size-4" /> robinxprince/MediaDrop
          </a>
          <p className="text-[12.5px] text-fg-3">
            © {new Date().getFullYear()} MediaDrop · <a href={site.license} target="_blank" rel="noopener noreferrer" className="hover:text-fg-2">MIT License</a>
          </p>
        </div>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-[12px] leading-relaxed text-fg-3/80 sm:px-6">
        Only download content you have the right to use. Licence labels come from each site; check the original page before using a
        result commercially. Premiere Pro is a trademark of Adobe. MediaDrop is an independent project, not affiliated with Adobe.
      </p>
    </footer>
  );
}
