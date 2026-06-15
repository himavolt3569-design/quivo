import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
  description: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2E3344]/10 bg-gradient-to-b from-[#fdfcfb] to-white p-8 text-center sm:p-10">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F7F0E6]/80 text-[#A7653A] shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      {title && (
        <h3 className="mb-1.5 text-sm font-bold text-[#27324A]">{title}</h3>
      )}
      <p className="text-xs font-medium text-[#746E73] max-w-[200px] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
