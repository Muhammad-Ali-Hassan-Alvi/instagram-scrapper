import Link from "next/link";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/exports", label: "Export" },
] as const;

export function AppShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Social Analytics
            </Link>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <span className="hidden text-xs text-zinc-500 sm:inline">Refreshes every 24h</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {(title || description) && (
          <div className="mb-8">
            {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
            {description && (
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
