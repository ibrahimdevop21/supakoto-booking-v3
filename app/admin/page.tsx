"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type TabKey = "agents" | "branches" | "freezes" | "technicians" | "duplicate-log";

type AgentMe = {
  id: string;
  name: string;
  role: string;
};

type BranchRow = {
  id: string;
  name: string;
  daily_cap: number;
  is_active: boolean;
};

type AgentRow = {
  id: string;
  user_id: string | null;
  name: string;
  username: string | null;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  branches?: { name?: string } | null;
};

type FreezeRow = {
  id: string;
  branch_id: string | null;
  freeze_start: string;
  freeze_end: string;
  reason: string | null;
  branches?: { name?: string } | null;
};

type TechnicianRow = {
  id: string;
  name: string;
  level: string;
  branch_id: string | null;
  is_active: boolean;
  branches?: { name?: string } | null;
};

type DuplicateLogRow = {
  id: string;
  created_at: string;
  customer_phone: string;
  appointment_date: string | null;
  attempted_by: string | null;
  existing_agent: string | null;
  existing_booking_id?: string | null;
  branch_id?: string | null;
};

const LEVEL_OPTIONS = ["فني أول", "فني ثاني", "مساعد فني"];

type LayoutMode = "mobile" | "desktop";

function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>("desktop");
  useEffect(() => {
    const read = () =>
      typeof window !== "undefined" && window.innerWidth < 768
        ? "mobile"
        : "desktop";
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return mode;
}

function formatArDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatArDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function branchName(branches: BranchRow[], id: string | null | undefined) {
  if (!id) return "—";
  return branches.find((b) => b.id === id)?.name ?? "—";
}

function roleBadge(role: string): { label: string; style: CSSProperties } {
  const r = role.toLowerCase();
  if (r === "admin" || r === "أدمن") {
    return {
      label: "أدمن",
      style: {
        background: "var(--error-bg)",
        border: "1px solid var(--error-border)",
        color: "var(--brand-red)",
      },
    };
  }
  if (r === "ops") {
    return {
      label: "عمليات",
      style: {
        background: "var(--warn-bg)",
        border: "1px solid var(--warn-border)",
        color: "var(--warn)",
      },
    };
  }
  return {
    label: "مندوب",
    style: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid var(--border-default)",
      color: "var(--text-secondary)",
    },
  };
}

function levelStyle(level: string): CSSProperties {
  if (level === "فني أول") {
    return {
      background: "var(--warn-bg)",
      border: "1px solid var(--warn-border)",
      color: "var(--warn)",
    };
  }
  if (level === "فني ثاني") {
    return {
      background: "rgba(96,165,250,0.10)",
      border: "1px solid rgba(96,165,250,0.2)",
      color: "#60a5fa",
    };
  }
  return {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--border-default)",
    color: "var(--text-muted)",
  };
}

