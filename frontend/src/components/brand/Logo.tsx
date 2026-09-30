import { cn } from "cn";

// Uygulama simgesi: C + onay + turuncu F (F = Flow + Fixed). Cizim public/brand/logo-art.svg,
// zemin primary token'i (Figma: 02 Components > Logo/Simge)
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("block size-10 shrink-0 overflow-hidden rounded-[0.55rem] bg-primary", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 40 px sabit SVG, optimizasyon gerekmez */}
      <img src="/brand/logo-art.svg" alt="" width={40} height={40} className="block size-full" />
    </span>
  );
}

// Yatay logo: simge + "CampusFlow" (Figma: Logo/Yatay)
export function LogoWordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-xl font-semibold tracking-tight">
        Campus<span className="text-primary">Flow</span>
      </span>
    </span>
  );
}
