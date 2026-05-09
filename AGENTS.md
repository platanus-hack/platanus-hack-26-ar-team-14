# Style Guide

Core principles for writing code and prompts in this repo. Read this before contributing — human or AI.

> **File sync note:** `AGENTS.md` is the canonical file. `CLAUDE.md` is a symlink to it (`CLAUDE.md -> AGENTS.md`), and `STYLE_GUIDE.md` mirrors the same content. When editing, change `AGENTS.md` and re-copy to `STYLE_GUIDE.md` so all three stay in sync. If the symlink is ever broken, restore with: `rm CLAUDE.md && ln -s AGENTS.md CLAUDE.md`.

---

## Part 1 — Software Design Principles

### 1. Simplicity first
- **YAGNI** (You Aren't Gonna Need It): don't build for hypothetical futures. Three similar lines beats a premature abstraction.
- **KISS**: the dumbest solution that works is usually the right one. Reach for cleverness only when you've earned it.
- **Rule of three**: don't extract a helper until you see the same shape three times.

### 2. Don't repeat yourself — but don't over-DRY
- Deduplicate *knowledge*, not *coincidental similarity*. Two functions that look alike today but model different concepts will diverge tomorrow.
- A small amount of repetition is cheaper than the wrong abstraction.

### 3. Single responsibility
- Each function, module, and component does one thing. If you need "and" to describe it, split it.
- Name things by what they *do* for the caller, not how they're implemented.

### 4. Explicit over implicit
- Prefer named arguments, typed signatures, and obvious control flow.
- No magic globals, no hidden side effects in constructors, no surprises from imports.

### 5. Boundaries and trust
- Validate at system boundaries (user input, network, external APIs). Trust internal callers — defensive checks inside trusted code is noise.
- Keep IO at the edges; keep the core pure and testable.

### 6. Fail loud, fail fast
- Crash on impossible states rather than silently coercing them. A swallowed error is a bug factory.
- No empty `catch` blocks. If you catch, you handle — or you re-raise with context.

### 7. Composition over inheritance
- Small functions and plain data, composed. Reach for class hierarchies only when the domain genuinely demands them.

### 8. Code is read more than written
- Optimize for the next reader (often: future you in six weeks).
- Names carry the weight. A good name removes the need for a comment.
- Comments explain *why*, never *what*. If the code needs a comment to say what it does, rename it.

### 9. Make the change easy, then make the easy change
- If a change feels hard, the structure is wrong. Refactor first (in a separate commit), then make the actual change in a clean diff.

### 10. Small, reversible steps
- Prefer many small commits over one heroic PR.
- Every commit should leave the codebase working. Bisect-friendly history is a gift to your future self.

### 11. Tests are part of the design
- If something is hard to test, it's usually hard to use. Listen to the test.
- Test behavior, not implementation. Mock at the boundary, not three layers deep.

### 12. Delete fearlessly
- Dead code is a tax. Unused branches, commented-out blocks, "just in case" exports — delete them. Git remembers.

### 13. Don't vibecode dependency versions
- Never hand-write Python package versions in `pyproject.toml` (e.g. `langchain>=1.0.0` pulled from memory). Versions you guess may not exist or may be wrong.
- Always use `uv` to manage Python deps: `uv add <pkg>`, `uv remove <pkg>`, `uv lock`, `uv sync`. Let the resolver pick real versions from the registry.
- Same principle for other ecosystems: use the package manager (`pnpm add`, `cargo add`, etc.), don't type version numbers from memory.

### 14. Config and env vars (backend)
- All env vars must be declared as typed fields on `Settings` in `backend/app/config.py`, and consumed via `from app.config import settings`. **Never read `os.environ` directly** in app code.
- `pydantic-settings` only loads fields it knows about. An undeclared var won't be in `os.environ` when the app boots via `fastapi dev` (no implicit `dotenv.load_dotenv()` happens), so any `os.environ["FOO"]` access silently 500s — and if it sits inside a tool, the agent's error middleware turns it into a "tool unavailable" message and the model fabricates a plausible-looking answer. Past incident: `OPENROUTER_API_KEY` was read directly from `os.environ` in `curriculum/store.py`; the embedding call failed at request time and the agent invented page numbers for the Programa de Estudio.
- When you add a new env var: add the field to `Settings` (with `SecretStr` for credentials), reference it in `.env.example`, and use `settings.<field>` in code.

### 15. Prefer a BFF boundary for frontend work
- Default to this flow for user-facing product features: `Frontend -> Frontend Backend / BFF -> Main Backend / Internal Services`.
- The frontend should not call the main backend or internal services directly unless there is a very explicit, reviewed reason to do so.
- The BFF exists to hide internal service URLs and implementation details from the frontend.
- The BFF is where we protect secrets, API keys, and service-specific credentials, and where we handle auth or session logic when that belongs close to the frontend experience.
- The BFF may adapt backend responses into frontend-shaped payloads, aggregate multiple backend calls into one endpoint, and enforce frontend-specific validation or access rules.
- When building new frontend features, prefer adding or updating BFF endpoints over introducing direct frontend-to-main-backend calls.

---

## Part 2 — Prompting Principles (for working with LLMs in this repo)

### 1. Be specific about the goal
- State *what* you want and *why*. The why lets the model make sensible judgment calls when the what is ambiguous.
- Bad: "fix the bug." Good: "the `/login` route 500s when email contains a `+`. Fix the regex in `auth/validate.py`."

### 2. Give the model the context it needs — and no more
- Include the exact file paths, function names, error messages, and constraints.
- Don't paste an entire codebase when three files would do. Noise dilutes signal.

### 3. Constrain the output shape
- Say what form you want: a diff, a one-paragraph summary, a JSON object, a checklist. Models drift toward verbose prose unless redirected.
- For code: specify the language, the file, and whether you want full file vs. patch.

### 4. Separate instructions from data
- Use clear delimiters (markdown headings, fenced blocks, XML tags) so the model can tell directives apart from content it's operating on.

### 5. Show, don't just tell
- One example of the desired output is worth a paragraph of description. Two examples cover the edge cases.

### 6. Decompose hard tasks
- Multi-step work fails as a single prompt. Break it into stages: *understand → plan → implement → verify*. Let the model finish each stage before starting the next.

### 7. Ask for reasoning when correctness matters
- For non-trivial logic, ask the model to think through the problem before producing the answer. For simple lookups, skip it — reasoning on trivia wastes tokens.

### 8. Verify, don't trust
- LLM output is a draft. Read the diff, run the tests, check the citations. A confident-sounding wrong answer is the default failure mode.
- "It compiled" is not "it's correct."

### 9. Iterate in tight loops
- Short prompt → check output → refine. Long monolithic prompts hide which instruction caused which behavior.

### 10. Prefer recent, authoritative sources
- For library and API questions, fetch current docs (e.g. via context7 or the project's own files) rather than relying on model memory. Training data goes stale.

### 11. State your role and the model's role
- "You are reviewing a PR" vs. "you are writing this from scratch" produces very different output. Make it explicit.

### 12. Negative instructions are weak
- "Don't be verbose" works less well than "respond in two sentences." Tell the model what to do, not what to avoid, whenever possible.

### 13. Memory and persistence
- Save lessons learned (corrections, validated approaches, project context) so the next session doesn't relearn them.
- Don't memorize what's already in the code — that's what `grep` is for.

---

## Applying this guide

- Before opening a PR, skim Part 1 against your diff. If a principle is violated, have a reason.
- When prompting an AI assistant on this repo, apply Part 2 — especially specificity, decomposition, and verification.
- This guide is living. If a principle stops serving us, change it (in a PR, with a reason).
