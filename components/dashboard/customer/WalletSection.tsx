"use client";

import { Coins, Wallet, ArrowUpRight, Gift } from "lucide-react";
import type { Transaction } from "@/lib/types";

interface WalletSectionProps {
  walletBalance: number;
  quivoCoins: number;
  recentTransactions: Transaction[];
}

const TYPE_LABEL: Record<string, string> = {
  cashback: "Cashback",
  coins_award: "Coins earned",
  bonus: "Welcome bonus",
  spend: "Redeemed",
  refund: "Refund",
};

const TYPE_COLOR: Record<string, string> = {
  cashback: "text-green-600",
  coins_award: "text-[#A7653A]",
  bonus: "text-purple-600",
  spend: "text-red-500",
  refund: "text-blue-500",
};

export function WalletSection({
  walletBalance,
  quivoCoins,
  recentTransactions,
}: WalletSectionProps) {
  return (
    <div className="rounded-[1.5rem] overflow-hidden border border-[#2E3344]/8 shadow-sm bg-white">
      {/* Balance header */}
      <div className="bg-gradient-to-br from-[#27324A] to-[#3D4D6B] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
              Quivo Wallet
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              Rs.{" "}
              {walletBalance.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
            <Wallet className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Coins row */}
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 w-fit">
          <Coins className="h-4 w-4 text-[#D8C99A]" />
          <span className="text-sm font-bold text-white">
            {quivoCoins.toLocaleString()} Quivo Coins
          </span>
        </div>
      </div>

      {/* Earn tips */}
      <div className="border-b border-[#2E3344]/8 bg-[#F7F0E6]/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[#A7653A] flex-shrink-0" />
          <p className="text-xs text-[#746E73] leading-relaxed">
            <span className="font-semibold text-[#27324A]">
              Earn 2% cashback
            </span>{" "}
            on every order ·{" "}
            <span className="font-semibold text-[#27324A]">50 bonus coins</span>{" "}
            on your first scan
          </p>
        </div>
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 ? (
        <div>
          <div className="px-5 pt-3.5 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#746E73]">
              Recent
            </p>
          </div>
          <div className="divide-y divide-[#2E3344]/6">
            {recentTransactions.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl ${
                    tx.type === "spend" ? "bg-red-50" : "bg-green-50"
                  }`}
                >
                  <ArrowUpRight
                    className={`h-4 w-4 ${
                      tx.type === "spend"
                        ? "text-red-500 rotate-180"
                        : "text-green-600"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#27324A]">
                    {tx.description ?? TYPE_LABEL[tx.type]}
                  </p>
                  <p className="text-[10px] text-[#746E73]">
                    {new Date(tx.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {tx.amount > 0 && (
                    <p
                      className={`text-xs font-bold ${TYPE_COLOR[tx.type] ?? "text-green-600"}`}
                    >
                      +Rs. {tx.amount.toFixed(2)}
                    </p>
                  )}
                  {tx.coins > 0 && (
                    <p className="text-[10px] font-semibold text-[#A7653A]">
                      +{tx.coins} coins
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 text-center">
          <p className="text-xs text-[#746E73]">
            Place your first order to earn cashback and coins!
          </p>
        </div>
      )}
    </div>
  );
}
