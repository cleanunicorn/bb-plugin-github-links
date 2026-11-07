// bb-plugin-github-links — shows Issues / Pull requests links for every
// project whose git remote is a GitHub repository.
import { useEffect, useState } from "react";
import {
  definePluginApp,
  experimental_Icon as Icon,
  experimental_useSidebarThreads,
  useBbNavigate,
  useSdk,
} from "@get-bb/plugin-sdk/app";

interface Repo {
  id: string;
  name: string;
  url: string;
}

/** Parses https, ssh, and scp-style GitHub remotes into a web URL. */
export function githubRepoUrl(remote: string | null | undefined): string | null {
  if (!remote) return null;
  const m = remote
    .trim()
    .match(/^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/git@|git@)github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

/** Map of projectId -> GitHub web URL, for projects with a GitHub remote. */
function useRepoMap(): Map<string, string> {
  const { repos } = useRepos();
  return new Map((repos ?? []).map((r) => [r.id, r.url]));
}

function useRepos() {
  const sdk = useSdk();
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    sdk.projects.list().then(
      (projects) => {
        if (!live) return;
        const out: Repo[] = [];
        for (const p of projects as Array<{ id: string; name: string; gitRemoteUrl?: string | null }>) {
          const url = githubRepoUrl(p.gitRemoteUrl);
          if (url) out.push({ id: p.id, name: p.name, url });
        }
        setRepos(out);
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [sdk]);
  return { repos, error };
}

const linkClass =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground";

function Links() {
  const { repos, error } = useRepos();
  if (error) return <div role="alert" className="text-sm text-destructive">{error}</div>;
  if (!repos) return <div role="status" className="text-sm text-muted-foreground">Loading…</div>;
  if (!repos.length)
    return (
      <div role="status" className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No projects with a GitHub remote.
      </div>
    );
  return (
    <ul className="grid gap-2">
      {repos.map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-xs text-muted-foreground">{r.url.replace("https://github.com/", "")}</span></span>
          <a className={linkClass} href={`${r.url}/issues`} target="_blank" rel="noopener noreferrer">
            <Icon name="CircleDot" className="size-3.5" aria-hidden />
            Issues
          </a>
          <a className={linkClass} href={`${r.url}/pulls`} target="_blank" rel="noopener noreferrer">
            <Icon name="GitPullRequest" className="size-3.5" aria-hidden />
            Pull requests
          </a>
        </li>
      ))}
    </ul>
  );
}

interface ListProps {
  activeThreadId: string | null;
  isCompactViewport: boolean;
  onNavigate: () => void;
}

const VISIBLE_DEFAULT = 6;

