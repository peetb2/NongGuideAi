import React from "react";
import { Skeleton, SkeletonDemo } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="w-full min-h-screen topo-bg-warm flex-1 lg:ml-64 p-5 sm:p-8 space-y-6">
      {/* Header Skeleton */}
      <div className="bg-white/80 rounded-2xl border border-[#E2E8E3] p-5 flex items-center justify-between">
        <SkeletonDemo />
        <Skeleton className="h-9 w-28 rounded-xl hidden sm:block" />
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#E2E8E3] p-6 space-y-5 shadow-2xs"
          >
            <SkeletonDemo />
            <div className="space-y-2.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
            <div className="pt-3 border-t border-[#E2E8E3] flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-xl" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
