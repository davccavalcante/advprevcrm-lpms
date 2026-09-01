"use client";

import { SignIn } from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { controlClasses, Field } from "@/components/ui/form-field";
import { browserSupabase } from "@/lib/supabase/browser";

/*
 * The password is exchanged for a session directly between this browser and the
 * authentication service. It never travels through this application and this
 * application never stores it, which is why the form is a client component and
 * not a server action.
 */
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const { error: failure } = await browserSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (failure) {
      /* The reason is never detailed: telling an unknown visitor whether the
       * address exists would answer a question nobody should be able to ask. */
      setError("Endereço eletrônico ou senha incorretos.");
      setWorking(false);
      return;
    }

    const origin = params.get("origem");
    router.replace(origin?.startsWith("/") ? origin : "/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field label="Endereço eletrônico" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={controlClasses}
        />
      </Field>

      <Field label="Senha" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={controlClasses}
        />
      </Field>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-attention-soft px-3 py-2 text-sm font-semibold text-ink"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={working}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-base font-semibold text-brand-contrast transition-opacity duration-(--motion-fast) hover:opacity-90 disabled:opacity-60"
      >
        <SignIn size={18} weight="bold" aria-hidden />
        {working ? "Entrando" : "Entrar"}
      </button>
    </form>
  );
}
