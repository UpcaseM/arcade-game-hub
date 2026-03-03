# Main Iterative Optimization Plan

Updated: 2026-03-03
Scope: `dojo-brawler` + `dou-shou-qi`

## Goal
Give `main` a high-level but executable workflow that splits work into small tasks, increases iterations, and reduces single-task timeout risk.

## Global Execution Rules (for main)
1. Always run route first:
   - `~/.openclaw/workflows/coding/ship route "<project_path> :: <goal>"`
2. Keep each ship goal to one micro-slice (one behavior change + matching tests).
3. Prefer `SHIP_MAX_LOOPS=2` for each micro-slice; only raise to `3` when a slice has review fallout.
4. After each delivered slice, push branch immediately (no large local backlog).
5. Release to `main` only on explicit approval.

## Track A: dojo-brawler (High-Level Optimization)

### A0 Baseline (no logic change)
- Objective: establish measurable baseline and guardrails.
- Deliverables:
  - add a tiny script/checklist for FPS/input latency manual evidence
  - document current gameplay parameters (speed, cooldown, damage)
- Gate:
  - manual smoke on desktop + mobile viewport

### A1 Runtime modularization
- Objective: split `game.js` into small modules without gameplay changes.
- Suggested slices:
  - `constants/config`
  - `input controller`
  - `combat rules (pure functions)`
  - `render helpers`
- Gate:
  - behavior parity checklist (no regression)

### A2 Deterministic combat tests
- Objective: make collision/attack/HP logic testable.
- Suggested slices:
  - extract pure combat functions
  - add minimal test runner (Vitest or Node test)
  - add tests for hitbox overlap, invulnerability, KO flow
- Gate:
  - tests pass + gameplay parity

### A3 Mobile input hardening
- Objective: reduce touch edge-case failures.
- Suggested slices:
  - pointer capture/cancel edge handling
  - joystick dead-zone tuning + attack hold debounce
  - add manual matrix for rotate/background-resume
- Gate:
  - manual mobile matrix pass

### A4 AI + difficulty tuning
- Objective: improve replayability with low risk.
- Suggested slices:
  - easy/normal/hard parameter presets
  - retreat/strafe thresholds externalized to config
  - basic telemetry counters (round length, hits landed)
- Gate:
  - balance checklist pass

## Track B: dou-shou-qi (Push and Stabilization)

### B1 Already-fixed join flow verification
- Current fix on branch:
  - join recovery now tolerates non-standard provider claim errors if room owner is same guest
  - regression test added in `src/net/onlineSession.test.ts`
- Gate:
  - `npm --prefix dou-shou-qi test`
  - `npm --prefix dou-shou-qi run lint`

### B2 Integration checks
- Gate:
  - `node --test tools/auth.test.mjs`
  - `node tools/validate-static-paths.mjs`
  - `node tools/verify-review-artifacts.mjs`

### B3 Delivery
- Push feature branch after green gates.
- Optional release command only with explicit approval:
  - `python3 ~/.openclaw/workflows/coding/status.py release --run-id <run_id> --target-branch main`

## Suggested Micro-task Queue (main can run directly)
1. `dojo-brawler :: A0 baseline checklist + parameter doc only`
2. `dojo-brawler :: A1 split constants and input controller only`
3. `dojo-brawler :: A2 extract combat pure functions + first 3 tests`
4. `dojo-brawler :: A3 touch edge-case hardening only`
5. `dou-shou-qi :: B1/B2 verify join-room fix and all gates`

Each item should be a separate ship run with small diff and immediate push.
