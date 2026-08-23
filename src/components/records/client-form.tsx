"use client";

import { FloppyDisk } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  controlClasses,
  Field,
  FormNotice,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "@/components/ui/form-field";
import type { StoredClient } from "@/lib/case-domain";
import { formatCpf } from "@/lib/case-domain";
import { saveClientAction } from "@/lib/record-actions";

/*
 * Registration and edition of a client. The lawyer is the only operator: the
 * client never registers, never signs in and never reaches this screen.
 */
export function ClientForm({ client }: { client?: StoredClient }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [cpf, setCpf] = useState(client?.cpf ?? "");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveClientAction(client?.id ?? null, form);
      if (result.ok) {
        setFieldErrors({});
        setFormError(null);
        router.push(`/clientes/${result.id}`);
        router.refresh();
        return;
      }
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? null);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {formError ? <FormNotice tone="attention">{formError}</FormNotice> : null}
      {Object.keys(fieldErrors).length > 0 ? (
        <FormNotice tone="attention">
          O cadastro não foi gravado. Corrija os campos assinalados abaixo.
        </FormNotice>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field
            label="Nome completo"
            htmlFor="fullName"
            required
            error={fieldErrors.fullName}
          >
            <input
              id="fullName"
              name="fullName"
              defaultValue={client?.fullName ?? ""}
              aria-invalid={Boolean(fieldErrors.fullName)}
              className={controlClasses}
            />
          </Field>
        </div>

        <Field
          label="CPF"
          htmlFor="cpf"
          required
          hint="Os dígitos verificadores são conferidos antes da gravação."
          error={fieldErrors.cpf}
        >
          <input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            aria-invalid={Boolean(fieldErrors.cpf)}
            className={controlClasses}
          />
        </Field>

        <Field
          label="Documento de identidade"
          htmlFor="rg"
          required
          error={fieldErrors.rg}
        >
          <input
            id="rg"
            name="rg"
            defaultValue={client?.rg ?? ""}
            aria-invalid={Boolean(fieldErrors.rg)}
            className={controlClasses}
          />
        </Field>

        <Field
          label="Data de nascimento"
          htmlFor="birthDate"
          required
          error={fieldErrors.birthDate}
        >
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={client?.birthDate ?? ""}
            aria-invalid={Boolean(fieldErrors.birthDate)}
            className={controlClasses}
          />
        </Field>

        <Field
          label="Nome da mãe"
          htmlFor="motherName"
          error={fieldErrors.motherName}
        >
          <input
            id="motherName"
            name="motherName"
            defaultValue={client?.motherName ?? ""}
            className={controlClasses}
          />
        </Field>

        <Field
          label="Telefone"
          htmlFor="phone"
          required
          error={fieldErrors.phone}
        >
          <input
            id="phone"
            name="phone"
            defaultValue={client?.phone ?? ""}
            aria-invalid={Boolean(fieldErrors.phone)}
            className={controlClasses}
          />
        </Field>

        <Field
          label="Endereço eletrônico"
          htmlFor="email"
          required
          error={fieldErrors.email}
        >
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
            aria-invalid={Boolean(fieldErrors.email)}
            className={controlClasses}
          />
        </Field>

        <div className="md:col-span-2">
          <Field
            label="Endereço"
            htmlFor="address"
            required
            error={fieldErrors.address}
          >
            <input
              id="address"
              name="address"
              defaultValue={client?.address ?? ""}
              aria-invalid={Boolean(fieldErrors.address)}
              className={controlClasses}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field
            label="Cidade e unidade federativa"
            htmlFor="cityState"
            required
            error={fieldErrors.cityState}
          >
            <input
              id="cityState"
              name="cityState"
              defaultValue={client?.cityState ?? ""}
              aria-invalid={Boolean(fieldErrors.cityState)}
              className={controlClasses}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field
            label="Observações do cadastro"
            htmlFor="notes"
            hint="Nada aqui substitui documento; é apenas anotação interna do atendimento."
            error={fieldErrors.notes}
          >
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={client?.notes ?? ""}
              className={controlClasses}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={primaryButtonClasses}
        >
          <FloppyDisk size={18} weight="bold" aria-hidden />
          {pending
            ? "Gravando"
            : client
              ? "Gravar alterações"
              : "Cadastrar cliente"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className={secondaryButtonClasses}
        >
          Cancelar
        </button>
        <p aria-live="polite" className="text-xs text-ink-soft">
          {pending
            ? "Gravando em arquivo local."
            : "A gravação é em arquivo local, na pasta de dados do escritório."}
        </p>
      </div>
    </form>
  );
}
