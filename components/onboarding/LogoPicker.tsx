"use client";

import { useRef, useState } from "react";
import { UploadCloud, Check } from "lucide-react";

const INITIAL_COLORS = [
  "#A7653A", "#27324A", "#2E7D32", "#1565C0", "#6A1B9A",
  "#AD1457", "#00695C", "#E65100", "#4527A0", "#37474F",
  "#BF360C", "#0277BD", "#558B2F", "#6D4C41", "#263238",
  "#880E4F", "#004D40", "#1A237E", "#827717", "#4E342E",
  "#B71C1C", "#01579B", "#33691E", "#311B92", "#212121",
  "#F57F17",
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface LogoPickerProps {
  onFile: (file: File, previewUrl: string) => void;
  previewUrl?: string;
}

function makeInitialFile(letter: string, color: string): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(100, 100, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "bold 88px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 100, 104);
    canvas.toBlob((blob) => {
      resolve(new File([blob!], `logo-${letter}.png`, { type: "image/png" }));
    }, "image/png");
  });
}

export function LogoPicker({ onFile, previewUrl }: LogoPickerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickInitial(letter: string, color: string) {
    setSelected(letter);
    const file = await makeInitialFile(letter, color);
    const url = URL.createObjectURL(file);
    onFile(file, url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelected(null);
    const url = URL.createObjectURL(file);
    onFile(file, url);
  }

  return (
    <div className="space-y-3">
      {previewUrl && (
        <div className="flex items-center gap-3">
          <img src={previewUrl} alt="Logo preview" className="h-14 w-14 rounded-xl object-cover border border-[#2E3344]/10" />
          <span className="text-sm text-[#746E73]">Preview</span>
        </div>
      )}

      <div className="border border-[#2E3344]/10 rounded-2xl p-3 sm:p-4 bg-[#fafafa]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mb-3">Pick an initial</p>
        <div className="flex flex-wrap gap-1.5">
          {LETTERS.map((l, i) => {
            const color = INITIAL_COLORS[i % INITIAL_COLORS.length];
            const isSelected = selected === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => pickInitial(l, color)}
                className="relative h-9 w-9 rounded-lg flex items-center justify-center text-white text-xs font-black transition-transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#A7653A]"
                style={{ backgroundColor: color }}
                aria-label={`Use letter ${l} as logo`}
              >
                {l}
                {isSelected && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white flex items-center justify-center shadow">
                    <Check className="h-2.5 w-2.5 text-[#27324A]" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <div className="border-2 border-dashed border-[#2E3344]/10 rounded-xl p-4 flex flex-col items-center gap-1.5 hover:bg-[#F7F0E6]/30 transition cursor-pointer text-center"
          onClick={() => fileRef.current?.click()}>
          <UploadCloud className="h-5 w-5 text-[#A7653A]" />
          <span className="text-sm font-bold text-[#27324A]">Or upload your own logo</span>
          <span className="text-xs text-[#746E73]">PNG, JPG up to 2 MB</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
