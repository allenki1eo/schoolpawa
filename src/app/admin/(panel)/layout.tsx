import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { adminLogout, requireAdmin } from "@/server/admin/auth";

async function logout() {
  "use server";
  await adminLogout();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/admin" className="flex items-center gap-2 font-display font-extrabold">
            <LogoMark size={28} /> Admin
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span className="hidden sm:inline">
              {admin.name} · {admin.role}
              {admin.isQualifiedTeacher ? " · teacher ✓" : ""}
            </span>
            <form action={logout}>
              <button className="rounded-lg px-2 py-1 hover:bg-white/5">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
