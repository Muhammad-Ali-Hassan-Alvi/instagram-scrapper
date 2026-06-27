import { SidebarNav } from "@/components/analytics/SidebarNav";
import { ui } from "@/lib/ui-classes";

export function AnalyticsShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className={ui.page}>
      <div className="flex min-h-screen">
        <SidebarNav />

        <div className="flex flex-1 flex-col">
          <header className={`${ui.header} px-4 py-4 sm:px-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={ui.label}>Dashboard</p>
                <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
              </div>
              <p className="text-xs text-slate-500">
                Reads MongoDB only · scrape via separate terminal
              </p>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
