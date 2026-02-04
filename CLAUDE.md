# CLAUDE.md - ListBurst Project Guide

## Project Overview

ListBurst is a static site built with Astro 5.x. The project uses TypeScript in strict mode and follows Astro's file-based routing conventions.

## Tech Stack

- **Framework**: Astro 5.17+
- **Language**: TypeScript (strict mode)
- **Module System**: ESM
- **Package Manager**: npm

## Commands

```bash
npm run dev      # Start dev server (localhost:4321)
npm run build    # Build to ./dist/
npm run preview  # Preview production build
```

## Project Structure

```
src/
├── pages/       # File-based routing (index.astro → /)
├── components/  # Reusable .astro components
├── layouts/     # Page layout wrappers (use <slot />)
└── assets/      # Images, SVGs (auto-optimized)
public/          # Static files served as-is
```

## Astro Component Pattern

```astro
---
// Frontmatter: server-side JS/TS
import Component from '../components/Component.astro';
import { Image } from 'astro:assets';
---

<!-- Template -->
<Component />

<style>
  /* Scoped CSS by default */
</style>
```

## Coding Conventions

- Use `.astro` files for pages and components
- Import assets in frontmatter, reference via `.src` property
- CSS is scoped by default in `<style>` blocks
- Use semantic HTML5 elements
- Prefer flexbox for layouts
- Follow BEM-style naming for IDs/classes

## File Naming

- Pages: `kebab-case.astro` (e.g., `about-us.astro`)
- Components: `PascalCase.astro` (e.g., `Welcome.astro`)
- Layouts: `PascalCase.astro` (e.g., `Layout.astro`)

## TypeScript

- Strict mode enabled via `astro/tsconfigs/strict`
- Type definitions in `.astro/types.d.ts` (auto-generated)

## Notes

- No testing framework configured yet
- No integrations/plugins added yet
- Output directory `./dist/` is git-ignored
