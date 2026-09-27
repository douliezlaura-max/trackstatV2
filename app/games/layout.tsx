import { DashboardProvider } from "@/components/DashboardProvider";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { listAccounts } from "@/lib/accounts";
import { devLoginEnabled, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GamesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session?.user ?? null;
  const accounts = user ? await listAccounts(user.id) : [];

  return (
    <DashboardProvider user={user} initialAccounts={accounts} devLogin={devLoginEnabled()}>
      <div className="flex min-h-dvh bg-ink-950">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="bg-grid flex-1 px-4 py-6 sm:px-8">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
