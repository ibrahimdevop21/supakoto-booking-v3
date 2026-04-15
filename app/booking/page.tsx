"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CAL_BRANCH_NAMES = ["التجمع", "زايد", "المعادي", "دمياط الجديدة"];

const SERVICES = [
  "Takai 5",
  "Gold",
  "Gold Plus",
  "Steel",
  "Steel Plus",
  "Heat Isolation",
  "Others",
];

const ADDONS = [
  { id: "heat_glass", name: "عزل حراري زجاج 95%", price: 8400 },
  { id: "nano_4", name: "نانو 4 جنوط", price: 5000 },
  { id: "nano_interior", name: "نانو داخلي + بيانو بلاك", price: 5000 },
  { id: "protect_windshield", name: "حماية زجاج أمامي", price: 6000 },
  { id: "protect_panorama", name: "حماية بانوراما", price: 5000 },
  { id: "piano_4poles_roof", name: "بيانو 4 قوايم + سقف", price: 2500 },
  { id: "piano_4poles", name: "بيانو 4 قوايم", price: 2000 },
  { id: "piano_bumpers", name: "بيانو أكصدامين + جوانب", price: 5000 },
  { id: "nano_salon", name: "نانو صالون كامل", price: 7000 },
  { id: "nano_dashboard", name: "نانو طابلوه + طارة", price: 2000 },
  { id: "nano_seats", name: "نانو كراسي", price: 3000 },
  { id: "nano_floormats", name: "نانو فرش أبواب", price: 3500 },
  { id: "nano_windshield", name: "نانو زجاج أمامي", price: 2500 },
  { id: "fiber_ext", name: "فايبر خارجي أسود", price: 6000 },
  { id: "ppf_front_bumper", name: "بروتكشن أكصدام أمامي", price: 5000 },
  { id: "ppf_rear_bumper", name: "بروتكشن أكصدام خلفي", price: 5000 },
  { id: "ppf_door", name: "بروتكشن باب واحد", price: 3500 },
  { id: "ppf_front_fender", name: "بروتكشن رفرف أمامي", price: 3500 },
  { id: "ppf_rear_fender", name: "بروتكشن قايم + رفرف خلفي", price: 5000 },
  { id: "ppf_hood", name: "بروتكشن كبوت", price: 5000 },
  { id: "ppf_roof", name: "بروتكشن سقف", price: 6000 },
  { id: "ppf_trunk", name: "بروتكشن شنطة", price: 5000 },
  { id: "ppf_headlight", name: "بروتكشن فانوس أمامي", price: 2500 },
];

function addonNamesJoined(ids: string[] | null | undefined): string {
  if (!ids?.length) return "";
  return ids
    .map((id) => ADDONS.find((a) => a.id === id)?.name ?? id)
    .join("، ");
}

function parseAddonsFromRow(row: Record<string, unknown>): string[] | null {
  const a = row.addons;
  if (a == null) return null;
  if (Array.isArray(a)) return a.map((x) => String(x));
  return null;
}

