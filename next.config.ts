import type { NextConfig } from "next";

/*
 * The URLs of the product are Brazilian Portuguese, by the director's order of
 * 2026-08-21, while route folders and code identifiers stay in English, by the
 * language law of the project. The two rules meet here: every pt-BR URL is
 * rewritten to the English physical route that serves it, and every English
 * page URL redirects to its pt-BR form, so the address bar never shows English.
 * `/`, `/agenda` and `/judicial` are the same word in both languages.
 *
 * The API routes keep their English paths answering with no redirect, because
 * the daily systemd timer on the office server calls `/api/capture/run` and a
 * redirect would break a caller that does not follow one; the pt-BR aliases
 * below are the documented public form.
 *
 * Order matters in both lists: literal segments come before parameter
 * segments, so `novo` is never captured as an identifier.
 */

const pageRoutes: { en: string; ptBr: string }[] = [
  { en: "/clients/new", ptBr: "/clientes/novo" },
  {
    en: "/clients/:clientId/cases/new",
    ptBr: "/clientes/:clientId/casos/novo",
  },
  { en: "/clients/:clientId/edit", ptBr: "/clientes/:clientId/editar" },
  { en: "/clients/:clientId", ptBr: "/clientes/:clientId" },
  { en: "/clients", ptBr: "/clientes" },
  {
    en: "/cases/:clientId/:caseId/edit",
    ptBr: "/casos/:clientId/:caseId/editar",
  },
  { en: "/cases/:clientId/:caseId", ptBr: "/casos/:clientId/:caseId" },
  { en: "/cases", ptBr: "/casos" },
  { en: "/intake", ptBr: "/atendimento" },
  { en: "/administrative", ptBr: "/administrativo" },
  { en: "/tasks", ptBr: "/tarefas" },
  { en: "/finance", ptBr: "/financeiro" },
  { en: "/settings", ptBr: "/configuracoes" },
];

const apiRoutes: { en: string; ptBr: string }[] = [
  { en: "/api/documents", ptBr: "/api/documentos" },
  { en: "/api/capture/run", ptBr: "/api/captura/executar" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return pageRoutes.map((route) => ({
      source: route.en,
      destination: route.ptBr,
      permanent: false,
    }));
  },
  async rewrites() {
    return [...pageRoutes, ...apiRoutes].map((route) => ({
      source: route.ptBr,
      destination: route.en,
    }));
  },
};

export default nextConfig;
