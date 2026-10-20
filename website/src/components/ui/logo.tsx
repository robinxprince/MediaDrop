import Image from "next/image";
import logo from "./logo.png";

export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <Image src={logo} alt="" width={size} height={size} className={className} priority />;
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={26} />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">MediaDrop</span>
    </span>
  );
}
