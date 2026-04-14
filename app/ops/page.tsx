"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

const STATUS_MAP = {
  WAITING: {
    ar: "انتظار",
    color: "var(--text-muted)",
    bg: "rgba(255,255,255,0.05)",
  },
  RECEIVED: {
    ar: "استلام",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.10)",
  },
  IN_PROGRESS: {
    ar: "تشغيل",
    color: "var(--warn)",
    bg: "var(--warn-bg)",
  },
  CHECK: {
    ar: "فحص جودة",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.10)",
  },
  WAITING_DELIVERY: {
    ar: "انتظار تسليم",
    color: "#34d399",
    bg: "rgba(52,211,153,0.10)",
  },
  DELIVERED: {
    ar: "تم التسليم",
    color: "var(--success)",
    bg: "var(--success-bg)",
  },
  DOUBLE_CHECK: {
    ar: "دبل اتشيك",
    color: "var(--brand-red)",
    bg: "var(--error-bg)",
  },
} as const;

const LEVEL_MAP: Record<
  string,
  { color: string; bg: string }
> = {
  "فني أول": { color: "var(--warn)", bg: "var(--warn-bg)" },
  "فني ثاني": { color: "#60a5fa", bg: "rgba(96,165,250,0.10)" },
  "مساعد فني": {
    color: "var(--text-muted)",
    bg: "rgba(255,255,255,0.05)",
  },
};

type JobStatus = keyof typeof STATUS_MAP;

type BranchRow = { id: string; name: string };

type TechnicianRow = {
  id: string;
  name: string;
  level: string;
  branch_id: string | null;
  is_active?: boolean;
};

type WorkshopJob = {
  id: string;
  booking_id: string | null;
  branch_id: string;
  car_model: string | null;
  customer_name: string;
  customer_phone: string;
  service: string;
  appointment_date: string;
  status: string;
  job_type: string;
  notes: string | null;
  quoted_amount?: string | null;
  actual_amount?: string | number | null;
  technician_ids?: string[] | null;
  received_at?: string | null;
  delivered_at?: string | null;
  created_at?: string;
  branches?: { name?: string } | null;
  bookings?: Record<string, unknown> | null;
};

type PendingBooking = {
  id: string;
  branch_id: string;
  agent_id: string;
  customer_name: string;
  customer_phone: string;
  car_model: string | null;
  service: string;
  notes: string | null;
  amount: string | null;
  status: string;
  branches?: { name?: string } | null;
  agents?: { name?: string } | null;
};

