import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { adminLogin, currentAdmin } from "@/server/admin/auth";
import { fingerprint } from "@/server/crypto";
import { RateLimitError } from "@/server/rate-limit";

export const metadata = { title: "Admin" };

async function login(formData: FormData) {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  let ok = false;
  try {
    ok = await adminLogin(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""), fingerprint(ip));
  } catch (e) {
    if (e instanceof RateLimitError) redirect("/admin/login?error=rate");
    throw e;
  }
  redirect(ok ? "/admin" : "/admin/login?error=1");
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <LogoMark size={48} />
      <h1 className="font-display mt-6 text-2xl font-black">School Pawa Admin</h1>
      <p className="mt-1 text-sm text-muted">Content review, schools, moderation and compliance.</p>
      <form action={login} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error === "rate" ? "Too many attempts. Try again later." : "Wrong email or password."}</p> : null}
        <Button type="submit" variant="gold" size="lg" block>Sign in</Button>
      </form>
    </div>
  );
}
