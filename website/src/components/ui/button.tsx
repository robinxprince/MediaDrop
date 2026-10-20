import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-fg text-ink shadow-[0_0_0_1px_rgb(255_255_255/0.2),0_8px_30px_-6px_rgb(91_147_255/0.55)] hover:bg-white hover:shadow-[0_0_0_1px_rgb(255_255_255/0.35),0_10px_40px_-6px_rgb(91_147_255/0.75)]",
  secondary:
    "bg-white/[0.04] text-fg ring-1 ring-inset ring-line-strong backdrop-blur-md hover:bg-white/[0.08] hover:ring-white/20",
  ghost: "text-fg-2 hover:text-fg hover:bg-white/[0.05]",
};

const sizes = {
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2.5 rounded-2xl",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  external = true,
  className = "",
  ...rest
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: keyof typeof sizes;
  external?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`group/btn relative inline-flex select-none items-center justify-center font-medium tracking-[-0.01em] transition-[background-color,box-shadow,color,transform] duration-300 ease-out-expo active:scale-[0.97] ${sizes[size]} ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}
