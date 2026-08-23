"use client";

import {
  PaperPlaneTilt,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnswerContent } from "@/components/nhe/answer-content";
import { askDavid, type NheTurn } from "@/lib/trinity/nhe-actions";

/*
 * The persistent surface of the entity, present on every screen. It knows the
 * screen the lawyer is on and says so, and the lawyer may still ask about
 * anything else in the system.
 *
 * The assisted-content marking is stated once, at the foot of the panel, by
 * order of the director on 2026-08-11: the surface says the content is assisted
 * and depends on the review of the human lawyer, and the model, the moment and
 * the author stay in the immutable audit record of every turn. A conversation
 * cannot be erased by anyone, which is why no delete control exists here.
 */

type Turn = {
  id: string;
  question: string;
  result: NheTurn | null;
};

function screenContextOf(pathname: string): string {
  if (pathname === "/") return "Painel do advogado";
  if (pathname.startsWith("/casos/")) return `Ficha de caso, rota ${pathname}`;
  if (pathname === "/casos") return "Lista de casos";
  if (pathname.startsWith("/clientes/"))
    return `Ficha de cliente, rota ${pathname}`;
  if (pathname === "/clientes") return "Lista de clientes";
  if (pathname === "/atendimento") return "Atendimento";
  if (pathname === "/administrativo") return "Administrativo";
  if (pathname === "/judicial") return "Judicial";
  if (pathname === "/agenda") return "Agenda";
  if (pathname === "/financeiro") return "Financeiro";
  if (pathname === "/configuracoes") return "Configurações";
  return pathname;
}

export function EntityDock({ greeting }: { greeting: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  /* The conversation the office opened for this lawyer, carried from one
   * question to the next so the exchange stays one conversation. */
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  /*
   * Spoken state. The panel prints the waiting message and then replaces it
   * with the answer, and a replaced element is not announced, so a lawyer using
   * a screen reader was never told that the answer had arrived. This region
   * exists from the first render and only its text changes, which is what makes
   * an announcement reliable.
   */
  const latest = turns.at(-1);
  const spokenStatus =
    latest === undefined
      ? ""
      : latest.result === null
        ? "David está lendo os registros."
        : latest.result.ok
          ? "Resposta de David recebida na conversa."
          : "David não respondeu. Leia o aviso na conversa.";

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  /*
   * The newest question is brought to the top of the reading area, so a long
   * answer is read from its first line. Measured on 2026-08-11: scrolling from
   * inside the transition ran before the paint, left the reading area in the
   * middle of the previous answer and forced the lawyer to scroll by hand.
   */
  useEffect(() => {
    const list = listRef.current;
    const last = list?.lastElementChild;
    if (
      !open ||
      turns.length === 0 ||
      !list ||
      !(last instanceof HTMLElement)
    ) {
      return;
    }
    list.scrollTo({ top: last.offsetTop - list.offsetTop });
  }, [turns, open]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asked = question.trim();
    if (asked.length === 0 || pending) {
      return;
    }
    const id = `${Date.now()}`;
    setTurns((current) => [...current, { id, question: asked, result: null }]);
    setQuestion("");
    startTransition(async () => {
      const result = await askDavid(
        asked,
        screenContextOf(pathname),
        conversationId ?? undefined,
      );
      /* The conversation is one conversation. Measured on 2026-08-11T23:39Z:
       * without carrying the identifier back, every question opened a new one,
       * the record on disk was split into files of a single turn each, the body
       * received a different session on every question, and the ceiling per
       * conversation could never bind, because no conversation ever had a
       * second turn. */
      if (result.conversationId !== undefined) {
        setConversationId(result.conversationId);
      }
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, result } : turn)),
      );
    });
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          open
            ? "Fechar a conversa com David"
            : "Abrir a conversa com David, entidade não humana do escritório"
        }
        className="fixed right-4 bottom-4 z-40 inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-full bg-panel px-5 py-3 text-sm font-bold text-ink-inverse shadow-panel transition-colors duration-(--motion-fast) hover:bg-panel-hover sm:right-6 sm:bottom-6"
      >
        {open ? (
          <X size={20} weight="bold" aria-hidden />
        ) : (
          <Sparkle size={20} weight="bold" aria-hidden />
        )}
        David
      </button>

      {open ? (
        <aside
          aria-label="Conversa com David"
          aria-busy={pending}
          /* Closing with the escape key returns the focus to the control that
           * opened the panel, so the keyboard never lands on the body. */
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              toggleRef.current?.focus();
            }
          }}
          className="fixed inset-x-4 bottom-24 z-40 flex max-h-(--overlay-max-height-tall) flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-panel sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-(--overlay-chat-width)"
        >
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink">David</h2>
            <p className="text-xs text-ink-soft">
              Contexto atual: {screenContextOf(pathname)}.
            </p>
          </header>

          <div
            ref={listRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto"
          >
            <p className="rounded-md bg-inset p-4 text-sm leading-relaxed text-ink">
              {greeting}
            </p>

            {turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-2">
                <p className="ml-auto w-fit max-w-(--overlay-bubble-max-width) rounded-md bg-panel px-4 py-2 text-sm break-words text-ink-inverse">
                  {turn.question}
                </p>
                {turn.result === null ? (
                  <p className="w-fit rounded-md bg-inset px-4 py-2 text-sm text-ink-soft">
                    David está lendo os registros.
                  </p>
                ) : turn.result.ok ? (
                  <div className="rounded-md border border-line bg-inset p-4">
                    <AnswerContent text={turn.result.answer ?? ""} />
                  </div>
                ) : (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-md bg-attention-soft p-4 text-sm text-ink"
                  >
                    <WarningCircle
                      size={18}
                      weight="bold"
                      aria-hidden
                      className="mt-0.5 shrink-0"
                    />
                    {turn.result.blockedReason ?? turn.result.unavailableReason}
                  </p>
                )}
              </div>
            ))}
          </div>

          <p className="sr-only" aria-live="polite">
            {spokenStatus}
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-2">
            {/* The visual helper was removed by the director's order of
             * 2026-08-21; the field keeps an invisible accessible name. */}
            <label htmlFor="nhe-question" className="sr-only">
              Pergunta para David
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                id="nhe-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                /* Never disabled: disabling the focused field throws the
                 * keyboard back to the body, and the lawyer may well want to
                 * write the next question while this one is being read. */
                className="min-w-0 flex-1 rounded-md border border-line bg-inset px-4 py-3 text-sm text-ink"
              />
              <button
                type="submit"
                disabled={pending}
                aria-label="Enviar pergunta"
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-panel text-ink-inverse transition-colors duration-(--motion-fast) hover:bg-panel-hover disabled:opacity-60"
              >
                <PaperPlaneTilt size={18} weight="bold" aria-hidden />
              </button>
            </div>
            <p className="text-xs text-ink-soft">
              Conteúdo assistido pela Inteligência Massiva (IM) da{" "}
              <a
                href="https://teleologyhi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-1 underline-offset-2 hover:opacity-80"
              >
                TeleologyHI
              </a>
              , sujeito à revisão do advogado. Conversa registrada em auditoria.
            </p>
          </form>
        </aside>
      ) : null}
    </>
  );
}
