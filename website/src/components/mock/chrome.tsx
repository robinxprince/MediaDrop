import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Clock, Folder, Home, Menu, Pin, Plus, RotateCw, Search, Settings } from "lucide-react";
import { Logo } from "../ui/logo";
import { PrBadge } from "../ui/icons";

// The MediaDrop window as laid out in renderer/index.html: top bar, collapsed icon sidebar, viewport.

export type SidebarTab = "search" | "envato" | "youtube" | "google";

export function AppWindow({
  children,
  active = "search",
  connected = true,
  address,
  className = "",
}: {
  children: ReactNode;
  active?: SidebarTab;
  connected?: boolean;
  address?: string;
  className?: string;
}) {
  return (
    <div
      className={`@container relative flex flex-col overflow-hidden rounded-[14px] bg-[#090b10] text-left shadow-[0_0_0_1px_rgb(255_255_255/0.09),0_40px_120px_-30px_rgb(0_0_0/0.9),0_0_80px_-20px_rgb(91_147_255/0.25)] ${className}`}
    >
      <TopBar connected={connected} address={address} />
      <div className="flex min-h-0 flex-1">
        <Sidebar active={active} />
        <div className="relative min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function TopBar({ connected, address }: { connected: boolean; address?: string }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#1e2433] bg-[#0d1017] pr-2.5 @lg:gap-3">
      <div className="flex w-[52px] shrink-0 items-center justify-center gap-[5px] @lg:w-[72px]">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <Logo size={20} className="hidden @md:block" />
      <div className="hidden items-center gap-0.5 text-[#5e667b] @2xl:flex">
        {[ChevronLeft, ChevronRight, RotateCw, Home].map((I, i) => (
          <span key={i} className="grid size-6 place-items-center rounded-md">
            <I className="size-3.5" strokeWidth={2.4} />
          </span>
        ))}
      </div>
      <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#1e2433] bg-[#090b10] px-2.5 text-[11px] text-[#9aa3b8]">
        <span className="truncate font-mono">{address ?? "MediaDrop Search"}</span>
      </div>
      <span
        className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[10.5px] font-medium transition-colors duration-500 ${
          connected ? "border-[#00f59b]/25 bg-[#00f59b]/[0.06] text-[#d7ffef]" : "border-[#1e2433] bg-[#11141c] text-[#9aa3b8]"
        }`}
      >
        <span className={`size-1.5 rounded-full transition-colors duration-500 ${connected ? "bg-[#00f59b] shadow-[0_0_8px_#00f59b]" : "bg-[#ffb800]"}`} />
        <PrBadge className="!size-4 !text-[8px]" />
        <span className="hidden @xl:inline">{connected ? "Connected" : "Checking…"}</span>
      </span>
      <span className="hidden gap-0.5 text-[#5e667b] @xl:flex">
        <Pin className="size-3.5" />
        <Settings className="ml-1.5 size-3.5" />
      </span>
    </div>
  );
}

function Sidebar({ active }: { active: SidebarTab }) {
  const item = (tab: SidebarTab, icon: ReactNode, label: string) => (
    <span
      key={tab}
      title={label}
      className={`relative grid size-9 place-items-center rounded-[10px] transition-colors duration-300 ${active === tab ? "bg-[#222738]" : ""}`}
    >
      {active === tab && <span className="absolute -left-[9px] h-4 w-[3px] rounded-r-full bg-[#00e5ff]" />}
      {icon}
    </span>
  );

  return (
    <div className="hidden w-[54px] shrink-0 flex-col items-center gap-1.5 border-r border-[#1e2433] bg-[#0d1017] py-2.5 @md:flex">
      <span className="grid size-9 place-items-center text-[#5e667b]">
        <Menu className="size-4" />
      </span>
      {item("search", <Search className="size-[17px] text-[#eef1f8]" strokeWidth={2.4} />, "Search")}
      {item(
        "envato",
        <span className="grid size-[22px] place-items-center rounded-[6px] bg-[#87e64b]">
          <span className="block h-2.5 w-1.5 rotate-[25deg] rounded-full bg-[#1a4200]" />
        </span>,
        "Envato Elements",
      )}
      {item(
        "youtube",
        <span className="grid h-[16px] w-[22px] place-items-center rounded-[5px] bg-[#ff0000]">
          <span className="ml-px border-y-[4px] border-l-[6px] border-y-transparent border-l-white" />
        </span>,
        "YouTube",
      )}
      {item(
        "google",
        <span className="grid size-[22px] place-items-center rounded-full bg-white text-[13px] font-bold leading-none text-[#4285f4]">G</span>,
        "Google",
      )}
      <span className="my-1 h-px w-6 bg-[#1e2433]" />
      <span className="grid size-9 place-items-center rounded-[10px] text-[#5e667b]">
        <Plus className="size-4" strokeWidth={2.5} />
      </span>
      <span className="mt-auto grid size-9 place-items-center text-[#5e667b]">
        <Folder className="size-4" />
      </span>
      <span className="grid size-9 place-items-center text-[#5e667b]">
        <Clock className="size-4" />
      </span>
    </div>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`whitespace-nowrap rounded-full px-1.5 py-[2px] text-[9.5px] font-semibold leading-none ${className}`}>{children}</span>;
}
