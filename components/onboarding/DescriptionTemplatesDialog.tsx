"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import templatesData from "./templates.json";

interface DescriptionTemplatesDialogProps {
  onSelect: (description: string) => void;
  category: string;
}

export function DescriptionTemplatesDialog({
  onSelect,
  category,
}: DescriptionTemplatesDialogProps) {
  const [open, setOpen] = useState(false);
  
  // Find templates for the current category, fallback to 'others' if not found
  const templates = 
    templatesData[category as keyof typeof templatesData] || 
    templatesData["others"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs font-bold text-[#3B82F6] hover:underline flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" />
          Choose Template
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0 rounded-3xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-[#1E293B]/10 bg-[#F8FAFC]">
          <DialogTitle className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#3B82F6]" />
            Description Templates
          </DialogTitle>
          <p className="text-sm text-[#746E73] mt-1">
            Select a pre-written description for your shop. You can edit it later.
          </p>
        </DialogHeader>
        
        <div className="overflow-y-auto p-6 flex-1 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelect(template);
                  setOpen(false);
                }}
                className="text-left p-4 rounded-xl border border-[#1E293B]/10 hover:border-[#3B82F6] hover:bg-[#F8FAFC] transition-all group flex flex-col gap-2"
              >
                <p className="text-sm text-[#0F172A] leading-relaxed flex-1">
                  "{template}"
                </p>
                <div className="text-[10px] font-bold text-[#3B82F6] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
                  <Check className="h-3 w-3" /> Use this template
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
