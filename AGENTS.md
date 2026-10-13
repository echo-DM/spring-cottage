# Repository Guidelines

## Repository Status

This repository is newly initialized: it currently has no application source, dependency manifests, tests, or commits. The layout and conventions below are starting guidelines. Update this document when the project establishes its implementation and tooling.

## Project Structure & Module Organization

Keep application code in `src/`, automated tests in `tests/`, static assets in `public/`, and implementation or verification notes in `docs/` when those directories become necessary. Group modules by responsibility, and keep related components and helpers together. Store generated build output separately from source and exclude it from version control.

## Build, Test, and Development Commands

No build, test, or development commands are configured yet. When adding tooling, document the exact setup and verification commands in `README.md`.

- For Node.js work, use `pnpm` for dependency management. Define scripts before documenting commands such as `pnpm dev`, `pnpm build`, or `pnpm test`.
- For Python work, use `uv` instead of invoking `pip` directly.
- For Haskell work, use GHC installed through GHCup and Cabal for dependencies, builds, tests, and the REPL.

## Coding Style & Naming Conventions

Follow the conventions of the chosen language consistently. Configure a formatter and linter alongside the first implementation, and document their invocation. Use descriptive module names, `camelCase` for JavaScript or TypeScript functions and variables, and `PascalCase` for components and types. Keep formatting-only changes separate from functional changes.

## Testing Guidelines

No testing framework or coverage threshold is established. Add tests for meaningful behavior as functionality is introduced; use descriptive names that identify the scenario and expected result. Document how to run them. For visual or interactive features, record browser checks and include screenshots when reviewing visible changes.

## Commit & Pull Request Guidelines

There is no existing commit history to establish a convention. Start with concise Conventional Commit messages, such as `feat: add initial scene` or `docs: document local setup`. Keep each commit focused. Pull requests should explain the change, list verification performed, link relevant issues, and include screenshots for visual changes. State any verification that remains incomplete.
