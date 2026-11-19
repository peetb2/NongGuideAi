"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "font-sans rounded-xl border border-[#D5DFD8] bg-white text-[#1A231E] shadow-lg",
          title: "text-xs font-semibold",
          description: "text-xs text-[#68776E]",
        },
      }}
      {...props}
    />
  );
}
