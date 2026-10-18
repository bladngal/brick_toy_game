# Code Project

This folder is a software repository. Treat it like a normal coding project: read existing code and docs first, follow established conventions, and make changes that are minimal and reviewable.

## Defaults

- Prefer working with the project's existing tools and scripts (build, test, lint, format).
- Avoid broad rewrites unless explicitly asked; incremental changes are preferred.
- Ask before adding new dependencies or changing the project's architecture.
- Keep secrets out of the repo. Use `.env.example` for example environment variables.

## Layout (Suggested, Not Required)

Common folders you may see (or choose to create if asked) include:

- `src/` — Application/library code
- `tests/` — Tests
- `scripts/` — Automation scripts
- `docs/` — Design docs and notes
- `examples/` — Usage examples and demos

---

## Capture Intent, Not Just Deliverables

When the user asks for something, two things are happening:

1. **The deliverable** — the artifact being requested
2. **The intent** — the concerns, constraints, tensions, and reasoning that shape *how* and *why* it should be built

**Do not let intent evaporate.** Intent is metadata that must be stored alongside the work, not consumed once and discarded.

- Future iterations need access to the full thinking
- Related work shares the same concerns and constraints
- The nuance IS the value — without it, future work loses critical context

When the user shares intent while requesting work, capture it in a context or notes file alongside the artifact. If you sense you're missing intent, ask — or note the gap.

---

## Preserve Nuance

**Do not over-summarize.** When capturing information:

- Keep the user's exact phrasing where it carries meaning
- Do not round nuanced positions into clean categories
- When in doubt, quote directly rather than paraphrase
- If something is "just short of a hard requirement" — say that, don't simplify to "requirement" or "preference"

---

## File Naming Conventions

Use a **TYPE prefix** in uppercase at the start of filenames so files of the same kind sort together:

```
PROMPT_campaign_brief.md
SCRIPT_intro_sequence.md
NOTES_stakeholder_feedback.md
OUTLINE_video_structure.md
DRAFT_announcement_letter.md
```

The prefix describes what the file *is*, not its topic. Choose a clear, short type name that fits the content.

### Versioning

For **minor edits** (typos, small tweaks, additions), edit the file in place.

For **major revisions** (rewrites, new direction, structural changes), create a new version:

```
SCRIPT_intro_sequence_v01.md
SCRIPT_intro_sequence_v02.md
```

This preserves the ability to compare or revert without relying on git history alone.

---

## Long-Term Memory

Keep durable project memory in this file, not in `CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`.

- Use this section for decisions, non-obvious constraints, stable preferences, and important context worth carrying forward.
- Prefer appending dated bullets so future runs can track why decisions were made.
- Keep temporary task notes in normal working docs; only keep long-lived context here.

### Decision Log

- **2026-10-17**: Built the project as a zero-build, instant-play 3D browser game using ES Modules and Three.js (`index.html` + `src/`), matching the user's preference for a 3D Three.js browser game that runs immediately without complex build tooling.
- **2026-10-17**: Core gameplay centers on a toy minifigure avatar exploring a flower garden (trees, benches, water fountains, flower beds, lamps, fences) where every prop is assembled from individual studded toy bricks that detach into physical 3D brick pieces when hit, kicked, or jumped on.
- **2026-10-17**: Included three user-selected mechanics: (1) collectible spinning studs with a score/True Builder counter, (2) procedural Web Audio API sound effects (plastic brick clatter, smash impacts, stud chimes, footsteps, fountain water), and (3) manual + optional auto-timer rebuild mechanics that magnetically snap scattered bricks back into place.
- **2026-10-17**: Added 14 multi-tiered studded brick clouds floating and bobbing across the sky (`y = 6.8–10.4`) and lowered the default camera pitch (`0.31 rad`) so the clouds are clearly visible in the upper sky during normal play while remaining purely decorative ("just for fun, not for smashing") and excluded from smashable prop counts.


