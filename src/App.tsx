import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, CarFront, Check, ChevronDown, ChevronRight, CircleHelp,
  CreditCard, Download, Ellipsis, FileJson, FileSpreadsheet, Film, Filter, HeartPulse, Home,
  LayoutDashboard, Menu, Moon, MoreHorizontal, Pencil, Plus, Search, Settings,
  ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Tag, Trash2, TrendingDown,
  TrendingUp, Utensils, Wallet, X, type LucideIcon,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type TxType = "expense" | "income";
type Category = "Food & dining" | "Groceries" | "Transport" | "Shopping" | "Bills" | "Health" | "Entertainment" | "Salary" | "Freelance" | "Other";
type Payment = "Card" | "Cash" | "Bank transfer" | "Mobile wallet";
type Transaction = { id: string; type: TxType; amount: number; category: Category; date: string; payment: Payment; note: string };
type Budget = { category: Category; limit: number };
type Currency = "MMK" | "USD" | "THB" | "SGD";
type Page = "Overview" | "Transactions" | "Budgets" | "Settings";

const STORAGE_KEY = "moneta-finance-v1";
const categories: { name: Category; icon: LucideIcon; color: string; tint: string }[] = [
  { name: "Food & dining", icon: Utensils, color: "#f59e0b", tint: "amber" },
  { name: "Groceries", icon: ShoppingBag, color: "#84cc16", tint: "green" },
  { name: "Transport", icon: CarFront, color: "#6366f1", tint: "indigo" },
  { name: "Shopping", icon: ShoppingBag, color: "#ec4899", tint: "pink" },
  { name: "Bills", icon: Home, color: "#0ea5e9", tint: "sky" },
  { name: "Health", icon: HeartPulse, color: "#10b981", tint: "green" },
  { name: "Entertainment", icon: Film, color: "#8b5cf6", tint: "violet" },
  { name: "Salary", icon: BriefcaseBusiness, color: "#10b981", tint: "green" },
  { name: "Freelance", icon: Sparkles, color: "#14b8a6", tint: "teal" },
  { name: "Other", icon: Tag, color: "#64748b", tint: "slate" },
];
type SpendingCategory = (typeof categories)[number] & { value: number };
const navItems: { label: Page; icon: LucideIcon }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Transactions", icon: ArrowDownRight },
  { label: "Budgets", icon: SlidersHorizontal },
  { label: "Settings", icon: Settings },
];
const chartColors = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#0ea5e9", "#ec4899"];

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date);
}
function makeDemoTransactions(): Transaction[] {
  const rows: [TxType, number, Category, number, Payment, string][] = [
    ["expense", 5000, "Food & dining", 0, "Card", "Coffee & croissant"],
    ["income", 800000, "Salary", 1, "Bank transfer", "Monthly salary"],
    ["expense", 7000, "Transport", 1, "Mobile wallet", "Ride to the office"],
    ["expense", 45000, "Shopping", 2, "Card", "A little something"],
    ["expense", 12000, "Food & dining", 3, "Card", "Lunch with Mia"],
    ["income", 120000, "Freelance", 4, "Bank transfer", "Brand identity project"],
    ["expense", 68000, "Bills", 5, "Bank transfer", "Internet & utilities"],
    ["expense", 15000, "Health", 6, "Card", "Pharmacy"],
    ["expense", 25000, "Entertainment", 8, "Mobile wallet", "Friday movie night"],
    ["expense", 8000, "Food & dining", 10, "Cash", "Market breakfast"],
    ["expense", 22000, "Transport", 12, "Card", "Weekly metro pass"],
    ["income", 800000, "Salary", 34, "Bank transfer", "Monthly salary"],
    ["expense", 150000, "Groceries", 2, "Card", "Weekly groceries"],
    ["expense", 68000, "Bills", 42, "Bank transfer", "Internet & utilities"],
    ["income", 800000, "Salary", 64, "Bank transfer", "Monthly salary"],
    ["expense", 45000, "Food & dining", 70, "Card", "Dinner with friends"],
    ["expense", 32000, "Entertainment", 98, "Card", "Concert tickets"],
    ["income", 800000, "Salary", 124, "Bank transfer", "Monthly salary"],
    ["expense", 35000, "Food & dining", 130, "Card", "Dinner out"],
    ["income", 800000, "Salary", 154, "Bank transfer", "Monthly salary"],
    ["expense", 30000, "Transport", 160, "Mobile wallet", "Monthly transit"],
    ["income", 800000, "Salary", 184, "Bank transfer", "Monthly salary"],
    ["expense", 85000, "Shopping", 194, "Card", "Home essentials"],
  ];
  return rows.map(([type, amount, category, age, payment, note], i) => ({
    id: `demo-${i}-${age}`, type, amount, category, date: daysAgo(age), payment, note,
  }));
}
const defaultBudgets: Budget[] = [
  { category: "Food & dining", limit: 120000 }, { category: "Groceries", limit: 350000 },
  { category: "Transport", limit: 100000 }, { category: "Shopping", limit: 250000 },
  { category: "Bills", limit: 180000 }, { category: "Entertainment", limit: 120000 },
  { category: "Health", limit: 80000 },
];
const legacyBudgets: Budget[] = [
  { category: "Food & dining", limit: 450 }, { category: "Transport", limit: 180 },
  { category: "Shopping", limit: 300 }, { category: "Bills", limit: 220 },
  { category: "Entertainment", limit: 150 }, { category: "Health", limit: 120 },
];
function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== "object") return false;
  const tx = value as Partial<Transaction>;
  const parsedDate = typeof tx.date === "string" ? new Date(`${tx.date}T12:00:00`) : null;
  return typeof tx.id === "string" && (tx.type === "income" || tx.type === "expense")
    && typeof tx.amount === "number" && Number.isFinite(tx.amount) && tx.amount > 0
    && typeof tx.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
    && parsedDate !== null && localDate(parsedDate) === tx.date
    && categories.some((item) => item.name === tx.category)
    && ["Card", "Cash", "Bank transfer", "Mobile wallet"].includes(tx.payment ?? "")
    && typeof tx.note === "string";
}
function isBudget(value: unknown): value is Budget {
  if (!value || typeof value !== "object") return false;
  const budget = value as Partial<Budget>;
  return categories.some((item) => item.name === budget.category)
    && typeof budget.limit === "number" && Number.isFinite(budget.limit) && budget.limit > 0;
}
function readSaved() {
  const defaults = { transactions: makeDemoTransactions(), budgets: defaultBudgets, currency: "MMK" as Currency, dark: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("Saved data is not an object");
    const saved = parsed as Partial<typeof defaults> & { schemaVersion?: number };
    if (saved.transactions !== undefined && (!Array.isArray(saved.transactions) || !saved.transactions.every(isTransaction))) throw new Error("Saved transactions are invalid");
    if (saved.budgets !== undefined && (!Array.isArray(saved.budgets) || !saved.budgets.every(isBudget))) throw new Error("Saved budgets are invalid");
    const demoTransactions = makeDemoTransactions();
    const demoByIndex = new Map(demoTransactions.map((transaction) => [transaction.id.match(/^demo-(\d+)-/)?.[1], transaction]));
    const transactions = (saved.transactions ?? defaults.transactions).map((transaction) => {
      const demoIndex = transaction.id.match(/^demo-(\d+)-/)?.[1];
      return saved.schemaVersion === 2 || demoIndex === undefined ? transaction : demoByIndex.get(demoIndex) ?? transaction;
    });
    const storedBudgets = saved.budgets ?? defaults.budgets;
    const hasLegacyDemoSet = (saved.transactions?.length ?? 0) > 0
      && saved.transactions?.every((transaction) => transaction.id.startsWith("demo-")) === true;
    const shouldMigrateLegacyDefault = saved.schemaVersion !== 2 && saved.currency === "USD"
      && (hasLegacyDemoSet || saved.transactions?.length === 0);
    const budgetsAreLegacyDefaults = storedBudgets.length === legacyBudgets.length
      && legacyBudgets.every((legacy) => storedBudgets.some((budget) => budget.category === legacy.category && budget.limit === legacy.limit));
    const migratedBudgets = hasLegacyDemoSet && shouldMigrateLegacyDefault && storedBudgets.length > 0
      ? defaultBudgets.map((nextBudget) => {
        const oldBudget = storedBudgets.find((budget) => budget.category === nextBudget.category);
        const oldDefault = legacyBudgets.find((budget) => budget.category === nextBudget.category);
        return oldBudget && oldDefault
          ? { ...nextBudget, limit: Math.round(nextBudget.limit * oldBudget.limit / oldDefault.limit) }
          : nextBudget;
      })
      : budgetsAreLegacyDefaults && saved.schemaVersion !== 2 ? defaultBudgets : storedBudgets;
    return {
      transactions,
      budgets: migratedBudgets,
      currency: shouldMigrateLegacyDefault
        ? "MMK"
        : ["MMK", "USD", "THB", "SGD"].includes(saved.currency ?? "") ? saved.currency as Currency : defaults.currency,
      dark: typeof saved.dark === "boolean" ? saved.dark : defaults.dark,
    };
  } catch (error) {
    console.warn("Could not read saved Moneta data; starting with demo data.", error);
    return defaults;
  }
}
function categoryInfo(category: Category) {
  return categories.find((item) => item.name === category) ?? categories[categories.length - 1];
}
function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}
function formatMoney(value: number, currency: Currency) {
  const roundedValue = Math.round(value);
  if (currency === "MMK") return `${formatWholeNumber(roundedValue)} Ks`;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(roundedValue);
}
function prettyDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  const today = localDate();
  if (date === today) return "Today";
  if (date === daysAgo(1)) return "Yesterday";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parsed);
}
function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(date);
}
function txIsCurrentMonth(tx: Transaction) {
  const date = new Date(`${tx.date}T12:00:00`);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}
