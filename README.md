# bb-plugin-github-links

A [bb](https://getbb.app) plugin that adds GitHub **Issues** and **Pull requests**
links next to each project in the sidebar.

- `app.tsx` — the frontend: a project-grouped thread list (`experimental_threadList`),
  a "GitHub links" page, and a homepage section.
- `server.ts` — an empty backend (the manifest requires one). Projects are read
  through the bb SDK in the browser.
- `skills/github-links/SKILL.md` — a short skill describing the plugin to agents.

It replaces bb's built-in thread list while enabled; switch back under
Settings → Appearance → Sidebar.

## Install

```sh
bb plugin install git:https://github.com/cleanunicorn/bb-plugin-github-links
```

## Develop

```sh
npm install
bb plugin install .   # register this directory
bb plugin dev         # rebuild and reload on save
npx tsc --noEmit      # typecheck
```
