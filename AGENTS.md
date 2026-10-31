# Project instructions

Do not run builds after every change. Run a build only when the user asks or there is concrete evidence of a build error.

Read docs/PROJECT_PLAN.md and the assigned person's handoff before work. Commit and push each verified feature or section. Keep progress records accurate and preserve the agreed team ownership.

Lea and Pranav implementation commits must use the authenticated GitHub account pranavpk-05 and its account-linked commit email. The configured GitHub noreply address reliably attributes commits to that account. Clear inherited GH_TOKEN/GITHUB_TOKEN only in the command process before verifying gh api user; those environment variables can otherwise select a different account. Verify before commits/pushes; do not fall back to Mathew's credentials or rewrite existing Mathew commits. Never store account passwords or tokens in project files.
