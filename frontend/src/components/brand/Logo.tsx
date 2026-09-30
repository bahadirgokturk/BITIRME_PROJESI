import { cn } from "cn";

// Uygulama simgesi: C + onay + turuncu F (F = Flow + Fixed). Cizim public/brand/logo-art.svg,
// zemin primary token'i (Figma: 02 Components > Logo/Simge). Boyut className ile verilir.
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("block size-10 shrink-0 overflow-hidden rounded-[0.55rem] bg-primary", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- sabit SVG, optimizasyon gerekmez */}
      <img src="/brand/logo-art.svg" alt="" width={40} height={40} className="block size-full" />
    </span>
  );
}

// Giris ekrani telefonda logo buyuk (50 px simge, 25 px yazi); menulerde 40 px (Figma: Logo/Yatay)
const WORDMARK_SIZES = {
  md: { mark: "size-10", gap: "gap-2.5", text: "text-xl" },
  lg: { mark: "size-[50px]", gap: "gap-3", text: "text-[25px]" },
} as const;

export function LogoWordmark({ size = "md" }: { size?: keyof typeof WORDMARK_SIZES }) {
  const classes = WORDMARK_SIZES[size];
  return (
    <span className={cn("flex items-center", classes.gap)}>
      <LogoMark className={classes.mark} />
      <span className={cn("font-semibold tracking-tight", classes.text)}>
        Campus<span className="text-primary">Flow</span>
      </span>
    </span>
  );
}
