"use client";

import { useState } from "react";
import { approveApplication, rejectApplication, updateOverrideDiscount } from "@/app/actions/wholesale";
import { toast } from "sonner";
import { Check, X, Store, Percent, Clock } from "lucide-react";

export function WholesaleView({
  shopId,
  globalDiscount,
  applications,
}: {
  shopId: string;
  globalDiscount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applications: any[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleApprove = async (id: string, currentOverride: number | null) => {
    setLoadingId(id);
    const res = await approveApplication(id, currentOverride);
    if (res.error) toast.error(res.error);
    else toast.success("Application approved!");
    setLoadingId(null);
  };

  const handleReject = async (id: string) => {
    setLoadingId(id);
    const res = await rejectApplication(id);
    if (res.error) toast.error(res.error);
    else toast.success("Application rejected.");
    setLoadingId(null);
  };

  const handleUpdateDiscount = async (id: string, newDiscount: number) => {
    setLoadingId(id);
    const res = await updateOverrideDiscount(id, newDiscount);
    if (res.error) toast.error(res.error);
    else toast.success("Discount updated!");
    setLoadingId(null);
  };

  const pending = applications.filter((a) => a.status === "pending");
  const approved = applications.filter((a) => a.status === "approved");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-[#27324A] tracking-tight">Wholesale B2B</h1>
        <p className="text-[#746E73] text-sm mt-1">
          Manage retailer applications and custom pricing. Your global wholesale discount is <strong className="text-[#27324A]">{globalDiscount}%</strong>.
        </p>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-bold text-[#27324A] flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#A7653A]" />
            Pending Applications ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="bg-white border border-[#2E3344]/8 rounded-[2rem] p-8 text-center">
              <p className="text-[#746E73]">No pending applications at the moment.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pending.map((app) => (
                <div key={app.id} className="bg-white border border-[#2E3344]/8 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-[#F7F0E6] flex items-center justify-center shrink-0">
                      <Store className="h-6 w-6 text-[#A7653A]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#27324A] text-lg">{app.retailer.name}</h3>
                      <p className="text-sm text-[#746E73]">{app.retailer.address}</p>
                      <p className="text-xs text-[#746E73] mt-1">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[#2E3344]/8">
                    <button
                      disabled={loadingId === app.id}
                      onClick={() => handleReject(app.id)}
                      className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl border border-[#2E3344]/10 text-[#746E73] font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                      disabled={loadingId === app.id}
                      onClick={() => handleApprove(app.id, null)}
                      className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl bg-[#27324A] text-white font-semibold hover:bg-[#1f293b] transition-colors shadow-md disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold text-[#27324A] flex items-center gap-2 mb-4 mt-10">
            <Check className="w-5 h-5 text-green-600" />
            Approved Retailers ({approved.length})
          </h2>
          {approved.length === 0 ? (
            <div className="bg-white border border-[#2E3344]/8 rounded-[2rem] p-8 text-center">
              <p className="text-[#746E73]">You have no approved retailers yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#2E3344]/8 rounded-[2rem] overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F8F8F7] text-[#746E73] uppercase text-[10px] font-bold tracking-wider border-b border-[#2E3344]/8">
                  <tr>
                    <th className="px-6 py-4">Retailer</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Custom Discount %</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3344]/8">
                  {approved.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-[#27324A]">{app.retailer.name}</td>
                      <td className="px-6 py-4 text-[#746E73]">{app.retailer.address}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 max-w-[120px]">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              defaultValue={app.override_discount_percent ?? globalDiscount}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== app.override_discount_percent) {
                                  handleUpdateDiscount(app.id, val);
                                }
                              }}
                              className="w-full pl-3 pr-8 py-2 bg-white border border-[#2E3344]/20 rounded-xl text-[#27324A] focus:outline-none focus:ring-2 focus:ring-[#A7653A]/20"
                            />
                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#746E73]" />
                          </div>
                        </div>
                        {app.override_discount_percent !== null && (
                          <span className="text-[10px] text-[#A7653A] font-medium mt-1 block">Custom applied</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          disabled={loadingId === app.id}
                          onClick={() => handleReject(app.id)}
                          className="text-red-500 hover:text-red-700 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Revoke Access
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