const AR_MONTHS = [
  "يناير","فبراير","مارس","إبرايل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
const DAY_HEADS = ["أح","إث","ثل","أر","خم","جم","سب"];

type LayoutMode = "mobile" | "tablet" | "desktop";

function useLayoutMode(): LayoutMode {
  const read = () => {
    if (typeof window === "undefined") return "desktop" as LayoutMode;
    const w = window.innerWidth;
    if (w < 768) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };
  const [mode, setMode] = useState<LayoutMode>(() =>
    typeof window !== "undefined" ? read() : "desktop"
  );
  useEffect(() => {
    const onResize = () => setMode(read);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mode;
}

type BranchRow = { id: string; name: string; name_en?: string; daily_cap?: number };

type SlotInfo = {
  branch: string;
  booked: number;
  capacity: number;
  available: number;
  full: boolean;
  freezeBlocked?: boolean;
  freezeMessage?: string;
  confirmed?: number;
  onHold?: number;
};

type BookingSuccessSnapshot = {
  id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_raw: string | null;
  branch_id: string;
  branchName: string;
  service: string;
  appointment_date: string;
  car_model: string | null;
  amount: string | null;
  notes: string | null;
  addons: string[] | null;
};

function formatBookingDateAr(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function apiRowToSnapshot(
  row: Record<string, unknown>,
  branchNameLookup: string
): BookingSuccessSnapshot {
  const br = row.branches as { name?: string } | null | undefined;
  return {
    id: String(row.id ?? ""),
    status: String(row.status ?? "CONFIRMED"),
    customer_name: String(row.customer_name ?? ""),
    customer_phone: String(row.customer_phone ?? ""),
    customer_phone_raw:
      row.customer_phone_raw != null ? String(row.customer_phone_raw) : null,
    branch_id: String(row.branch_id ?? ""),
    branchName: br?.name ?? branchNameLookup,
    service: String(row.service ?? ""),
    appointment_date: String(row.appointment_date ?? ""),
    car_model: row.car_model != null ? String(row.car_model) : null,
    amount: row.amount != null ? String(row.amount) : null,
    notes: row.notes != null ? String(row.notes) : null,
    addons: parseAddonsFromRow(row),
  };
}

function buildBookingShareText(s: BookingSuccessSnapshot) {
  const lines = [
    "✅ تأكيد حجز موعد — سوباكوتو",
    "",
    `العميل: ${s.customer_name}`,
    `التليفون: ${s.customer_phone_raw ?? s.customer_phone}`,
    `الخدمة: ${s.service}`,
    `الموعد: ${formatBookingDateAr(s.appointment_date)}`,
    `الفرع: ${s.branchName}`,
  ];
  if (s.car_model) lines.push(`المركبة: ${s.car_model}`);
  if (s.amount) lines.push(`الإيداع: ${s.amount} ج.م`);
  if (s.addons?.length) {
    lines.push(`الإضافات: ${addonNamesJoined(s.addons)}`);
  }
  if (s.notes) lines.push(`ملاحظات: ${s.notes}`);
  lines.push("", "شكراً لاختيارك سوباكوتو 🚗");
  return lines.join("\n");
}

function buildBookingShareTextFromRow(b: BookingRow, branchList?: BranchRow[]) {
  const branchName =
    b.branches?.name ??
    branchList?.find((x) => x.id === b.branch_id)?.name ??
    "";
  const lines = [
    "✅ تأكيد حجز موعد — سوباكوتو",
    "",
    `العميل: ${b.customer_name}`,
    `التليفون: ${b.customer_phone_raw ?? b.customer_phone}`,
    `الخدمة: ${b.service}`,
    `الموعد: ${formatBookingDateAr(b.appointment_date)}`,
    `الفرع: ${branchName}`,
  ];
  if (b.car_model) lines.push(`المركبة: ${b.car_model}`);
  if (b.amount) lines.push(`الإيداع: ${b.amount} ج.م`);
  if (b.addons?.length) {
    lines.push(`الإضافات: ${addonNamesJoined(b.addons)}`);
  }
  if (b.notes) lines.push(`ملاحظات: ${b.notes}`);
  lines.push("", "شكراً لاختيارك سوباكوتو 🚗");
  return lines.join("\n");
}

type BookingRow = {
  id: string;
  branch_id: string;
  agent_id: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_raw?: string | null;
  car_model: string | null;
  service: string;
  amount: string | null;
  notes: string | null;
  appointment_date: string;
  status: string;
  addons?: string[] | null;
  branches?: { name?: string } | null;
};

type CapState = {
  full: boolean;
  available: number;
  booked: number;
  capacity: number;
  freezeBlocked: boolean;
  freezeMessage?: string;
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calCells(y: number, m: number) {
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const out: (string | null)[] = [];
  for (let i = 0; i < first; i++) out.push(null);
  for (let d = 1; d <= days; d++) out.push(toISO(new Date(y, m, d)));
  return out;
}

function BookingPageInner() {
  const router = useRouter();
  const today = toISO(new Date());

  const [agent, setAgent] = useState<{ id: string; name: string; role: string } | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentErr, setAgentErr] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [allBookings, setAllBookings] = useState<BookingRow[]>([]);

  const [cy, setCy] = useState(() => new Date().getFullYear());
  const [cm, setCm] = useState(() => new Date().getMonth());

  const [slotsByBranch, setSlotsByBranch] = useState<Record<string, SlotInfo> | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  type MonthDayActivity = {
    confirmed: number;
    onHold: number;
    cancelled: number;
  };
  const [monthActivity, setMonthActivity] = useState<
    Record<string, MonthDayActivity>
  >({});

  const [form, setForm] = useState({
    customer: "",
    mobile: "",
    branch: "",
    car: "",
    service: "",
    amount: "",
    appointmentDate: "",
    notes: "",
  });

  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const [mobileErr, setMobileErr] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const [capState, setCapState] = useState<CapState | null>(null);
  const [capLoading, setCapLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [bookingAwaitingStatus, setBookingAwaitingStatus] =
    useState<BookingSuccessSnapshot | null>(null);
  const [statusHoldLoading, setStatusHoldLoading] = useState(false);
  const [bookingCopyDone, setBookingCopyDone] = useState(false);
  const bookingCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dayListCopyBookingId, setDayListCopyBookingId] = useState<string | null>(
    null
  );
  const dayListCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: "",
    customerPhone: "",
    carModel: "",
    service: "",
    amount: "",
    appointmentDate: "",
    notes: "",
  });
  const [editBranchId, setEditBranchId] = useState<string | null>(null);
  const [editOriginalDate, setEditOriginalDate] = useState("");
  const [editCap, setEditCap] = useState<CapState | null>(null);
  const [editCapLoading, setEditCapLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editMobileErr, setEditMobileErr] = useState(false);

  const layoutMode = useLayoutMode();
  const [mobileTab, setMobileTab] = useState(0);
  const mobileDateNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const selectedDate = form.appointmentDate;

  const selectedAddonsTotal = useMemo(
    () =>
      selectedAddons.reduce(
        (s, id) => s + (ADDONS.find((a) => a.id === id)?.price ?? 0),
        0
      ),
    [selectedAddons]
  );

  const selectedDayActivity = useMemo((): MonthDayActivity => {
    if (!selectedDate)
      return { confirmed: 0, onHold: 0, cancelled: 0 };
    return (
      monthActivity[selectedDate] ?? {
        confirmed: 0,
        onHold: 0,
        cancelled: 0,
      }
    );
  }, [selectedDate, monthActivity]);

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + "T12:00:00");
    if (!isNaN(d.getTime())) {
      setCy(d.getFullYear());
      setCm(d.getMonth());
    }
  }, [selectedDate]);

  const loadBookings = useCallback(async (agentId: string) => {
    try {
      const r = await fetch(`/api/my-bookings?agentId=${encodeURIComponent(agentId)}`);
      const data = await r.json().catch(() => []);
      if (r.ok && Array.isArray(data)) setAllBookings(data as BookingRow[]);
      else setAllBookings([]);
    } catch {
      setAllBookings([]);
    }
  }, []);

  const refreshSlots = useCallback(
    async (date: string) => {
      if (!date) {
        setSlotsByBranch(null);
        return;
      }
      setSlotsLoading(true);
      setSlotsByBranch(null);
      try {
        const res = await fetch(
          `/api/capacity/all?date=${date}&branches=${encodeURIComponent(CAL_BRANCH_NAMES.join(","))}`
        );
        const map = (await res.json()) as Record<string, SlotInfo>;
        setSlotsByBranch(map);
      } catch {
        setSlotsByBranch(null);
      }
      setSlotsLoading(false);
    },
    []
  );

  const fetchCapacityAll = refreshSlots;

  const fetchMonthActivity = useCallback(async () => {
    const res = await fetch(
      `/api/capacity/month?year=${cy}&month=${cm + 1}`
    );
    const data = await res.json().catch(() => ({}));
    if (
      res.ok &&
      data &&
      typeof data === "object" &&
      !Array.isArray(data)
    ) {
      setMonthActivity(data as Record<string, MonthDayActivity>);
    } else {
      setMonthActivity({});
    }
  }, [cy, cm]);

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString("ar-EG", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/auth/me");
      if (cancelled) return;
      if (r.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAgentErr(
          typeof data?.error === "string" ? data.error : "تعذر تحميل الحساب"
        );
        setAgentLoading(false);
        return;
      }
      setAgent(data);
      await loadBookings(data.id);
      setAgentLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadBookings]);

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) setBranches(d as BranchRow[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSlots(selectedDate);
  }, [selectedDate, refreshSlots]);

  useEffect(() => {
    if (!form.branch || !form.appointmentDate) {
      setCapState(null);
      return;
    }
    setCapLoading(true);
    fetch(
      `/api/capacity?branchId=${encodeURIComponent(form.branch)}&date=${encodeURIComponent(form.appointmentDate)}`
    )
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (d.error) {
          setCapState(null);
        } else if (d.frozen === true) {
          setCapState({
            full: true,
            available: 0,
            booked: typeof d.booked === "number" ? d.booked : 0,
            capacity: typeof d.cap === "number" ? d.cap : 0,
            freezeBlocked: true,
            freezeMessage:
              typeof d.message === "string" ? d.message : undefined,
          });
        } else if (d.available !== undefined) {
          setCapState({
            full: Boolean(d.full),
            available: Number(d.available),
            booked: Number(d.booked ?? 0),
            capacity: Number(d.cap ?? 0),
            freezeBlocked: false,
          });
        } else {
          setCapState(null);
        }
        setCapLoading(false);
      })
      .catch(() => {
        setCapState(null);
        setCapLoading(false);
      });
  }, [form.branch, form.appointmentDate]);

  const bookingsOnSelectedDate = useMemo(() => {
    return allBookings
      .filter((b) => b.appointment_date === selectedDate)
      .sort((a, b) => a.customer_name.localeCompare(b.customer_name, "ar"));
  }, [allBookings, selectedDate]);

  useEffect(() => {
    void fetchMonthActivity();
  }, [fetchMonthActivity]);

  useEffect(() => {
    if (!editingId || !editBranchId || !editForm.appointmentDate) {
      setEditCap(null);
      return;
    }
    if (editForm.appointmentDate === editOriginalDate) {
      setEditCapLoading(false);
      setEditCap(null);
      return;
    }
    setEditCapLoading(true);
    fetch(
      `/api/capacity?branchId=${encodeURIComponent(editBranchId)}&date=${encodeURIComponent(editForm.appointmentDate)}`
    )
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (d.error) setEditCap(null);
        else if (d.frozen === true)
          setEditCap({
            full: true,
            available: 0,
            booked: typeof d.booked === "number" ? d.booked : 0,
            capacity: typeof d.cap === "number" ? d.cap : 0,
            freezeBlocked: true,
            freezeMessage:
              typeof d.message === "string" ? d.message : undefined,
          });
        else if (d.available !== undefined)
          setEditCap({
            full: Boolean(d.full),
            available: Number(d.available),
            booked: Number(d.booked ?? 0),
            capacity: Number(d.cap ?? 0),
            freezeBlocked: false,
          });
        else setEditCap(null);
        setEditCapLoading(false);
      })
      .catch(() => {
        setEditCap(null);
        setEditCapLoading(false);
      });
  }, [editingId, editBranchId, editForm.appointmentDate, editOriginalDate]);

  const editCapBlocks =
    Boolean(editingId) &&
    editForm.appointmentDate !== editOriginalDate &&
    (editCapLoading ||
      !editCap ||
      editCap.freezeBlocked === true ||
      editCap.full === true);

  const isFull = capState?.full === true;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleSubmit = async (bypassSameAgentDuplicate = false) => {
    if (!agent) return;
    const reqf: (keyof typeof form)[] = [
      "customer",
      "mobile",
      "branch",
      "car",
      "service",
      "appointmentDate",
    ];
    for (const f of reqf) if (!form[f]?.trim()) {
      alert("برجاء ملء كل الحقول المطلوبة");
      return;
    }
    if (!/^[0-9]{10,11}$/.test(form.mobile.trim())) {
      setMobileErr(true);
      return;
    }
    setMobileErr(false);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branch,
          agentId: agent.id,
          customerName: form.customer.trim(),
          customerPhone: form.mobile.trim(),
          carModel: form.car.trim(),
          service: form.service.trim(),
          amount: form.amount.trim() || null,
          appointmentDate: form.appointmentDate,
          notes: form.notes.trim() || null,
          addons: selectedAddons,
          ...(bypassSameAgentDuplicate ? { bypassDuplicate: true } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 201) {
        const bid = typeof data.id === "string" ? data.id : "";
        const branchLabel =
          branches.find((x) => x.id === form.branch)?.name ?? form.branch;
        if (bid) {
          setBookingAwaitingStatus(
            apiRowToSnapshot(data as Record<string, unknown>, branchLabel)
          );
        } else {
          const customerName =
            typeof data.customer_name === "string"
              ? data.customer_name
              : form.customer.trim();
          setResult({
            success: true,
            message: customerName
              ? `تم تسجيل موعد ${customerName} بنجاح.`
              : "تم تسجيل الموعد بنجاح.",
          });
        }
        await loadBookings(agent.id);
        await fetchCapacityAll(form.appointmentDate);
        await fetchMonthActivity();
        setSelectedAddons([]);
      } else if (!res.ok) {
        const msg = data?.error || data?.message || "حصل خطأ أثناء الحجز";
        const isDuplicate = Boolean(data?.isDuplicate);
        const isCapacityError = res.status === 409 && !isDuplicate;
        setResult({
          success: false,
          isDuplicate,
          duplicateType: data?.duplicateType,
          type: isCapacityError ? "capacity" : "error",
          message: msg,
          alternatives: data?.alternatives || [],
          existingBooking: data?.existingBooking,
          duplicateMessage:
            typeof data?.message === "string" ? data.message : undefined,
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown";
      setResult({
        success: false,
        type: "error",
        message: "Network error: " + message,
      });
    }
    setSubmitting(false);
  };

  const reset = () => {
    if (bookingCopyTimerRef.current) {
      clearTimeout(bookingCopyTimerRef.current);
      bookingCopyTimerRef.current = null;
    }
    setBookingCopyDone(false);
    setResult(null);
    setBookingAwaitingStatus(null);
    setForm((f) => ({
      ...f,
      customer: "",
      mobile: "",
      car: "",
      amount: "",
      notes: "",
    }));
    setSelectedAddons([]);
  };

  const completeBookingSuccess = (b: BookingSuccessSnapshot) => {
    setBookingAwaitingStatus(null);
    setBookingCopyDone(false);
    setResult({
      success: true,
      bookingConfirmation: b,
    });
  };

  const handleChooseConfirmed = () => {
    if (!bookingAwaitingStatus) return;
    completeBookingSuccess(bookingAwaitingStatus);
  };

  const handleChooseOnHold = async () => {
    if (!bookingAwaitingStatus || !agent) return;
    setStatusHoldLoading(true);
    try {
      const res = await fetch(`/api/my-bookings/${bookingAwaitingStatus.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          status: "ON-HOLD",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "حصل خطأ");
        return;
      }
      await loadBookings(agent.id);
      await fetchCapacityAll(bookingAwaitingStatus.appointment_date);
      await fetchMonthActivity();
      const snap = apiRowToSnapshot(
        data,
        bookingAwaitingStatus.branchName
      );
      completeBookingSuccess(snap);
    } finally {
      setStatusHoldLoading(false);
    }
  };

  const pickAppointmentDate = useCallback(
    (d: string) => {
      setForm((f) => ({ ...f, appointmentDate: d }));
      if (layoutMode === "mobile") {
        if (mobileDateNavTimerRef.current) {
          clearTimeout(mobileDateNavTimerRef.current);
        }
        mobileDateNavTimerRef.current = setTimeout(() => {
          setMobileTab(1);
          mobileDateNavTimerRef.current = null;
        }, 300);
      }
    },
    [layoutMode]
  );

  const patchBooking = async (id: string, body: Record<string, unknown>) => {
    if (!agent) return false;
    const res = await fetch(`/api/my-bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: agent.id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof data?.error === "string" ? data.error : "حصل خطأ");
      return false;
    }
    await loadBookings(agent.id);
    const slotDate =
      typeof body.appointmentDate === "string" ? body.appointmentDate : selectedDate;
    await fetchCapacityAll(slotDate);
    await fetchMonthActivity();
    return true;
  };

  const openEdit = (b: BookingRow) => {
    setEditingId(b.id);
    setEditBranchId(b.branch_id);
    setEditOriginalDate(b.appointment_date);
    setEditForm({
      customerName: b.customer_name,
      customerPhone: b.customer_phone_raw ?? b.customer_phone,
      carModel: b.car_model ?? "",
      service: b.service,
      amount: b.amount ?? "",
      appointmentDate: b.appointment_date,
      notes: b.notes ?? "",
    });
    setEditMobileErr(false);
    setEditCap(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditBranchId(null);
    setEditCap(null);
    setEditCapLoading(false);
  };

  const saveEdit = async () => {
    if (!agent || !editingId) return;
    const req = ["customerName", "customerPhone", "carModel", "service", "appointmentDate"] as const;
    for (const k of req) {
      if (!editForm[k]?.trim()) {
        alert("برجاء ملء كل الحقول");
        return;
      }
    }
    if (!/^[0-9]{10,11}$/.test(editForm.customerPhone.trim())) {
      setEditMobileErr(true);
      return;
    }
    if (editCapBlocks) return;
    setSaveLoading(true);
    try {
      const ok = await patchBooking(editingId, {
        customerName: editForm.customerName.trim(),
        customerPhone: editForm.customerPhone.trim(),
        carModel: editForm.carModel.trim(),
        service: editForm.service.trim(),
        amount: editForm.amount.trim() || null,
        appointmentDate: editForm.appointmentDate,
        notes: editForm.notes.trim() || null,
      });
      if (ok) closeEdit();
    } catch {
      alert("حصل خطأ");
    }
    setSaveLoading(false);
  };

  const patchStatus = async (id: string, status: string) => {
    await patchBooking(id, { status });
  };

  const salesRep = agent?.name ?? "";
  const role = (agent?.role ?? "agent").toLowerCase();
  const isAdmin = role === "admin" || role === "أدمن";
  const isOps = role === "ops";

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
    transition: "all 0.15s ease",
    border: "none",
    cursor: "pointer",
  };

  const calendarGridSlots = useMemo(() => {
    const c = calCells(cy, cm);
    const pad: (string | null)[] = [...c];
    while (pad.length < 42) pad.push(null);
    return pad.slice(0, 42);
  }, [cy, cm]);

  if (agentLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-4)",
          background: "var(--surface-deep)",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            border: "2.5px solid var(--border-default)",
            borderTopColor: "var(--brand-red)",
            borderRadius: "50%",
            animation: "spin 0.75s linear infinite",
          }}
        />
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          جاري التحميل...
        </p>
      </div>
    );
  }

  if (agentErr || !agent) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "var(--space-6)",
          paddingRight: "var(--space-6)",
          paddingBottom: "var(--space-6)",
          paddingLeft: "var(--space-6)",
          background: "var(--surface-deep)",
        }}
      >
        <div
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-6)",
            maxWidth: 400,
            textAlign: "center",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p style={{ color: "#fca5a5", marginBottom: "var(--space-4)" }}>
            {agentErr || "لم يتم العثور على الحساب"}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            style={{
              padding: "10px 20px",
              background: "var(--brand-red)",
              border: "none",
              borderRadius: "var(--radius-md)",
              color: "#fff",
              fontFamily: "inherit",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  if (bookingAwaitingStatus) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "var(--space-4)",
          paddingRight: "var(--space-4)",
          paddingBottom: "var(--space-4)",
          paddingLeft: "var(--space-4)",
          background: "var(--surface-deep)",
        }}
      >
        <div
          className="fade-up"
          style={{
            width: "100%",
            maxWidth: 440,
            padding: "28px 24px",
            background: "var(--surface-card)",
            border: `1px solid var(--border-subtle)`,
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--card-shadow)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-md)",
              fontWeight: 700,
              marginBottom: "var(--space-2)",
              color: "var(--success)",
            }}
          >
            ✅ تم تسجيل الموعد
          </p>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              marginBottom: "var(--space-5)",
            }}
          >
            ما هي حالة الحجز؟
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              disabled={statusHoldLoading}
              onClick={handleChooseConfirmed}
              style={{
                flex: "1 1 160px",
                minHeight: 52,
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                border: "none",
                fontFamily: "inherit",
                fontSize: "var(--text-md)",
                fontWeight: 700,
                cursor: statusHoldLoading ? "not-allowed" : "pointer",
                opacity: statusHoldLoading ? 0.6 : 1,
                background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                color: "#fff",
                boxShadow: "0 4px 14px rgba(21,128,61,0.35)",
              }}
            >
              مؤكد ✓
            </button>
            <button
              type="button"
              disabled={statusHoldLoading}
              onClick={handleChooseOnHold}
              style={{
                flex: "1 1 160px",
                minHeight: 52,
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                border: "none",
                fontFamily: "inherit",
                fontSize: "var(--text-md)",
                fontWeight: 700,
                cursor: statusHoldLoading ? "wait" : "pointer",
                opacity: statusHoldLoading ? 0.85 : 1,
                background: "linear-gradient(135deg, #b45309 0%, #92400e 100%)",
                color: "#fff",
                boxShadow: "0 4px 14px rgba(180,83,9,0.35)",
              }}
            >
              {statusHoldLoading ? "…" : "معلق ⏸"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const ok = result.success === true;
    const snap = result.bookingConfirmation as BookingSuccessSnapshot | undefined;

    if (ok && snap) {
      const copyText = buildBookingShareText(snap);
      const onHold = snap.status === "ON-HOLD";
      const detailRow = (
        label: string,
        value: ReactNode,
        valueStyle?: CSSProperties
      ) => (
        <div
          key={label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 10,
            direction: "rtl",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "var(--text-primary)",
              textAlign: "left",
              flex: 1,
              ...valueStyle,
            }}
          >
            {value}
          </span>
        </div>
      );

      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,12,20,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            paddingTop: 20,
            paddingRight: 20,
            paddingBottom: 20,
            paddingLeft: 20,
          }}
        >
          <div
            className="fade-up"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--success-border)",
              borderRadius: "var(--radius-xl)",
              padding: 24,
              maxWidth: 420,
              width: "100%",
              margin: "0 auto",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                color: "var(--success)",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--success)",
                textAlign: "center",
                margin: "0 0 8px",
              }}
            >
              تم الحجز بنجاح
            </p>
            <div style={{ textAlign: "center", marginBottom: 4 }}>
              {onHold ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "var(--warn-bg)",
                    border: "1px solid var(--warn-border)",
                    color: "var(--warn)",
                  }}
                >
                  معلق ⏸
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "var(--success-bg)",
                    border: "1px solid var(--success-border)",
                    color: "var(--success)",
                  }}
                >
                  مؤكد ✓
                </span>
              )}
            </div>
            <div
              style={{
                height: 1,
                background: "var(--border-subtle)",
                margin: "16px 0",
              }}
            />
            <div>
              {detailRow("العميل", snap.customer_name)}
              {detailRow(
                "التليفون",
                snap.customer_phone_raw ?? snap.customer_phone,
                {
                  direction: "ltr",
                  unicodeBidi: "plaintext",
                }
              )}
              {detailRow("الفرع", snap.branchName)}
              {detailRow("الخدمة", snap.service)}
              {detailRow(
                "الموعد",
                formatBookingDateAr(snap.appointment_date)
              )}
              {snap.car_model
                ? detailRow("نوع المركبة", snap.car_model)
                : null}
              {snap.amount
                ? detailRow("الإيداع", `${snap.amount} ج.م`)
                : null}
              {snap.addons && snap.addons.length > 0
                ? detailRow(
                    "الإضافات",
                    addonNamesJoined(snap.addons),
                    {
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                    }
                  )
                : null}
              {snap.notes
                ? detailRow("ملاحظات", snap.notes, {
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                  })
                : null}
            </div>
            <div
              style={{
                height: 1,
                background: "var(--border-subtle)",
                margin: "16px 0",
              }}
            />
            <p
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                margin: "0 0 10px",
              }}
            >
              شارك تفاصيل الحجز مع العميل
            </p>
            <div
              style={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                fontSize: "12px",
                color: "var(--text-secondary)",
                lineHeight: 1.8,
                direction: "rtl",
                whiteSpace: "pre-wrap",
                marginBottom: 10,
              }}
            >
              {copyText}
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(copyText);
                  if (bookingCopyTimerRef.current) {
                    clearTimeout(bookingCopyTimerRef.current);
                  }
                  setBookingCopyDone(true);
                  bookingCopyTimerRef.current = setTimeout(() => {
                    setBookingCopyDone(false);
                    bookingCopyTimerRef.current = null;
                  }, 2000);
                } catch {
                  alert("تعذر النسخ");
                }
              }}
              style={{
                width: "100%",
                height: 40,
                background: "var(--surface-elevated)",
                border: bookingCopyDone
                  ? "1px solid var(--success-border)"
                  : "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                color: bookingCopyDone ? "var(--success)" : "var(--text-primary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "border-color 0.15s ease, color 0.15s ease",
              }}
            >
              {bookingCopyDone ? "✓ تم النسخ" : "📋 نسخ تفاصيل الحجز"}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                width: "100%",
                height: 44,
                marginTop: 10,
                background: "transparent",
                border: "1px solid var(--brand-red)",
                borderRadius: "var(--radius-md)",
                color: "var(--brand-red)",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--error-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              حجز جديد +
            </button>
          </div>
        </div>
      );
    }

    const dup = Boolean(result.isDuplicate);
    const duplicateType = result.duplicateType as string | undefined;
    const duplicateMessage =
      typeof result.duplicateMessage === "string"
        ? result.duplicateMessage
        : "";
    const existingDup = result.existingBooking as
      | {
          agentName: string;
          branchName: string;
          date: string;
          service: string;
        }
      | undefined;

    const dupRow = (label: string, value: string) => (
      <div
        key={label}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 8,
          direction: "rtl",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-primary)",
            textAlign: "left",
            flex: 1,
          }}
        >
          {value}
        </span>
      </div>
    );

    if (!ok && dup && existingDup && duplicateType === "same_agent") {
      return (
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "var(--space-4)",
            paddingRight: "var(--space-4)",
            paddingBottom: "var(--space-4)",
            paddingLeft: "var(--space-4)",
            background: "var(--surface-deep)",
          }}
        >
          <div
            className="fade-up"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: "28px 24px",
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-md)",
                fontWeight: 700,
                marginBottom: "var(--space-3)",
                color: "var(--warn)",
              }}
            >
              ⚠️ تنبيه — نفس العميل
            </p>
            <div
              style={{
                background: "var(--warn-bg)",
                border: "1px solid var(--warn-border)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                marginBottom: "var(--space-4)",
              }}
            >
              {dupRow("المندوب", existingDup.agentName)}
              {dupRow("الفرع", existingDup.branchName)}
              {dupRow("الخدمة", existingDup.service)}
              {dupRow(
                "التاريخ",
                existingDup.date
                  ? formatBookingDateAr(existingDup.date)
                  : ""
              )}
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.65,
                marginBottom: "var(--space-4)",
              }}
            >
              العميل ده عنده حجز تبعك بالفعل.
              <br />
              هل تريد الحجز لسيارة تانية لنفس العميل؟
            </p>
            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={() => void handleSubmit(true)}
                style={{
                  flex: "1 1 160px",
                  minHeight: 44,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                  cursor: "pointer",
                  background:
                    "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                  color: "#fff",
                  boxShadow: "0 4px 14px rgba(21,128,61,0.35)",
                }}
              >
                نعم، حجز سيارة تانية
              </button>
              <button
                type="button"
                onClick={reset}
                style={{
                  flex: "1 1 160px",
                  minHeight: 44,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  fontFamily: "inherit",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "var(--surface-elevated)",
                  color: "var(--text-secondary)",
                }}
              >
                لا، رجوع
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!ok && dup && existingDup && duplicateType !== "same_agent") {
      const adminNote =
        duplicateMessage || "تم تسجيل هذه المحاولة وإبلاغ الإدارة";
      return (
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "var(--space-4)",
            paddingRight: "var(--space-4)",
            paddingBottom: "var(--space-4)",
            paddingLeft: "var(--space-4)",
            background: "var(--surface-deep)",
          }}
        >
          <div
            className="fade-up"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: "28px 24px",
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <p
              style={{
                fontSize: "18px",
                fontWeight: 700,
                marginBottom: "var(--space-3)",
                color: "var(--warn)",
              }}
            >
              ⚠️ رقم محجوز مسبقاً
            </p>
            <div
              style={{
                background: "var(--warn-bg)",
                border: "1px solid var(--warn-border)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                marginBottom: "var(--space-4)",
              }}
            >
              {dupRow("المندوب", existingDup.agentName)}
              {dupRow("الفرع", existingDup.branchName)}
              {dupRow("الخدمة", existingDup.service)}
              {dupRow(
                "التاريخ",
                existingDup.date
                  ? formatBookingDateAr(existingDup.date)
                  : ""
              )}
            </div>
            <div
              style={{
                background: "var(--error-bg)",
                border: "1px solid var(--error-border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                fontSize: "12px",
                color: "#fca5a5",
                marginBottom: "var(--space-5)",
              }}
            >
              {adminNote}
            </div>
            <button
              type="button"
              onClick={reset}
              style={{
                width: "100%",
                padding: 11,
                background: "transparent",
                border: `1px solid var(--brand-red)`,
                borderRadius: "var(--radius-md)",
                color: "var(--brand-red)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              حجز جديد +
            </button>
          </div>
        </div>
      );
    }

    const cap = result.type === "capacity";
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "var(--space-4)",
          paddingRight: "var(--space-4)",
          paddingBottom: "var(--space-4)",
          paddingLeft: "var(--space-4)",
          background: "var(--surface-deep)",
        }}
      >
        <div
          className="fade-up"
          style={{
            width: "100%",
            maxWidth: 460,
            padding: "28px 24px",
            background: ok ? "var(--success-bg)" : "var(--error-bg)",
            border: `1px solid ${ok ? "var(--success-border)" : "var(--error-border)"}`,
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-md)",
              fontWeight: 700,
              marginBottom: "var(--space-2)",
              color: ok ? "var(--success)" : "#fca5a5",
            }}
          >
            {ok
              ? "تم الحجز بنجاح"
              : dup
                ? "حجز مكرر"
                : cap
                  ? "الفرع ممتلئ"
                  : "حصل خطأ"}
          </p>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.65,
              whiteSpace: "pre-line",
            }}
          >
            {String(result.message ?? "")}
          </p>
          {Array.isArray(result.alternatives) &&
            (result.alternatives as unknown[]).length > 0 && (
              <div
                style={{
                  marginTop: "var(--space-4)",
                  paddingTop: 14,
                  borderTop: `1px solid var(--error-border)`,
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: "var(--warn)",
                    marginBottom: "var(--space-2)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  أقرب مواعيد متاحة
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(result.alternatives as { date: string; available: number }[]).map(
                    (a) => (
                      <button
                        key={a.date}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, appointmentDate: a.date }));
                          setResult(null);
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "var(--surface-elevated)",
                          border: `1px solid var(--border-default)`,
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-secondary)",
                          fontSize: "var(--text-xs)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {a.date}{" "}
                        <span style={{ color: "var(--text-muted)" }}>
                          ({a.available} متاح)
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          <button
            type="button"
            onClick={reset}
            style={{
              width: "100%",
              marginTop: "var(--space-5)",
              padding: 11,
              background: "transparent",
              border: `1px solid var(--brand-red)`,
              borderRadius: "var(--radius-md)",
              color: "var(--brand-red)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + حجز جديد
          </button>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-4)",
          background: "var(--surface-deep)",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            border: "2.5px solid var(--border-default)",
            borderTopColor: "var(--brand-red)",
            borderRadius: "50%",
            animation: "spin 0.75s linear infinite",
          }}
        />
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          جاري التسجيل...
        </p>
      </div>
    );
  }

  const inp: React.CSSProperties = {
    width: "100%",
    height: 38,
    padding: "8px 12px",
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-primary)",
    fontSize: "var(--text-base)",
    fontFamily: "Cairo, inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    lineHeight: 1.35,
  };

  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: "6px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };

  const isMobile = layoutMode === "mobile";
  const hideCal = isMobile && mobileTab !== 0;
  const hideCap = isMobile && mobileTab !== 0;
  const hideBook = isMobile && mobileTab !== 1;
  const hideForm = isMobile && mobileTab !== 2;

  return (
    <div
      className="booking-page-root"
      data-layout={layoutMode}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--surface-deep)",
        overflow: "hidden",
        paddingBottom: isMobile ? "env(safe-area-inset-bottom, 0px)" : undefined,
      }}
    >
      <header
        className={`booking-header ${isMobile ? "booking-header--mobile" : ""}`}
        dir={isMobile ? "ltr" : "rtl"}
        style={{
          height: isMobile ? 48 : 56,
          flexShrink: 0,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr auto 1fr" : "auto 1fr auto",
          alignItems: "center",
          gap: isMobile ? 8 : 16,
          padding: isMobile ? "0 12px" : "0 24px",
          background: isMobile
            ? "rgba(8,12,20,0.95)"
            : "rgba(13,18,32,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-subtle)",
          zIndex: 50,
        }}
      >
        {isMobile ? (
          <>
            <button
              type="button"
              className="booking-header-logout"
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-secondary)",
                fontSize: 11,
                padding: "6px 8px",
                cursor: "pointer",
                fontFamily: "inherit",
                justifySelf: "start",
              }}
            >
              خروج
            </button>
            <div
              className="booking-header-logo"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt="SupaKoto"
                style={{
                  width: 80,
                  height: "auto",
                  objectFit: "contain",
                }}
              />
            </div>
            <span
              className="booking-header-user"
              dir="ltr"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
                justifySelf: "end",
              }}
            >
              {agent.name}
            </span>
          </>
        ) : (
          <>
            <div className="booking-header-logo" style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt="SupaKoto"
                style={{ width: 100, height: "auto", objectFit: "contain" }}
              />
            </div>
            <div
              className="booking-header-nav-desktop"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",
                minWidth: 0,
              }}
            >
              {isOps && (
                <Link href="/ops" style={headerGhostPill}>
                  لوحة العمليات
                </Link>
              )}
              {isAdmin && (
                <>
                  <Link href="/ops" style={headerGhostPill}>
                    لوحة العمليات
                  </Link>
                  <Link href="/admin" style={headerGhostPill}>
                    الإدارة
                  </Link>
                </>
              )}
            </div>
            <div
              dir="ltr"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
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
                  transition: "color 0.15s ease",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--brand-red)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                خروج
              </button>
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: "var(--border-default)",
                  flexShrink: 0,
                }}
              />
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
        className={`booking-unified-grid booking-tab-panel ${
          layoutMode === "desktop"
            ? "booking-grid-desktop"
            : layoutMode === "tablet"
              ? "booking-grid-tablet"
              : "booking-grid-mobile"
        }`}
        style={{
          height:
            layoutMode === "mobile"
              ? "calc(100vh - 48px - 60px - env(safe-area-inset-bottom, 0px))"
              : "calc(100vh - 56px)",
          direction: "ltr",
          ...(layoutMode === "desktop"
            ? {
                gridTemplateColumns: "480px 1fr 400px",
                overflow: "hidden",
              }
            : layoutMode === "tablet"
              ? { overflow: "hidden" }
              : {
                  overflow: "auto",
                  WebkitOverflowScrolling: "touch",
                }),
        }}
      >
        <div
          className="booking-cal-column"
          style={{
            direction: "rtl",
            display: hideCal ? "none" : "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: 12,
              boxShadow: "var(--card-shadow)",
              maxWidth: "100%",
              width: "100%",
              overflow: "hidden",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (cm === 11) {
                    setCy((y) => y + 1);
                    setCm(0);
                  } else setCm((m) => m + 1);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-red)";
                  e.currentTarget.style.color = "var(--brand-red)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                &#8249;
              </button>
              <span
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                }}
              >
                {AR_MONTHS[cm]} {cy}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (cm === 0) {
                    setCy((y) => y - 1);
                    setCm(11);
                  } else setCm((m) => m - 1);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-red)";
                  e.currentTarget.style.color = "var(--brand-red)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                &#8250;
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "2px",
                width: "100%",
                marginBottom: 4,
                flexShrink: 0,
              }}
            >
              {DAY_HEADS.map((h) => (
                <div
                  key={h}
                  style={{
                    textAlign: "center",
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    letterSpacing: "0.04em",
                    padding: "2px 0",
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "2px",
                width: "100%",
                flexShrink: 0,
              }}
            >
              {calendarGridSlots.map((d, i) => {
                if (!d)
                  return (
                    <div
                      key={`e-${i}`}
                      style={{
                        minWidth: 0,
                        minHeight: 0,
                        aspectRatio: "1",
                      }}
                    />
                  );
                const past = d < today;
                const isToday = d === today;
                const isSel = d === selectedDate;
                const isFri = new Date(d).getDay() === 5;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={past}
                    className="cal-day"
                    onClick={() => pickAppointmentDate(d)}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      minWidth: 0,
                      minHeight: 0,
                      position: "relative",
                      border:
                        isSel
                          ? "none"
                          : isToday
                            ? "1px solid rgba(191,30,46,0.4)"
                            : "1px solid transparent",
                      borderRadius: "var(--radius-sm)",
                      background: isSel ? "var(--brand-red)" : "transparent",
                      color: past
                        ? "var(--text-muted)"
                        : isSel
                          ? "#fff"
                          : isToday
                            ? "#fca5a5"
                            : isFri
                              ? "var(--text-muted)"
                              : "var(--text-secondary)",
                      fontSize: "12px",
                      fontWeight: isSel || isToday ? 700 : 400,
                      cursor: past ? "not-allowed" : "pointer",
                      padding: 0,
                      fontFamily: "inherit",
                      transition: "all 0.12s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      boxShadow: isSel
                        ? "0 2px 8px rgba(191,30,46,0.35)"
                        : "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <span>{new Date(d + "T00:00:00").getDate()}</span>
                  </button>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: "var(--space-3)",
                fontSize: "10px",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    border: "1px solid rgba(191,30,46,0.4)",
                    display: "inline-block",
                  }}
                />
                اليوم
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--brand-red)",
                    display: "inline-block",
                  }}
                />
                محدد
              </span>
            </div>
          </div>

          <div
            className="fade-up"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
              flexShrink: 0,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {!selectedDate ? (
              <div
                style={{
                  minHeight: 80,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  اختار يوم لعرض الملخص
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      letterSpacing: "0.06em",
                      fontWeight: 600,
                    }}
                  >
                    ملخص اليوم
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      background: "var(--surface-elevated)",
                      padding: "2px 10px",
                      borderRadius: 99,
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {formatBookingDateAr(selectedDate)}
                  </span>
                </div>
                <div
                  style={{
                    height: 1,
                    background: "var(--border-subtle)",
                    margin: "10px 0",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--success)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                    >
                      مؤكد
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--success)",
                    }}
                  >
                    {selectedDayActivity.confirmed}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--warn)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                    >
                      معلق
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--warn)",
                    }}
                  >
                    {selectedDayActivity.onHold}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--brand-red)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                    >
                      ملغي
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#fca5a5",
                    }}
                  >
                    {selectedDayActivity.cancelled}
                  </span>
                </div>
                <div
                  style={{
                    height: 1,
                    background: "var(--border-subtle)",
                    margin: "10px 0",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    الإجمالي
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {selectedDayActivity.confirmed +
                      selectedDayActivity.onHold +
                      selectedDayActivity.cancelled}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className="booking-middle-column"
          style={{
            direction: "rtl",
            display:
              hideCap && hideBook && !(
                isMobile &&
                mobileTab === 1 &&
                !selectedDate
              )
                ? "none"
                : "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
              boxShadow: "var(--card-shadow)",
              width: "100%",
              boxSizing: "border-box",
              ...(hideCap ? { display: "none" } : {}),
            }}
          >
            {!selectedDate ? (
              <div
                style={{
                  minHeight: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "var(--space-6)",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-muted)",
                    textAlign: "center",
                    lineHeight: 1.6,
                    maxWidth: 320,
                  }}
                >
                  اختار يوم من التقويم لعرض طاقة الفروع
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "var(--space-3)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    طاقة الفروع
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      background: "var(--surface-elevated)",
                      padding: "2px 10px",
                      borderRadius: 99,
                      border: `1px solid var(--border-default)`,
                    }}
                  >
                    {selectedDate}
                  </span>
                </div>
                {slotsLoading ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      paddingTop: 4,
                    }}
                  >
                    {CAL_BRANCH_NAMES.map((b) => (
                      <div
                        key={b}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "var(--radius-md)",
                          background: "var(--surface-elevated)",
                          border: `1px solid var(--border-subtle)`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "var(--text-sm)",
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {b}
                          </span>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--text-muted)",
                            }}
                          >
                            جاري...
                          </span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: "var(--surface-elevated)",
                            borderRadius: 99,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: "30%",
                              background: "var(--border-strong)",
                              borderRadius: 99,
                              animation: "barGrow 1s ease infinite alternate",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : slotsByBranch ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    {CAL_BRANCH_NAMES.map((b) => {
                      const s = slotsByBranch[b];
                      if (!s) return null;
                      const frozen = s.freezeBlocked === true;
                      const pct =
                        s.capacity > 0
                          ? Math.min((s.booked / s.capacity) * 100, 100)
                          : 0;
                      const full = s.full || frozen;
                      const low = !full && s.available <= 2;
                      const clr = full
                        ? "var(--brand-red)"
                        : low
                          ? "var(--warn)"
                          : "var(--success)";
                      const confirmed = s.confirmed ?? 0;
                      const onHold = s.onHold ?? 0;
                      const capTotal = s.capacity;
                      return (
                        <div
                          key={b}
                          style={{
                            position: "relative",
                            padding: "14px 16px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--surface-elevated)",
                            border: `1px solid var(--border-subtle)`,
                          }}
                        >
                          {frozen && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(8,12,20,0.75)",
                                borderRadius: "var(--radius-md)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 8,
                                textAlign: "center",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "var(--text-muted)",
                                  background: "var(--surface-card)",
                                  padding: "2px 8px",
                                  borderRadius: 99,
                                }}
                              >
                                مجمد
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-secondary)",
                                  lineHeight: 1.4,
                                }}
                              >
                                {s.freezeMessage ||
                                  "غير متاح"}
                              </span>
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 8,
                              gap: 12,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                              }}
                            >
                              {b}
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 99,
                                flexShrink: 0,
                                color: full
                                  ? "#fca5a5"
                                  : low
                                    ? "var(--warn)"
                                    : "var(--success)",
                                background: full
                                  ? "var(--error-bg)"
                                  : low
                                    ? "var(--warn-bg)"
                                    : "var(--success-bg)",
                                border: `1px solid ${full ? "var(--error-border)" : low ? "var(--warn-border)" : "var(--success-border)"}`,
                              }}
                            >
                              {full
                                ? "🔴 ممتلئ"
                                : low
                                  ? `🟡 ${s.available} متبقي`
                                  : `🟢 ${s.available} متاح`}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 4,
                              background: "var(--surface-elevated)",
                              borderRadius: 99,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: clr,
                                borderRadius: 99,
                                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ whiteSpace: "nowrap" }}>
                              📋 {confirmed} حجز مؤكد
                            </span>
                            <span style={{ margin: "0 6px", opacity: 0.5 }}>
                              •
                            </span>
                            <span style={{ whiteSpace: "nowrap" }}>
                              ⏸ {onHold} معلق
                            </span>
                            <span style={{ margin: "0 6px", opacity: 0.5 }}>
                              •
                            </span>
                            <span style={{ whiteSpace: "nowrap" }}>
                              {capTotal} إجمالي الطاقة
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-muted)",
                      textAlign: "center",
                      paddingTop: 8,
                    }}
                  >
                    تعذر تحميل البيانات
                  </p>
                )}
              </>
            )}
          </div>

              {isMobile && mobileTab === 1 && !selectedDate ? (
                <div
                  className="booking-mobile-pick-day"
                  style={{
                    background: "var(--surface-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-5)",
                    boxShadow: "var(--card-shadow)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-muted)",
                      marginBottom: 16,
                      lineHeight: 1.6,
                    }}
                  >
                    اختار يوم من التقويم
                  </p>
                  <button
                    type="button"
                    onClick={() => setMobileTab(0)}
                    style={{
                      minHeight: 44,
                      padding: "0 20px",
                      background: "var(--surface-elevated)",
                      border: `1px solid var(--border-default)`,
                      borderRadius: "var(--radius-md)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    اذهب للتقويم
                  </button>
                </div>
              ) : null}

              {selectedDate && (
              <div
                id="booking-day-panel"
                className="fade-up"
                style={{
                  animationDelay: "0.05s",
                  display: hideBook ? "none" : "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  width: "100%",
                  maxWidth: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {isMobile ? "مواعيدك" : "مواعيدك في هذا اليوم"}
                    </span>
                    {isMobile && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--text-secondary)",
                          background: "var(--surface-elevated)",
                          padding: "2px 10px",
                          borderRadius: 99,
                          border: `1px solid var(--border-default)`,
                        }}
                      >
                        {formatBookingDateAr(selectedDate)}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-secondary)",
                      background: "var(--surface-elevated)",
                      padding: "2px 8px",
                      borderRadius: 99,
                      border: `1px solid var(--border-default)`,
                    }}
                  >
                    {bookingsOnSelectedDate.length}
                  </span>
                </div>
                {bookingsOnSelectedDate.length === 0 ? (
                  <div
                    style={{
                      minHeight: 60,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 30, opacity: 0.35 }}>&#128197;</div>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-muted)",
                      }}
                    >
                      مفيش مواعيد ليك
                    </p>
                  </div>
                ) : (
                  bookingsOnSelectedDate.map((b) => {
                    const st = b.status.toUpperCase();
                    const showAct = b.appointment_date >= today;
                    const isEd = editingId === b.id;
                    return (
                      <div
                        key={b.id}
                        style={{
                          background: "var(--surface-elevated)",
                          border: `1px solid var(--border-subtle)`,
                          borderRadius: "var(--radius-md)",
                          padding: "var(--space-3)",
                          marginBottom: "var(--space-2)",
                        }}
                      >
                        {isEd ? (
                          <div>
                            <div
                              style={{
                                fontSize: "var(--text-xs)",
                                fontWeight: 700,
                                color: "var(--brand-red)",
                                marginBottom: "var(--space-3)",
                                letterSpacing: "0.08em",
                              }}
                            >
                              تعديل الحجز
                            </div>
                            <div
                              className="booking-form-grid-2"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "var(--space-3)",
                                marginBottom: "var(--space-3)",
                              }}
                            >
                              <div>
                                <label style={lbl}>اسم العميل *</label>
                                <input
                                  className="sk-input"
                                  style={inp}
                                  value={editForm.customerName}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      customerName: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <label style={lbl}>رقم التليفون *</label>
                                <input
                                  className={`sk-input${editMobileErr ? " error" : ""}`}
                                  style={{
                                    ...inp,
                                    direction: "ltr",
                                    textAlign: "left",
                                    borderColor: editMobileErr
                                      ? "var(--brand-red)"
                                      : undefined,
                                  }}
                                  type="tel"
                                  value={editForm.customerPhone}
                                  onChange={(e) => {
                                    setEditMobileErr(false);
                                    setEditForm((f) => ({
                                      ...f,
                                      customerPhone: e.target.value,
                                    }));
                                  }}
                                />
                              </div>
                              <div>
                                <label style={lbl}>الموعد *</label>
                                <input
                                  className="sk-input"
                                  style={inp}
                                  type="date"
                                  min={today}
                                  value={editForm.appointmentDate}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      appointmentDate: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <label style={lbl}>الخدمة *</label>
                                <select
                                  className="sk-input"
                                  style={inp}
                                  value={editForm.service}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      service: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">— اختار —</option>
                                  {SERVICES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div style={{ marginBottom: "var(--space-3)" }}>
                              <label style={lbl}>نوع المركبة *</label>
                              <input
                                className="sk-input"
                                style={inp}
                                value={editForm.carModel}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    carModel: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div
                              className="booking-form-grid-2"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "var(--space-3)",
                                marginBottom: "var(--space-3)",
                              }}
                            >
                              <div>
                                <label style={lbl}>المبلغ</label>
                                <input
                                  className="sk-input"
                                  style={inp}
                                  value={editForm.amount}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      amount: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                {editForm.appointmentDate !== editOriginalDate && (
                                  <div style={{ paddingTop: 22 }}>
                                    {editCapLoading ? (
                                      <span
                                        style={{
                                          fontSize: "var(--text-xs)",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        جاري...
                                      </span>
                                    ) : editCap ? (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          padding: "2px 8px",
                                          borderRadius: 99,
                                          color: editCap.freezeBlocked || editCap.full
                                            ? "#fca5a5"
                                            : "var(--success)",
                                          background: editCap.freezeBlocked || editCap.full
                                            ? "var(--error-bg)"
                                            : "var(--success-bg)",
                                          border: `1px solid ${editCap.freezeBlocked || editCap.full ? "var(--error-border)" : "var(--success-border)"}`,
                                        }}
                                      >
                                        {editCap.freezeBlocked
                                          ? "مجمد"
                                          : editCap.full
                                            ? "ممتلئ"
                                            : `${editCap.available} متاح`}
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ marginBottom: "var(--space-3)" }}>
                              <label style={lbl}>ملاحظات</label>
                              <textarea
                                className="sk-input"
                                style={{
                                  ...inp,
                                  minHeight: 72,
                                  resize: "vertical",
                                }}
                                value={editForm.notes}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    notes: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <button
                              type="button"
                              disabled={saveLoading || editCapBlocks}
                              onClick={saveEdit}
                              style={{
                                width: "100%",
                                padding: "10px",
                                background: "var(--brand-red)",
                                border: "none",
                                borderRadius: "var(--radius-md)",
                                color: "#fff",
                                fontWeight: 700,
                                cursor:
                                  saveLoading || editCapBlocks
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  saveLoading || editCapBlocks ? 0.5 : 1,
                                fontFamily: "inherit",
                                marginBottom: "var(--space-2)",
                              }}
                            >
                              {saveLoading ? "جاري..." : "حفظ"}
                            </button>
                            <button
                              type="button"
                              onClick={closeEdit}
                              style={{
                                width: "100%",
                                padding: 8,
                                background: "transparent",
                                border: `1px solid var(--border-default)`,
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              إلغاء التعديل
                            </button>
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: "var(--text-primary)",
                                }}
                              >
                                {b.customer_name}
                              </span>
                              <StatusMini status={st} />
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                marginBottom: 8,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px 10px",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  direction: "ltr",
                                  unicodeBidi: "plaintext",
                                  color: "var(--text-primary)",
                                }}
                              >
                                {b.customer_phone_raw ?? b.customer_phone}
                              </span>
                              <span style={{ color: "var(--border-strong)" }}>
                                |
                              </span>
                              <span style={{ color: "var(--text-secondary)" }}>
                                {b.car_model || "—"}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                marginBottom: 8,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <span style={{ color: "var(--text-secondary)" }}>
                                {b.branches?.name ??
                                  branches.find((br) => br.id === b.branch_id)
                                    ?.name ??
                                  "—"}
                              </span>
                              <span style={{ color: "var(--border-strong)" }}>
                                |
                              </span>
                              <span style={{ color: "var(--brand-red)" }}>
                                {b.service}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted)",
                                marginBottom: 8,
                              }}
                            >
                              {formatBookingDateAr(b.appointment_date)}
                            </div>
                            {b.amount && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-muted)",
                                  marginBottom: 8,
                                }}
                              >
                                الإيداع: {b.amount} ج.م
                              </div>
                            )}
                            {b.addons && b.addons.length > 0 && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  marginBottom: 8,
                                }}
                              >
                                الإضافات: {addonNamesJoined(b.addons)}
                              </div>
                            )}
                            {b.notes && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-secondary)",
                                  borderTop:
                                    "1px solid var(--border-subtle)",
                                  paddingTop: 8,
                                  marginTop: 4,
                                }}
                              >
                                {b.notes}
                              </div>
                            )}
                            <div
                              style={{
                                height: 1,
                                background: "var(--border-subtle)",
                                margin: "10px 0",
                              }}
                            />
                            <div
                              dir="ltr"
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 8,
                                width: "100%",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                }}
                              >
                                {showAct && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEdit(b)}
                                      style={btnPill()}
                                    >
                                      تعديل
                                    </button>
                                    {(st === "CONFIRMED" ||
                                      st === "ON-HOLD") && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              "متأكد من إلغاء الحجز؟"
                                            )
                                          )
                                            void patchStatus(
                                              b.id,
                                              "CANCELLED"
                                            );
                                        }}
                                        style={{
                                          ...btnPill(),
                                          background: "var(--error-bg)",
                                          border: `1px solid var(--error-border)`,
                                          color: "#fca5a5",
                                        }}
                                      >
                                        إلغاء
                                      </button>
                                    )}
                                    {(st === "CANCELLED" ||
                                      st === "ON-HOLD") && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void patchStatus(
                                            b.id,
                                            "CONFIRMED"
                                          )
                                        }
                                        style={{
                                          ...btnPill(),
                                          background:
                                            "var(--success-bg)",
                                          border: `1px solid var(--success-border)`,
                                          color: "var(--success)",
                                        }}
                                      >
                                        تأكيد
                                      </button>
                                    )}
                                    {st === "CONFIRMED" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void patchStatus(
                                            b.id,
                                            "ON-HOLD"
                                          )
                                        }
                                        style={{
                                          ...btnPill(),
                                          background: "var(--warn-bg)",
                                          border: `1px solid var(--warn-border)`,
                                          color: "var(--warn)",
                                        }}
                                      >
                                        ON-HOLD
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      buildBookingShareTextFromRow(
                                        b,
                                        branches
                                      )
                                    );
                                    if (dayListCopyTimerRef.current) {
                                      clearTimeout(
                                        dayListCopyTimerRef.current
                                      );
                                    }
                                    setDayListCopyBookingId(b.id);
                                    dayListCopyTimerRef.current =
                                      setTimeout(() => {
                                        setDayListCopyBookingId(null);
                                        dayListCopyTimerRef.current = null;
                                      }, 2000);
                                  } catch {
                                    alert("تعذر النسخ");
                                  }
                                }}
                                style={{
                                  padding: "4px 10px",
                                  border: `1px solid ${
                                    dayListCopyBookingId === b.id
                                      ? "var(--success-border)"
                                      : "var(--border-default)"
                                  }`,
                                  borderRadius: 99,
                                  background: "transparent",
                                  color:
                                    dayListCopyBookingId === b.id
                                      ? "var(--success)"
                                      : "var(--text-secondary)",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontFamily: "inherit",
                                }}
                              >
                                {dayListCopyBookingId === b.id
                                  ? "✓ تم"
                                  : "📋 نسخ"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
          )}
        </div>

        <div
          className="booking-form-column"
          style={{
            direction: "rtl",
            display: hideForm ? "none" : "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="booking-form-card"
            style={{
              background: "var(--surface-card)",
              border: `1px solid var(--border-subtle)`,
              borderRadius: "var(--radius-xl)",
              padding: 20,
              width: "100%",
              boxSizing: "border-box",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div
              style={{
                marginBottom: "var(--space-5)",
                paddingBottom: "var(--space-5)",
                borderBottom: `1px solid var(--border-subtle)`,
              }}
            >
              <h1
                className="booking-form-title"
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "var(--space-2)",
                }}
              >
                حجز موعد جديد
              </h1>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                }}
              >
                {salesRep}
                {todayLabel ? ` · ${todayLabel}` : ""}
              </p>
            </div>

            <SectionDivider>بيانات العميل</SectionDivider>
            <div
              className="booking-form-grid-2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
                marginBottom: 12,
              }}
            >
              <div>
                <label style={lbl}>
                  العميل <span style={{ color: "var(--brand-red)" }}>*</span>
                </label>
                <input
                  className="sk-input"
                  style={{
                    ...inp,
                  }}
                  placeholder="اسم العميل"
                  value={form.customer}
                  onChange={set("customer")}
                />
              </div>
              <div>
                <label style={lbl}>
                  Mobile{" "}
                  <span style={{ color: "var(--brand-red)" }}>*</span>
                </label>
                <input
                  className={`sk-input${mobileErr ? " error" : ""}`}
                  style={{
                    ...inp,
                    borderColor: mobileErr ? "var(--brand-red)" : undefined,
                  }}
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  value={form.mobile}
                  onChange={(e) => {
                    setMobileErr(false);
                    setForm((f) => ({ ...f, mobile: e.target.value }));
                  }}
                  onBlur={() =>
                    form.mobile &&
                    setMobileErr(
                      !/^[0-9]{10,11}$/.test(form.mobile.trim())
                    )
                  }
                />
                {mobileErr && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--brand-red)",
                      marginTop: 4,
                      display: "block",
                    }}
                  >
                    10 أو 11 رقم
                  </span>
                )}
              </div>
            </div>

            <SectionDivider>تفاصيل الحجز</SectionDivider>
            <div
              className="booking-form-grid-2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
                marginBottom: 12,
              }}
            >
              <div>
                <label style={lbl}>
                  الفرع{" "}
                  <span style={{ color: "var(--brand-red)" }}>*</span>
                </label>
                <select
                  className="sk-input"
                  style={inp}
                  value={form.branch}
                  onChange={set("branch")}
                >
                  <option value="">— اختار —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>
                  الموعد{" "}
                  <span style={{ color: "var(--brand-red)" }}>*</span>
                </label>
                <input
                  className="sk-input"
                  style={inp}
                  type="date"
                  min={today}
                  value={form.appointmentDate}
                  onChange={set("appointmentDate")}
                />
              </div>
            </div>

            {(capLoading || capState) && (
              <div style={{ marginBottom: "var(--space-3)" }}>
                {capLoading ? (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        border: `1.5px solid var(--border-default)`,
                        borderTopColor: "var(--brand-red)",
                        borderRadius: "50%",
                        animation: "spin 0.75s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    جاري التحقق...
                  </span>
                ) : (
                  capState && <CapBadge cap={capState} />
                )}
              </div>
            )}

            <SectionDivider>المركبة والخدمة</SectionDivider>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>
                نوع المركبة{" "}
                <span style={{ color: "var(--brand-red)" }}>*</span>
              </label>
              <input
                className="sk-input"
                style={inp}
                placeholder="e.g. Haval H6 2026"
                value={form.car}
                onChange={set("car")}
              />
            </div>
            <div
              className="booking-form-grid-2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
                marginBottom: 12,
              }}
            >
              <div>
                <label style={lbl}>
                  الخدمة{" "}
                  <span style={{ color: "var(--brand-red)" }}>*</span>
                </label>
                <select
                  className="sk-input"
                  style={inp}
                  value={form.service}
                  onChange={set("service")}
                >
                  <option value="">— اختار —</option>
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>الإيداع (EGP)</label>
                <input
                  className="sk-input"
                  style={inp}
                  placeholder="0"
                  value={form.amount}
                  onChange={set("amount")}
                />
              </div>
            </div>
            <div>
              <label style={lbl}>ملاحظات</label>
              <textarea
                className="sk-input"
                style={{
                  ...inp,
                  minHeight: 80,
                  height: "auto",
                  resize: "vertical",
                }}
                placeholder="أي ملاحظات..."
                value={form.notes}
                onChange={set("notes")}
              />
            </div>

            <SectionDivider>إضافات</SectionDivider>
            <div
              className="booking-addons-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                maxHeight: 200,
                overflowY: "auto",
                scrollbarWidth: "thin",
                padding: 2,
              }}
            >
              {ADDONS.map((addon) => {
                const sel = selectedAddons.includes(addon.id);
                return (
                  <div
                    key={addon.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedAddons((prev) =>
                        prev.includes(addon.id)
                          ? prev.filter((x) => x !== addon.id)
                          : [...prev, addon.id]
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedAddons((prev) =>
                          prev.includes(addon.id)
                            ? prev.filter((x) => x !== addon.id)
                            : [...prev, addon.id]
                        );
                      }
                    }}
                    dir="ltr"
                    style={{
                      background: sel
                        ? "rgba(191,30,46,0.08)"
                        : "var(--surface-input)",
                      border: `1px solid ${
                        sel
                          ? "rgba(191,30,46,0.35)"
                          : "var(--border-default)"
                      }`,
                      borderRadius: "var(--radius-sm)",
                      padding: "7px 10px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.12s",
                    }}
                  >
                    <span
                      dir="rtl"
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        textAlign: "right",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {addon.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: sel ? "var(--brand-red)" : "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {addon.price.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                );
              })}
            </div>
            {selectedAddons.length > 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "left",
                  marginTop: 6,
                  marginBottom: 0,
                }}
              >
                إجمالي الإضافات: {selectedAddonsTotal.toLocaleString("ar-EG")}{" "}
                ج.م
              </p>
            )}

            <div
              className="booking-form-submit-wrap"
              style={{ marginTop: "var(--space-5)" }}
            >
              {isFull ? (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "var(--error-bg)",
                    border: `1px solid var(--error-border)`,
                    borderRadius: "var(--radius-md)",
                    color: "#fca5a5",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {capState?.freezeBlocked
                    ? `⚠ ${capState?.freezeMessage || "غير متاح"}`
                    : "🔴 الفرع ممتلئ — غيّر التاريخ أو الفرع"}
                </div>
              ) : (
                <button
                  type="button"
                  className="booking-form-submit-btn"
                  onClick={() => void handleSubmit()}
                  style={{
                    width: "100%",
                    height: 44,
                    background:
                      "linear-gradient(135deg, #bf1e2e 0%, #8b1420 100%)",
                    boxShadow: "0 4px 16px rgba(191,30,46,0.3)",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    color: "#fff",
                    fontSize: "var(--text-md)",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition:
                      "transform 0.12s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 22px rgba(191,30,46,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(191,30,46,0.3)";
                  }}
                  onMouseDown={(e) =>
                    (e.currentTarget.style.transform = "scale(0.98)")
                  }
                  onMouseUp={(e) =>
                    (e.currentTarget.style.transform = "translateY(-1px)")
                  }
                >
                  تسجيل الموعد
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobile && (
        <nav className="bottom-tab-bar bottom-tab-bar-entrance">
          {(
            [
              { id: 0, icon: "📅", label: "التقويم" },
              { id: 1, icon: "📋", label: "مواعيدي" },
              { id: 2, icon: "➕", label: "حجز جديد" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bottom-tab-btn${mobileTab === t.id ? " bottom-tab-btn--active" : ""}`}
              onClick={() => setMobileTab(t.id)}
            >
              {mobileTab === t.id && (
                <span className="bottom-tab-indicator" aria-hidden />
              )}
              <span className="bottom-tab-icon">{t.icon}</span>
              <span className="bottom-tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function btnPill(): React.CSSProperties {
  return {
    height: 26,
    padding: "0 10px",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: "inherit",
    borderRadius: 99,
    border: `1px solid var(--border-default)`,
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };
}

function StatusMini({ status }: { status: string }) {
  const s = status;
  if (s === "CONFIRMED")
    return (
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 99,
          background: "var(--success-bg)",
          border: `1px solid var(--success-border)`,
          color: "var(--success)",
        }}
      >
        مؤكد
      </span>
    );
  if (s === "CANCELLED")
    return (
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 99,
          background: "rgba(100,116,139,0.12)",
          border: `1px solid var(--border-default)`,
          color: "var(--text-muted)",
        }}
      >
        ملغي
      </span>
    );
  if (s === "ON-HOLD")
    return (
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 99,
          background: "var(--warn-bg)",
          border: `1px solid var(--warn-border)`,
          color: "var(--warn)",
        }}
      >
        ON-HOLD
      </span>
    );
  return (
    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
      {status}
    </span>
  );
}

function CapBadge({ cap }: { cap: CapState }) {
  const full = cap.full;
  const frozen = cap.freezeBlocked === true;
  const low = !full && !frozen && cap.available <= 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          width: "fit-content",
          padding: "4px 10px",
          borderRadius: 99,
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          background: full
            ? "var(--error-bg)"
            : low
              ? "var(--warn-bg)"
              : "var(--success-bg)",
          border: `1px solid ${full ? "var(--error-border)" : low ? "var(--warn-border)" : "var(--success-border)"}`,
          color: full
            ? "#fca5a5"
            : low
              ? "var(--warn)"
              : "var(--success)",
        }}
      >
        {full
          ? `ممتلئ ${cap.booked}/${cap.capacity}`
          : low
            ? `متبقي ${cap.available} (${cap.booked}/${cap.capacity})`
            : `متاح ${cap.available} (${cap.booked}/${cap.capacity})`}
      </span>
      {frozen && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "#fca5a5",
            lineHeight: 1.5,
          }}
        >
          {cap.freezeMessage || "مجمد"}
        </span>
      )}
    </div>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        margin: "12px 0 10px",
        fontSize: "8px",
        fontWeight: 700,
        color: "var(--brand-red)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
      <span
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(to left, transparent, var(--border-default))`,
        }}
      />
    </div>
  );
}

export default function BookingPage() {
  return <BookingPageInner />;
}
