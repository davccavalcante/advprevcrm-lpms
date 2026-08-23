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
import {
  type CaseSphereId,
  caseSpheres,
  caseStatuses,
  caseTypesBySphere,
  type StoredCase,
  sphereOf,
} from "@/lib/case-domain";
import { saveCaseAction } from "@/lib/record-actions";

/*
 * Opening and edition of a case. The sphere is the first decision because it is
 * what defines against whom the office litigates, which court branch hears it
 * and which deadline regime counts, and the screen states all three.
 */
export function CaseForm({
  clientId,
  clientName,
  record,
  defaultLawyer,
}: {
  clientId: string;
  clientName: string;
  record?: StoredCase;
  defaultLawyer: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sphere, setSphere] = useState<CaseSphereId>(
    record?.sphere ?? "federal-social-security",
  );

  const selected = sphereOf(sphere);
  const types = caseTypesBySphere[sphere];

  /* What the case was opened with, when the catalogue no longer offers it. */
  const recordedTypeOutsideCatalogue =
    record?.caseType && !types.some((type) => type.label === record.caseType)
      ? record.caseType
      : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveCaseAction(clientId, record?.id ?? null, form);
      if (result.ok) {
        setFieldErrors({});
        setFormError(null);
        router.push(`/casos/${clientId}/${result.id}`);
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
          O caso não foi gravado. Corrija os campos assinalados abaixo.
        </FormNotice>
      ) : null}

      <p className="text-sm text-ink-soft">
        Caso de {clientName}. Um único fato pode abrir mais de um caso, em
        esferas diferentes, e cada um segue com documentos, prazos e financeiro
        próprios.
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold text-ink">
          Esfera{" "}
          <span className="font-normal text-ink-soft">(obrigatório)</span>
        </legend>
        {caseSpheres.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-line px-4 py-3 transition-colors duration-(--motion-fast) hover:bg-inset has-checked:border-brand-muted has-checked:bg-inset"
          >
            <input
              type="radio"
              name="sphere"
              value={option.id}
              checked={sphere === option.id}
              onChange={() => setSphere(option.id)}
              className="mt-1 size-4 shrink-0 cursor-pointer accent-ink"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">
                {option.label}, {option.courtLabel}
              </span>
              <span className="block text-xs leading-relaxed text-ink-soft">
                {option.scopeLabel}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2 rounded-md bg-inset p-4">
        <p className="text-xs leading-relaxed text-ink">
          <span className="font-bold">Fundamento.</span> {selected.groundLabel}
        </p>
        <p className="text-xs leading-relaxed text-ink">
          <span className="font-bold">Contagem de prazo.</span>{" "}
          {selected.deadlineRegimeLabel} O cálculo é apoio e a responsabilidade
          profissional permanece do advogado.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Tipo do caso"
          htmlFor="caseType"
          required
          error={fieldErrors.caseType}
        >
          <select
            id="caseType"
            name="caseType"
            defaultValue={record?.caseType ?? ""}
            key={sphere}
            aria-invalid={Boolean(fieldErrors.caseType)}
            className={controlClasses}
          >
            <option value="">Selecione o tipo</option>
            {/*
             * A case recorded before a change of the catalogue keeps the type it
             * was opened with, offered here as its own option. Without it the
             * browser would silently fall back to the empty option and an
             * edition of an untouched field would rewrite what the office
             * recorded.
             */}
            {recordedTypeOutsideCatalogue ? (
              <option value={recordedTypeOutsideCatalogue}>
                {recordedTypeOutsideCatalogue}, tipo registrado no caso
              </option>
            ) : null}
            {types.map((type) => (
              <option key={type.id} value={type.label}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Parte contrária"
          htmlFor="opposingParty"
          required
          hint={`Nesta esfera, em regra: ${selected.opposingPartyLabel}.`}
          error={fieldErrors.opposingParty}
        >
          <input
            id="opposingParty"
            name="opposingParty"
            defaultValue={
              record?.opposingParty ?? selected.opposingPartyPrefill
            }
            aria-invalid={Boolean(fieldErrors.opposingParty)}
            className={controlClasses}
          />
        </Field>

        <Field
          label="Situação"
          htmlFor="status"
          required
          error={fieldErrors.status}
        >
          <select
            id="status"
            name="status"
            defaultValue={record?.status ?? "administrative"}
            aria-invalid={Boolean(fieldErrors.status)}
            className={controlClasses}
          >
            {caseStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Advogado responsável"
          htmlFor="responsibleLawyer"
          required
          error={fieldErrors.responsibleLawyer}
        >
          <input
            id="responsibleLawyer"
            name="responsibleLawyer"
            defaultValue={record?.responsibleLawyer ?? defaultLawyer}
            aria-invalid={Boolean(fieldErrors.responsibleLawyer)}
            className={controlClasses}
          />
        </Field>

        <div className="md:col-span-2">
          <Field
            label="Referência interna"
            htmlFor="reference"
            hint="Número do processo, do requerimento ou a referência que o escritório usa."
            error={fieldErrors.reference}
          >
            <input
              id="reference"
              name="reference"
              defaultValue={record?.reference ?? ""}
              className={controlClasses}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field
            label="Número do processo judicial"
            htmlFor="lawsuitNumber"
            hint="Numeração única do Conselho Nacional de Justiça, no formato 0000000-00.0000.0.00.0000. É por ele que a intimação publicada encontra este caso sozinha, sem ninguém decidir nada."
            error={fieldErrors.lawsuitNumber}
          >
            <input
              id="lawsuitNumber"
              name="lawsuitNumber"
              inputMode="numeric"
              defaultValue={record?.lawsuitNumber ?? ""}
              className={controlClasses}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field
            label="Resumo do fato"
            htmlFor="factSummary"
            hint="O fato que originou o caso. Quando o mesmo fato abre casos em esferas diferentes, repita o resumo em cada um."
            error={fieldErrors.factSummary}
          >
            <textarea
              id="factSummary"
              name="factSummary"
              rows={4}
              defaultValue={record?.factSummary ?? ""}
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
          {pending ? "Gravando" : record ? "Gravar alterações" : "Abrir caso"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className={secondaryButtonClasses}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
