# Contributing to Pebble

Thanks for taking the time to help out! Pebble is in **alpha**, so contributions of every size — bug reports, fixes, docs, ideas — are genuinely useful right now.

## Found a bug?

[Open an issue](https://github.com/skyf0xx/Pebble/issues). A good report includes:

- What you did and what you expected to happen
- What actually happened (errors, screenshots, console output)
- Your environment — OS, browser, and how you launched Pebble (binary vs. dev server)

Since we're alpha, please [search existing issues](https://github.com/skyf0xx/Pebble/issues) first — someone may already have hit the same rough edge.

## Want to contribute code?

1. **Fork** the repo and create a branch off `master`.
2. **Set up locally** — see [DEVELOPERS.md](./DEVELOPERS.md):
   ```bash
   git clone https://github.com/skyf0xx/Pebble.git
   cd Pebble
   npm install
   npm run dev          # Vite dev server on http://localhost:5173
   ```
3. **Read the context** before you start — these explain the *why* and the house rules:
   - [CLAUDE.md](./CLAUDE.md) — product context, design system, component naming, project structure
   - [SPEC.md](./SPEC.md) — product spec and vision
   - [TODO.md](./TODO.md) — build order and backlog
4. **Make your change**, keeping it lean — Pebble is a static PWA with no backend, and we'd like to keep it that way.
5. **Open a PR** against `master` with a clear description of what changed and why.

## Style & conventions

- **Match the surrounding code** — naming, structure, and idioms. Use the exact component names listed in [CLAUDE.md](./CLAUDE.md) (e.g. `SetupScreen`, `SessionRow`, `StatusIcon`).
- **Follow the design language** — palette, typography, radius, spacing, and copy tone are all documented in [CLAUDE.md](./CLAUDE.md). Copy stays calm and human; never say "AI".
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/) — e.g. `feat:`, `fix:`, `docs:`, `refactor:`.
- **Keep PRs focused** — one logical change per PR is easier to review.

## Roadmap notes

Pebble talks to [Hermes](https://github.com/nousresearch/hermes-agent) agents today, behind a small adapter layer ([`src/lib/adapters/`](./src/lib/adapters/)). Support for other hosts is on the roadmap — see [DEVELOPERS.md](./DEVELOPERS.md) if you'd like to help get there.

---

By contributing, you agree that your contributions are licensed under the project's [MIT License](./LICENSE).