export default function AdminPage() {
  const router = useRouter();
  const layoutMode = useLayoutMode();
  const isMobile = layoutMode === "mobile";
  const [agent, setAgent] = useState<AgentMe | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("agents");

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [freezes, setFreezes] = useState<FreezeRow[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [duplicateLog, setDuplicateLog] = useState<DuplicateLogRow[]>([]);

  const [loadingByTab, setLoadingByTab] = useState<Record<TabKey, boolean>>({
    agents: false,
    branches: false,
    freezes: false,
    technicians: false,
    "duplicate-log": false,
  });

  const [showAddAgent, setShowAddAgent] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentRow | null>(null);
  const [passwordAgent, setPasswordAgent] = useState<AgentRow | null>(null);
  const [showAddFreeze, setShowAddFreeze] = useState(false);
  const [showAddTechnician, setShowAddTechnician] = useState(false);
  const [showPastFreezes, setShowPastFreezes] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [techDraft, setTechDraft] = useState<{
    name: string;
    level: string;
    branch_id: string | null;
  }>({ name: "", level: "فني أول", branch_id: null });

  const [branchCapDraft, setBranchCapDraft] = useState<Record<string, number>>({});
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);

  const setTabLoading = (tab: TabKey, val: boolean) =>
    setLoadingByTab((prev) => ({ ...prev, [tab]: val }));

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      window.setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const loadAgents = useCallback(async () => {
    setTabLoading("agents", true);
    const r = await fetch("/api/admin/agents");
    const data = await r.json().catch(() => []);
    setAgents(Array.isArray(data) ? data : []);
    setTabLoading("agents", false);
  }, []);

  const loadBranches = useCallback(async () => {
    setTabLoading("branches", true);
    const r = await fetch("/api/admin/branches");
    const data = await r.json().catch(() => []);
    const rows = Array.isArray(data) ? (data as BranchRow[]) : [];
    setBranches(rows);
    setBranchCapDraft(
      rows.reduce<Record<string, number>>((acc, b) => {
        acc[b.id] = Number(b.daily_cap ?? 0);
        return acc;
      }, {})
    );
    setTabLoading("branches", false);
  }, []);

  const loadFreezes = useCallback(async () => {
    setTabLoading("freezes", true);
    const r = await fetch("/api/admin/freezes");
    const data = await r.json().catch(() => []);
    setFreezes(Array.isArray(data) ? data : []);
    setTabLoading("freezes", false);
  }, []);

  const loadTechnicians = useCallback(async () => {
    setTabLoading("technicians", true);
    const r = await fetch("/api/admin/technicians");
    const data = await r.json().catch(() => []);
    setTechnicians(Array.isArray(data) ? data : []);
    setTabLoading("technicians", false);
  }, []);

  const loadDuplicateLog = useCallback(async () => {
    setTabLoading("duplicate-log", true);
    try {
      const r = await fetch("/api/admin/duplicate-log");
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "تعذر تحميل سجل التكرار",
          "error"
        );
        setDuplicateLog([]);
        return;
      }
      setDuplicateLog(Array.isArray(data) ? data : []);
    } catch {
      showToast("تعذر تحميل سجل التكرار", "error");
      setDuplicateLog([]);
    } finally {
      setTabLoading("duplicate-log", false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/auth/me");
      if (cancelled) return;
      if (r.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.id) {
        router.replace("/login");
        return;
      }
      const role = String(data.role ?? "").toLowerCase();
      if (role !== "admin" && role !== "أدمن") {
        router.replace("/booking");
        return;
      }
      setAgent(data as AgentMe);
      setAgentLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!agent) return;
    void loadBranches();
    void loadAgents();
  }, [agent, loadBranches, loadAgents]);

  useEffect(() => {
    if (!agent) return;
    if (activeTab === "agents") void loadAgents();
    else if (activeTab === "branches") void loadBranches();
    else if (activeTab === "freezes") void loadFreezes();
    else if (activeTab === "technicians") void loadTechnicians();
  }, [agent, activeTab, loadAgents, loadBranches, loadFreezes, loadTechnicians]);

  useEffect(() => {
    if (!agent || activeTab !== "duplicate-log") return;
    void loadDuplicateLog();
  }, [agent, activeTab, loadDuplicateLog]);

  const activeOrUpcomingFreezes = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return freezes.filter((f) => f.freeze_end >= today);
  }, [freezes]);

  const pastFreezes = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return freezes.filter((f) => f.freeze_end < today);
  }, [freezes]);

  const groupedTechnicians = useMemo(() => {
    const grouped = new Map<string, TechnicianRow[]>();
    for (const t of technicians) {
      const key = t.branch_id ?? "float";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }
    return grouped;
  }, [technicians]);

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) map.set(a.id, a.name);
    return map;
  }, [agents]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (agentLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-deep)",
          color: "var(--text-muted)",
        }}
      >
        جاري التحميل...
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--surface-deep)",
        direction: "rtl",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <header
        style={{
          height: isMobile ? 48 : 56,
          flexShrink: 0,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr auto 1fr" : "auto 1fr auto",
          alignItems: "center",
          gap: isMobile ? 8 : 16,
          padding: isMobile ? "0 12px" : "0 24px",
          background: "rgba(13,18,32,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-subtle)",
          zIndex: 50,
        }}
      >
        {isMobile ? (
          <>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                ...logoutBtn,
                justifySelf: "start",
                padding: 0,
              }}
            >
              خروج
            </button>
            <div style={{ display: "flex", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" style={{ width: 80 }} />
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                justifySelf: "end",
                color: "var(--text-primary)",
              }}
            >
              {agent.name}
            </span>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt="SupaKoto"
                style={{ width: 100, height: "auto", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",
                minWidth: 0,
              }}
            >
              <Link href="/booking" style={headerGhostPill}>
                الحجوزات
              </Link>
              <Link href="/ops" style={headerGhostPill}>
                لوحة العمليات
              </Link>
              <span style={headerGhostPillActive}>الإدارة</span>
            </div>
            <div
              dir="ltr"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <button type="button" onClick={handleLogout} style={logoutBtn}>
                خروج
              </button>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {agent.name}
              </span>
            </div>
          </>
        )}
      </header>

      <div
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          gap: 20,
          padding: isMobile ? "0 12px" : "0 24px",
          background: "var(--surface)",
          flexShrink: 0,
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {(
          [
            ["agents", "المندوبين"],
            ["branches", "الفروع"],
            ["freezes", "التجميد"],
            ["technicians", "الفنيين"],
            ["duplicate-log", "سجل التكرار"],
          ] as const
        ).map(([key, label]) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                height: 46,
                border: "none",
                borderBottom: active ? "2px solid var(--brand-red)" : "2px solid transparent",
                background: "transparent",
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 12 : 24 }}>
        {activeTab === "agents" && (
          <AgentsTab
            isMobile={isMobile}
            agents={agents}
            branches={branches}
            loading={loadingByTab.agents}
            onOpenAdd={() => setShowAddAgent(true)}
            onEdit={(a) => setEditAgent(a)}
            onPassword={(a) => setPasswordAgent(a)}
            onToggleActive={async (a) => {
              const nextIsActive = !a.is_active;
              const runToggle = async () => {
                const r = await fetch(`/api/admin/agents/${a.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ is_active: nextIsActive }),
                });
                const data = await r.json().catch(() => ({}));
                if (!r.ok) {
                  showToast(
                    typeof data.error === "string" ? data.error : "فشل تحديث الحالة",
                    "error"
                  );
                  return;
                }
                const updated = data as AgentRow;
                setAgents((prev) =>
                  prev.map((row) => (row.id === a.id ? { ...row, ...updated } : row))
                );
                showToast(
                  nextIsActive ? "تم تفعيل المندوب بنجاح" : "تم إيقاف المندوب بنجاح",
                  "success"
                );
              };
              if (!nextIsActive) {
                setConfirmAction({
                  message: `هل تريد إيقاف ${a.name}؟ سيتم منعه من الدخول.`,
                  onConfirm: () => {
                    void runToggle();
                  },
                });
                return;
              }
              await runToggle();
            }}
          />
        )}

        {activeTab === "branches" && (
          <BranchesTab
            isMobile={isMobile}
            branches={branches}
            loading={loadingByTab.branches}
            branchCapDraft={branchCapDraft}
            savingBranchId={savingBranchId}
            setBranchCapDraft={setBranchCapDraft}
            onSaveCap={async (id, cap) => {
              setSavingBranchId(id);
              const r = await fetch("/api/admin/branches", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, daily_cap: cap }),
              });
              const data = await r.json().catch(() => ({}));
              if (!r.ok) {
                showToast(
                  typeof data.error === "string" ? data.error : "فشل تحديث الطاقة اليومية",
                  "error"
                );
                setSavingBranchId(null);
                return;
              }
              await loadBranches();
              showToast("تم تحديث الطاقة اليومية بنجاح", "success");
              setSavingBranchId(null);
            }}
            onToggleBranch={async (b) => {
              setSavingBranchId(b.id);
              const r = await fetch("/api/admin/branches", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: b.id, is_active: !b.is_active }),
              });
              const data = await r.json().catch(() => ({}));
              if (!r.ok) {
                showToast(
                  typeof data.error === "string" ? data.error : "فشل تحديث حالة الفرع",
                  "error"
                );
                setSavingBranchId(null);
                return;
              }
              await loadBranches();
              showToast(
                !b.is_active ? "تم تفعيل الفرع بنجاح" : "تم إيقاف الفرع بنجاح",
                "success"
              );
              setSavingBranchId(null);
            }}
          />
        )}

        {activeTab === "freezes" && (
          <FreezesTab
            isMobile={isMobile}
            loading={loadingByTab.freezes}
            activeOrUpcoming={activeOrUpcomingFreezes}
            past={pastFreezes}
            showPast={showPastFreezes}
            onTogglePast={() => setShowPastFreezes((v) => !v)}
            onOpenAdd={() => setShowAddFreeze(true)}
            onDelete={async (id) => {
              const r = await fetch("/api/admin/freezes", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
              });
              const data = await r.json().catch(() => ({}));
              if (!r.ok) {
                showToast(
                  typeof data.error === "string" ? data.error : "فشل حذف التجميد",
                  "error"
                );
                return;
              }
              await loadFreezes();
              showToast("تم حذف التجميد بنجاح", "success");
            }}
          />
        )}

        {activeTab === "technicians" && (
          <TechniciansTab
            isMobile={isMobile}
            groupedTechnicians={groupedTechnicians}
            branches={branches}
            loading={loadingByTab.technicians}
            onOpenAdd={() => setShowAddTechnician(true)}
            editingTechId={editingTechId}
            techDraft={techDraft}
            setTechDraft={setTechDraft}
            onStartEdit={(t) => {
              setEditingTechId(t.id);
              setTechDraft({
                name: t.name,
                level: t.level,
                branch_id: t.branch_id,
              });
            }}
            onCancelEdit={() => setEditingTechId(null)}
            onSaveEdit={async (id) => {
              const r = await fetch(`/api/admin/technicians/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(techDraft),
              });
              const data = await r.json().catch(() => ({}));
              if (!r.ok) {
                showToast(
                  typeof data.error === "string" ? data.error : "فشل تعديل بيانات الفني",
                  "error"
                );
                return;
              }
              setEditingTechId(null);
              await loadTechnicians();
              showToast("تم تعديل بيانات الفني بنجاح", "success");
            }}
            onDelete={async (id) => {
              const r = await fetch(`/api/admin/technicians/${id}`, {
                method: "DELETE",
              });
              const data = await r.json().catch(() => ({}));
              if (!r.ok) {
                showToast(
                  typeof data.error === "string" ? data.error : "فشل إيقاف الفني",
                  "error"
                );
                return;
              }
              await loadTechnicians();
              showToast("تم إيقاف الفني بنجاح", "success");
            }}
          />
        )}

        {activeTab === "duplicate-log" && (
          <DuplicateLogTab
            isMobile={isMobile}
            rows={duplicateLog}
            agentNameById={agentNameById}
            loading={loadingByTab["duplicate-log"]}
          />
        )}
      </div>

      {showAddAgent && (
        <AddAgentModal
          branches={branches}
          showToast={showToast}
          onClose={() => setShowAddAgent(false)}
          onSaved={async () => {
            setShowAddAgent(false);
            await loadAgents();
            showToast("تم إضافة المندوب بنجاح", "success");
          }}
        />
      )}

      {editAgent && (
        <EditAgentModal
          agent={editAgent}
          branches={branches}
          showToast={showToast}
          onClose={() => setEditAgent(null)}
          onSaved={async (updated) => {
            setEditAgent(null);
            setAgents((prev) =>
              prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
            );
            showToast("تم تعديل بيانات المندوب بنجاح", "success");
          }}
        />
      )}

      {passwordAgent && (
        <ResetPasswordModal
          agent={passwordAgent}
          showToast={showToast}
          onClose={() => setPasswordAgent(null)}
          onSaved={async () => {
            setPasswordAgent(null);
            showToast("تم تغيير كلمة المرور بنجاح", "success");
          }}
        />
      )}

      {showAddFreeze && (
        <AddFreezeModal
          branches={branches}
          showToast={showToast}
          onClose={() => setShowAddFreeze(false)}
          onSaved={async () => {
            setShowAddFreeze(false);
            await loadFreezes();
            showToast("تم إضافة نافذة التجميد بنجاح", "success");
          }}
        />
      )}

      {showAddTechnician && (
        <AddTechnicianModal
          branches={branches}
          showToast={showToast}
          onClose={() => setShowAddTechnician(false)}
          onSaved={async () => {
            setShowAddTechnician(false);
            await loadTechnicians();
            showToast("تم إضافة الفني بنجاح", "success");
          }}
        />
      )}

      {confirmAction && (
        <div
          onClick={() => setConfirmAction(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(8,12,20,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl)",
              padding: 20,
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "var(--text-primary)",
                margin: 0,
                marginBottom: 14,
              }}
            >
              {confirmAction.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                style={ghostBtn}
                onClick={() => setConfirmAction(null)}
              >
                إلغاء
              </button>
              <button
                type="button"
                style={primaryBtn}
                onClick={() => {
                  confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            padding: "12px 24px",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            fontWeight: 600,
            backdropFilter: "blur(8px)",
            animation: "fadeUp 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            ...(toast.type === "success"
              ? {
                  background: "var(--success-bg)",
                  border: "1px solid var(--success-border)",
                  color: "var(--success)",
                }
              : {
                  background: "var(--error-bg)",
                  border: "1px solid var(--error-border)",
                  color: "#fca5a5",
                }),
          }}
        >
          <span>{toast.type === "success" ? "✓" : "✗"}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function AgentsTab({
  isMobile,
  agents,
  branches,
  loading,
  onOpenAdd,
  onEdit,
  onPassword,
  onToggleActive,
}: {
  isMobile: boolean;
  agents: AgentRow[];
  branches: BranchRow[];
  loading: boolean;
  onOpenAdd: () => void;
  onEdit: (a: AgentRow) => void;
  onPassword: (a: AgentRow) => void;
  onToggleActive: (a: AgentRow) => Promise<void>;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 8,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <h2 style={sectionTitle}>المندوبين ({agents.length})</h2>
        <button type="button" style={primaryBtn} onClick={onOpenAdd}>
          إضافة مندوب +
        </button>
      </div>
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>جاري التحميل...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={trBorder}>
                <th style={thStyle}>الاسم</th>
                <th style={thStyle}>الدور</th>
                <th style={thStyle}>الفرع</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const rb = roleBadge(a.role);
                return (
                  <tr key={a.id} style={trBorder}>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: a.is_active
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        }}
                      >
                        {a.name}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ ...badgeBase, ...rb.style }}>{rb.label}</span>
                    </td>
                    <td style={tdStyle}>
                      {a.branches?.name ?? branchName(branches, a.branch_id)}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          ...badgeBase,
                          ...(a.is_active
                            ? {
                                background: "var(--success-bg)",
                                border: "1px solid var(--success-border)",
                                color: "var(--success)",
                              }
                            : {
                                background: "var(--error-bg)",
                                border: "1px solid var(--error-border)",
                                color: "var(--brand-red)",
                              }),
                        }}
                      >
                        {a.is_active ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" style={ghostBtnSmall} onClick={() => onEdit(a)}>
                          تعديل
                        </button>
                        <button
                          type="button"
                          style={ghostBtnSmall}
                          onClick={() => void onToggleActive(a)}
                        >
                          {a.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          type="button"
                          style={ghostBtnSmall}
                          onClick={() => onPassword(a)}
                        >
                          كلمة مرور
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BranchesTab({
  isMobile,
  branches,
  loading,
  branchCapDraft,
  savingBranchId,
  setBranchCapDraft,
  onSaveCap,
  onToggleBranch,
}: {
  isMobile: boolean;
  branches: BranchRow[];
  loading: boolean;
  branchCapDraft: Record<string, number>;
  savingBranchId: string | null;
  setBranchCapDraft: Dispatch<SetStateAction<Record<string, number>>>;
  onSaveCap: (id: string, cap: number) => Promise<void>;
  onToggleBranch: (b: BranchRow) => Promise<void>;
}) {
  if (loading) return <p style={{ color: "var(--text-muted)" }}>جاري التحميل...</p>;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "1fr"
          : "repeat(2, minmax(260px, 1fr))",
        gap: 16,
      }}
    >
      {branches.map((b) => {
        const cap = branchCapDraft[b.id] ?? Number(b.daily_cap ?? 0);
        return (
          <div key={b.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{b.name}</div>
              <span
                style={{
                  ...badgeBase,
                  ...(b.is_active
                    ? { background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success)" }
                    : { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }),
                }}
              >
                {b.is_active ? "نشط" : "موقوف"}
              </span>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8 }}>
              الطاقة اليومية
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-red)", marginBottom: 12 }}>
              {cap}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <button
                type="button"
                style={ghostBtnSmall}
                onClick={() =>
                  setBranchCapDraft((prev) => ({ ...prev, [b.id]: Math.max(0, (prev[b.id] ?? b.daily_cap) - 1) }))
                }
              >
                -
              </button>
              <input
                className="sk-input"
                type="number"
                value={cap}
                onChange={(e) =>
                  setBranchCapDraft((prev) => ({
                    ...prev,
                    [b.id]: Number(e.target.value || 0),
                  }))
                }
                style={{ ...inpStyle, width: 90, height: 34, textAlign: "center" }}
              />
              <button
                type="button"
                style={ghostBtnSmall}
                onClick={() =>
                  setBranchCapDraft((prev) => ({ ...prev, [b.id]: (prev[b.id] ?? b.daily_cap) + 1 }))
                }
              >
                +
              </button>
              <button
                type="button"
                style={primaryBtnSmall}
                disabled={savingBranchId === b.id}
                onClick={() => void onSaveCap(b.id, cap)}
              >
                حفظ
              </button>
            </div>
            <button
              type="button"
              style={ghostBtn}
              disabled={savingBranchId === b.id}
              onClick={() => void onToggleBranch(b)}
            >
              {b.is_active ? "إيقاف الفرع" : "تفعيل الفرع"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FreezesTab({
  isMobile,
  loading,
  activeOrUpcoming,
  past,
  showPast,
  onTogglePast,
  onOpenAdd,
  onDelete,
}: {
  isMobile: boolean;
  loading: boolean;
  activeOrUpcoming: FreezeRow[];
  past: FreezeRow[];
  showPast: boolean;
  onTogglePast: () => void;
  onOpenAdd: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const today = new Date();
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 8,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <h2 style={sectionTitle}>التجميد ({activeOrUpcoming.length} نشط)</h2>
        <button type="button" style={primaryBtn} onClick={onOpenAdd}>
          إضافة تجميد +
        </button>
      </div>
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>جاري التحميل...</p>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
            {activeOrUpcoming.map((f) => {
              const end = new Date(f.freeze_end + "T12:00:00");
              const days = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
              return (
                <div key={f.id} style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>{f.branches?.name ?? "كل الفروع"}</strong>
                    <button
                      type="button"
                      style={{ ...ghostBtnSmall, color: "#fca5a5", borderColor: "var(--error-border)" }}
                      onClick={() => void onDelete(f.id)}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 6 }}>
                    من {formatArDate(f.freeze_start)} إلى {formatArDate(f.freeze_end)}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>
                    {f.reason || "—"}
                  </div>
                  <span style={{ ...badgeBase, background: "var(--warn-bg)", border: "1px solid var(--warn-border)", color: "var(--warn)" }}>
                    {days} يوم متبقي
                  </span>
                </div>
              );
            })}
            {activeOrUpcoming.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>لا توجد نوافذ تجميد حالية</p>
            )}
          </div>

          <button type="button" style={ghostBtn} onClick={onTogglePast}>
            التجميدات السابقة ({past.length}) {showPast ? "▲" : "▼"}
          </button>
          {showPast && (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {past.map((f) => (
                <div key={f.id} style={{ ...cardStyle, padding: 14, opacity: 0.75 }}>
                  <strong>{f.branches?.name ?? "كل الفروع"}</strong>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 6 }}>
                    من {formatArDate(f.freeze_start)} إلى {formatArDate(f.freeze_end)}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
                    {f.reason || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TechniciansTab({
  isMobile,
  groupedTechnicians,
  branches,
  loading,
  onOpenAdd,
  editingTechId,
  techDraft,
  setTechDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  isMobile: boolean;
  groupedTechnicians: Map<string, TechnicianRow[]>;
  branches: BranchRow[];
  loading: boolean;
  onOpenAdd: () => void;
  editingTechId: string | null;
  techDraft: { name: string; level: string; branch_id: string | null };
  setTechDraft: Dispatch<
    SetStateAction<{ name: string; level: string; branch_id: string | null }>
  >;
  onStartEdit: (t: TechnicianRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const total = Array.from(groupedTechnicians.values()).reduce((n, rows) => n + rows.length, 0);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 8,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <h2 style={sectionTitle}>الفنيين ({total})</h2>
        <button type="button" style={primaryBtn} onClick={onOpenAdd}>
          إضافة فني +
        </button>
      </div>
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>جاري التحميل...</p>
      ) : (
        Array.from(groupedTechnicians.entries()).map(([key, rows]) => (
          <div key={key} style={{ ...cardStyle, marginBottom: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              {key === "float" ? "متنقل (بدون فرع)" : branchName(branches, key)} ({rows.length})
            </div>
            {rows.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  borderTop: "1px solid var(--border-subtle)",
                  padding: "10px 0",
                }}
              >
                {editingTechId === t.id ? (
                  <>
                    <input
                      className="sk-input"
                      value={techDraft.name}
                      onChange={(e) =>
                        setTechDraft((prev) => ({ ...prev, name: e.target.value }))
                      }
                      style={{ ...inpStyle, flex: 1, minWidth: 140, height: 34 }}
                    />
                    <select
                      className="sk-input"
                      value={techDraft.level}
                      onChange={(e) =>
                        setTechDraft((prev) => ({ ...prev, level: e.target.value }))
                      }
                      style={{ ...inpStyle, width: 120, height: 34 }}
                    >
                      {LEVEL_OPTIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <select
                      className="sk-input"
                      value={techDraft.branch_id ?? ""}
                      onChange={(e) =>
                        setTechDraft((prev) => ({
                          ...prev,
                          branch_id: e.target.value || null,
                        }))
                      }
                      style={{ ...inpStyle, width: 160, height: 34 }}
                    >
                      <option value="">متنقل (بدون فرع)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" style={primaryBtnSmall} onClick={() => void onSaveEdit(t.id)}>
                      حفظ
                    </button>
                    <button type="button" style={ghostBtnSmall} onClick={onCancelEdit}>
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 160 }}>{t.name}</span>
                    <span style={{ ...badgeBase, ...levelStyle(t.level) }}>{t.level}</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {t.branches?.name ?? branchName(branches, t.branch_id)}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: t.is_active ? "var(--success)" : "var(--text-muted)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.is_active ? "var(--success)" : "var(--text-muted)" }} />
                      {t.is_active ? "نشط" : "موقوف"}
                    </span>
                    <div style={{ marginInlineStart: "auto", display: "flex", gap: 6 }}>
                      <button type="button" style={ghostBtnSmall} onClick={() => onStartEdit(t)}>
                        تعديل
                      </button>
                      <button type="button" style={ghostBtnSmall} onClick={() => void onDelete(t.id)}>
                        حذف
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function DuplicateLogTab({
  isMobile,
  rows,
  agentNameById,
  loading,
}: {
  isMobile: boolean;
  rows: DuplicateLogRow[];
  agentNameById: Map<string, string>;
  loading: boolean;
}) {
  return (
    <div>
      <h2 style={{ ...sectionTitle, marginBottom: 16, fontSize: isMobile ? 16 : 18 }}>
        سجل محاولات الحجز المكررة ({rows.length})
      </h2>
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>✅</div>
          <p style={{ color: "var(--text-muted)" }}>لا توجد محاولات مكررة</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={trBorder}>
                <th style={thStyle}>التاريخ والوقت</th>
                <th style={thStyle}>المندوب الذي حاول</th>
                <th style={thStyle}>رقم العميل</th>
                <th style={thStyle}>التاريخ المطلوب</th>
                <th style={thStyle}>المندوب الأصلي</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const same = (r.attempted_by ?? "") === (r.existing_agent ?? "");
                return (
                  <tr
                    key={r.id}
                    style={{
                      ...trBorder,
                      background: same ? "var(--warn-bg)" : "var(--error-bg)",
                    }}
                  >
                    <td style={tdStyle}>{formatArDateTime(r.created_at)}</td>
                    <td style={tdStyle}>
                      {r.attempted_by ? agentNameById.get(r.attempted_by) ?? "—" : "—"}
                    </td>
                    <td style={{ ...tdStyle, direction: "ltr", textAlign: "left" }}>
                      {r.customer_phone}
                    </td>
                    <td style={tdStyle}>{formatArDate(r.appointment_date)}</td>
                    <td style={tdStyle}>
                      {r.existing_agent ? agentNameById.get(r.existing_agent) ?? "—" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddAgentModal({
  branches,
  showToast,
  onClose,
  onSaved,
}: {
  branches: BranchRow[];
  showToast: (message: string, type?: "success" | "error") => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [branchId, setBranchId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password || !role) {
      showToast("أكمل كل الحقول المطلوبة", "error");
      return;
    }
    if (password.length < 6) {
      showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      return;
    }
    if (role === "ops" && !branchId) {
      showToast("الفرع مطلوب لدور العمليات", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          branchId: branchId || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(typeof data.error === "string" ? data.error : "فشل الإضافة", "error");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="إضافة مندوب جديد" onClose={onClose}>
      <Field label="الاسم">
        <input className="sk-input" style={inpStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="البريد الإلكتروني">
        <input
          className="sk-input"
          type="email"
          placeholder="name@supakoto.org"
          style={inpStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="كلمة المرور / PIN">
        <input
          className="sk-input"
          style={inpStyle}
          value={password}
          minLength={6}
          placeholder="٦ أحرف على الأقل"
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="الدور">
        <select className="sk-input" style={inpStyle} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="agent">مندوب</option>
          <option value="ops">عمليات</option>
          <option value="admin">أدمن</option>
        </select>
      </Field>
      <Field label="الفرع">
        <select className="sk-input" style={inpStyle} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">— بدون فرع —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" style={ghostBtn} onClick={onClose}>
          إلغاء
        </button>
        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void submit()}>
          {saving ? "..." : "إضافة"}
        </button>
      </div>
    </Modal>
  );
}

function EditAgentModal({
  agent,
  branches,
  showToast,
  onClose,
  onSaved,
}: {
  agent: AgentRow;
  branches: BranchRow[];
  showToast: (message: string, type?: "success" | "error") => void;
  onClose: () => void;
  onSaved: (agent: AgentRow) => Promise<void>;
}) {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [branchId, setBranchId] = useState(agent.branch_id ?? "");
  const [isActive, setIsActive] = useState(Boolean(agent.is_active));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      showToast("الاسم مطلوب", "error");
      return;
    }
    if (role === "ops" && !branchId) {
      showToast("الفرع مطلوب لدور العمليات", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          branch_id: branchId || null,
          is_active: isActive,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(typeof data.error === "string" ? data.error : "فشل التعديل", "error");
        return;
      }
      await onSaved(data as AgentRow);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="تعديل المندوب" onClose={onClose}>
      <Field label="الاسم">
        <input className="sk-input" style={inpStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="الدور">
        <select className="sk-input" style={inpStyle} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="agent">مندوب</option>
          <option value="ops">عمليات</option>
          <option value="admin">أدمن</option>
        </select>
      </Field>
      <Field label="الفرع">
        <select className="sk-input" style={inpStyle} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">— بدون فرع —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="الحالة">
        <select
          className="sk-input"
          style={inpStyle}
          value={isActive ? "active" : "inactive"}
          onChange={(e) => setIsActive(e.target.value === "active")}
        >
          <option value="active">نشط</option>
          <option value="inactive">موقوف</option>
        </select>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" style={ghostBtn} onClick={onClose}>
          إلغاء
        </button>
        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void submit()}>
          {saving ? "..." : "حفظ"}
        </button>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  agent,
  showToast,
  onClose,
  onSaved,
}: {
  agent: AgentRow;
  showToast: (message: string, type?: "success" | "error") => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(typeof data.error === "string" ? data.error : "فشل التحديث", "error");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="تغيير كلمة المرور" onClose={onClose}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 10 }}>{agent.name}</p>
      <Field label="كلمة المرور الجديدة">
        <input
          className="sk-input"
          style={inpStyle}
          value={password}
          minLength={6}
          placeholder="٦ أحرف على الأقل"
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" style={ghostBtn} onClick={onClose}>
          إلغاء
        </button>
        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void submit()}>
          {saving ? "..." : "تأكيد"}
        </button>
      </div>
    </Modal>
  );
}

function AddFreezeModal({
  branches,
  showToast,
  onClose,
  onSaved,
}: {
  branches: BranchRow[];
  showToast: (message: string, type?: "success" | "error") => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [branchId, setBranchId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!fromDate || !toDate) {
      showToast("حدد تاريخ البداية والنهاية", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/freezes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId || null,
          freeze_start: fromDate,
          freeze_end: toDate,
          reason: reason.trim() || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(typeof data.error === "string" ? data.error : "فشل الإضافة", "error");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="إضافة نافذة تجميد" onClose={onClose}>
      <Field label="الفرع">
        <select className="sk-input" style={inpStyle} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">كل الفروع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="من تاريخ">
        <input className="sk-input" style={inpStyle} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </Field>
      <Field label="إلى تاريخ">
        <input
          className="sk-input"
          style={inpStyle}
          type="date"
          min={fromDate || undefined}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </Field>
      <Field label="السبب">
        <input className="sk-input" style={inpStyle} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" style={ghostBtn} onClick={onClose}>
          إلغاء
        </button>
        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void submit()}>
          {saving ? "..." : "إضافة"}
        </button>
      </div>
    </Modal>
  );
}

function AddTechnicianModal({
  branches,
  showToast,
  onClose,
  onSaved,
}: {
  branches: BranchRow[];
  showToast: (message: string, type?: "success" | "error") => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("فني أول");
  const [branchId, setBranchId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      showToast("الاسم مطلوب", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/technicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          level,
          branch_id: branchId || null,
          is_active: true,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(typeof data.error === "string" ? data.error : "فشل الإضافة", "error");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="إضافة فني" onClose={onClose}>
      <Field label="الاسم">
        <input className="sk-input" style={inpStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="المستوى">
        <select className="sk-input" style={inpStyle} value={level} onChange={(e) => setLevel(e.target.value)}>
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="الفرع">
        <select className="sk-input" style={inpStyle} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">متنقل (بدون فرع)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" style={ghostBtn} onClick={onClose}>
          إلغاء
        </button>
        <button type="button" style={primaryBtn} disabled={saving} onClick={() => void submit()}>
          {saving ? "..." : "إضافة"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 140,
        background: "rgba(8,12,20,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          padding: 22,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: 12 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const headerGhostPill: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 99,
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  fontFamily: "inherit",
  background: "var(--surface-elevated)",
  color: "var(--text-secondary)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  cursor: "pointer",
};

const headerGhostPillActive: CSSProperties = {
  ...headerGhostPill,
  background: "var(--brand-red)",
  color: "#fff",
};

const logoutBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-secondary)",
  fontSize: "11px",
  padding: "6px 8px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const sectionTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const cardStyle: CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-lg)",
  padding: 20,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-sm)",
  background: "var(--surface-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
};

const trBorder: CSSProperties = {
  borderBottom: "1px solid var(--border-subtle)",
};

const thStyle: CSSProperties = {
  padding: 10,
  textAlign: "right",
  color: "var(--text-muted)",
  fontWeight: 600,
  fontSize: 11,
};

const tdStyle: CSSProperties = {
  padding: 10,
  color: "var(--text-secondary)",
};

const badgeBase: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 99,
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1.2,
};

const primaryBtn: CSSProperties = {
  height: 36,
  padding: "0 14px",
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--brand-red)",
  color: "#fff",
  fontWeight: 700,
  fontSize: "var(--text-xs)",
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryBtnSmall: CSSProperties = {
  ...primaryBtn,
  height: 32,
  padding: "0 12px",
};

const ghostBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-default)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "var(--text-sm)",
};

const ghostBtnSmall: CSSProperties = {
  ...ghostBtn,
  fontSize: 11,
  padding: "5px 10px",
};

const inpStyle: CSSProperties = {
  width: "100%",
  minHeight: 36,
  padding: "8px 12px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-default)",
  background: "var(--surface-input)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
