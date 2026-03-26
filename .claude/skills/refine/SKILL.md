---
name: refine
description: Review local changes (or a PR) for quality, correctness, and efficiency, then fix all findings structurally and verify with pnpm check.
---

# Refine: Review → Fix → Check

Review local changes (or a PR), fix all findings structurally, and verify with `pnpm check`.

---

## Phase 1: Identify Changes

If a PR number is given as an argument, use `gh pr diff <number>`.
Otherwise, use `git diff` (or `git diff HEAD` if there are staged changes) to get local changes.
If there are no changes, review the files most recently edited in this conversation.

Check the diff size. If the changed lines exceed ~800, split the diff by file for Phase 2 agents instead of passing the entire diff. When splitting, group related files into the same chunk (e.g., a type definition file and the files that import those types) so cross-file relationships are not missed.

---

## Phase 2: Simplify Review (3 Agents in Parallel)

Launch 3 agents **simultaneously in a single message** using the Agent tool.

### Shared Instructions (include at the top of each agent's prompt)

- Attach the target diff (split by file if over 800 lines).
- Before flagging an issue, use Grep/Read to check surrounding code and understand existing implementations. Prioritize searching within the same directory and immediate neighbors of changed files. Expand scope only when the change references modules from other layers.
- Output format: `- [file:line-range] category — suggested fix (one sentence)`
- Do NOT flag CLAUDE.md convention violations here — that is handled in Phase 4.

### Agent 1: Code Reuse Review

For each change:

1. **Search for existing utilities and helpers** that could replace newly written code. Look for similar patterns elsewhere in the codebase — common locations are utility directories, shared modules, and files adjacent to the changed ones.
2. **Flag any new function that duplicates existing functionality.** Suggest the existing function to use instead.
3. **Flag any inline logic that could use an existing utility** — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns are common candidates.

### Agent 2: Code Quality Review

Review the same changes for hacky patterns:

1. **Redundant state**: state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls
2. **Parameter sprawl**: adding new parameters to a function instead of generalizing or restructuring existing ones
3. **Copy-paste with slight variation**: near-duplicate code blocks that should be unified with a shared abstraction
4. **Leaky abstractions**: exposing internal details that should be encapsulated, or breaking existing abstraction boundaries
5. **Stringly-typed code**: using raw strings where constants, enums (string unions), or branded types already exist in the codebase
6. **Unnecessary JSX nesting**: wrapper Boxes/elements that add no layout value — check if inner component props (flexShrink, alignItems, etc.) already provide the needed behavior

### Agent 3: Efficiency Review

Review the same changes for efficiency:

1. **Unnecessary work**: redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns
2. **Missed concurrency**: independent operations run sequentially when they could run in parallel
3. **Recurring no-op updates**: state/store updates inside polling loops, intervals, or event handlers that fire unconditionally — add a change-detection guard so downstream consumers aren't notified when nothing changed. Also: if a wrapper function takes an updater/reducer callback, verify it honors same-reference returns (or whatever the "no change" signal is) — otherwise callers' early-return no-ops are silently defeated
4. **Unnecessary existence checks**: pre-checking file/resource existence before operating (TOCTOU anti-pattern) — operate directly and handle the error
5. **Memory**: unbounded data structures, missing cleanup, event listener leaks
6. **Overly broad operations**: reading entire files when only a portion is needed, loading all items when filtering for one

---

## Phase 3: Fix Simplify Findings

Wait for all 3 agents to complete. Consolidate findings and fix them directly.

If agents contradict each other (e.g., Agent 1 says "use existing utility X" while Agent 2 flags X as a leaky abstraction), read the code to decide which finding is actionable. Prefer the fix that reduces overall complexity.

After fixing, run `pnpm check` to catch breakage early. Fix any failures before proceeding.

---

## Phase 4: Correctness Review

Re-run `git diff` (or `git diff HEAD`) to capture the full change set including Phase 3 fixes. Review everything:

1. **Code correctness**: logic errors, missed edge cases, off-by-one, null/undefined handling
2. **CLAUDE.md conventions**: read CLAUDE.md directly and verify compliance with neverthrow, fail-fast, signals, frame-based battle, comment conventions, etc.
3. **Architectural performance**: algorithm choice, signal graph dependency structure, rendering boundaries — skip mechanical patterns (N+1, etc.) already caught in Phase 2
4. **Test coverage**: whether tests sufficiently cover the changes, impact on existing tests
5. **Security**: injection, XSS, handling of untrusted input

Fix any issues found **structurally**. Symptomatic fixes (adding comments, replacing with console.warn, defensive fallbacks) are not allowed.

---

## Phase 5: Verify

Run `pnpm check`. If it fails, fix the cause and re-run. **Repeat until exit code 0.**

If a pre-existing issue (not caused by this change) is found, fix it as well and continue.

Once complete, provide a concise summary of all fixes made.
