#!/usr/bin/env bash
#
# Bring the GitHub repository of this project to the exact state the esteira
# expects, in one idempotent command.
#
# It exists because the repository has been deleted and recreated more than
# once, and every recreation used to mean somebody remembering a list: four
# secrets, a deploy key, a description, a homepage and nineteen topics. A list
# that lives in a person's memory is a list that will be wrong one day, and the
# day it was wrong the deploy failed. This script is that list, versioned.
#
# Run it after creating the repository, and run it again whenever you want to
# be sure. Every operation is safe to repeat.
#
#   bash scripts/bootstrap-repository.sh
#
# What it never does: touch a credential. The private key of the server, the
# private half of a deploy key and the contents of .env do not pass through
# this script, and the two that are still needed are printed as ready commands
# for the owner to run. The deploy workflow was written so that only one of
# them, SERVER_SSH_KEY, is actually required; the other two are optional and
# the workflow says so in its own log.
#
# Requirements: the gh CLI, authenticated as the owner of the repository.

set -euo pipefail

REPO="${ADVPREV_REPO:-davccavalcante/advprevcrm-lpms}"
HOMEPAGE="https://advprevcrm.tech"
DESCRIPTION="Advprev CRM, the legal practice management system (LPMS) of a Brazilian social security law firm, built on Massive Intelligence (IM) with the MAIC, HIM, and NHE architecture."

# The deployment target. These four are not credentials: the host, the login,
# the path and the public address are already published in PREAMBLE.md inside
# this same repository. They are written as secrets anyway, because a secret is
# the channel the workflow reads first, and the workflow carries the same
# values as versioned defaults so a deploy still runs when they are absent.
VPS_HOSTINGER_SSH_IP="179.198.112.168"
VPS_HOSTINGER_SSH_USER="root"
DEPLOY_PATH="/home/fjallstoppur/advprevcrm-lpms"
NEXT_PUBLIC_APP_URL="${HOMEPAGE}"

# The public half of the read-only deploy key, when one has been minted on this
# workstation. Absent is fine while the repository is public.
DEPLOY_KEY_PUBLIC="${HOME}/.ssh/advprevcrm_lpms_deploy_ed25519.pub"

TOPICS=(
  nextjs typescript react tailwindcss radix-ui framer-motion zod biome vitest
  legaltech legal-practice-management lpms case-management law-firm
  social-security brazil massive-intelligence teleologyhi crm
)

say() { printf '%s\n' "$*"; }

command -v gh >/dev/null 2>&1 || {
  say "The gh CLI is not installed, and every operation below needs it."
  exit 1
}
gh auth status >/dev/null 2>&1 || {
  say "The gh CLI is not authenticated. Run: gh auth login"
  exit 1
}
gh repo view "${REPO}" >/dev/null 2>&1 || {
  say "The repository ${REPO} does not exist or is not visible to this account."
  exit 1
}

say "=== Presentation ==="
gh repo edit "${REPO}" --description "${DESCRIPTION}" --homepage "${HOMEPAGE}" >/dev/null
say "Description and homepage applied."

topic_args=()
for topic in "${TOPICS[@]}"; do
  topic_args+=(--add-topic "${topic}")
done
gh repo edit "${REPO}" "${topic_args[@]}" >/dev/null
say "Topics applied: ${#TOPICS[@]}."

say
say "=== Deployment target, written as secrets ==="
for pair in \
  "VPS_HOSTINGER_SSH_IP=${VPS_HOSTINGER_SSH_IP}" \
  "VPS_HOSTINGER_SSH_USER=${VPS_HOSTINGER_SSH_USER}" \
  "DEPLOY_PATH=${DEPLOY_PATH}" \
  "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}"
do
  name="${pair%%=*}"
  value="${pair#*=}"
  gh secret set "${name}" --repo "${REPO}" --body "${value}" >/dev/null
  say "${name} set."
done

say
say "=== Read-only deploy key ==="
if [ -f "${DEPLOY_KEY_PUBLIC}" ]; then
  fingerprint="$(ssh-keygen -lf "${DEPLOY_KEY_PUBLIC}" | awk '{print $2}')"
  if gh repo deploy-key list --repo "${REPO}" 2>/dev/null | grep -q "advprevcrm-lpms read-only deploy key"; then
    say "A deploy key with this title is already registered (${fingerprint})."
  elif gh repo deploy-key add "${DEPLOY_KEY_PUBLIC}" --repo "${REPO}" \
      --title "advprevcrm-lpms read-only deploy key" >/dev/null 2>/tmp/deploy-key.err; then
    say "Deploy key registered, read only (${fingerprint})."
  else
    # Never fatal. A public repository is cloned anonymously and needs no key
    # at all, so failing the whole bootstrap over an optional one is the very
    # defect this esteira exists to prevent. The most common reason is that
    # GitHub holds a public key globally unique across the account, so a key
    # registered on a repository that was deleted can still be in use.
    say "The deploy key was not registered, and nothing depends on it while this"
    say "repository is public. Reason reported by GitHub:"
    sed 's/^/  /' /tmp/deploy-key.err | head -3
    say "To use one anyway, mint a fresh pair and register it:"
    say "  ssh-keygen -t ed25519 -f ~/.ssh/advprevcrm_lpms_deploy_ed25519 -N '' -C advprevcrm-lpms-deploy"
    say "  gh repo deploy-key add ~/.ssh/advprevcrm_lpms_deploy_ed25519.pub --repo ${REPO} --title 'advprevcrm-lpms read-only deploy key'"
  fi
else
  say "No public deploy key at ${DEPLOY_KEY_PUBLIC}, and none is needed while"
  say "this repository is public: the server clones over anonymous HTTPS."
fi

say
say "=== Credentials, which this script never handles ==="
present="$(gh secret list --repo "${REPO}" --json name --jq '[.[].name] | join(" ")')"

case " ${present} " in
  *" SERVER_SSH_KEY "*)
    say "SERVER_SSH_KEY present. This is the only secret the deploy requires." ;;
  *)
    say "SERVER_SSH_KEY MISSING. The deploy stops at preflight without it. Run:"
    say "  gh secret set SERVER_SSH_KEY --repo ${REPO} < ~/.ssh/advprevcrm_vps_ed25519" ;;
esac

case " ${present} " in
  *" REPO_DEPLOY_KEY "*)
    say "REPO_DEPLOY_KEY present. The server will fetch over SSH." ;;
  *)
    say "REPO_DEPLOY_KEY absent, which is correct for a public repository."
    say "Needed only if this repository becomes private:"
    say "  gh secret set REPO_DEPLOY_KEY --repo ${REPO} < ~/.ssh/advprevcrm_lpms_deploy_ed25519" ;;
esac

case " ${present} " in
  *" DOTENV_B64 "*)
    say "DOTENV_B64 present. Every deploy replaces the configuration on the server." ;;
  *)
    say "DOTENV_B64 absent. The deploy keeps the .env already on the server."
    say "To push a new configuration, from the project directory:"
    say "  base64 -i .env | gh secret set DOTENV_B64 --repo ${REPO}" ;;
esac

say
say "=== Verification ==="
gh repo view "${REPO}" --json nameWithOwner,description,homepageUrl,visibility,repositoryTopics \
  --jq '{repository: .nameWithOwner, visibility, homepage: .homepageUrl, topics: (.repositoryTopics | length), described: (.description | length > 0)}'
say "Secrets: ${present}"
say
say "Bootstrap complete. The deploy workflow can be dispatched with:"
say "  gh workflow run \"Deploy to VPS\" --repo ${REPO} --ref main"
