"use client";

import React, { useState, useEffect } from "react";
import { AdminUserListItem } from "@/lib/admin";
import { PLANS, PlanId, normalizePlanId, getPlanConfig } from "@/lib/plans";
import {
  X,
  User,
  Shield,
  Coins,
  Key,
  Bot,
  Lock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Plus,
  Minus,
  Sparkles,
  Loader2,
  UserCheck,
  UserX,
  Calendar,
  ExternalLink,
  Crown,
} from "lucide-react";

interface AdminUserSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUserListItem | null;
  mode: "view" | "create";
  onUserUpdated: () => void;
  currentAdminEmail?: string;
}

export default function AdminUserSidePanel({
  isOpen,
  onClose,
  user,
  mode,
  onUserUpdated,
  currentAdminEmail,
}: AdminUserSidePanelProps) {
  // Tabs for view mode: "overview" | "credits" | "security" | "bots"
  const [activeTab, setActiveTab] = useState<"overview" | "credits" | "security" | "bots">("overview");

  // Credit adjustment state
  const [creditAdjustment, setCreditAdjustment] = useState<number>(0);
  const [exactCredit, setExactCredit] = useState<string>("");
  const [creditMode, setCreditMode] = useState<"adjust" | "exact">("adjust");
  const [isUpdatingCredit, setIsUpdatingCredit] = useState(false);

  // Role, plan & status state
  const [selectedRole, setSelectedRole] = useState<"USER" | "ADMIN">("USER");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("STANDARD");
  const [grantPlanCredits, setGrantPlanCredits] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<boolean>(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Create user form state
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPlan, setCreatePlan] = useState<PlanId>("STANDARD");
  const [createCredits, setCreateCredits] = useState<number>(100);
  const [createRole, setCreateRole] = useState<"USER" | "ADMIN">("USER");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Status feedback
  const [copiedId, setCopiedId] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state when selected user changes
  useEffect(() => {
    if (user && mode === "view") {
      setSelectedRole(user.role === "ADMIN" ? "ADMIN" : "USER");
      setSelectedPlan(normalizePlanId(user.plan));
      setGrantPlanCredits(false);
      setSelectedStatus(user.isActive !== false);
      setExactCredit(String(user.creditBalance));
      setCreditAdjustment(0);
      setNewPassword("");
      setConfirmPassword("");
      setShowDeleteConfirm(false);
      setActiveTab("overview");
    } else if (mode === "create") {
      setCreateEmail("");
      setCreatePassword("");
      setCreatePlan("STANDARD");
      setCreateCredits(PLANS.STANDARD.credits);
      setCreateRole("USER");
    }
    setToast(null);
  }, [user, mode, isOpen]);

  if (!isOpen) return null;

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleCopyId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // 1. Submit Credit Changes
  const handleSaveCredits = async () => {
    if (!user) return;
    setIsUpdatingCredit(true);
    try {
      const payload: any = {};
      if (creditMode === "adjust") {
        if (creditAdjustment === 0) {
          showToast("error", "กรุณาระบุจำนวนเครดิตที่ต้องการเพิ่มหรือลด");
          setIsUpdatingCredit(false);
          return;
        }
        payload.creditAdjustment = creditAdjustment;
      } else {
        const val = parseInt(exactCredit, 10);
        if (isNaN(val) || val < 0) {
          showToast("error", "กรุณาระบุจำนวนเครดิตที่ถูกต้อง (ไม่ต่ำกว่า 0)");
          setIsUpdatingCredit(false);
          return;
        }
        payload.creditBalance = val;
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการปรับปรุงเครดิต");

      showToast("success", "ปรับปรุงยอดเครดิตสำเร็จเรียบร้อย");
      setCreditAdjustment(0);
      onUserUpdated();
    } catch (err: any) {
      showToast("error", err.message || "ล้มเหลวในการบันทึกเครดิต");
    } finally {
      setIsUpdatingCredit(false);
    }
  };

  // 2. Submit Role / Plan / Status Changes
  const handleSaveRoleAndStatus = async () => {
    if (!user) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          plan: selectedPlan,
          grantPlanCredits,
          isActive: selectedStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการแก้ไขสิทธิ์และแพ็กเกจ");

      showToast(
        "success",
        grantPlanCredits
          ? `อัปเดตเป็น ${getPlanConfig(selectedPlan).thaiName} และเติมเครดิตสำเร็จ`
          : "อัปเดตแพ็กเกจ สิทธิ์ และสถานะบัญชีสำเร็จ"
      );
      setGrantPlanCredits(false);
      onUserUpdated();
    } catch (err: any) {
      showToast("error", err.message || "ล้มเหลวในการบันทึกข้อมูล");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 3. Reset Password
  const handleResetPassword = async () => {
    if (!user) return;
    if (newPassword.length < 6) {
      showToast("error", "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("error", "รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน");

      showToast("success", "รีเซ็ตรหัสผ่านของผู้ใช้เรียบร้อยแล้ว");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showToast("error", err.message || "ล้มเหลวในการรีเซ็ตรหัสผ่าน");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 4. Delete User
  const handleDeleteUser = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการลบบัญชี");

      showToast("success", "ลบบัญชีผู้ใช้สำเร็จ");
      setTimeout(() => {
        onUserUpdated();
        onClose();
      }, 700);
    } catch (err: any) {
      showToast("error", err.message || "ล้มเหลวในการลบบัญชี");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 5. Create New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createPassword) {
      showToast("error", "กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    if (createPassword.length < 6) {
      showToast("error", "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          plan: createPlan,
          creditBalance: createCredits,
          role: createRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการสร้างผู้ใช้");

      showToast("success", "สร้างผู้ใช้ใหม่เรียบร้อยแล้ว");
      setTimeout(() => {
        onUserUpdated();
        onClose();
      }, 800);
    } catch (err: any) {
      showToast("error", err.message || "ล้มเหลวในการสร้างผู้ใช้");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const isSelf = user?.email.toLowerCase() === currentAdminEmail?.toLowerCase();

  return (
    <>
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Side Panel container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex z-50 pl-10">
        <aside className="w-screen max-w-xl bg-white text-textMain shadow-2xl flex flex-col border-l border-borderLight animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-6 py-5 bg-[#27382B] text-white flex items-center justify-between border-b border-[#1F2C22] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 font-bold shadow-inner">
                {mode === "create" ? (
                  <Plus className="w-5 h-5 text-emerald-300" />
                ) : (
                  <User className="w-5 h-5 text-emerald-300" />
                )}
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  {mode === "create" ? "เพิ่มผู้ใช้ใหม่เข้าสู่ระบบ" : "แผงควบคุมจัดการผู้ใช้งาน"}
                  {mode === "view" && user?.role === "ADMIN" && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/30">
                      ADMIN
                    </span>
                  )}
                </h2>
                <p className="text-xs text-emerald-200/80 truncate max-w-xs">
                  {mode === "create" ? "กำหนดอีเมล รหัสผ่าน และเครดิตเริ่มต้น" : user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-emerald-200/70 hover:text-white hover:bg-white/10 transition"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toast Alert */}
          {toast && (
            <div
              className={`mx-6 mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 ${
                toast.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium flex-1">{toast.text}</span>
              <button
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {mode === "create" ? (
              /* CREATE USER FORM */
              <form onSubmit={handleCreateUser} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    อีเมล (Email) *
                  </label>
                  <input
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-borderLight bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัวอักษร) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-borderLight bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    แพ็กเกจเริ่มต้น (Plan)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["STANDARD", "PRO_MAX"] as PlanId[]).map((pid) => {
                      const p = PLANS[pid];
                      const active = createPlan === pid;
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => {
                            setCreatePlan(pid);
                            setCreateCredits(p.credits);
                          }}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            active
                              ? pid === "PRO_MAX"
                                ? "border-[#334539] bg-[#334539]/10 ring-1 ring-[#334539]"
                                : "border-brandGreen bg-emerald-50/50 ring-1 ring-brandGreen"
                              : "border-borderLight hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                            {pid === "PRO_MAX" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                            <span>{p.name}</span>
                          </div>
                          <div className="text-[11px] text-textMuted mt-0.5">
                            {p.credits.toLocaleString()} เครดิต &bull; {p.maxBots} บอท
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      เครดิตเริ่มต้น
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={createCredits}
                        onChange={(e) => setCreateCredits(parseInt(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 pl-9 text-sm rounded-xl border border-borderLight bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen transition"
                      />
                      <Coins className="w-4 h-4 text-amber-500 absolute left-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      ระดับสิทธิ์ (Role)
                    </label>
                    <select
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-borderLight bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen transition"
                    >
                      <option value="USER">User (ผู้ใช้ทั่วไป)</option>
                      <option value="ADMIN">Admin (ผู้ดูแลระบบ)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-borderLight">
                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="w-full py-3 px-4 rounded-xl bg-brandGreen text-white font-semibold text-sm hover:bg-[#344638] active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingUser ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังสร้างผู้ใช้...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>สร้างบัญชีผู้ใช้</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : user ? (
              /* VIEW & MANAGE USER */
              <>
                {/* User Identity Card */}
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-borderLight/80">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-borderLight flex items-center justify-center font-bold text-slate-800 text-lg shadow-sm">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-textMain">{user.email}</span>
                          {user.role === "ADMIN" ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                              ADMIN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded-md">
                              USER
                            </span>
                          )}
                          {normalizePlanId(user.plan) === "PRO_MAX" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-[#334539] text-amber-200 rounded-md">
                              <Crown className="w-2.5 h-2.5" />
                              Pro Max
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-sage-100 text-sage-800 rounded-md">
                              Standard
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-textMuted mt-1">
                          <span className="font-mono text-[10px] bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-600">
                            {user.id.slice(0, 16)}...
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyId}
                            title="คัดลอก User ID"
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                          >
                            {copiedId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                          }`}
                        />
                        {user.isActive ? "เปิดใช้งาน" : "ระงับการใช้งาน"}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-borderLight/60 text-center">
                    <div className="bg-white/80 p-2 rounded-xl border border-borderLight/60">
                      <div className="text-[10px] text-textMuted flex items-center justify-center gap-1">
                        <Coins className="w-3 h-3 text-amber-500" /> เครดิต
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {user.creditBalance}
                      </div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-borderLight/60">
                      <div className="text-[10px] text-textMuted flex items-center justify-center gap-1">
                        <Bot className="w-3 h-3 text-brandGreen" /> บอท
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">{user.botCount}</div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-borderLight/60">
                      <div className="text-[10px] text-textMuted flex items-center justify-center gap-1">
                        <Key className="w-3 h-3 text-indigo-500" /> คีย์ API
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {user.apiKeyCount}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub Navigation Tabs */}
                <div className="flex border-b border-borderLight gap-2 text-xs font-medium">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                      activeTab === "overview"
                        ? "border-brandGreen text-brandGreen font-bold"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>สิทธิ์ & สถานะ</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("credits")}
                    className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                      activeTab === "credits"
                        ? "border-brandGreen text-brandGreen font-bold"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>จัดการเครดิต</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("bots")}
                    className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                      activeTab === "bots"
                        ? "border-brandGreen text-brandGreen font-bold"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>บอท ({user.botCount})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("security")}
                    className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                      activeTab === "security"
                        ? "border-brandGreen text-brandGreen font-bold"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>รีเซ็ตรหัส</span>
                  </button>
                </div>

                {/* TAB 1: OVERVIEW & ROLE */}
                {activeTab === "overview" && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="space-y-4">
                      {/* Plan Management */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          แพ็กเกจผู้ใช้งาน (Subscription Plan)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {(["STANDARD", "PRO_MAX"] as PlanId[]).map((pid) => {
                            const p = PLANS[pid];
                            const isSelected = selectedPlan === pid;
                            return (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => setSelectedPlan(pid)}
                                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                                  isSelected
                                    ? pid === "PRO_MAX"
                                      ? "border-[#334539] bg-[#334539]/10 text-slate-900 ring-1 ring-[#334539]"
                                      : "border-brandGreen bg-emerald-50/50 text-slate-900 ring-1 ring-brandGreen"
                                    : "border-borderLight hover:bg-slate-50 text-slate-600"
                                }`}
                              >
                                {pid === "PRO_MAX" ? (
                                  <Crown className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                                ) : (
                                  <Sparkles className="w-4 h-4 mt-0.5 text-brandGreen shrink-0" />
                                )}
                                <div>
                                  <div className="text-xs font-bold flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    <span className="text-[10px] font-medium text-textMuted">
                                      ({p.priceLabel})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-textMuted mt-0.5">
                                    {p.credits.toLocaleString()} เครดิต &bull; สูงสุด {p.maxBots} บอท
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-borderLight/80 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={grantPlanCredits}
                            onChange={(e) => setGrantPlanCredits(e.target.checked)}
                            className="rounded border-slate-300 text-brandGreen focus:ring-brandGreen"
                          />
                          <span>
                            เติมเครดิตตามแพ็กเกจทันที (+{PLANS[selectedPlan].credits.toLocaleString()} เครดิต)
                          </span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          ระดับสิทธิ์การเข้าถึง (Role)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedRole("USER")}
                            className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                              selectedRole === "USER"
                                ? "border-brandGreen bg-emerald-50/50 text-slate-900 ring-1 ring-brandGreen"
                                : "border-borderLight hover:bg-slate-50 text-slate-600"
                            }`}
                          >
                            <User className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                            <div>
                              <div className="text-xs font-bold">User (ผู้ใช้ทั่วไป)</div>
                              <div className="text-[11px] text-textMuted mt-0.5">
                                ใช้งานบอทและจัดการข้อมูลของตนเอง
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedRole("ADMIN")}
                            className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                              selectedRole === "ADMIN"
                                ? "border-brandGreen bg-emerald-50/50 text-slate-900 ring-1 ring-brandGreen"
                                : "border-borderLight hover:bg-slate-50 text-slate-600"
                            }`}
                          >
                            <Shield className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                            <div>
                              <div className="text-xs font-bold text-emerald-900">
                                Admin (ผู้ดูแลระบบ)
                              </div>
                              <div className="text-[11px] text-textMuted mt-0.5">
                                เข้าถึงระบบจัดการผู้ใช้และส่วนกลาง
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          สถานะบัญชีการใช้งาน (Account Status)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedStatus(true)}
                            className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                              selectedStatus
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500"
                                : "border-borderLight hover:bg-slate-50 text-slate-600"
                            }`}
                          >
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-semibold">เปิดใช้งานปกติ (Active)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedStatus(false)}
                            disabled={isSelf}
                            className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                              !selectedStatus
                                ? "border-rose-500 bg-rose-50 text-rose-900 ring-1 ring-rose-500"
                                : "border-borderLight hover:bg-slate-50 text-slate-600"
                            } ${isSelf ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <UserX className="w-4 h-4 text-rose-600" />
                            <span className="text-xs font-semibold">ระงับบัญชี (Suspended)</span>
                          </button>
                        </div>
                        {isSelf && (
                          <p className="text-[11px] text-amber-600 mt-1">
                            * คุณไม่สามารถระงับบัญชีของตนเองได้
                          </p>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleSaveRoleAndStatus}
                          disabled={isUpdatingStatus}
                          className="w-full py-2.5 px-4 rounded-xl bg-brandGreen text-white font-medium text-xs hover:bg-[#344638] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdatingStatus ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>กำลังบันทึก...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>บันทึกการเปลี่ยนแปลงแพ็กเกจ สิทธิ์ & สถานะ</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* User Info Metadata */}
                      <div className="pt-4 border-t border-borderLight text-xs text-textMuted space-y-1.5">
                        <div className="flex justify-between">
                          <span>วันที่สมัครสมาชิก:</span>
                          <span className="text-slate-800 font-medium">
                            {new Date(user.createdAt).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>อัปเดตล่าสุด:</span>
                          <span className="text-slate-800 font-medium">
                            {new Date(user.updatedAt).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: CREDITS MANAGEMENT */}
                {activeTab === "credits" && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-amber-800 font-medium">ยอดเครดิตคงเหลือปัจจุบัน</div>
                        <div className="text-2xl font-bold text-amber-900 mt-0.5">
                          {user.creditBalance.toLocaleString()}{" "}
                          <span className="text-sm font-medium text-amber-700">เครดิต</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                        <Coins className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Mode Toggle: Adjustment vs Exact */}
                    <div className="flex rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setCreditMode("adjust")}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                          creditMode === "adjust"
                            ? "bg-white text-textMain shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        เพิ่ม / ลด เครดิต
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditMode("exact")}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                          creditMode === "exact"
                            ? "bg-white text-textMain shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        กำหนดยอดคงเหลือโดยตรง
                      </button>
                    </div>

                    {creditMode === "adjust" ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            ปุ่มด่วน (Quick Presets)
                          </label>
                          <div className="grid grid-cols-5 gap-2">
                            {[10, 50, 100, 500].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setCreditAdjustment((prev) => prev + amt)}
                                className="py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center justify-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" />
                                {amt}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setCreditAdjustment(0)}
                              className="py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition"
                            >
                              รีเซ็ต
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            {[-10, -50, -100, -500].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setCreditAdjustment((prev) => prev + amt)}
                                className="py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex items-center justify-center gap-0.5"
                              >
                                {amt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            ยอดที่จะปรับปรุง (บวกหรือลบ)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={creditAdjustment}
                              onChange={(e) => setCreditAdjustment(parseInt(e.target.value) || 0)}
                              placeholder="+50 หรือ -20"
                              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-borderLight bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen font-bold"
                            />
                          </div>
                          <div className="text-[11px] text-textMuted mt-1">
                            ยอดหลังจากปรับปรุง:{" "}
                            <span className="font-bold text-slate-800">
                              {Math.max(0, user.creditBalance + creditAdjustment)} เครดิต
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            กำหนดยอดเครดิตใหม่โดยตรง
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={exactCredit}
                            onChange={(e) => setExactCredit(e.target.value)}
                            placeholder="ระบุจำนวนเครดิต"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-borderLight bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen font-bold"
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleSaveCredits}
                        disabled={isUpdatingCredit}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isUpdatingCredit ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>กำลังบันทึกเครดิต...</span>
                          </>
                        ) : (
                          <>
                            <Coins className="w-3.5 h-3.5" />
                            <span>ยืนยันการปรับปรุงเครดิต</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: BOTS & API KEYS */}
                {activeTab === "bots" && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-brandGreen" />
                        <span>แชทบอทของผู้ใช้นี้ ({user.bots?.length || 0})</span>
                      </h4>
                      {user.bots && user.bots.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {user.bots.map((b) => (
                            <div
                              key={b.id}
                              className="p-3 rounded-xl border border-borderLight bg-slate-50/70 hover:bg-slate-50 transition flex items-center justify-between"
                            >
                              <div>
                                <div className="text-xs font-bold text-textMain flex items-center gap-2">
                                  <span>{b.name}</span>
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      b.isActive ? "bg-emerald-500" : "bg-slate-400"
                                    }`}
                                  />
                                </div>
                                <div className="text-[10px] text-textMuted font-mono mt-0.5">
                                  {b.model} • สร้างเมื่อ{" "}
                                  {new Date(b.createdAt).toLocaleDateString("th-TH")}
                                </div>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-borderLight text-slate-600">
                                {b.isActive ? "Active" : "Paused"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-textMuted border border-dashed border-borderLight rounded-xl">
                          ผู้ใช้นี้ยังไม่มีการสร้างแชทบอท
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-borderLight">
                      <h4 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-indigo-500" />
                        <span>คีย์ API ({user.apiKeys?.length || 0})</span>
                      </h4>
                      {user.apiKeys && user.apiKeys.length > 0 ? (
                        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                          {user.apiKeys.map((k) => (
                            <div
                              key={k.id}
                              className="p-2.5 rounded-xl border border-borderLight bg-slate-50/70 flex items-center justify-between"
                            >
                              <div className="font-mono text-xs font-semibold text-slate-800">
                                {k.keyPrefix}...
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-200">
                                {k.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-textMuted border border-dashed border-borderLight rounded-xl">
                          ไม่มีคีย์ API
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: SECURITY & PASSWORD RESET */}
                {activeTab === "security" && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-borderLight space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <Lock className="w-4 h-4 text-slate-600" />
                        <span>ตั้งรหัสผ่านใหม่ให้ผู้ใช้</span>
                      </div>
                      <p className="text-[11px] text-textMuted leading-relaxed">
                        ผู้ดูแลระบบสามารถกำหนดรหัสผ่านใหม่ให้ผู้ใช้ได้ทันทีในกรณีที่ผู้ใช้ลืมรหัสผ่าน
                      </p>

                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
                          </label>
                          <input
                            type="password"
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="ระบุรหัสผ่านใหม่"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-borderLight bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            ยืนยันรหัสผ่านใหม่อีกครั้ง
                          </label>
                          <input
                            type="password"
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-borderLight bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/30 focus:border-brandGreen"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleResetPassword}
                          disabled={isUpdatingPassword}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-800 text-white font-medium text-xs hover:bg-slate-900 transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdatingPassword ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>กำลังตั้งรหัสผ่านใหม่...</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>บันทึกรหัสผ่านใหม่</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* DANGER ZONE (BOTTOM OF PANEL) */}
                <div className="pt-6 border-t border-borderLight">
                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>ลบบัญชีผู้ใช้งานถาวร</span>
                        </h4>
                        <p className="text-[11px] text-rose-700/80 mt-0.5">
                          การลบบัญชีจะลบบอท เอกสารความรู้ และคีย์ API ทั้งหมดของผู้ใช้นี้
                        </p>
                      </div>

                      {!showDeleteConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isSelf}
                          className={`px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 font-semibold text-xs hover:bg-rose-100 hover:text-rose-900 transition shadow-sm ${
                            isSelf ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          ลบบัญชี
                        </button>
                      ) : null}
                    </div>

                    {showDeleteConfirm && (
                      <div className="mt-3 pt-3 border-t border-rose-200/80 animate-in fade-in">
                        <p className="text-xs font-bold text-rose-800">
                          แน่ใจหรือไม่ว่าต้องการลบบัญชี {user.email}? ข้อมูลจะไม่สามารถกู้คืนได้!
                        </p>
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={handleDeleteUser}
                            disabled={isDeleting}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>กำลังลบ...</span>
                              </>
                            ) : (
                              <span>ยืนยันการลบถาวร</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
