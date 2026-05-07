import { LucideIcon } from "lucide-react";

interface EyebrowProps {
  children: React.ReactNode;
  icon?: LucideIcon;
}

export function Eyebrow({ children, icon: Icon }: EyebrowProps) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-[#F3E1CB] px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </p>
  );
}
