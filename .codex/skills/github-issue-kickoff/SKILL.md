---
name: github-issue-kickoff
description: Start work on a GitHub issue in a full-stack repository. Use when the user asks things like "mach bitte issue #32 in @github", wants the latest `master` or default branch pulled locally, wants a fresh `codex/issue-...` branch created, and wants backend and frontend work delegated to `dotnet-core-expert` and `react-specialist`.
---

# GitHub Issue Kickoff

## Overview

Use this skill to turn a short "take issue #123" request into a consistent startup workflow: read the issue, sync the base branch, create a work branch, and delegate backend and frontend slices to the right specialists.

## Workflow

1. Resolve the repository, workspace, and issue number from the user's message or the current context.
2. Read the issue with the GitHub plugin before planning implementation. Pull out the goal, constraints, acceptance clues, and likely backend or frontend areas.
3. Check `git status --short` before any branch switch. If the worktree is dirty in a way that could conflict with syncing the base branch, pause and ask instead of stashing, resetting, or overwriting by default.
4. Pick the base branch. Prefer the repo's default branch, but honor `master` when the user explicitly asks for `master`.
5. Sync the base branch with non-interactive commands. Prefer this sequence: `git fetch origin <base>`, `git switch <base>`, `git merge --ff-only origin/<base>`.
6. Create a fresh work branch named `codex/issue-<number>-<slug>` unless the user requests a different pattern. Build the slug from the issue title.
7. Split work into disjoint ownership when the issue spans both server and client concerns.
8. Spawn `dotnet-core-expert` for backend files, APIs, domain logic, migrations, and server-side validation.
9. Spawn `react-specialist` for frontend UI, state flow, API wiring, and client-side validation.
10. Tell each specialist its write scope, remind it that it is not alone in the codebase, and tell it not to revert unrelated edits.
11. Keep the main agent responsible for integration, conflict resolution, verification, and the final user summary.

## Delegation Template

When spawning specialists, include:

- The issue number and a short summary of the goal.
- The workspace path and the exact ownership boundary.
- Repo-specific constraints discovered from the issue or codebase.
- A request to report changed files, risks, and verification performed.

## Verification

Before closing the task:

- Review backend and frontend results together instead of trusting them blindly.
- Run the smallest useful verification per slice, such as targeted `dotnet build`, frontend build, or repo-native test commands. For frontend-heavy issues, also check loading, error, and empty states, responsive behavior, localization, and API contract assumptions.
- Call out anything not verified, anything blocked by missing dependencies, and any assumptions made from the issue text.

## Guardrails

- Do not use interactive git flows.
- Do not stash, reset, or discard user changes unless explicitly asked.
- Do not spawn specialists before the issue and branch context are clear.
- Do not give both specialists overlapping ownership unless coordination is the point of the task.
- Skip the irrelevant specialist when the issue is clearly backend-only or frontend-only.

