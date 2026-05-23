"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Store, PlusCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setActiveShop } from "@/app/actions/owner";
import { startNewShopOnboarding } from "@/app/actions/onboarding";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SwitcherShop {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
}

interface OwnerShopSwitcherProps {
  shops: SwitcherShop[];
  activeShopId?: string | null;
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function OwnerShopSwitcher({ shops, activeShopId }: OwnerShopSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);

  const initial =
    shops.find((s) => s.id === activeShopId) ?? shops[0] ?? null;
  const [selectedShop, setSelectedShop] = React.useState<SwitcherShop | null>(initial);

  // Keep local state in sync when shops list changes (e.g. after creating a new shop)
  React.useEffect(() => {
    React.startTransition(() => {
      setSelectedShop(shops.find((s) => s.id === activeShopId) ?? shops[0] ?? null);
    });
  }, [shops, activeShopId]);

  const handleSelect = async (shop: SwitcherShop) => {
    if (shop.id === selectedShop?.id) {
      setOpen(false);
      return;
    }
    const previous = selectedShop;
    setSelectedShop(shop); // optimistic
    setOpen(false);
    setSwitching(true);
    try {
      const res = await setActiveShop(shop.id);
      if ("error" in res && res.error) {
        setSelectedShop(previous); // revert
        toast.error(res.error);
        return;
      }
      router.refresh();
      toast.success(`Switched to ${shop.name}`);
    } catch {
      setSelectedShop(previous);
      toast.error("Could not switch shop");
    } finally {
      setSwitching(false);
    }
  };

  // Empty state: no shops yet
  if (!selectedShop) {
    return (
      <Link
        href="/onboarding/owner"
        className="flex items-center gap-3 w-full h-14 rounded-2xl border border-dashed border-[#A7653A]/40 bg-white px-3 hover:bg-[#F7F0E6]/50 transition-all"
      >
        <div className="h-8 w-8 rounded-lg bg-[#A7653A]/10 text-[#A7653A] flex items-center justify-center shrink-0">
          <PlusCircle className="h-4 w-4" />
        </div>
        <div className="flex flex-col items-start truncate">
          <span className="text-sm font-bold text-[#A7653A]">Set up your shop</span>
          <span className="text-[10px] text-[#746E73] font-medium uppercase tracking-widest">
            Get started
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between md:justify-center lg:justify-between h-14 rounded-2xl border-[#2E3344]/10 bg-white hover:bg-[#F7F0E6]/50 hover:text-[#27324A] transition-all"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-[#27324A] text-white flex items-center justify-center shrink-0">
              <Store className="h-4 w-4 text-[#D8C99A]" />
            </div>
            <div className="flex flex-col items-start truncate md:hidden lg:flex">
              <span className="text-sm font-bold truncate text-[#27324A]">
                {selectedShop.name}
              </span>
              <span className="text-[10px] text-[#746E73] font-medium uppercase tracking-widest">
                {formatRole(selectedShop.role)}
              </span>
            </div>
          </div>
          {switching ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-[#A7653A]" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 md:hidden lg:block" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0 rounded-2xl border-[#2E3344]/10 shadow-xl">
        <Command>
          <CommandInput placeholder="Search shop..." className="h-11" />
          <CommandList>
            <CommandEmpty>No shop found.</CommandEmpty>
            <CommandGroup heading="Your Shops">
              {shops.map((shop) => (
                <CommandItem
                  key={shop.id}
                  value={shop.name}
                  onSelect={() => {
                    void handleSelect(shop);
                  }}
                  className="rounded-xl my-1 cursor-pointer font-medium text-sm"
                >
                  <Store className="mr-2 h-4 w-4 text-[#A7653A]" />
                  <span className="truncate">{shop.name}</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4 text-[#27324A]",
                      selectedShop.id === shop.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  // Server action sets a short-lived HMAC-signed cookie and
                  // then redirects.  Bare URL navigation to /onboarding/owner
                  // is blocked for owners who already have a shop, so the
                  // cookie is the only legitimate entry point.
                  React.startTransition(() => {
                    void startNewShopOnboarding();
                  });
                }}
                className="rounded-xl my-1 cursor-pointer text-[#A7653A] font-bold"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Shop
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
