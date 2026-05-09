"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "../actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-vermilion px-4 py-2 font-display text-paper transition disabled:opacity-50"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="meta-mono">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-rule/60 bg-paper px-3 py-2 font-serif text-ink focus:border-vermilion focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="meta-mono">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-rule/60 bg-paper px-3 py-2 font-serif text-ink focus:border-vermilion focus:outline-none"
        />
      </label>

      {state?.error ? (
        <p className="text-sm text-vermilion">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
