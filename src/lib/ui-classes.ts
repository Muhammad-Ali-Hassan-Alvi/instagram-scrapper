/** Shared light-theme Tailwind class strings for the analytics dashboard. */
export const ui = {
  page: "min-h-full bg-slate-50 text-slate-900",
  sidebar: "border-r border-slate-200 bg-white",
  header: "border-b border-slate-200 bg-white",
  card: "rounded-xl border border-slate-200 bg-white shadow-sm",
  cardMuted: "rounded-xl border border-dashed border-slate-300 bg-slate-50",
  tableHead: "bg-slate-50 text-slate-500",
  tableRow: "border-t border-slate-100 hover:bg-slate-50/80",
  input:
    "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20",
  btn: "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40",
  btnPrimary:
    "rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-60",
  link: "text-violet-600 underline-offset-2 hover:text-violet-700 hover:underline",
  muted: "text-slate-500",
  label: "text-xs font-medium uppercase tracking-wide text-slate-500",
} as const;
