# Fitness Hub Premium Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the repo-side blockers keeping Fitness Hub below premium readiness, including repeatable live Clerk role-matrix QA for disposable test identities.

**Architecture:** Use the JSON execution contract at `docs/superpowers/plans/2026-05-09-premium-hardening-execution-plan.json`. Keep edits in the canonical pnpm monorepo and preserve the current AI workout upgrade worktree.

**Tech Stack:** pnpm, Node 22 via mise, Express, Zod, Clerk, React/Vite, Expo, Playwright, Node test runner.

---

## Task Order

- [ ] T0: Validate plan and baseline.
- [ ] T1: Clear high dependency audit findings.
- [ ] T2: Remove member debug leakage.
- [ ] T3: Harden mutating API validation.
- [ ] T4: Add AI quality regression fixtures.
- [ ] T5: Polish covered UX states.
- [ ] T6: Add performance stress gate.
- [ ] T6.5: Add live Clerk role-matrix gate.
- [ ] T7: Final release gate and rerating.

## Self-Review

- Files are mapped in the JSON contract.
- Every task has exact verification commands.
- Live Clerk QA is test-instance only by default and refuses non-`sk_test_` mutation unless explicitly overridden.