function timeAgo(ms: number): string {
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d` : `${Math.floor(d / 30)}mo`;
}

/** Small round icon button / link used for the project actions. */
const actionClass =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

type SidebarThread = ReturnType<typeof experimental_useSidebarThreads>["threads"][number];

function StatusDot({ thread }: { thread: SidebarThread }) {
  const busy = /run|work|busy|progress/i.test(`${thread.indicator ?? ""} ${thread.status ?? ""}`);
  if (busy)
    return <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-label="Working" />;
  if (thread.hasPendingInteraction)
    return <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-label="Needs input" />;
  if (thread.isUnread)
    return <span className="size-2 shrink-0 rounded-full bg-primary/70" aria-label="Unread" />;
  return <span className="size-2 shrink-0" aria-hidden />;
}

function ThreadRow({
  thread,
  active,
  onNavigate,
}: {
  thread: SidebarThread;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <a
      href={thread.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        "group/row flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors " +
        (active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/75 hover:bg-accent/60 hover:text-foreground")
      }
    >
      <StatusDot thread={thread} />
      <span className={"min-w-0 flex-1 truncate " + (thread.isUnread ? "font-medium text-foreground" : "")}>
        {thread.displayTitle || thread.titleFallback || "Untitled"}
      </span>
      {thread.isPinned && <Icon name="Pin" className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{timeAgo(thread.updatedAt)}</span>
    </a>
  );
}

/** Sidebar list: threads grouped by project, GitHub links in each header. */
function ProjectThreadList({ activeThreadId, isCompactViewport, onNavigate }: ListProps) {
  const { status, threads, projects } = experimental_useSidebarThreads();
  const repoMap = useRepoMap();
  const navigate = useBbNavigate();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  if (status !== "ready" && !threads.length)
    return <div role="status" className="p-3 text-sm text-muted-foreground">Loading…</div>;

  const visible = threads
    .filter((t) => !t.isArchived && !t.isHidden)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const pinned = visible.filter((t) => t.isPinned);
  // Hide empty projects unless they have a GitHub repo worth linking to.
  const groups = projects
    .map((p) => ({ p, items: visible.filter((t) => t.projectId === p.id), repo: repoMap.get(p.id) }))
    .filter((g) => g.items.length > 0 || g.repo);
  const reveal = isCompactViewport ? "" : "opacity-0 group-hover/project:opacity-100 group-focus-within/project:opacity-100";

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
      {pinned.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Icon name="Pin" className="size-3" aria-hidden /> Pinned
          </h3>
          {pinned.map((t) => (
            <ThreadRow key={t.id} thread={t} active={t.id === activeThreadId} onNavigate={onNavigate} />
          ))}
        </section>
      )}
      {groups.map(({ p, items, repo }) => {
        const isCollapsed = collapsed.has(p.id);
        const showAll = expanded.has(p.id);
        const shown = showAll ? items : items.slice(0, VISIBLE_DEFAULT);
        return (
          <section key={p.id} className="group/project">
            <div className="flex items-center gap-0.5 rounded-md pr-1 hover:bg-accent/40">
              <button
                type="button"
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left"
                aria-expanded={!isCollapsed}
                onClick={() => setCollapsed((prev) => toggle(prev, p.id))}
              >
                <Icon
                  name={isCollapsed ? "Folder" : "FolderOpen"}
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="truncate text-[13px] font-semibold text-foreground">{p.name}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
              </button>
              <div className={"flex items-center gap-0.5 transition-opacity " + reveal}>
                {repo && (
                  <>
                    <a className={actionClass} href={`${repo}/issues`} target="_blank" rel="noopener noreferrer" title="GitHub issues" aria-label={`${p.name} issues`}>
                      <Icon name="CircleDot" className="size-3.5" aria-hidden />
                    </a>
                    <a className={actionClass} href={`${repo}/pulls`} target="_blank" rel="noopener noreferrer" title="GitHub pull requests" aria-label={`${p.name} pull requests`}>
                      <Icon name="GitPullRequest" className="size-3.5" aria-hidden />
                    </a>
                  </>
                )}
                <button
                  type="button"
                  className={actionClass}
                  title="New thread"
                  aria-label={`New thread in ${p.name}`}
                  onClick={() => {
                    navigate.toCompose({ projectId: p.id, focusPrompt: true });
                    onNavigate();
                  }}
                >
                  <Icon name="Plus" className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
            {!isCollapsed && (
              <div className="ml-4 mt-0.5 border-l border-border/70 pl-1.5">
                {shown.map((t) => (
                  <ThreadRow key={t.id} thread={t} active={t.id === activeThreadId} onNavigate={onNavigate} />
                ))}
                {items.length > VISIBLE_DEFAULT && (
                  <button
                    type="button"
                    className="h-7 w-full rounded-md px-2 text-left text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded((prev) => toggle(prev, p.id))}
                  >
                    {showAll ? "Show less" : `Show ${items.length - VISIBLE_DEFAULT} more`}
                  </button>
                )}
                {items.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No threads</div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Page() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <h1 className="mb-4 text-lg font-semibold">GitHub links</h1>
        <Links />
      </div>
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.navPanel({
    id: "github-links",
    title: "GitHub links",
    icon: "Github",
    path: "github-links",
    component: Page,
  });
  app.slots.experimental_threadList({
    id: "project-threads",
    title: "Projects with GitHub links",
    description: "Threads grouped by project, with Issues and PRs links in each project header.",
    component: ProjectThreadList,
  });
  app.slots.homepageSection({
    id: "github-links",
    title: "GitHub issues & pull requests",
    component: Links,
  });
});
