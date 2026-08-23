"use client";

import { IdentificationCard } from "@phosphor-icons/react";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { OfficeProfileView } from "@/lib/office-profile";
import {
  changePasswordAction,
  updateIdentityAction,
  updatePhotoAction,
} from "@/lib/office-profile-actions";

/*
 * The editable account profile: photo, name, email and password, by the
 * director's order of 2026-08-21. Every write goes through a server action
 * that validates again and appends to the profile change log; what this card
 * checks before sending exists only to give an honest message earlier.
 */

type Notice = { kind: "ok" | "error"; text: string } | null;

const inputClasses =
  "w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-offset-1 focus:outline-ink";

const buttonClasses =
  "inline-flex w-fit items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-card transition-opacity hover:opacity-90 disabled:opacity-50";

function NoticeLine({ notice }: { notice: Notice }) {
  if (notice === null) {
    return null;
  }
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-xs ${notice.kind === "ok" ? "bg-inset text-ink" : "bg-inset font-semibold text-ink"}`}
    >
      {notice.text}
    </p>
  );
}

export function ProfileCard({
  initial,
  passwordMinChars,
}: {
  initial: OfficeProfileView;
  passwordMinChars: number;
}) {
  const [profile, setProfile] = useState(initial);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [identityNotice, setIdentityNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [photoNotice, setPhotoNotice] = useState<Notice>(null);
  const [savingIdentity, startIdentity] = useTransition();
  const [savingPassword, startPassword] = useTransition();
  const [savingPhoto, startPhoto] = useTransition();
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const saveIdentity = () => {
    startIdentity(async () => {
      const result = await updateIdentityAction({
        firstName,
        lastName,
        email,
      });
      if (result.ok) {
        setProfile(result.profile);
        setIdentityNotice({
          kind: "ok",
          text: "Identificação salva. O nome e o endereço passam a valer em todas as telas.",
        });
      } else {
        setIdentityNotice({ kind: "error", text: result.reason });
      }
    });
  };

  const savePassword = () => {
    if (nextPassword.length < passwordMinChars) {
      setPasswordNotice({
        kind: "error",
        text: `A nova senha precisa ter ao menos ${passwordMinChars} caracteres.`,
      });
      return;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordNotice({
        kind: "error",
        text: "A confirmação não é igual à nova senha, então nada foi enviado.",
      });
      return;
    }
    startPassword(async () => {
      const result = await changePasswordAction({
        current: currentPassword,
        next: nextPassword,
      });
      if (result.ok) {
        setProfile(result.profile);
        setCurrentPassword("");
        setNextPassword("");
        setConfirmPassword("");
        setPasswordNotice({
          kind: "ok",
          text: "Senha registrada com proteção de hash. Ela nunca é guardada em claro.",
        });
      } else {
        setPasswordNotice({ kind: "error", text: result.reason });
      }
    });
  };

  const savePhoto = () => {
    const file = photoInput.current?.files?.[0];
    if (file === undefined) {
      setPhotoNotice({
        kind: "error",
        text: "Escolha um arquivo de imagem antes de enviar.",
      });
      return;
    }
    const form = new FormData();
    form.set("photo", file);
    startPhoto(async () => {
      const result = await updatePhotoAction(form);
      if (result.ok) {
        setProfile(result.profile);
        if (photoInput.current) {
          photoInput.current.value = "";
        }
        setPhotoName(null);
        setPhotoNotice({
          kind: "ok",
          text: "Foto atualizada. Ela passa a aparecer em todas as telas.",
        });
      } else {
        setPhotoNotice({ kind: "error", text: result.reason });
      }
    });
  };

  return (
    <section
      aria-label="Identificação da conta"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <IdentificationCard size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Identificação da conta</h2>
          <p className="text-sm text-ink-soft">
            Nome, endereço eletrônico, senha e foto desta conta. Cada alteração
            gera registro com autor, momento e valores antes e depois.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          name={profile.fullName}
          photoSrc={profile.avatarSrc}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
          <p className="text-xs font-bold text-ink">Nova foto</p>
          {/* The native file control speaks the language of the browser, and
           * the interface of this office speaks only Brazilian Portuguese, so
           * the control is visually hidden behind a labelled button. */}
          <input
            ref={photoInput}
            id="profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) =>
              setPhotoName(event.target.files?.[0]?.name ?? null)
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="profile-photo"
              className="inline-flex w-fit cursor-pointer items-center rounded-md border border-line px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-inset"
            >
              Escolher arquivo
            </label>
            <span className="text-xs break-words text-ink-soft">
              {photoName ?? "Nenhum arquivo escolhido"}
            </span>
          </div>
          <p className="text-xs text-ink-soft">
            JPEG, PNG ou WebP, com até dois megabytes.
          </p>
          <button
            type="button"
            onClick={savePhoto}
            disabled={savingPhoto}
            className={buttonClasses}
          >
            {savingPhoto ? "Enviando foto..." : "Enviar foto"}
          </button>
          <NoticeLine notice={photoNotice} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="profile-first-name"
              className="text-xs font-bold text-ink"
            >
              Nome
            </label>
            <input
              id="profile-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={inputClasses}
              autoComplete="given-name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="profile-last-name"
              className="text-xs font-bold text-ink"
            >
              Sobrenome
            </label>
            <input
              id="profile-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={inputClasses}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-email" className="text-xs font-bold text-ink">
            Endereço eletrônico
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClasses}
            autoComplete="email"
          />
        </div>
        <button
          type="button"
          onClick={saveIdentity}
          disabled={savingIdentity}
          className={buttonClasses}
        >
          {savingIdentity ? "Salvando..." : "Salvar identificação"}
        </button>
        <NoticeLine notice={identityNotice} />
        <p className="text-xs text-ink-soft">
          Perfil {profile.role}, time {profile.team}. O perfil e o time
          pertencem à Administração e não mudam nesta tela.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <h3 className="text-sm font-bold text-ink">Senha</h3>
        {profile.passwordSet ? (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="profile-current-password"
              className="text-xs font-bold text-ink"
            >
              Senha atual
            </label>
            <input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={inputClasses}
              autoComplete="current-password"
            />
          </div>
        ) : (
          <p className="text-xs text-ink-soft">
            Nenhuma senha registrada ainda nesta instalação.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="profile-next-password"
              className="text-xs font-bold text-ink"
            >
              Nova senha
            </label>
            <input
              id="profile-next-password"
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              className={inputClasses}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="profile-confirm-password"
              className="text-xs font-bold text-ink"
            >
              Confirmação
            </label>
            <input
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClasses}
              autoComplete="new-password"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={savePassword}
          disabled={savingPassword}
          className={buttonClasses}
        >
          {savingPassword ? "Registrando..." : "Alterar senha"}
        </button>
        <NoticeLine notice={passwordNotice} />
        <p className="text-xs text-ink-soft">
          A senha precisa de ao menos {passwordMinChars} caracteres e é guardada
          apenas como hash com sal, nunca em claro. Nesta fase ainda não existe
          módulo de autenticação; a senha registrada aqui será a semente da
          credencial quando ele existir, e a tela diz isso de propósito.
        </p>
      </div>
    </section>
  );
}
