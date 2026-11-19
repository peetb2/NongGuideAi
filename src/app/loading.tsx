import React from "react";
import { Skeleton, SkeletonDemo } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="min-h-screen w-full topo-bg-warm flex flex-col items-center justify-center p-6">
      <div className="bg-white/90 backdrop-blur-md border border-[#E2E8E3] rounded-3xl p-8 shadow-sm max-w-md w-full space-y-6">
        <SkeletonDemo />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-10 w-full rounded-xl mt-4" />
        </div>
      </div>
    </div>
  );
}