function txIsInPeriod(tx: Transaction, period: string) {
  const bounds = periodBounds(period);
  if (!bounds) return true;
  const date = new Date(`${tx.date}T12:00:00`);
  return date >= bounds.start && date < bounds.end;
}
function periodBounds(period: string, previous = false) {
  const now = new Date();
  if (period === "All time") return null;
  if (period === "Last 30 days") {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (previous ? -29 : 1));
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 30);
    return { start, end };
  }
  const monthOffset = period === "This month" ? (previous ? -1 : 0) : (previous ? -2 : -1);
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
}
function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0%" : "New";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change > 0 ? "+" : ""}${Math.round(change)}%`;
}

function App() {
  const saved = useMemo(readSaved, []);
  const [transactions, setTransactions] = useState<Transaction[]>(saved.transactions);
  const [budgets, setBudgets] = useState<Budget[]>(saved.budgets);
  const [currency, setCurrency] = useState<Currency>(saved.currency);
  const [dark, setDark] = useState(saved.dark);
  const [page, setPage] = useState<Page>("Overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [paymentFilter, setPaymentFilter] = useState("All methods");
  const [period, setPeriod] = useState("This month");
  const [chartPeriod, setChartPeriod] = useState<"6 months" | "12 months">("6 months");
  const [budgetEditing, setBudgetEditing] = useState<Category | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, transactions, budgets, currency, dark }));
    } catch (error) {
      console.error("Could not save Moneta data to local storage.", error);
      notify("Could not save changes on this device");
    }
  }, [transactions, budgets, currency, dark]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }
  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(tx: Transaction) { setEditing(tx); setModalOpen(true); }
  function saveTransaction(tx: Transaction) {
    setTransactions((current) => editing
      ? current.map((item) => item.id === editing.id ? tx : item)
      : [tx, ...current]);
    notify(editing ? "Transaction updated" : "Transaction added");
    setModalOpen(false);
  }
  function deleteTransaction(tx: Transaction) {
    if (!window.confirm(`Delete "${tx.note || tx.category}"? This can't be undone.`)) return;
    setTransactions((current) => current.filter((item) => item.id !== tx.id));
    notify("Transaction deleted");
  }
  function loadDemo() {
    setTransactions(makeDemoTransactions());
    setBudgets(defaultBudgets);
    notify("Demo data loaded");
  }
  function clearData() {
    if (!window.confirm("Clear all transactions and budgets? This can't be undone.")) return;
    setTransactions([]);
    setBudgets([]);
    notify("Your data has been cleared");
  }
  function saveBudget(category: Category) {
    const amount = Number(budgetDraft.replaceAll(",", ""));
    if (!Number.isSafeInteger(amount) || amount <= 0) { notify("Enter a whole-number budget greater than zero"); return; }
    setBudgets((items) => items.some((item) => item.category === category)
      ? items.map((item) => item.category === category ? { ...item, limit: amount } : item)
      : [...items, { category, limit: amount }]);
    setBudgetEditing(null);
    notify("Budget updated");
  }
  function downloadFile(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = name; link.click();
    URL.revokeObjectURL(url);
  }
  function exportJSON() {
    downloadFile("moneta-backup.json", JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), transactions, budgets, currency, dark }, null, 2), "application/json");
    notify("Backup downloaded");
  }
  function exportCSV() {
    const escape = (value: string | number) => {
      const safe = String(value).replace(/^[=+\-@]/, "'$&");
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [["Date", "Type", "Category", "Amount", "Payment method", "Note"], ...transactions.map((tx) =>
      [tx.date, tx.type, tx.category, tx.amount, tx.payment, tx.note])];
    downloadFile("moneta-transactions.csv", rows.map((row) => row.map(escape).join(",")).join("\n"), "text/csv;charset=utf-8");
    notify("Transactions exported as CSV");
  }
  async function importJSON(file?: File) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { transactions?: unknown }).transactions)) {
        throw new Error("Backup must contain a transactions array");
      }
      const backup = parsed as { transactions: Transaction[]; budgets?: Budget[]; currency?: Currency; dark?: boolean };
      if (!backup.transactions.every(isTransaction)) {
        throw new Error("Backup contains an invalid transaction");
      }
      if (backup.budgets !== undefined && (!Array.isArray(backup.budgets) || !backup.budgets.every(isBudget))) {
        throw new Error("Backup contains an invalid budget");
      }
      if (backup.currency !== undefined && !["MMK", "USD", "THB", "SGD"].includes(backup.currency)) {
        throw new Error("Backup contains an unsupported currency");
      }
      if (backup.dark !== undefined && typeof backup.dark !== "boolean") {
        throw new Error("Backup contains an invalid appearance setting");
      }
      setTransactions(backup.transactions);
      if (backup.budgets) setBudgets(backup.budgets);
      if (backup.currency) setCurrency(backup.currency);
      if (backup.dark !== undefined) setDark(backup.dark);
      notify("Backup imported successfully");
    } catch (error) {
      console.error("Could not import Moneta backup.", error);
      notify(error instanceof Error ? error.message : "Could not import backup");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  const currentMonthTransactions = useMemo(() => transactions.filter(txIsCurrentMonth), [transactions]);
  const overviewTransactions = useMemo(() => transactions.filter((tx) => txIsInPeriod(tx, period)), [transactions, period]);
  const previousPeriodTransactions = useMemo(() => {
    const bounds = periodBounds(period, true);
    if (!bounds) return [];
    return transactions.filter((tx) => {
      const date = new Date(`${tx.date}T12:00:00`);
      return date >= bounds.start && date < bounds.end;
    });
  }, [transactions, period]);
  const monthIncome = overviewTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const monthExpense = overviewTransactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
  const previousIncome = previousPeriodTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const previousExpense = previousPeriodTransactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
  const previousSavingsRate = previousIncome > 0 ? ((previousIncome - previousExpense) / previousIncome) * 100 : 0;
  const totalBalance = transactions.reduce((sum, tx) => sum + (tx.type === "income" ? tx.amount : -tx.amount), 0);
  const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
  const savingsRateChange = Math.round(savingsRate - previousSavingsRate);
  const categorySpending = categories.filter((item) => !["Salary", "Freelance"].includes(item.name)).map((item) => ({
    ...item, value: overviewTransactions.filter((tx) => tx.type === "expense" && tx.category === item.name).reduce((sum, tx) => sum + tx.amount, 0),
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);

  const trendData = useMemo(() => {
    const count = chartPeriod === "6 months" ? 6 : 12;
    const now = new Date();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (count - i - 1), 1);
      const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const month = transactions.filter((tx) => tx.date.startsWith(prefix));
      return {
        month: monthLabel(date),
        income: month.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0),
        expense: month.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0),
      };
    });
  }, [transactions, chartPeriod]);
  const filteredTransactions = useMemo(() => {
    return [...transactions].filter((tx) => {
      const matchesPeriod = txIsInPeriod(tx, period);
      const query = search.trim().toLowerCase();
      const matchesQuery = !query || `${tx.note} ${tx.category} ${tx.payment}`.toLowerCase().includes(query);
      return matchesPeriod && matchesQuery && (typeFilter === "All types" || tx.type === typeFilter.toLowerCase())
        && (categoryFilter === "All categories" || tx.category === categoryFilter)
        && (paymentFilter === "All methods" || tx.payment === paymentFilter);
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, period, search, typeFilter, categoryFilter, paymentFilter]);

  const pageDescription: Record<Page, string> = {
    Overview: "Here's what's happening with your money.",
    Transactions: "Every little thing, all in one place.",
    Budgets: "A plan for the things you care about.",
    Settings: "Make Moneta feel a little more like you.",
  };

  return (
    <div className={`app-shell${dark ? " dark" : ""}`}>
      <aside className={`sidebar${mobileMenu ? " sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("Overview"); }}>
          <span className="brand-mark"><Wallet size={19} strokeWidth={2.2} /></span>
          <span className="brand-name">moneta<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link${page === label ? " active" : ""}`} onClick={() => { setPage(label); setMobileMenu(false); }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {label === "Transactions" && <span className="nav-count">{transactions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><Sparkles size={16} /></div>
            <p className="tip-title">Small steps, big picture.</p>
            <p className="tip-copy">You’re doing great. Keep an eye on your spending this month.</p>
            <button onClick={() => setPage("Budgets")}>View budgets <ArrowRight size={14} /></button>
          </div>
          <button className="profile-button" onClick={() => setPage("Settings")}>
            <span className="avatar">A</span>
            <span className="profile-text"><strong>Alex Morgan</strong><small>Personal account</small></span>
            <MoreHorizontal size={19} className="profile-more" />
          </button>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{page}</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button theme-button" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify("You're all caught up")}><Bell size={18} /><i /></button>
            <button className="topbar-avatar" onClick={() => setPage("Settings")} aria-label="Open account settings">A</button>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="live-dot" /> YOUR MONEY, IN FOCUS</div>
              <h1>{page === "Overview" ? "Good morning, Alex" : page}</h1>
              <p>{pageDescription[page]}</p>
            </div>
            <div className="heading-actions">
              {page === "Overview" && <label className="date-select"><CalendarDays size={16} /><select aria-label="Dashboard date range" value={period} onChange={(event) => setPeriod(event.target.value)}>{["This month", "Last month", "Last 30 days", "All time"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>}
              <button className="primary-button add-button" onClick={openAdd}><Plus size={17} /> <span>Add transaction</span></button>
            </div>
          </div>

          {page === "Overview" && <Overview
            currency={currency} totalBalance={totalBalance} monthIncome={monthIncome} monthExpense={monthExpense}
            previousIncome={previousIncome} previousExpense={previousExpense} savingsRateChange={savingsRateChange} period={period}
            savingsRate={savingsRate} transactions={transactions} categorySpending={categorySpending}
            trendData={trendData} chartPeriod={chartPeriod} setChartPeriod={setChartPeriod}
            onAdd={openAdd} onEdit={openEdit} onViewTransactions={() => setPage("Transactions")}
          />}
          {page === "Transactions" && <TransactionsView
            transactions={filteredTransactions} currency={currency} search={search} setSearch={setSearch}
            typeFilter={typeFilter} setTypeFilter={setTypeFilter} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} period={period} setPeriod={setPeriod}
            onEdit={openEdit} onDelete={deleteTransaction} onExport={exportCSV}
          />}
          {page === "Budgets" && <BudgetsView
            transactions={currentMonthTransactions} budgets={budgets} currency={currency}
            editing={budgetEditing} draft={budgetDraft} setDraft={setBudgetDraft}
            startEdit={(category, limit) => { setBudgetEditing(category); setBudgetDraft(limit ? formatWholeNumber(limit) : ""); }}
            save={saveBudget} cancel={() => setBudgetEditing(null)}
          />}
          {page === "Settings" && <SettingsView
            currency={currency} setCurrency={setCurrency} dark={dark} setDark={setDark}
            onCSV={exportCSV} onJSON={exportJSON} onImport={() => importRef.current?.click()}
            onDemo={loadDemo} onClear={clearData} transactionCount={transactions.length}
          />}
        </div>
        <footer className="footer"><span>Made for a clearer kind of money.</span><span><ShieldCheck size={14} /> Your data stays on this device</span></footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ label, icon: Icon }) => <button key={label} className={page === label ? "selected" : ""} onClick={() => setPage(label)} aria-label={label}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      <button className="fab" onClick={openAdd} aria-label="Add transaction"><Plus size={24} /></button>
      <input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => void importJSON(event.target.files?.[0])} />
      {modalOpen && <TransactionModal
        transaction={editing} currency={currency} onClose={() => setModalOpen(false)} onSave={saveTransaction}
      />}
      {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}</div>}
    </div>
  );
}

function Overview(props: {
  currency: Currency; totalBalance: number; monthIncome: number; monthExpense: number; savingsRate: number;
  previousIncome: number; previousExpense: number; savingsRateChange: number;
  transactions: Transaction[]; categorySpending: SpendingCategory[]; period: string; trendData: { month: string; income: number; expense: number }[];
  chartPeriod: "6 months" | "12 months"; setChartPeriod: (period: "6 months" | "12 months") => void;
  onAdd: () => void; onEdit: (tx: Transaction) => void; onViewTransactions: () => void;
}) {
  const { currency, totalBalance, monthIncome, monthExpense, savingsRate, previousIncome, previousExpense, savingsRateChange, transactions, categorySpending, period, trendData, chartPeriod, setChartPeriod } = props;
  const savings = monthIncome - monthExpense;
  const kpis = [
    { title: "Total balance", amount: totalBalance, icon: Wallet, tone: "purple", change: "Across all time", delta: "Your big picture" },
    { title: period === "This month" ? "Monthly income" : "Income", amount: monthIncome, icon: ArrowDownLeft, tone: "green", change: period === "All time" ? "All time" : percentChange(monthIncome, previousIncome), delta: period === "All time" ? "Money coming in" : "vs. prior period" },
    { title: period === "This month" ? "Monthly expenses" : "Expenses", amount: monthExpense, icon: ArrowUpRight, tone: "rose", change: period === "All time" ? "All time" : percentChange(monthExpense, previousExpense), delta: period === "All time" ? "Money going out" : "vs. prior period" },
    { title: "Savings rate", amount: savingsRate, icon: Sparkles, tone: "amber", change: period === "All time" ? "All time" : `${savingsRateChange > 0 ? "+" : ""}${savingsRateChange} pp`, delta: period === "All time" ? "A little adds up" : "vs. prior period", percent: true },
  ];
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const totalSpending = categorySpending.reduce((sum, item) => sum + item.value, 0);
  return (
    <>
      <section className="kpi-grid">
        {kpis.map(({ title, amount, icon: Icon, tone, change, delta, percent }) => (
          <article className={`kpi-card tone-${tone}`} key={title}>
            <div className="kpi-top"><span className="kpi-icon"><Icon size={18} /></span><button aria-label={`More about ${title}`} className="kpi-more"><Ellipsis size={19} /></button></div>
            <div className="kpi-label">{title}</div>
            <div className="kpi-value">{percent ? `${amount.toFixed(0)}%` : formatMoney(amount, currency)}</div>
            <div className="kpi-foot"><span className={change === "All time" || change === "New" ? "trend-neutral" : tone === "rose" ? change.startsWith("-") ? "trend-up" : "trend-down" : change.startsWith("-") ? "trend-down" : "trend-up"}>{change.startsWith("-") ? <TrendingDown size={13} /> : change === "All time" || change === "New" ? <Sparkles size={12} /> : <TrendingUp size={13} />} {change}</span><span>{delta}</span></div>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="card cashflow-card">
          <div className="card-header">
            <div><h2>Cash flow</h2><p>Your income and expenses, over time.</p></div>
            <div className="segmented-control" aria-label="Cash flow chart period">
              {(["6 months", "12 months"] as const).map((range) => <button key={range} className={chartPeriod === range ? "chosen" : ""} onClick={() => setChartPeriod(range)}>{range}</button>)}
            </div>
          </div>
          <div className="chart-summary">
            <div><span className="chart-summary-label"><i className="legend-dot income-dot" /> Income</span><strong>{formatMoney(monthIncome, currency)}</strong></div>
            <div><span className="chart-summary-label"><i className="legend-dot expense-dot" /> Expenses</span><strong>{formatMoney(monthExpense, currency)}</strong></div>
            <div className="net-summary"><span className="chart-summary-label"><i className="legend-dot net-dot" /> Net savings</span><strong className={savings >= 0 ? "text-green" : "text-rose"}>{formatMoney(savings, currency)}</strong></div>
          </div>
          <div className="cashflow-chart">
            {trendData.some((item) => item.income || item.expense) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.17} /><stop offset="95%" stopColor="#10b981" stopOpacity={0.005} /></linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8" stopOpacity={0.2} /><stop offset="95%" stopColor="#818cf8" stopOpacity={0.005} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(value: number) => formatMoney(value, currency)} />
                  <Tooltip content={<CashflowTooltip currency={currency} />} />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} fill="url(#incomeGradient)" activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="expense" stroke="#818cf8" strokeWidth={2.5} fill="url(#expenseGradient)" activeDot={{ r: 5, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={TrendingUp} title="Your cash flow starts here" copy="Add a few transactions and your monthly story will take shape." />}
          </div>
        </article>

        <article className="card category-card">
          <div className="card-header"><div><h2>Spending breakdown</h2><p>Where your money goes.</p></div><button className="soft-icon" aria-label="Spending breakdown info" onClick={() => props.onViewTransactions()}><ArrowRight size={16} /></button></div>
          <div className="donut-wrap">
            {categorySpending.length > 0 ? <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categorySpending} dataKey="value" nameKey="name" innerRadius="69%" outerRadius="91%" paddingAngle={4} stroke="none" cornerRadius={5}>
                    {categorySpending.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                  </Pie>
                  <Tooltip content={<DonutTooltip currency={currency} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><strong>{formatMoney(categorySpending.reduce((sum, item) => sum + item.value, 0), currency)}</strong><span>spent in {period.toLowerCase()}</span></div>
            </> : <div className="donut-empty"><EmptyState icon={ShoppingBag} title="A fresh start" copy="Your spending categories will show up here." /></div>}
          </div>
          <div className="category-legend">
            {categorySpending.slice(0, 4).map((item, index) => <div className="legend-row" key={item.name}><span className="legend-category"><i style={{ background: chartColors[index % chartColors.length] }} />{item.name}</span><span>{Math.round(item.value / totalSpending * 100)}%</span><strong>{formatMoney(item.value, currency)}</strong></div>)}
            {categorySpending.length > 4 && <button className="see-all-link" onClick={props.onViewTransactions}>See all categories <ArrowRight size={13} /></button>}
          </div>
        </article>
      </section>

      <section className="card transactions-card">
        <div className="card-header">
          <div><h2>Recent transactions</h2><p>The latest little money moments.</p></div>
          <button className="text-button" onClick={props.onViewTransactions}>View all <ArrowRight size={15} /></button>
        </div>
        {recent.length ? <div className="transaction-list">
          {recent.map((tx) => <TransactionRow key={tx.id} tx={tx} currency={currency} onEdit={() => props.onEdit(tx)} compact />)}
        </div> : <EmptyState icon={Wallet} title="No transactions just yet" copy="When money moves, you’ll see it here." action={<button className="primary-button small-button" onClick={props.onAdd}><Plus size={15} /> Add your first transaction</button>} />}
      </section>
    </>
  );
}

function CashflowTooltip({ active, payload, label, currency }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency: Currency }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <div key={item.name}><i style={{ background: item.color }} />{item.name}<b>{formatMoney(item.value, currency)}</b></div>)}</div>;
}
function DonutTooltip({ active, payload, currency }: { active?: boolean; payload?: { name: string; value: number; payload: { color?: string } }[]; currency: Currency }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{payload[0].name}</strong><div><i style={{ background: payload[0].payload.color ?? "#6366f1" }} />Spent<b>{formatMoney(payload[0].value, currency)}</b></div></div>;
}

function TransactionRow({ tx, currency, onEdit, onDelete, compact = false }: { tx: Transaction; currency: Currency; onEdit: () => void; onDelete?: () => void; compact?: boolean }) {
  const info = categoryInfo(tx.category);
  const Icon = info.icon;
  return (
    <div className={`transaction-row${compact ? " compact-row" : ""}`}>
      <div className={`transaction-icon tint-${info.tint}`}><Icon size={18} strokeWidth={1.8} /></div>
      <div className="transaction-main"><strong>{tx.note || tx.category}</strong><span>{tx.category}<i />{prettyDate(tx.date)}{!compact && <><i />{tx.payment}</>}</span></div>
      {!compact && <span className="payment-chip"><CreditCard size={13} />{tx.payment}</span>}
      <div className={`transaction-amount ${tx.type === "income" ? "amount-income" : ""}`}>
        <strong>{tx.type === "income" ? "+" : "−"}{formatMoney(tx.amount, currency)}</strong>
        <span>{tx.type === "income" ? "Income" : "Expense"}</span>
      </div>
      <button className="row-action" aria-label={`Edit ${tx.note || tx.category}`} onClick={onEdit}><Pencil size={15} /></button>
      {onDelete && <button className="row-action delete-action" aria-label={`Delete ${tx.note || tx.category}`} onClick={onDelete}><Trash2 size={15} /></button>}
    </div>
  );
}

function TransactionsView(props: {
  transactions: Transaction[]; currency: Currency; search: string; setSearch: (value: string) => void;
  typeFilter: string; setTypeFilter: (value: string) => void; categoryFilter: string; setCategoryFilter: (value: string) => void;
  paymentFilter: string; setPaymentFilter: (value: string) => void; period: string; setPeriod: (value: string) => void;
  onEdit: (tx: Transaction) => void; onDelete: (tx: Transaction) => void; onExport: () => void;
}) {
  const { transactions, currency } = props;
  const income = transactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const expense = transactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
  const filtersActive = props.typeFilter !== "All types" || props.categoryFilter !== "All categories" || props.paymentFilter !== "All methods" || props.period !== "This month" || !!props.search;
  function clearFilters() { props.setTypeFilter("All types"); props.setCategoryFilter("All categories"); props.setPaymentFilter("All methods"); props.setPeriod("This month"); props.setSearch(""); }
  return (
    <>
      <section className="transaction-summary">
        <div><span><i className="summary-dot dot-all" />Showing transactions</span><strong>{transactions.length}</strong></div>
        <div><span><i className="summary-dot dot-income" />Money in</span><strong className="text-green">{formatMoney(income, currency)}</strong></div>
        <div><span><i className="summary-dot dot-expense" />Money out</span><strong className="text-rose">{formatMoney(expense, currency)}</strong></div>
      </section>
      <section className="card all-transactions">
        <div className="transactions-toolbar">
          <div className="search-field"><Search size={17} /><input value={props.search} onChange={(e) => props.setSearch(e.target.value)} placeholder="Search transactions..." aria-label="Search transactions" />{props.search && <button aria-label="Clear search" onClick={() => props.setSearch("")}><X size={15} /></button>}</div>
          <button className="outline-button export-button" onClick={props.onExport}><Download size={15} /> Export CSV</button>
        </div>
        <div className="filter-toolbar">
          <span className="filter-label"><Filter size={14} /> Filters</span>
          <select value={props.period} onChange={(e) => props.setPeriod(e.target.value)} aria-label="Filter by date">
            {["This month", "Last month", "Last 30 days", "All time"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={props.typeFilter} onChange={(e) => props.setTypeFilter(e.target.value)} aria-label="Filter by type">
            {["All types", "Income", "Expense"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={props.categoryFilter} onChange={(e) => props.setCategoryFilter(e.target.value)} aria-label="Filter by category">
            {["All categories", ...categories.map((item) => item.name)].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={props.paymentFilter} onChange={(e) => props.setPaymentFilter(e.target.value)} aria-label="Filter by payment method">
            {["All methods", "Card", "Cash", "Bank transfer", "Mobile wallet"].map((item) => <option key={item}>{item}</option>)}
          </select>
          {filtersActive && <button className="clear-filters" onClick={clearFilters}>Clear all</button>}
        </div>
        {transactions.length ? <div className="transaction-list full-list">{transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} currency={currency} onEdit={() => props.onEdit(tx)} onDelete={() => props.onDelete(tx)} />)}</div>
          : <EmptyState icon={Search} title={filtersActive ? "No transactions found" : "Your page, your pace"} copy={filtersActive ? "Try changing your search or filters." : "Your transactions will show up here once you add one."} action={filtersActive ? <button className="outline-button" onClick={clearFilters}>Clear filters</button> : undefined} />}
      </section>
    </>
  );
}

function BudgetsView(props: {
  transactions: Transaction[]; budgets: Budget[]; currency: Currency; editing: Category | null; draft: string;
  setDraft: (value: string) => void; startEdit: (category: Category, limit?: number) => void;
  save: (category: Category) => void; cancel: () => void;
}) {
  const expenses = props.transactions.filter((tx) => tx.type === "expense");
  const spentTotal = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const budgetTotal = props.budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const categoriesToShow = categories.filter((item) => !["Salary", "Freelance"].includes(item.name));
  return (
    <>
      <section className="budget-overview">
        <div className="budget-overview-copy"><span className="eyebrow">YOUR MONTHLY PLAN</span><h2>A little structure goes a long way.</h2><p>Give every category a limit that feels right for you.</p><button className="primary-button small-button" onClick={() => props.startEdit("Other", props.budgets.find((b) => b.category === "Other")?.limit)}><Plus size={15} /> Set a new limit</button></div>
        <div className="budget-stat-card"><div className="budget-stat-icon"><Wallet size={18} /></div><span>Spent this month</span><strong>{formatMoney(spentTotal, props.currency)}</strong><div className="budget-stat-foot"><span>of {formatMoney(budgetTotal, props.currency)} planned</span><span>{budgetTotal > 0 ? Math.min(Math.round(spentTotal / budgetTotal * 100), 999) : 0}%</span></div><div className="progress-track"><span style={{ width: `${budgetTotal ? Math.min(spentTotal / budgetTotal * 100, 100) : 0}%` }} className={spentTotal / Math.max(budgetTotal, 1) >= 1 ? "over" : spentTotal / Math.max(budgetTotal, 1) >= .8 ? "warning" : ""} /></div></div>
      </section>
      <section className="budget-section-heading"><div><h2>Category limits</h2><p>Monthly spending, at a glance.</p></div><span className="budget-month"><CalendarDays size={14} /> This month</span></section>
      <section className="budget-grid">
        {categoriesToShow.map((item) => {
          const budget = props.budgets.find((entry) => entry.category === item.name);
          const spent = expenses.filter((tx) => tx.category === item.name).reduce((sum, tx) => sum + tx.amount, 0);
          const ratio = budget ? spent / budget.limit : 0;
          const Icon = item.icon;
          const editing = props.editing === item.name;
          return <article className="card budget-card" key={item.name}>
            <div className="budget-card-top"><div className={`transaction-icon tint-${item.tint}`}><Icon size={18} /></div><button className="row-action" aria-label={`Edit ${item.name} budget`} onClick={() => props.startEdit(item.name, budget?.limit)}><Pencil size={15} /></button></div>
            <h3>{item.name}</h3>
            {editing ? <form className="budget-edit-form" onSubmit={(event) => { event.preventDefault(); props.save(item.name); }}><span>{props.currency === "MMK" ? "Ks" : props.currency}</span><input autoFocus type="text" inputMode="numeric" value={props.draft} onChange={(event) => props.setDraft(event.target.value.replace(/[^\d,]/g, ""))} placeholder="150,000" aria-label={`${item.name} budget amount`} /><button aria-label="Save budget"><Check size={16} /></button><button type="button" aria-label="Cancel" onClick={props.cancel}><X size={16} /></button></form>
              : <div className="budget-amount"><strong>{formatMoney(spent, props.currency)}</strong><span>of {budget ? formatMoney(budget.limit, props.currency) : "No limit"}</span></div>}
            <div className="progress-track"><span className={ratio >= 1 ? "over" : ratio >= .8 ? "warning" : ""} style={{ width: `${budget ? Math.min(ratio * 100, 100) : 0}%`, background: !budget ? "transparent" : ratio >= 1 ? undefined : ratio >= .8 ? undefined : item.color }} /></div>
            <div className="budget-progress-label">{budget ? ratio >= 1 ? <span className="text-rose">Over budget by {formatMoney(spent - budget.limit, props.currency)}</span> : ratio >= .8 ? <span className="text-amber">Almost there — {Math.round(ratio * 100)}%</span> : <span>{Math.round(ratio * 100)}% of limit used</span> : <button className="set-limit-link" onClick={() => props.startEdit(item.name)}>+ Set a monthly limit</button>}<span>{budget ? `${formatMoney(Math.max(0, budget.limit - spent), props.currency)} left` : ""}</span></div>
          </article>;
        })}
      </section>
      <div className="budget-note"><CircleHelp size={15} /> Budgets reset automatically on the first of each month. Your transaction history stays yours.</div>
    </>
  );
}

function SettingsView(props: {
  currency: Currency; setCurrency: (value: Currency) => void; dark: boolean; setDark: (value: boolean) => void;
  onCSV: () => void; onJSON: () => void; onImport: () => void; onDemo: () => void; onClear: () => void; transactionCount: number;
}) {
  return (
    <div className="settings-layout">
      <section className="card settings-card">
        <div className="settings-section-head"><div className="settings-icon"><SlidersHorizontal size={18} /></div><div><h2>Preferences</h2><p>A few small things to make this feel like yours.</p></div></div>
        <div className="setting-row"><div><strong>Display currency</strong><span>Choose how amounts are shown throughout the app.</span></div><select className="currency-select" value={props.currency} onChange={(event) => props.setCurrency(event.target.value as Currency)} aria-label="Display currency"><option value="MMK">MMK · Myanmar Kyat</option><option value="USD">USD · US Dollar</option><option value="THB">THB · Thai Baht</option><option value="SGD">SGD · Singapore Dollar</option></select></div>
        <div className="setting-row"><div><strong>Appearance</strong><span>Set a calm tone, day or night.</span></div><button className={`toggle${props.dark ? " on" : ""}`} role="switch" aria-checked={props.dark} aria-label="Dark mode" onClick={() => props.setDark(!props.dark)}><span /></button></div>
      </section>
      <section className="card settings-card">
        <div className="settings-section-head"><div className="settings-icon settings-icon-blue"><FileJson size={18} /></div><div><h2>Your data</h2><p>Your data is private and stored only on this device.</p></div></div>
        <div className="setting-row"><div><strong>Export transactions</strong><span>Download a spreadsheet-ready copy of your transactions.</span></div><button className="outline-button" onClick={props.onCSV}><FileSpreadsheet size={16} /> Export CSV</button></div>
        <div className="setting-row"><div><strong>Backup your data</strong><span>Save or restore a complete JSON backup.</span></div><div className="setting-button-group"><button className="outline-button" onClick={props.onJSON}><Download size={15} /> Export</button><button className="outline-button" onClick={props.onImport}><ArrowDownRight size={15} /> Import</button></div></div>
        <div className="data-footnote"><ShieldCheck size={14} /> {props.transactionCount} transactions stored locally on this device</div>
      </section>
      <section className="card settings-card">
        <div className="settings-section-head"><div className="settings-icon settings-icon-amber"><Sparkles size={18} /></div><div><h2>A fresh beginning</h2><p>Try Moneta with example data, or start with a clean slate.</p></div></div>
        <div className="setting-row"><div><strong>Load demo data</strong><span>Fill your dashboard with a thoughtfully made sample month.</span></div><button className="outline-button" onClick={props.onDemo}><Sparkles size={15} /> Load demo</button></div>
        <div className="setting-row danger-setting"><div><strong>Clear all data</strong><span>Remove transactions and budget limits from this device.</span></div><button className="outline-button danger-outline" onClick={props.onClear}><Trash2 size={15} /> Clear data</button></div>
      </section>
      <div className="settings-version"><span className="brand-mark mini-mark"><Wallet size={14} /></span> Moneta <i /> Thoughtful money, a little at a time.</div>
    </div>
  );
}

function TransactionModal({ transaction, currency, onClose, onSave }: {
  transaction: Transaction | null; currency: Currency; onClose: () => void; onSave: (tx: Transaction) => void;
}) {
  const [type, setType] = useState<TxType>(transaction?.type ?? "expense");
  const [amount, setAmount] = useState(transaction ? formatWholeNumber(transaction.amount) : "");
  const [category, setCategory] = useState<Category>(transaction?.category ?? "Food & dining");
  const [date, setDate] = useState(transaction?.date ?? localDate());
  const [payment, setPayment] = useState<Payment>(transaction?.payment ?? "Card");
  const [note, setNote] = useState(transaction?.note ?? "");
  const [error, setError] = useState("");
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const firstCategory = type === "income" ? "Salary" : "Food & dining";
  function changeType(newType: TxType) {
    setType(newType);
    if (newType === "income" && !["Salary", "Freelance"].includes(category)) setCategory("Salary");
    if (newType === "expense" && ["Salary", "Freelance"].includes(category)) setCategory("Food & dining");
  }
  const availableCategories = categories.filter((item) => type === "income" ? ["Salary", "Freelance", "Other"].includes(item.name) : !["Salary", "Freelance"].includes(item.name));
  useEffect(() => { if (!availableCategories.some((item) => item.name === category)) setCategory(firstCategory); }, [type]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(amount.replaceAll(",", ""));
    if (!Number.isSafeInteger(parsed) || parsed <= 0) { setError("Enter a whole-number amount greater than zero."); return; }
    if (!date) { setError("Choose a date for this transaction."); return; }
    onSave({ id: transaction?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, amount: parsed, category, date, payment, note: note.trim() });
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title" onSubmit={submit}>
        <div className="modal-head"><div><span className="eyebrow">A LITTLE MONEY MOMENT</span><h2 id="transaction-modal-title">{transaction ? "Edit transaction" : "Add transaction"}</h2></div><button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <div className="type-toggle"><button type="button" className={type === "expense" ? "selected expense-selected" : ""} onClick={() => changeType("expense")}><ArrowUpRight size={16} /> Expense</button><button type="button" className={type === "income" ? "selected income-selected" : ""} onClick={() => changeType("income")}><ArrowDownLeft size={16} /> Income</button></div>
        <label className="field-label amount-label">Amount</label>
        <div className="amount-input-wrap"><span>{currency === "MMK" ? "Ks" : currency}</span><input autoFocus inputMode="numeric" type="text" value={amount} onChange={(event) => { setAmount(event.target.value.replace(/[^\d,]/g, "")); setError(""); }} placeholder="5,000" aria-label={`Amount in ${currency}`} /></div>
        <label className="field-label">Category</label>
        <div className="category-picker">
          {availableCategories.map((item) => { const Icon = item.icon; return <button type="button" key={item.name} className={`category-option${category === item.name ? " picked" : ""}`} onClick={() => setCategory(item.name)}><span className={`category-option-icon tint-${item.tint}`}><Icon size={17} /></span><span>{item.name}</span></button>; })}
        </div>
        <div className="form-two-col">
          <label className="field-label">Date<input className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="field-label">Payment method<select className="form-input" value={payment} onChange={(event) => setPayment(event.target.value as Payment)}><option>Card</option><option>Cash</option><option>Bank transfer</option><option>Mobile wallet</option></select></label>
        </div>
        <label className="field-label note-label">Note <span>Optional</span><input className="form-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was this for?" maxLength={100} /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{transaction ? "Save changes" : "Add transaction"} <ArrowRight size={16} /></button></div>
      </form>
    </div>
  );
}

function EmptyState({ icon: Icon, title, copy, action }: { icon: LucideIcon; title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-illustration"><Icon size={24} /></div><strong>{title}</strong><p>{copy}</p>{action}</div>;
}

export default App;