type AgentMe = {
  id: string;
  name: string;
  role: string;
  branch_id?: string | null;
};

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatArDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseMoney(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n =
    typeof v === "number"
      ? v
      : parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function techIds(job: WorkshopJob): string[] {
  const raw = job.technician_ids;
  if (Array.isArray(raw)) return raw.filter(Boolean) as string[];
  return [];
}

function statusBadgeStyle(status: string): CSSProperties {
  const s = STATUS_MAP[status as JobStatus];
  if (!s)
    return {
      fontSize: "10px",
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 99,
      background: "var(--surface-elevated)",
      color: "var(--text-muted)",
    };
  return {
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 99,
    background: s.bg,
    color: s.color,
  };
}

function levelStyle(level: string): CSSProperties {
  const m = LEVEL_MAP[level] ?? LEVEL_MAP["مساعد فني"];
  return {
    fontSize: "10px",
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 6,
    background: m.bg,
    color: m.color,
  };
}

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

export default function OpsPage() {
  const router = useRouter();
  const layoutMode = useLayoutMode();
  const isMobile = layoutMode === "mobile";

  const [agent, setAgent] = useState<AgentMe | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [jobs, setJobs] = useState<WorkshopJob[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);

  const [selectedDate, setSelectedDate] = useState(() =>
    toISODate(new Date())
  );
  const [selectedBranch, setSelectedBranch] = useState("");
  const [activeView, setActiveView] = useState<"kanban" | "table">("kanban");
  const [showTechnicianPanel, setShowTechnicianPanel] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showCreateFromBookingModal, setShowCreateFromBookingModal] =
    useState(false);

  const [showJobEditModal, setShowJobEditModal] = useState(false);
  const [editJob, setEditJob] = useState<WorkshopJob | null>(null);
  const [doubleCheckJob, setDoubleCheckJob] = useState<WorkshopJob | null>(
    null
  );

  const [tableSort, setTableSort] = useState<{
    key: "status" | "branch" | null;
    dir: "asc" | "desc";
  }>({ key: null, dir: "asc" });

  const role = (agent?.role ?? "").toLowerCase();
  const isAdmin = role === "admin" || role === "أدمن";
  const isOps = role === "ops";

  const headerGhostPill: CSSProperties = {
    paddingTop: "6px",
    paddingRight: "14px",
    paddingBottom: "6px",
    paddingLeft: "14px",
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
    transition: "all 0.15s ease",
    border: "none",
    cursor: "pointer",
  };

  const headerGhostPillActive: CSSProperties = {
    ...headerGhostPill,
    background: "var(--brand-red)",
    color: "#fff",
  };

  const inp: CSSProperties = {
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

  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams({ date: selectedDate });
    if (selectedBranch) params.set("branchId", selectedBranch);
    const r = await fetch(`/api/workshop/jobs?${params}`);
    const data = await r.json().catch(() => []);
    setJobs(Array.isArray(data) ? data : []);
  }, [selectedDate, selectedBranch]);

  const fetchTechnicians = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedBranch) params.set("branchId", selectedBranch);
    const q = params.toString();
    const r = await fetch(
      `/api/workshop/technicians${q ? `?${q}` : ""}`
    );
    const data = await r.json().catch(() => []);
    setTechnicians(Array.isArray(data) ? data : []);
  }, [selectedBranch]);

  const fetchPendingBookings = useCallback(async () => {
    const params = new URLSearchParams({ date: selectedDate });
    if (selectedBranch) params.set("branchId", selectedBranch);
    const r = await fetch(`/api/workshop/bookings?${params}`);
    const data = await r.json().catch(() => []);
    setPendingBookings(Array.isArray(data) ? data : []);
  }, [selectedDate, selectedBranch]);

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
        setAgent(null);
        setAgentLoading(false);
        return;
      }
      const a = data as AgentMe;
      setAgent(a);
      const rl = (a.role ?? "").toLowerCase();
      if (rl !== "ops" && rl !== "admin" && rl !== "أدمن") {
        router.replace("/booking");
        return;
      }
      if (a.branch_id && rl === "ops") {
        setSelectedBranch(String(a.branch_id));
      }
      setAgentLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!agent) return;
    (async () => {
      const r = await fetch("/api/branches");
      const data = await r.json().catch(() => []);
      setBranches(Array.isArray(data) ? data : []);
    })();
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    void fetchJobs();
    void fetchTechnicians();
    void fetchPendingBookings();
  }, [agent, fetchJobs, fetchTechnicians, fetchPendingBookings]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const patchJob = async (id: string, body: Record<string, unknown>) => {
    const r = await fetch(`/api/workshop/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(
        typeof err.error === "string" ? err.error : "تعذر تحديث البطاقة"
      );
      return;
    }
    await fetchJobs();
    await fetchPendingBookings();
  };

  const branchName = useMemo(() => {
    if (!selectedBranch) return "كل الفروع";
    return (
      branches.find((b) => b.id === selectedBranch)?.name ?? "الفرع"
    );
  }, [branches, selectedBranch]);

  const techById = useMemo(() => {
    const m = new Map<string, TechnicianRow>();
    technicians.forEach((t) => m.set(t.id, t));
    return m;
  }, [technicians]);

  const kpis = useMemo(() => {
    const total = jobs.length;
    const waiting = jobs.filter((j) => j.status === "WAITING").length;
    const running = jobs.filter(
      (j) => j.status === "IN_PROGRESS" || j.status === "RECEIVED"
    ).length;
    const ready = jobs.filter((j) => j.status === "WAITING_DELIVERY").length;
    const done = jobs.filter((j) => j.status === "DELIVERED").length;
    return { total, waiting, running, ready, done };
  }, [jobs]);

  const sortedTableJobs = useMemo(() => {
    const list = [...jobs];
    if (tableSort.key === "status") {
      list.sort((a, b) =>
        tableSort.dir === "asc"
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status)
      );
    } else if (tableSort.key === "branch") {
      const name = (j: WorkshopJob) =>
        j.branches?.name ?? branches.find((x) => x.id === j.branch_id)?.name ?? "";
      list.sort((a, b) =>
        tableSort.dir === "asc"
          ? name(a).localeCompare(name(b), "ar")
          : name(b).localeCompare(name(a), "ar")
      );
    }
    return list;
  }, [jobs, tableSort, branches]);

  const footerSum = useMemo(() => {
    let sum = 0;
    for (const j of jobs) {
      sum += parseMoney(j.actual_amount);
    }
    return sum;
  }, [jobs]);

  const kanbanBuckets = useMemo(() => {
    const col1 = jobs.filter(
      (j) => j.status === "WAITING" || j.status === "RECEIVED"
    );
    const col2 = jobs.filter(
      (j) => j.status === "IN_PROGRESS" || j.status === "CHECK"
    );
    const col3 = jobs.filter((j) => j.status === "WAITING_DELIVERY");
    const col4 = jobs.filter(
      (j) => j.status === "DELIVERED" || j.status === "DOUBLE_CHECK"
    );
    return { col1, col2, col3, col4 };
  }, [jobs]);

  const openPrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const inProgress =
      jobs.filter(
        (j) =>
          j.status === "IN_PROGRESS" ||
          j.status === "RECEIVED" ||
          j.status === "CHECK" ||
          j.status === "WAITING"
      ).length;
    const delivered = jobs.filter((j) => j.status === "DELIVERED").length;
    const rows = jobs
      .map((j, i) => {
        const techNames = techIds(j)
          .map((id) => techById.get(id)?.name ?? id)
          .join("، ");
        const st = STATUS_MAP[j.status as JobStatus]?.ar ?? j.status;
        const price = parseMoney(j.actual_amount);
        return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(j.car_model ?? "—")}</td>
          <td>${escapeHtml(j.customer_name)}</td>
          <td>${escapeHtml(j.service)}</td>
          <td>${escapeHtml(techNames || "—")}</td>
          <td>${escapeHtml(st)}</td>
          <td>${price || "—"}</td>
          <td>${escapeHtml(j.notes ?? "")}</td>
        </tr>`;
      })
      .join("");
    const title = `تقرير تشغيل ${escapeHtml(branchName)} — ${escapeHtml(
      formatArDate(selectedDate)
    )}`;
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="utf-8"/><title>${title}</title>
      <style>
        body { font-family: Cairo, sans-serif; padding: 24px; color: #111; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
        th { background: #f3f3f3; }
        h1 { font-size: 18px; margin-bottom: 16px; }
        .foot { margin-top: 16px; font-size: 13px; }
      </style></head><body>
      <h1>${title}</h1>
      <table><thead><tr>
        <th>#</th><th>المركبة</th><th>العميل</th><th>الخدمة</th><th>الفنيين</th><th>الحالة</th><th>السعر</th><th>ملاحظات</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="foot">
        إجمالي السيارات: ${jobs.length} |
        تم التسليم: ${delivered} |
        في التشغيل: ${inProgress} |
        إجمالي المبالغ: ${footerSum}
      </div>
      <script>setTimeout(function(){ window.print(); }, 500);</script>
      </body></html>`);
    w.document.close();
  };

  const renderJobActions = (job: WorkshopJob) => {
    const next = (
      label: string,
      body: Record<string, unknown>,
      color: string,
      onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    ) => (
      <button
        type="button"
        onClick={
          onClick ??
          ((e) => {
            e.stopPropagation();
            void patchJob(job.id, body);
          })
        }
        style={{
          padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          fontFamily: "inherit",
          fontSize: "11px",
          fontWeight: 700,
          cursor: "pointer",
          background: color,
          color: "#fff",
        }}
      >
        {label}
      </button>
    );

    switch (job.status) {
      case "WAITING":
        return next("استلم ✓", { status: "RECEIVED" }, "#15803d");
      case "RECEIVED":
        return next(
          "ابدأ التشغيل ▶",
          { status: "IN_PROGRESS" },
          "#b45309",
          (e) => {
            e.stopPropagation();
            if (!techIds(job).length) {
              if (
                !window.confirm(
                  "لم يتم تعيين فنيين بعد. هل تريد المتابعة؟"
                )
              ) {
                return;
              }
            }
            void patchJob(job.id, { status: "IN_PROGRESS" });
          }
        );
      case "IN_PROGRESS":
        return next("فحص جودة 🔍", { status: "CHECK" }, "#7c3aed");
      case "CHECK":
        return next("جاهز للتسليم ✓", { status: "WAITING_DELIVERY" }, "#059669");
      case "WAITING_DELIVERY":
        return next("تسليم نهائي 🚗", { status: "DELIVERED" }, "#2563eb");
      case "DELIVERED":
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDoubleCheckJob(job);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontFamily: "inherit",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              background: "var(--brand-red)",
              color: "#fff",
            }}
          >
            حدد دبل اتشيك 📅
          </button>
        );
      case "DOUBLE_CHECK":
        return next("اكتمل ✓", { status: "DELIVERED" }, "#15803d");
      default:
        return null;
    }
  };

  const JobCard = ({ job }: { job: WorkshopJob }) => {
    const st = job.status as JobStatus;
    const meta = STATUS_MAP[st];
    return (
      <div
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: 12,
          marginBottom: 8,
          cursor: "pointer",
        }}
        onClick={() => {
          setEditJob(job);
          setShowJobEditModal(true);
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {job.car_model ?? "—"}
          </span>
          <span style={statusBadgeStyle(job.status)}>{meta?.ar ?? job.status}</span>
        </div>
        <div
          style={{
            fontSize: 12,
            direction: "ltr",
            textAlign: "right",
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}
        >
          {job.customer_name} | {job.customer_phone}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--brand-red)",
            marginBottom: 8,
          }}
        >
          {job.service}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {techIds(job).length === 0 ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              غير معين
            </span>
          ) : (
            techIds(job).map((id) => {
              const t = techById.get(id);
              return (
                <span key={id} style={levelStyle(t?.level ?? "مساعد فني")}>
                  {t?.name ?? id}
                </span>
              );
            })
          )}
        </div>
        {job.received_at && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 6,
            }}
          >
            ⏱ وقت الاستلام: {formatTime(job.received_at)}
          </div>
        )}
        {job.notes && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              marginBottom: 8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.notes}
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {renderJobActions(job)}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditJob(job);
              setShowJobEditModal(true);
            }}
            style={{
              fontSize: 10,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            تعديل
          </button>
        </div>
      </div>
    );
  };

  const KanbanColumn = ({
    title,
    barColor,
    list,
  }: {
    title: string;
    barColor: string;
    list: WorkshopJob[];
  }) => (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: 12,
        minHeight: 200,
      }}
    >
      <div
        style={{
          borderTop: `3px solid ${barColor}`,
          paddingTop: 8,
          marginTop: -12,
          marginLeft: -12,
          marginRight: -12,
          paddingLeft: 12,
          paddingRight: 12,
          marginBottom: 8,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            background: "var(--surface-elevated)",
            padding: "2px 8px",
            borderRadius: 99,
          }}
        >
          {list.length}
        </span>
      </div>
      <div className="scroll-col" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {list.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </div>
  );

  if (agentLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-deep)",
        }}
      >
        <p style={{ color: "var(--text-muted)" }}>جاري التحميل...</p>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--surface-deep)",
        overflow: "hidden",
        direction: "rtl",
      }}
    >
      <header
        style={{
          height: isMobile ? 48 : 56,
          flexShrink: 0,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr auto 1fr" : "auto 1fr auto",
          alignItems: "center",
          gap: isMobile ? 8 : 16,
          paddingTop: 0,
          paddingRight: isMobile ? 12 : 24,
          paddingBottom: 0,
          paddingLeft: isMobile ? 12 : 24,
          background: "rgba(13,18,32,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-subtle)",
          zIndex: 50,
        }}
      >
        {!isMobile ? (
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
              <span style={headerGhostPillActive}>لوحة العمليات</span>
              {isAdmin && (
                <Link href="/admin" style={headerGhostPill}>
                  الإدارة
                </Link>
              )}
            </div>
            <div
              dir="ltr"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowTechnicianPanel(true)}
                  style={{
                    ...headerGhostPill,
                    cursor: "pointer",
                  }}
                >
                  الفنيين
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: "transparent",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-secondary)",
                  fontSize: "11px",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
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
        ) : (
          <>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: 11,
                cursor: "pointer",
                justifySelf: "start",
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
              }}
            >
              {agent.name}
            </span>
          </>
        )}
      </header>

      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border-subtle)",
          paddingTop: 12,
          paddingRight: 24,
          paddingBottom: 12,
          paddingLeft: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            type="date"
            className="sk-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ ...inp, width: "auto", height: 36 }}
          />
          {isAdmin && (
            <select
              className="sk-input"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ ...inp, width: 200, height: 36 }}
            >
              <option value="">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {isOps && (
            <select
              className="sk-input"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ ...inp, width: 200, height: 36 }}
              disabled
            >
              {branches
                .filter((b) => b.id === selectedBranch)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          )}
          {pendingBookings.length > 0 && (
            <button
              type="button"
              className="ops-pending-pulse"
              onClick={() => setShowCreateFromBookingModal(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 99,
                border: "1px solid var(--warn-border)",
                background: "var(--warn-bg)",
                color: "var(--warn)",
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {pendingBookings.length} حجز بدون بطاقة ←
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={() => setActiveView("kanban")}
              style={{
                height: 36,
                minWidth: 44,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-default)",
                background:
                  activeView === "kanban" ? "var(--brand-red)" : "transparent",
                color: activeView === "kanban" ? "#fff" : "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
              }}
              title="كانبان"
            >
              ⊞
            </button>
            <button
              type="button"
              onClick={() => setActiveView("table")}
              style={{
                height: 36,
                minWidth: 44,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-default)",
                background:
                  activeView === "table" ? "var(--brand-red)" : "transparent",
                color: activeView === "table" ? "#fff" : "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
              }}
              title="جدول"
            >
              ≡
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowAddJobModal(true)}
            style={{
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
            }}
          >
            ➕ إضافة سيارة
          </button>
          <button
            type="button"
            onClick={openPrint}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "var(--text-xs)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🖨 طباعة
          </button>
        </div>
      </div>

      <div
        style={{
          paddingTop: 16,
          paddingRight: 24,
          paddingBottom: 16,
          paddingLeft: 24,
          display: "flex",
          gap: 12,
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        {[
          { label: "إجمالي اليوم", n: kpis.total, c: "var(--text-primary)" },
          { label: "انتظار", n: kpis.waiting, c: "var(--text-muted)" },
          { label: "تشغيل", n: kpis.running, c: "var(--warn)" },
          { label: "جاهز للتسليم", n: kpis.ready, c: "var(--success)" },
          { label: "تم التسليم", n: kpis.done, c: "#60a5fa" },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              paddingTop: 14,
              paddingRight: 18,
              paddingBottom: 14,
              paddingLeft: 18,
              minWidth: 140,
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: k.c }}>
              {k.n}
            </div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginTop: 4,
              }}
            >
              {k.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {activeView === "kanban" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(280px, 1fr))",
              gap: 16,
              paddingTop: 0,
              paddingRight: 24,
              paddingBottom: 16,
              paddingLeft: 24,
              overflowX: "auto",
            }}
          >
            <KanbanColumn
              title="استلام"
              barColor="#60a5fa"
              list={kanbanBuckets.col1}
            />
            <KanbanColumn
              title="تشغيل"
              barColor="var(--warn)"
              list={kanbanBuckets.col2}
            />
            <KanbanColumn
              title="تسليم"
              barColor="#34d399"
              list={kanbanBuckets.col3}
            />
            <KanbanColumn
              title="منتهي"
              barColor="var(--success)"
              list={kanbanBuckets.col4}
            />
          </div>
        ) : (
          <div style={{ padding: "0 24px 24px", overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--text-sm)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: 8, textAlign: "right" }}>المركبة</th>
                  <th style={{ padding: 8, textAlign: "right" }}>العميل</th>
                  <th style={{ padding: 8, textAlign: "left" }}>التليفون</th>
                  <th style={{ padding: 8, textAlign: "right" }}>الخدمة</th>
                  <th style={{ padding: 8, textAlign: "right" }}>الفنيين</th>
                  <th
                    style={{ padding: 8, textAlign: "right", cursor: "pointer" }}
                    onClick={() =>
                      setTableSort((s) => ({
                        key: "status",
                        dir:
                          s.key === "status" && s.dir === "asc"
                            ? "desc"
                            : "asc",
                      }))
                    }
                  >
                    الحالة {tableSort.key === "status" ? (tableSort.dir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    style={{ padding: 8, textAlign: "right", cursor: "pointer" }}
                    onClick={() =>
                      setTableSort((s) => ({
                        key: "branch",
                        dir:
                          s.key === "branch" && s.dir === "asc"
                            ? "desc"
                            : "asc",
                      }))
                    }
                  >
                    الفرع {tableSort.key === "branch" ? (tableSort.dir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th style={{ padding: 8, textAlign: "right" }}>السعر</th>
                  <th style={{ padding: 8, textAlign: "right" }}>ملاحظات</th>
                  <th style={{ padding: 8, textAlign: "right" }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {sortedTableJobs.map((job) => (
                  <tr
                    key={job.id}
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <td style={{ padding: 8 }}>{job.car_model ?? "—"}</td>
                    <td style={{ padding: 8 }}>{job.customer_name}</td>
                    <td style={{ padding: 8, direction: "ltr", textAlign: "left" }}>
                      {job.customer_phone}
                    </td>
                    <td style={{ padding: 8, color: "var(--brand-red)" }}>
                      {job.service}
                    </td>
                    <td style={{ padding: 8 }}>
                      {techIds(job)
                        .map((id) => techById.get(id)?.name ?? id)
                        .join("، ") || "—"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <span style={statusBadgeStyle(job.status)}>
                        {STATUS_MAP[job.status as JobStatus]?.ar ?? job.status}
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>
                      {job.branches?.name ??
                        branches.find((b) => b.id === job.branch_id)?.name ??
                        "—"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {parseMoney(job.actual_amount) || "—"}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.notes ?? ""}
                    </td>
                    <td style={{ padding: 8 }} onClick={(e) => e.stopPropagation()}>
                      {renderJobActions(job)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: 12,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                    }}
                  >
                    إجمالي السيارات: {jobs.length}
                  </td>
                  <td style={{ padding: 12, fontWeight: 700 }}>
                    إجمالي المبالغ: {footerSum}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {showAddJobModal && (
        <AddJobModal
          branches={branches}
          technicians={technicians}
          selectedDate={selectedDate}
          selectedBranch={selectedBranch}
          isOps={isOps}
          inp={inp}
          onClose={() => setShowAddJobModal(false)}
          onSaved={async () => {
            setShowAddJobModal(false);
            await fetchJobs();
            await fetchPendingBookings();
          }}
        />
      )}

      {showCreateFromBookingModal && (
        <CreateFromBookingModal
          pending={pendingBookings}
          selectedDate={selectedDate}
          inp={inp}
          onClose={() => setShowCreateFromBookingModal(false)}
          onCreated={async (id: string) => {
            setPendingBookings((p) => p.filter((b) => b.id !== id));
            await fetchJobs();
          }}
        />
      )}

      {showJobEditModal && editJob && (
        <JobEditModal
          job={editJob}
          branches={branches}
          technicians={technicians}
          isOps={isOps}
          inp={inp}
          onClose={() => {
            setShowJobEditModal(false);
            setEditJob(null);
          }}
          onSaved={async () => {
            setShowJobEditModal(false);
            setEditJob(null);
            await fetchJobs();
          }}
        />
      )}

      {doubleCheckJob && (
        <DoubleCheckModal
          job={doubleCheckJob}
          inp={inp}
          onClose={() => setDoubleCheckJob(null)}
          onDone={async () => {
            setDoubleCheckJob(null);
            await fetchJobs();
          }}
        />
      )}

      {isAdmin && showTechnicianPanel && (
        <TechnicianPanel
          branches={branches}
          onClose={() => setShowTechnicianPanel(false)}
          onChanged={fetchTechnicians}
        />
      )}

    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function AddJobModal({
  branches,
  technicians,
  selectedDate,
  selectedBranch,
  isOps,
  inp,
  onClose,
  onSaved,
}: {
  branches: BranchRow[];
  technicians: TechnicianRow[];
  selectedDate: string;
  selectedBranch: string;
  isOps: boolean;
  inp: CSSProperties;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [jobType, setJobType] = useState<"installation" | "maintenance" | "double_check">(
    "installation"
  );
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [car, setCar] = useState("");
  const [service, setService] = useState("");
  const [branchId, setBranchId] = useState(
    isOps ? selectedBranch : selectedBranch || ""
  );
  const [date, setDate] = useState(selectedDate);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [techSel, setTechSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const branchOptions = isOps
    ? branches.filter((b) => b.id === selectedBranch)
    : branches;

  useEffect(() => {
    if (isOps && selectedBranch) setBranchId(selectedBranch);
  }, [isOps, selectedBranch]);

  const submit = async () => {
    if (!branchId || !customerName.trim() || !phone.trim()) {
      alert("أكمل الحقول المطلوبة");
      return;
    }
    setSaving(true);
    try {
      const body = {
        job_type: jobType,
        customer_name: customerName.trim(),
        customer_phone: phone.trim(),
        car_model: car.trim() || null,
        service: service.trim() || "—",
        branch_id: branchId,
        appointment_date: date,
        quoted_amount: price.trim() || null,
        notes: notes.trim() || null,
        status: "WAITING",
        technician_ids: techSel.length ? techSel : null,
      };
      const r = await fetch("/api/workshop/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(typeof e.error === "string" ? e.error : "فشل الحفظ");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="إضافة سيارة جديدة" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 10, color: "var(--text-muted)" }}>نوع العمل</label>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {(
              [
                ["تركيب", "installation"],
                ["صيانة", "maintenance"],
                ["دبل اتشيك", "double_check"],
              ] as const
            ).map(([ar, val]) => (
              <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="jt"
                  checked={jobType === val}
                  onChange={() => setJobType(val)}
                />
                {ar}
              </label>
            ))}
          </div>
        </div>
        <Field label="اسم العميل">
          <input className="sk-input" style={inp} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </Field>
        <Field label="تليفون">
          <input className="sk-input" style={inp} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="المركبة">
          <input className="sk-input" style={inp} value={car} onChange={(e) => setCar(e.target.value)} />
        </Field>
        <Field label="الخدمة">
          <input className="sk-input" style={inp} value={service} onChange={(e) => setService(e.target.value)} />
        </Field>
        <Field label="الفرع">
          <select
            className="sk-input"
            style={inp}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={isOps}
          >
            <option value="">—</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="التاريخ">
          <input className="sk-input" style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="السعر">
          <input className="sk-input" style={inp} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <textarea className="sk-input" style={{ ...inp, minHeight: 72 }} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
        <Field label="الفنيين">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {technicians.map((t) => {
              const on = techSel.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setTechSel((s) =>
                      on ? s.filter((x) => x !== t.id) : [...s, t.id]
                    )
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: on ? "2px solid var(--brand-red)" : "1px solid var(--border-default)",
                    background: "var(--surface-elevated)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {on ? "✓ " : ""}
                  {t.name}
                  <span style={levelStyle(t.level)}>{t.level}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>إلغاء</button>
          <button type="button" disabled={saving} onClick={() => void submit()} style={primaryBtn}>
            {saving ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateFromBookingModal({
  pending,
  selectedDate,
  inp,
  onClose,
  onCreated,
}: {
  pending: PendingBooking[];
  selectedDate: string;
  inp: CSSProperties;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const createOne = async (b: PendingBooking) => {
    const body = {
      booking_id: b.id,
      branch_id: b.branch_id,
      car_model: b.car_model,
      customer_name: b.customer_name,
      customer_phone: b.customer_phone,
      service: b.service,
      appointment_date: selectedDate,
      job_type: "installation",
      status: "WAITING",
      notes: b.notes,
      quoted_amount: b.amount,
    };
    const r = await fetch("/api/workshop/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(typeof e.error === "string" ? e.error : "فشل الإنشاء");
      return;
    }
    await onCreated(b.id);
  };

  return (
    <Modal title="حجوزات اليوم بدون بطاقة" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "70vh", overflowY: "auto" }}>
        {pending.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>لا يوجد حجوزات معلقة</p>
        ) : (
          pending.map((b) => (
            <div
              key={b.id}
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: 12,
                background: "var(--surface-elevated)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{b.customer_name}</div>
              <div style={{ fontSize: 12, direction: "ltr", textAlign: "right", color: "var(--text-secondary)" }}>
                {b.customer_phone}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{b.car_model ?? "—"} | {b.service}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                المندوب: {b.agents?.name ?? "—"}
              </div>
              <button type="button" style={{ ...primaryBtn, marginTop: 8 }} onClick={() => void createOne(b)}>
                إنشاء بطاقة
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

function JobEditModal({
  job,
  branches,
  technicians,
  isOps,
  inp,
  onClose,
  onSaved,
}: {
  job: WorkshopJob;
  branches: BranchRow[];
  technicians: TechnicianRow[];
  isOps: boolean;
  inp: CSSProperties;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState(job.customer_name);
  const [phone, setPhone] = useState(job.customer_phone);
  const [car, setCar] = useState(job.car_model ?? "");
  const [service, setService] = useState(job.service);
  const [branchId, setBranchId] = useState(job.branch_id);
  const [date, setDate] = useState(job.appointment_date);
  const [quoted, setQuoted] = useState(String(job.quoted_amount ?? ""));
  const [actual, setActual] = useState(String(job.actual_amount ?? ""));
  const [notes, setNotes] = useState(job.notes ?? "");
  const [techSel, setTechSel] = useState<string[]>(techIds(job));
  const [saving, setSaving] = useState(false);

  const branchOptions = isOps
    ? branches.filter((b) => b.id === branchId)
    : branches;

  const submit = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/workshop/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: phone.trim(),
          car_model: car.trim() || null,
          service: service.trim(),
          branch_id: branchId,
          appointment_date: date,
          quoted_amount: quoted.trim() || null,
          actual_amount: actual.trim() || null,
          notes: notes.trim() || null,
          technician_ids: techSel.length ? techSel : null,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(typeof e.error === "string" ? e.error : "فشل الحفظ");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="تعديل بطاقة العمل" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="اسم العميل">
          <input className="sk-input" style={inp} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </Field>
        <Field label="تليفون">
          <input className="sk-input" style={inp} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="المركبة">
          <input className="sk-input" style={inp} value={car} onChange={(e) => setCar(e.target.value)} />
        </Field>
        <Field label="الخدمة">
          <input className="sk-input" style={inp} value={service} onChange={(e) => setService(e.target.value)} />
        </Field>
        <Field label="الفرع">
          <select
            className="sk-input"
            style={inp}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={isOps}
          >
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="التاريخ">
          <input className="sk-input" style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="السعر المقدر">
          <input className="sk-input" style={inp} value={quoted} onChange={(e) => setQuoted(e.target.value)} />
        </Field>
        <Field label="المبلغ الفعلي">
          <input className="sk-input" style={inp} value={actual} onChange={(e) => setActual(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <textarea className="sk-input" style={{ ...inp, minHeight: 72 }} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
        <Field label="الفنيين">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {technicians.map((t) => {
              const on = techSel.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setTechSel((s) =>
                      on ? s.filter((x) => x !== t.id) : [...s, t.id]
                    )
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: on ? "2px solid var(--brand-red)" : "1px solid var(--border-default)",
                    background: "var(--surface-elevated)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {on ? "✓ " : ""}
                  {t.name}
                  <span style={levelStyle(t.level)}>{t.level}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={ghostBtn}>إلغاء</button>
          <button type="button" disabled={saving} onClick={() => void submit()} style={primaryBtn}>
            {saving ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DoubleCheckModal({
  job,
  inp,
  onClose,
  onDone,
}: {
  job: WorkshopJob;
  inp: CSSProperties;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [date, setDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toISODate(t);
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const body = {
        booking_id: job.booking_id,
        branch_id: job.branch_id,
        car_model: job.car_model,
        customer_name: job.customer_name,
        customer_phone: job.customer_phone,
        service: "دبل اتشيك",
        job_type: "double_check",
        appointment_date: date,
        status: "WAITING",
        notes: notes.trim() || null,
      };
      const r1 = await fetch("/api/workshop/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r1.ok) {
        const e = await r1.json().catch(() => ({}));
        alert(typeof e.error === "string" ? e.error : "فشل إنشاء الموعد");
        return;
      }
      const r2 = await fetch(`/api/workshop/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      });
      if (!r2.ok) {
        const e = await r2.json().catch(() => ({}));
        alert(typeof e.error === "string" ? e.error : "فشل تحديث البطاقة");
        return;
      }
      await onDone();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const minD = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toISODate(t);
  })();

  return (
    <Modal title="تحديد موعد دبل اتشيك" onClose={onClose}>
      <Field label="التاريخ">
        <input
          className="sk-input"
          style={inp}
          type="date"
          min={minD}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="ملاحظات">
        <textarea className="sk-input" style={{ ...inp, minHeight: 72 }} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>إلغاء</button>
        <button type="button" disabled={loading} onClick={() => void submit()} style={primaryBtn}>
          {loading ? "…" : "تأكيد"}
        </button>
      </div>
    </Modal>
  );
}

