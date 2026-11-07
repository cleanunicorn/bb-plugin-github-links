---
name: github-links
description: Explains the GitHub Links plugin, which lists Issues and Pull requests links for each bb project with a GitHub remote.
---

The plugin has no CLI. It reads each project's `gitRemoteUrl` (see `bb project list --json`)
and, for GitHub remotes, links to `<repo>/issues` and `<repo>/pulls` on the GitHub links page
and the new-thread homepage. Projects without a GitHub remote are omitted.
