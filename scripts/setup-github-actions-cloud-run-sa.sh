#!/usr/bin/env bash
# One-time setup: store a GCP service account JSON key as GitHub secret GCP_SA_KEY.
# You do NOT need gcloud installed for day-to-day deploys — GitHub Actions uses gcloud
# on the runner. This script only needs `gh` (and a key file from the Cloud Console).
#
# Usage:
#   1. Follow the Console steps printed below (or pass an existing key):
#        ./scripts/setup-github-actions-cloud-run-sa.sh /path/to/key.json
#   2. Push .github/workflows/deploy-api-cloud-run.yml to main (if not already).

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-fast-ability-283416}"
SA_ID="${SA_ID:-github-actions-cloud-run}"
SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
REPO="${REPO:-trevor-sutherland/app-espn-lines-mono}"
SECRET_NAME="${SECRET_NAME:-GCP_SA_KEY}"

print_console_steps() {
  cat <<EOF
=== Create the service account in Google Cloud Console (no local gcloud) ===

1. Open IAM → Service accounts (project ${PROJECT_ID}):
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=${PROJECT_ID}

2. Click "+ CREATE SERVICE ACCOUNT"
   - Name: ${SA_ID}
   - ID:   ${SA_ID}
   - Click Create and continue

3. Grant these roles, then Continue → Done:
   - Cloud Run Admin          (roles/run.admin)
   - Artifact Registry Writer (roles/artifactregistry.writer)
   - Service Account User     (roles/iam.serviceAccountUser)

4. Open the new SA → Keys → Add key → Create new key → JSON → Create
   Save the downloaded file somewhere outside the git repo
   (e.g. ~/Downloads/${SA_ID}.json). Do NOT commit it.

5. Run this script with that file:
   ./scripts/setup-github-actions-cloud-run-sa.sh ~/Downloads/${SA_ID}.json

EOF
}

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh (GitHub CLI) is required to set the repository secret." >&2
  exit 1
fi

KEY_FILE="${1:-}"
if [[ -z "${KEY_FILE}" ]]; then
  print_console_steps
  echo "error: pass the path to the downloaded JSON key file." >&2
  exit 1
fi

if [[ ! -f "${KEY_FILE}" ]]; then
  echo "error: key file not found: ${KEY_FILE}" >&2
  exit 1
fi

# Basic sanity check without printing secret contents
if ! grep -q '"type": "service_account"' "${KEY_FILE}"; then
  echo "error: ${KEY_FILE} does not look like a GCP service account JSON key." >&2
  exit 1
fi

echo "Setting GitHub Actions secret ${SECRET_NAME} on ${REPO} ..."
gh secret set "${SECRET_NAME}" --repo "${REPO}" < "${KEY_FILE}"
echo "Done. Secret ${SECRET_NAME} is set."
echo
echo "Next:"
echo "  - Commit and push .github/workflows/deploy-api-cloud-run.yml to main"
echo "  - Or: GitHub → Actions → \"Deploy API to Cloud Run\" → Run workflow"
echo "  - Confirm: https://spreadhead-picks-api-259735889792.us-central1.run.app/health"
echo
echo "You can delete the local key file after the secret is stored:"
echo "  rm ${KEY_FILE}"
