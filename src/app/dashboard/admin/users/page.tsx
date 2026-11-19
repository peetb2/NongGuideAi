"use client";

import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import AdminUserSidePanel from "@/components/dashboard/AdminUserSidePanel";
import { SkeletonDemo } from "@/components/ui/skeleton";
import { AdminUserListItem } from "@/lib/admin";
import { fetchCurrentUser, UserSessionData } from "@/lib/client-auth";
import { normalizePlanId, PlanId, PLANS } from "@/lib/plans";
import Link from "next/link";
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Bot,
  Key,
  Plus,
  Search,
  RefreshCw,
  MoreVertical,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserCheck,
  UserX,
  ExternalLink,
  Crown,
} from "lucide-react";

export default function AdminUsersPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Users data from API
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "ADMIN" | "USER">("all");
  const [planFilter, setPlanFilter] = useState<"all" | PlanId>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Side Panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelMode, setSidePanelMode] = useState<"view" | "create">("view");
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  // Quick credit modal or inline state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Initial auth check
  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        setIsAdmin(Boolean(user.isAdmin));
      } else {
        setIsAdmin(false);
      }
    });
  }, []);

  // 2. Fetch users list
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถโหลดรายชื่อผู้ใช้ได้");
      }
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin === true) {
      loadUsers();
    }
  }, [isAdmin]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchId = u.id.toLowerCase().includes(q);
        if (!matchEmail && !matchId) return false;
      }
      // Role
      if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }
      // Plan
      if (planFilter !== "all" && normalizePlanId(u.plan) !== planFilter) {
        return false;
      }
      // Status
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "suspended" && u.isActive) return false;

      return true;
    });
  }, [users, searchQuery, roleFilter, planFilter, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => u.role === "ADMIN").length;
    const activeCount = users.filter((u) => u.isActive).length;
    const totalCredits = users.reduce((acc, u) => acc + (u.creditBalance || 0), 0);
    const totalBots = users.reduce((acc, u) => acc + (u.botCount || 0), 0);
    return { total, adminCount, activeCount, totalCredits, totalBots };
  }, [users]);

  // Handlers for side panel
  const handleOpenUserPanel = (user: AdminUserListItem) => {
    setSelectedUser(user);
    setSidePanelMode("view");
    setSidePanelOpen(true);
  };

  const handleOpenCreatePanel = () => {
    setSelectedUser(null);
    setSidePanelMode("create");
    setSidePanelOpen(true);
  };

  const handleUserUpdated = () => {
    loadUsers();
    // Refresh selectedUser with latest data if panel is still open
    if (selectedUser) {
      setTimeout(async () => {
        try {
          const res = await fetch("/api/admin/users");
          const data = await res.json();
          if (data.users) {
            const updated = data.users.find((u: AdminUserListItem) => u.id === selectedUser.id);
            if (updated) setSelectedUser(updated);
          }
        } catch {}
      }, 300);
    }
  };

  // Quick plan switch (Standard <-> Pro Max)
  const handleQuickPlanSwitch = async (userId: string, nextPlan: PlanId, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: nextPlan }),
      });
      if (res.ok) {
        showToast(`เปลี่ยนแพ็กเกจเป็น ${PLANS[nextPlan].thaiName} สำเร็จ`);
        loadUsers();
      }
    } catch {
      showToast("ล้มเหลวในการเปลี่ยนแพ็กเกจ");
    }
  };

  // Quick adjust credit (+50 / -10)
  const handleQuickCredit = async (userId: string, amount: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditAdjustment: amount }),
      });
      if (res.ok) {
        showToast(amount > 0 ? `+${amount} เครดิตสำเร็จ` : `${amount} เครดิตสำเร็จ`);
        loadUsers();
      }
    } catch {
      showToast("ล้มเหลวในการปรับเครดิต");
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-screen bg-[#F6F8F6]">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header
          title="จัดการผู้ใช้งาน (User Management)"
          subtitle="ศูนย์ควบคุมผู้ดูแลระบบ: จัดการบัญชี ปรับปรุงเครดิต และกำหนดสิทธิ์การใช้งาน"
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          actionButton={
            <button
              onClick={handleOpenCreatePanel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brandGreen text-white text-xs font-semibold hover:bg-[#344638] transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มผู้ใช้ใหม่</span>
            </button>
          }
        />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Access Denied Warning if not Admin */}
          {isAdmin === false && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center max-w-lg mx-auto my-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-rose-900">
                คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (Admin Only)
              </h3>
              <p className="text-xs text-rose-700 leading-relaxed">
                หน้านี้สงวนไว้สำหรับผู้ดูแลระบบ (Admin) เท่านั้น บัญชีของคุณ ({currentUser?.email})
                ไม่มีสิทธิ์การใช้งานในส่วนนี้
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition"
                >
                  กลับไปที่แดชบอร์ด
                </Link>
              </div>
            </div>
          )}

          {/* Admin Content Area */}
          {isAdmin && (
            <>
              {/* Stat Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Users */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-borderLight shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-textMuted">ผู้ใช้ทั้งหมด</div>
                    <div className="text-2xl font-bold text-textMain mt-1">{stats.total}</div>
                    <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                      {stats.activeCount} บัญชีเปิดใช้งาน
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                {/* Admins */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-borderLight shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-textMuted">ผู้ดูแลระบบ (Admins)</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                      {stats.adminCount}
                    </div>
                    <div className="text-[11px] text-textMuted mt-0.5">สิทธิ์ผู้จัดการระบบ</div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-brandGreen flex items-center justify-center border border-emerald-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>

                {/* Total System Credits */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-borderLight shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-textMuted">เครดิตรวมทั้งหมด</div>
                    <div className="text-2xl font-bold text-amber-700 mt-1">
                      {stats.totalCredits.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-textMuted mt-0.5">เครดิตในระบบ</div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <Coins className="w-5 h-5" />
                  </div>
                </div>

                {/* Total Bots */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-borderLight shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-textMuted">บอทที่ถูกสร้างทั้งหมด</div>
                    <div className="text-2xl font-bold text-textMain mt-1">{stats.totalBots}</div>
                    <div className="text-[11px] text-textMuted mt-0.5">จากผู้ใช้ทั้งหมด</div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Bot className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Filters & Actions Bar */}
              <div className="bg-white p-4 rounded-2xl border border-borderLight shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาด้วยอีเมล หรือ User ID..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-borderLight bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ล้าง
                    </button>
                  )}
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Role filter */}
                  <div className="flex rounded-xl bg-slate-100 p-1 text-xs">
                    <button
                      onClick={() => setRoleFilter("all")}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        roleFilter === "all"
                          ? "bg-white text-textMain shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      ทั้งหมด ({users.length})
                    </button>
                    <button
                      onClick={() => setRoleFilter("ADMIN")}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        roleFilter === "ADMIN"
                          ? "bg-white text-emerald-800 shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Admin ({stats.adminCount})
                    </button>
                    <button
                      onClick={() => setRoleFilter("USER")}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        roleFilter === "USER"
                          ? "bg-white text-textMain shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      User ({stats.total - stats.adminCount})
                    </button>
                  </div>

                  {/* Plan filter */}
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-borderLight bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brandGreen/30"
                  >
                    <option value="all">แพ็กเกจ: ทั้งหมด</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PRO_MAX">Pro Max</option>
                  </select>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-borderLight bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brandGreen/30"
                  >
                    <option value="all">สถานะ: ทั้งหมด</option>
                    <option value="active">เปิดใช้งาน (Active)</option>
                    <option value="suspended">ระงับ (Suspended)</option>
                  </select>

                  {/* Refresh Button */}
                  <button
                    onClick={loadUsers}
                    disabled={loading}
                    className="p-2 rounded-xl border border-borderLight hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                    title="โหลดข้อมูลใหม่"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brandGreen" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Users Table / List */}
              <div className="bg-white rounded-2xl border border-borderLight shadow-sm overflow-hidden">
                {loading && users.length === 0 ? (
                  <div className="p-6 space-y-5 divide-y divide-borderLight/50">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={i > 0 ? "pt-5" : ""}>
                        <SkeletonDemo />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="py-12 px-6 text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                    <p className="text-xs text-rose-700 font-semibold">{error}</p>
                    <button
                      onClick={loadUsers}
                      className="px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs"
                    >
                      ลองใหม่อีกครั้ง
                    </button>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข</p>
                    <p className="text-xs text-textMuted">ลองปรับเปลี่ยนคำค้นหาหรือตัวกรองด้านบน</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-textMuted font-semibold border-b border-borderLight uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3.5 px-4 sm:px-6">ผู้ใช้งาน (User)</th>
                          <th className="py-3.5 px-4">แพ็กเกจ (Plan)</th>
                          <th className="py-3.5 px-4">สิทธิ์ (Role)</th>
                          <th className="py-3.5 px-4">สถานะ</th>
                          <th className="py-3.5 px-4">เครดิต (Credits)</th>
                          <th className="py-3.5 px-4 text-center">บอท / คีย์</th>
                          <th className="py-3.5 px-4 hidden md:table-cell">วันที่สมัคร</th>
                          <th className="py-3.5 px-4 text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borderLight/60">
                        {filteredUsers.map((u) => {
                          const isCurrentUser = u.email.toLowerCase() === currentUser?.email?.toLowerCase();
                          return (
                            <tr
                              key={u.id}
                              onClick={() => handleOpenUserPanel(u)}
                              className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            >
                              {/* User Info */}
                              <td className="py-3.5 px-4 sm:px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                    {u.email.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-textMain text-xs truncate max-w-[180px] sm:max-w-xs">
                                        {u.email}
                                      </span>
                                      {isCurrentUser && (
                                        <span className="px-1.5 py-0.5 text-[9px] bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">
                                          คุณ
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-textMuted font-mono truncate max-w-[140px]">
                                      {u.id}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Plan */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5">
                                  {normalizePlanId(u.plan) === "PRO_MAX" ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#334539] text-amber-200 border border-[#46624D]">
                                      <Crown className="w-3 h-3 text-amber-300" />
                                      Pro Max
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sage-100 text-sage-800 border border-sage-200">
                                      Standard
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleQuickPlanSwitch(
                                        u.id,
                                        normalizePlanId(u.plan) === "PRO_MAX" ? "STANDARD" : "PRO_MAX",
                                        e
                                      )
                                    }
                                    title={
                                      normalizePlanId(u.plan) === "PRO_MAX"
                                        ? "สลับเป็น Standard"
                                        : "อัปเกรดเป็น Pro Max"
                                    }
                                    className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold border border-slate-200"
                                  >
                                    {normalizePlanId(u.plan) === "PRO_MAX" ? "→ Std" : "→ Pro Max"}
                                  </button>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="py-3.5 px-4">
                                {u.role === "ADMIN" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    ADMIN
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                    USER
                                  </span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                    u.isActive
                                      ? "text-emerald-700 bg-emerald-50"
                                      : "text-rose-700 bg-rose-50"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      u.isActive ? "bg-emerald-500" : "bg-rose-500"
                                    }`}
                                  />
                                  {u.isActive ? "Active" : "Suspended"}
                                </span>
                              </td>

                              {/* Credit Balance with quick +/- buttons */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-xs">
                                    {u.creditBalance.toLocaleString()}
                                  </span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => handleQuickCredit(u.id, 50, e)}
                                      title="+50 เครดิตทันที"
                                      className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200"
                                    >
                                      +50
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleQuickCredit(u.id, -10, e)}
                                      title="-10 เครดิต"
                                      className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200"
                                    >
                                      -10
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Bots / Keys count */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex items-center gap-2 text-textMuted font-medium text-[11px]">
                                  <span title={`${u.botCount} แชทบอท`} className="flex items-center gap-0.5">
                                    <Bot className="w-3.5 h-3.5 text-brandGreen" />
                                    {u.botCount}
                                  </span>
                                  <span>/</span>
                                  <span title={`${u.apiKeyCount} คีย์ API`} className="flex items-center gap-0.5">
                                    <Key className="w-3.5 h-3.5 text-indigo-500" />
                                    {u.apiKeyCount}
                                  </span>
                                </div>
                              </td>

                              {/* Registered Date */}
                              <td className="py-3.5 px-4 hidden md:table-cell text-textMuted text-[11px]">
                                {new Date(u.createdAt).toLocaleDateString("th-TH", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>

                              {/* Action: Open Side Panel */}
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenUserPanel(u);
                                  }}
                                  className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-brandGreen hover:text-white text-slate-700 font-semibold text-xs transition cursor-pointer shadow-xs"
                                >
                                  จัดการ
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ADMIN USER SIDE PANEL DRAWER */}
      <AdminUserSidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        user={selectedUser}
        mode={sidePanelMode}
        onUserUpdated={handleUserUpdated}
        currentAdminEmail={currentUser?.email}
      />
    </div>
  );
}
