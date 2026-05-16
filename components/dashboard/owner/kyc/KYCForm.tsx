"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitKYCDocuments } from "@/app/actions/owner";
import { toast } from "sonner";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

interface KYCFormProps {
  shopId: string;
  shopName: string;
  verificationStatus: VerificationStatus;
  graceEndsAt: string;
  daysRemaining: number;
  isBlocked: boolean;
  kycSubmittedAt: string | null;
  kycRejectionReason: string | null;
  kycDocumentUrls: string[];
  kycConfidence: number | null;
}

const STATUS_CONFIG = {
  unverified: {
    icon: ShieldAlert,
    iconClass: "text-red-500",
    bgClass: "bg-red-50",
    badgeClass: "bg-red-100 text-red-700",
    label: "Not Verified",
    desc: "Your shop is live during the 30-day grace period. Upload business proof before the deadline.",
  },
  pending: {
    icon: Clock,
    iconClass: "text-amber-500",
    bgClass: "bg-amber-50",
    badgeClass: "bg-amber-100 text-amber-700",
    label: "Under Review",
    desc: "Your documents have been submitted and are currently being reviewed by our team.",
  },
  verified: {
    icon: ShieldCheck,
    iconClass: "text-green-500",
    bgClass: "bg-green-50",
    badgeClass: "bg-green-100 text-green-700",
    label: "Verified",
    desc: "Your shop is fully verified. All features are unlocked.",
  },
  rejected: {
    icon: ShieldAlert,
    iconClass: "text-red-600",
    bgClass: "bg-red-50",
    badgeClass: "bg-red-100 text-red-700",
    label: "Rejected",
    desc: "Your verification was rejected. Please review the reason below and re-submit.",
  },
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function KYCForm({
  shopId,
  verificationStatus,
  graceEndsAt,
  daysRemaining,
  isBlocked,
  kycSubmittedAt,
  kycRejectionReason,
  kycDocumentUrls,
  kycConfidence,
}: KYCFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();
  const cfg = STATUS_CONFIG[verificationStatus];
  const StatusIcon = cfg.icon;
  const canSubmit = verificationStatus === "unverified" || verificationStatus === "rejected";
  const dueDate = new Date(graceEndsAt).toLocaleDateString("en-NP", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) { toast.error(`${f.name}: unsupported file type.`); return false; }
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name}: must be under 5 MB.`); return false; }
      return true;
    });
    setFiles(prev => [...prev, ...valid].slice(0, 5));
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews(prev => [...prev, ev.target?.result as string].slice(0, 5));
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!files.length && !kycDocumentUrls.length) { toast.error("Upload at least one document."); return; }

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `kyc/${shopId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: up, error } = await supabase.storage.from("shop_assets").upload(path, file, { upsert: true });
      if (error || !up) { toast.error(`Upload failed: ${error?.message}`); setUploading(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("shop_assets").getPublicUrl(up.path);
      uploadedUrls.push(publicUrl);
    }

    setUploading(false);
    const allUrls = [...kycDocumentUrls, ...uploadedUrls];

    startTransition(async () => {
      const result = await submitKYCDocuments(shopId, allUrls);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Documents submitted! Our team will review within 24 hours.");
        setFiles([]);
        setPreviews([]);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`rounded-4xl border p-6 ${cfg.bgClass} border-current/10`}>
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 bg-white shadow-sm`}>
            <StatusIcon className={`h-6 w-6 ${cfg.iconClass}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-black text-lg text-[#27324A]">Verification Status</h2>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${cfg.badgeClass}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-[#746E73]">{cfg.desc}</p>
            {verificationStatus !== "verified" && verificationStatus !== "pending" && (
              <p className={`text-xs mt-2 font-bold ${isBlocked ? "text-red-700" : "text-[#A7653A]"}`}>
                {isBlocked
                  ? `Documents are now required. Grace period ended on ${dueDate}.`
                  : `Documents due by ${dueDate} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining).`}
              </p>
            )}
            {kycSubmittedAt && verificationStatus === "pending" && (
              <p className="text-xs text-[#746E73] mt-2 font-medium">
                Submitted {new Date(kycSubmittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            {kycConfidence !== null && verificationStatus === "verified" && (
              <div className="flex items-center gap-2 mt-2">
                <div className="h-2 flex-1 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${kycConfidence}%` }} />
                </div>
                <span className="text-xs font-bold text-green-700">{kycConfidence}% confidence</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Reason */}
      {verificationStatus === "rejected" && kycRejectionReason && (
        <div className="rounded-3xl bg-red-50 border border-red-200 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm text-red-800 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{kycRejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pending — live status polling notice */}
      {verificationStatus === "pending" && (
        <div className="rounded-3xl bg-[#F7F0E6]/60 border border-[#A7653A]/20 p-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#A7653A]/10 flex items-center justify-center shrink-0">
              <RefreshCw className="h-4 w-4 text-[#A7653A] animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <div>
              <p className="font-bold text-sm text-[#27324A]">Review in progress</p>
              <p className="text-xs text-[#746E73]">This page updates automatically. Typical review time: 24–48 hours.</p>
            </div>
          </div>
        </div>
      )}

      {/* Already submitted docs */}
      {kycDocumentUrls.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-[#27324A] uppercase tracking-wider">Submitted Documents</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {kycDocumentUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#2E3344]/10 bg-[#f8f8f7] hover:bg-[#F7F0E6] transition group"
              >
                {url.endsWith(".pdf") ? (
                  <FileText className="h-8 w-8 text-[#A7653A]" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Document ${idx + 1}`} className="h-16 w-full object-cover rounded-xl" />
                )}
                <span className="text-[10px] font-bold text-[#746E73] group-hover:text-[#A7653A]">Doc {idx + 1}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Upload form — only for unverified / rejected */}
      {canSubmit && (
        <div className="bg-white rounded-4xl border border-[#2E3344]/10 p-6 space-y-5">
          <div>
            <h3 className="font-black text-[#27324A] mb-1">
              {kycDocumentUrls.length > 0 ? "Add More Documents" : "Upload KYC Documents"}
            </h3>
            <p className="text-sm text-[#746E73]">
              Accepted: PAN card, citizenship, trade license, or business registration. Max 5 MB each.
            </p>
          </div>

          {/* Drop zone */}
          <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[#2E3344]/15 rounded-2xl cursor-pointer hover:border-[#A7653A]/50 hover:bg-[#F7F0E6]/30 transition group">
            <div className="h-12 w-12 rounded-2xl bg-[#F7F0E6] flex items-center justify-center group-hover:scale-110 transition">
              <Upload className="h-5 w-5 text-[#A7653A]" />
            </div>
            <div className="text-center">
              <p className="font-bold text-[#27324A] text-sm">Click to upload</p>
              <p className="text-xs text-[#746E73]">JPG, PNG, WEBP, PDF — up to 5 files, 5 MB each</p>
            </div>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>

          {/* Previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((file, idx) => (
                <div key={idx} className="relative rounded-2xl overflow-hidden border border-[#2E3344]/10 bg-[#f8f8f7]">
                  {file.type === "application/pdf" ? (
                    <div className="flex flex-col items-center justify-center h-20 gap-1">
                      <FileText className="h-8 w-8 text-[#A7653A]" />
                      <span className="text-[9px] text-[#746E73] px-2 truncate w-full text-center">{file.name}</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[idx]} alt={file.name} className="h-20 w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-white shadow flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={uploading || isPending || (files.length === 0 && kycDocumentUrls.length === 0)}
            className="w-full h-14 rounded-2xl bg-[#27324A] text-white font-black text-base disabled:opacity-40 hover:bg-[#1b2333] transition flex items-center justify-center gap-2"
          >
            {uploading || isPending ? (
              <><RefreshCw className="h-5 w-5 animate-spin" /> Submitting...</>
            ) : (
              <><CheckCircle2 className="h-5 w-5" /> Submit for Review</>
            )}
          </button>
        </div>
      )}

      {/* Verified — all good */}
      {verificationStatus === "verified" && (
        <div className="flex flex-col items-center py-8 gap-3 text-center">
          <div className="h-16 w-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <p className="font-black text-[#27324A] text-lg">You&apos;re all set!</p>
          <p className="text-sm text-[#746E73]">Your shop is verified and all features are unlocked.</p>
        </div>
      )}
    </div>
  );
}
