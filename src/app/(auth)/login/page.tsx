import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { Panel } from "@/components/ui/Panel";
import { signInAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await props.searchParams;
  const raw = params.next;
  const next = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  return (
    <Panel className="p-6">
      <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-[13px] text-subtle">
        Access your campaign and season stats.
      </p>

      <div className="mt-6">
        <CredentialsForm action={signInAction} submitLabel="Sign in" next={next} />
      </div>

      <p className="mt-6 border-t border-border pt-4 text-[13px] text-subtle">
        No account yet?{" "}
        <Link href="/signup" className="text-primary transition-colors hover:text-primary/80">
          Create one
        </Link>
      </p>
    </Panel>
  );
}