function TechnicianPanel({
  branches,
  onClose,
  onChanged,
}: {
  branches: BranchRow[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [list, setList] = useState<TechnicianRow[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("فني أول");
  const [branchId, setBranchId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/workshop/technicians");
    const data = await r.json().catch(() => []);
    setList(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const m = new Map<string | "float", TechnicianRow[]>();
    for (const t of list) {
      const key = t.branch_id == null ? "float" : t.branch_id;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return m;
  }, [list]);

  const addTech = async () => {
    if (!name.trim()) return;
    const body = {
      name: name.trim(),
      level,
      branch_id: branchId === "" ? null : branchId,
      is_active: true,
    };
    const r = await fetch("/api/workshop/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(typeof e.error === "string" ? e.error : "فشل الإضافة");
      return;
    }
    setName("");
    await load();
    await onChanged();
  };

  const saveEdit = async (id: string) => {
    const r = await fetch(`/api/workshop/technicians/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (r.ok) {
      setEditingId(null);
      await load();
      await onChanged();
    }
  };

  const del = async (id: string) => {
    if (!confirm("تعطيل هذا الفني؟")) return;
    await fetch(`/api/workshop/technicians/${id}`, { method: "DELETE" });
    await load();
    await onChanged();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,12,20,0.6)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "min(420px, 100vw)",
          height: "100%",
          background: "var(--surface-card)",
          borderLeft: "1px solid var(--border-subtle)",
          overflowY: "auto",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>الفنيين</span>
          <button type="button" onClick={onClose} style={ghostBtn}>✕</button>
        </div>
        {Array.from(grouped.entries()).map(([key, techs]) => {
          const title =
            key === "float"
              ? "متنقل"
              : branches.find((b) => b.id === key)?.name ?? key;
          return (
            <div key={String(key)} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-red)", marginBottom: 8 }}>
                {title}
              </div>
              {techs.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  {editingId === t.id ? (
                    <input
                      className="sk-input"
                      style={{ flex: 1, minWidth: 120, padding: 6, fontSize: 13 }}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => void saveEdit(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEdit(t.id);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      style={{ flex: 1, cursor: "pointer", fontWeight: 600 }}
                      onClick={() => {
                        setEditingId(t.id);
                        setEditName(t.name);
                      }}
                    >
                      {t.name}
                    </span>
                  )}
                  <span style={levelStyle(t.level)}>{t.level}</span>
                  <button type="button" style={{ ...ghostBtn, fontSize: 10 }} onClick={() => del(t.id)}>
                    حذف
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>إضافة فني</div>
          <input
            className="sk-input"
            placeholder="الاسم"
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="sk-input"
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="فني أول">فني أول</option>
            <option value="فني ثاني">فني ثاني</option>
            <option value="مساعد فني">مساعد فني</option>
          </select>
          <select
            className="sk-input"
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">متنقل</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button type="button" style={primaryBtn} onClick={() => void addTech()}>
            إضافة
          </button>
        </div>
      </div>
    </div>
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(8,12,20,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          padding: 24,
          maxWidth: 480,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: 16 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const primaryBtn: CSSProperties = {
  padding: "10px 18px",
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--brand-red)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "var(--text-sm)",
};

const ghostBtn: CSSProperties = {
  padding: "10px 18px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-default)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "var(--text-sm)",
};
