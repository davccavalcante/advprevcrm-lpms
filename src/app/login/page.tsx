import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Entrar | Advprev CRM",
};

/*
 * The door of the system. It is the only screen served without a session, and
 * it carries no data of the office: no case, no client, no indicator, nothing
 * that could be read by somebody who never signed in.
 */
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-lg border border-line bg-card p-8">
        <div className="flex flex-col gap-3">
          <Logo />
          <h1 className="text-2xl font-semibold text-ink">
            Entrar no Advprev CRM
          </h1>
          <p className="text-sm text-ink-soft">
            Sistema interno do escritório. O acesso é pessoal e cada leitura de
            caso, documento ou prazo é registrada em auditoria.
          </p>
        </div>

        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>

        <p className="text-xs text-ink-soft">
          Esqueceu a senha ou precisa de acesso? Procure a Administração do
          escritório.
        </p>
      </div>
    </main>
  );
}
