import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { Panel } from "@/components/ui/Panel";
import { signUpAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await props.searchParams;
  const raw = params.next;
  const next = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  return (
    <Panel className="p-6">
      <h1 className="text-lg font-semibold tracking-tight">Create your founder account</h1>
      <p className="mt-1 text-[13px] text-subtle">
        Submit a product and follow how it performs.
      </p>

      <div className="mt-6">
        <CredentialsForm
          action={signUpAction}
          submitLabel="Create account"
          includeName
          next={next}
        />
      </div>

      <p className="mt-6 border-t border-border pt-4 text-[13px] text-subtle">
        Already competing?{" "}
        <Link href="/login" className="text-primary transition-colors hover:text-primary/80">
          Sign in
        </Link>
      </p>
    </Panel>
  );
}
