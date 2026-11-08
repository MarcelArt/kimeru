import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, linkOptions, useNavigate } from "@tanstack/react-router";
import {
  FlaskConical,
  History,
  Plug,
  ShieldCheck,
  Plus,
  Save,
  Play,
  LoaderCircle,
  ImagePlus,
  X,
  LockKeyhole,
  Menu,
  LogOut,
  KeyRound,
  RefreshCw,
  ChevronRight,
  Trash2,
  Download,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Badge } from "#/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "#/components/ui/dialog";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { cn } from "#/lib/utils";
import { DEFAULT_MODELS } from "#/lib/domain";
import type { Bootstrap, DecisionInput, Run, Workspace } from "#/lib/domain";
import {
  getBootstrap,
  getWorkspace,
  logout,
  savePlayground,
  deletePlayground,
  executeRun,
  getRun,
  deleteRun,
  getConnectionModels,
} from "#/server/api";
import { AuthScreen } from "./AuthScreen";
import { QuestionEditor, newQuestion } from "./QuestionEditor";
import { Results } from "./Results";
import { RunHistory } from "./RunHistory";
import { Connections } from "./Connections";
import { Administration, PasswordDialog } from "./Administration";
import { Modal, Picker, errorMessage, downloadJson } from "./shared";
import { prepareImage } from "./images";
import { ThemeToggle } from "./ThemeToggle";
import {
  editorLink,
  sourceKey,
  useWorkspacePage,
  type EditorSource,
} from "./routing";

function blankInput(workspace: Workspace | null): DecisionInput {
  const connection = workspace?.connections[0];
  return {
    title: "Untitled playground",
    connectionId: connection?.id || "",
    model: connection ? DEFAULT_MODELS[connection.kind][0] : "jev-latest",
    state: "",
    stateFormat: "text",
    questions: [newQuestion("choice", "decision")],
    images: [],
  };
}
function findPlayground(workspace: Workspace | null, id: string) {
  return workspace?.playgrounds.find((playground) => playground.id === id);
}

export function App({
  initialBootstrap,
  initialWorkspace,
}: {
  initialBootstrap: Bootstrap;
  initialWorkspace: Workspace | null;
}) {
  const navigate = useNavigate();
  const page = useWorkspacePage();
  const routeSource = page.view === "playground" ? page.source : null;
  const routeKey = routeSource && sourceKey(routeSource);
  const [bootstrap, setBootstrap] = useState(initialBootstrap);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  // A saved playground named in the URL opens in the first render, so the
  // server-rendered page already shows it.
  const [editorSource, setEditorSourceState] = useState<EditorSource>(() =>
    routeSource?.kind === "playground" &&
    findPlayground(initialWorkspace, routeSource.id)
      ? routeSource
      : { kind: "new" },
  );
  const [draft, setDraft] = useState<DecisionInput>(() => {
    const playground =
      editorSource.kind === "playground" &&
      findPlayground(initialWorkspace, editorSource.id);
    return playground
      ? structuredClone(playground)
      : blankInput(initialWorkspace);
  });
  // A run named in the URL loads after hydration; until then its page shows
  // a loading state instead of an empty draft.
  const [openingRun, setOpeningRun] = useState(() =>
    initialWorkspace && routeSource?.kind === "run" ? routeSource.id : null,
  );
  // Read by the URL sync and by async handlers, which must see the latest
  // values rather than the ones from the render that started them.
  const editorSourceRef = useRef(editorSource);
  const routeKeyRef = useRef(routeKey);
  const playgroundId =
    editorSource.kind === "playground" ? editorSource.id : undefined;
  const [run, setRun] = useState<Run | null>(null);
  const [stale, setStale] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [customModelOpen, setCustomModelOpen] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    kind: "run" | "playground";
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      setSidebarCollapsed(
        window.localStorage.getItem("kimeru-sidebar-collapsed") === "true",
      );
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
    function syncSidebar(event: StorageEvent) {
      if (event.key === "kimeru-sidebar-collapsed" || event.key === null)
        setSidebarCollapsed(event.newValue === "true");
    }
    window.addEventListener("storage", syncSidebar);
    return () => window.removeEventListener("storage", syncSidebar);
  }, []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 681px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileNav(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const signedInAs = workspace?.user.id;
  // Opens what the URL names in the editor. This runs only when the URL or the
  // signed-in user changes. Actions that change the editor themselves update
  // editorSourceRef before navigating, so their navigation is a no-op here.
  useLayoutEffect(() => {
    routeKeyRef.current = routeKey;
    if (
      !routeSource ||
      !workspace ||
      routeKey === sourceKey(editorSourceRef.current)
    )
      return;
    if (routeSource.kind === "new") {
      showEditor(routeSource, blankInput(workspace));
      return;
    }
    if (routeSource.kind === "playground") {
      const playground = findPlayground(workspace, routeSource.id);
      if (playground) showEditor(routeSource, playground);
      else {
        toast.error("Playground not found.");
        void navigate({ to: "/", replace: true });
      }
      return;
    }
    let current = true;
    setOpeningRun(routeSource.id);
    getRun({ data: { id: routeSource.id } })
      .then((saved) => {
        if (current) showEditor(routeSource, saved.input, saved);
      })
      .catch((error) => {
        if (!current) return;
        toast.error(errorMessage(error));
        void navigate({ to: "/runs", replace: true });
      })
      .finally(() => {
        if (current) setOpeningRun(null);
      });
    return () => {
      current = false;
      setOpeningRun(null);
    };
  }, [routeKey, signedInAs]);
  const role = workspace?.user.role;
  useEffect(() => {
    if (page.view === "admin" && role && role !== "admin")
      void navigate({ to: "/", replace: true });
  }, [page.view, role]);
  const connection = workspace?.connections.find(
    (item) => item.id === draft.connectionId,
  );
  const modelOptions = Array.from(
    new Set([
      ...models,
      ...(connection ? DEFAULT_MODELS[connection.kind] : []),
      draft.model,
    ]),
  ).filter(Boolean);
  const incompatible =
    connection?.kind === "cloudflare" &&
    draft.questions.some((question) => question.type === "box");
  let validJson = true;
  if (draft.stateFormat === "json") {
    try {
      JSON.parse(draft.state);
    } catch {
      validJson = false;
    }
  }

  async function refresh() {
    const nextBootstrap = await getBootstrap();
    setBootstrap(nextBootstrap);
    if (!nextBootstrap.user) {
      setWorkspace(null);
      return;
    }
    const nextWorkspace = await getWorkspace();
    setWorkspace(nextWorkspace);
    if (!draft.connectionId && nextWorkspace.connections.length)
      setDraft((value) => ({
        ...value,
        connectionId: nextWorkspace.connections[0].id,
        model: DEFAULT_MODELS[nextWorkspace.connections[0].kind][0],
      }));
  }
  function edit(patch: Partial<DecisionInput>) {
    setDraft((value) => ({ ...value, ...patch }));
    setDirty(true);
    if (run) setStale(true);
  }
  function closeMobileNav() {
    setMobileNav(false);
  }
  function setEditorSource(source: EditorSource) {
    editorSourceRef.current = source;
    setEditorSourceState(source);
  }
  /** Replaces the editor's contents with `input`, identified by `source`. */
  function showEditor(
    source: EditorSource,
    input: DecisionInput,
    savedRun: Run | null = null,
  ) {
    setEditorSource(source);
    setDraft(structuredClone(input));
    setRun(savedRun);
    setStale(false);
    setDirty(false);
    setModels([]);
  }
  /**
   * Keeps the editor's contents but gives them a new identity, such as after
   * saving. If the editor is on screen, its URL changes to match.
   */
  function rebindEditor(source: EditorSource) {
    const onScreen =
      routeKeyRef.current === sourceKey(editorSourceRef.current);
    setEditorSource(source);
    if (onScreen) void navigate({ ...editorLink(source), replace: true });
  }
  function toggleSidebar() {
    const collapsed = !sidebarCollapsed;
    setSidebarCollapsed(collapsed);
    try {
      window.localStorage.setItem("kimeru-sidebar-collapsed", String(collapsed));
    } catch {
      // The current session can still change the sidebar without persistence.
    }
  }
  function newPlayground() {
    showEditor({ kind: "new" }, blankInput(workspace));
    closeMobileNav();
    void navigate({ to: "/" });
  }
  async function save() {
    setSaving(true);
    const startedFor = editorSourceRef.current;
    try {
      const saved = await savePlayground({
        data: { ...draft, id: playgroundId },
      });
      // Skip if Back or Forward opened something else while saving.
      if (editorSourceRef.current === startedFor) {
        if (saved.id !== playgroundId)
          rebindEditor({ kind: "playground", id: saved.id });
        setDirty(false);
      }
      await refresh();
      toast.success("Playground saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  async function execute() {
    if (running) return;
    if (!connection) {
      toast.error("Add and select a provider connection first.");
      return;
    }
    if (!validJson) {
      toast.error("Fix the JSON state before running.");
      return;
    }
    if (incompatible) {
      toast.error(
        "Clef does not support Box. Choose a supporting model or remove the Box question.",
      );
      return;
    }
    if (!draft.questions.length) {
      toast.error("Add at least one question.");
      return;
    }
    if (
      draft.questions.some(
        (question) => !question.id.trim() || !question.instructions.trim(),
      )
    ) {
      toast.error("Each question needs an ID and instructions.");
      return;
    }
    if (
      new Set(draft.questions.map((question) => question.id)).size !==
      draft.questions.length
    ) {
      toast.error("Question IDs must be unique.");
      return;
    }
    setRunning(true);
    const startedFor = editorSourceRef.current;
    try {
      const result = await executeRun({ data: draft });
      // Back or forward can open something else mid-run; these results only
      // belong to the inputs that were sent.
      if (editorSourceRef.current === startedFor) {
        setRun(result);
        setStale(false);
        // The run now records an unsaved draft and its results, so the run's
        // URL reopens both. A saved playground keeps its own URL.
        if (startedFor.kind !== "playground")
          rebindEditor({ kind: "run", id: result.id });
      }
      await refresh();
      if (result.status === "error")
        toast.error(result.error || "The provider request failed.");
      else toast.success("Run completed");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }
  async function discover() {
    if (!connection) return;
    setDiscovering(true);
    try {
      const found = await getConnectionModels({ data: { id: connection.id } });
      setModels(found);
      toast.success(
        `Found ${found.length} model${found.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      toast.error(
        `${errorMessage(error)} You can enter a model name manually.`,
      );
    } finally {
      setDiscovering(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (draft.images.length + files.length > 8) {
      toast.error("Attach up to eight images per playground.");
      return;
    }
    setUploading(true);
    try {
      const prepared = [];
      for (const file of Array.from(files))
        prepared.push(await prepareImage(file));
      edit({ images: [...draft.images, ...prepared] });
      toast.success(
        `${prepared.length} image${prepared.length === 1 ? "" : "s"} attached`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function example() {
    try {
      const response = await fetch("/examples/mug.jpg");
      if (!response.ok)
        throw new Error("The example image could not be loaded.");
      const image = await prepareImage(
        new File([await response.blob()], "mug.jpg", { type: "image/jpeg" }),
      );
      showEditor({ kind: "new" }, {
        ...blankInput(workspace),
        title: "Product listing review",
        stateFormat: "json",
        state: JSON.stringify(
          {
            title: "Ceramic mug",
            description: "A simple mug for everyday coffee.",
            condition: "new",
          },
          null,
          2,
        ),
        images: [image],
        questions: [
          {
            id: "category",
            type: "choice",
            instructions: "Choose the best category for this product listing.",
            criteria: {
              "Home & living": "Objects for everyday living",
              Accessories: "Wearable or personal items",
              Other: "None of these categories",
            },
          },
          {
            id: "listing_quality",
            type: "score",
            instructions:
              "Rate how complete and useful this product listing is.",
            criteria: ["Unusable", "Poor", "Fair", "Good", "Excellent"],
          },
          {
            id: "product_present",
            type: "noul",
            instructions:
              "The image clearly contains the product described in the listing.",
          },
          {
            id: "product_region",
            type: "box",
            instructions: "Locate the full ceramic mug, including its handle.",
            targetImageId: image.id,
          },
        ],
      });
      setDirty(true);
      closeMobileNav();
      void navigate({ to: "/" });
      toast(
        "Example inputs loaded. Run with your provider to get real results.",
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "run")
        await deleteRun({ data: { id: deleteTarget.id } });
      else await deletePlayground({ data: { id: deleteTarget.id } });
      const removed = sourceKey(deleteTarget);
      if (sourceKey(editorSourceRef.current) === removed) {
        // Its URL no longer opens anything, so the editor becomes a new
        // draft. A deleted run's inputs stay in it, unsaved.
        const onScreen = routeKeyRef.current === removed;
        if (deleteTarget.kind === "playground")
          showEditor({ kind: "new" }, blankInput(workspace));
        else setEditorSource({ kind: "new" });
        if (onScreen) void navigate({ to: "/", replace: true });
      }
      if (deleteTarget.id === run?.id) setRun(null);
      setDeleteTarget(null);
      await refresh();
      toast.success("Deleted");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }
  async function signOut() {
    try {
      await logout();
      setWorkspace(null);
      setBootstrap({ needsSetup: false, user: null });
      showEditor({ kind: "new" }, blankInput(null));
      void navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (!bootstrap.user || !workspace)
    return (
      <AuthScreen needsSetup={bootstrap.needsSetup} onSignedIn={refresh} />
    );
  const user = workspace.user;
  // The Playground item returns to whatever the editor holds, unsaved
  // changes included.
  const navigation = [
    {
      title: "Playground",
      icon: FlaskConical,
      link: editorLink(editorSource),
    },
    { title: "Run history", icon: History, link: linkOptions({ to: "/runs" }) },
    {
      title: "Connections",
      icon: Plug,
      link: linkOptions({ to: "/connections" }),
    },
  ];
  const editorLoading =
    routeSource?.kind === "run" && openingRun === routeSource.id;
  const navigationContent = (
    <>
      <div className="brand" aria-label="Kimeru">
        <img className="brand-mark" src="/brand/kimeru.svg" alt="" width={24} height={24} />
        <span className="sidebar-label">kimeru</span>
        <Button
          className="mobile-nav-close"
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        >
          <X />
        </Button>
      </div>
      <Button
        variant="outline"
        className="new-playground-button"
        aria-label="New playground"
        title="New playground"
        onClick={newPlayground}
        disabled={running}
      >
        <Plus data-icon="inline-start" />
        <span className="sidebar-label">New playground</span>
      </Button>
      <nav className="primary-nav" aria-label="Workspace">
        {navigation.map((item) => (
          <Link
            {...item.link}
            key={item.title}
            className="nav-link"
            activeOptions={{ exact: true }}
            aria-label={item.title}
            title={item.title}
            onClick={closeMobileNav}
          >
            <item.icon />
            <span className="sidebar-label">{item.title}</span>
          </Link>
        ))}
      </nav>
      <div className="library-label">
        Your playgrounds <span>{workspace.playgrounds.length}</span>
      </div>
      <div className="library-list">
        {workspace.playgrounds.length ? (
          workspace.playgrounds.map((playground) => (
            <div
              className={cn(
                "library-entry",
                routeKey === `playground:${playground.id}` && "active",
              )}
              key={playground.id}
            >
              <Link
                to="/playgrounds/$playgroundId"
                params={{ playgroundId: playground.id }}
                activeOptions={{ exact: true }}
                disabled={running}
                onClick={closeMobileNav}
                title={playground.title}
                aria-label={playground.title}
              >
                <FileText className="library-icon" aria-hidden="true" />
                <span className="sidebar-label">{playground.title}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${playground.title}`}
                onClick={() => {
                  setMobileNav(false);
                  setDeleteTarget({
                    id: playground.id,
                    title: playground.title,
                    kind: "playground",
                  });
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))
        ) : (
          <p className="library-empty">Saved playgrounds will appear here.</p>
        )}
      </div>
      <button
        className="example-link"
        aria-label="Load example inputs"
        title="Load example inputs"
        onClick={example}
        disabled={running}
      >
        <Plus />
        <span className="sidebar-label">Load example inputs</span>
      </button>
      <div className="sidebar-bottom">
        {user.role === "admin" && (
          <Link
            to="/admin"
            className="nav-link"
            activeOptions={{ exact: true }}
            aria-label="Administration"
            title="Administration"
            onClick={closeMobileNav}
          >
            <ShieldCheck />
            <span className="sidebar-label">Administration</span>
          </Link>
        )}
        <button
          className="nav-link"
          aria-label="About this workspace"
          title="About this workspace"
          onClick={() => {
            setMobileNav(false);
            setHelpOpen(true);
          }}
        >
          <CircleHelp />
          <span className="sidebar-label">About this workspace</span>
        </button>
        <button
          className="nav-link"
          aria-label="Change password"
          title="Change password"
          onClick={() => {
            setMobileNav(false);
            setPasswordOpen(true);
          }}
        >
          <KeyRound />
          <span className="sidebar-label">Change password</span>
        </button>
        <div className="account-row">
          <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <div className="account-details">
            <strong>{user.name}</strong>
            <span>
              {user.role === "admin" ? "Administrator" : "Personal workspace"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            title="Sign out"
            onClick={signOut}
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </>
  );
  return (
    <div className="application" data-sidebar-collapsed={sidebarCollapsed}>
      <aside id="workspace-sidebar" className="app-sidebar desktop-sidebar">
        {navigationContent}
      </aside>
      <Dialog open={mobileNav} onOpenChange={setMobileNav}>
        <DialogContent
          className="mobile-navigation top-0 left-0 translate-x-0 translate-y-0"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!passwordOpen && !helpOpen && !deleteTarget)
              menuTrigger.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a playground or manage your workspace.
          </DialogDescription>
          <div className="app-sidebar mobile-sidebar">{navigationContent}</div>
        </DialogContent>
      </Dialog>
      <main className="app-main">
        <header className="app-topbar">
          <div className="breadcrumb">
            <Button
              className="sidebar-toggle"
              variant="ghost"
              size="icon"
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-controls="workspace-sidebar"
              aria-expanded={!sidebarCollapsed}
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <Button
              ref={menuTrigger}
              className="mobile-menu-button"
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu />
            </Button>
            <span className="breadcrumb-parent">Workspace</span>
            <ChevronRight className="breadcrumb-parent" />
            <span>
              {page.view === "playground"
                ? editorLoading
                  ? "Opening run…"
                  : draft.title
                : page.view === "history"
                  ? "Run history"
                  : page.view === "connections"
                    ? "Connections"
                    : "Administration"}
            </span>
          </div>
          <div className="topbar-actions">
            <Badge variant="outline">
              <LockKeyhole />
              Private workspace
            </Badge>
            <ThemeToggle />
          </div>
        </header>
        {page.view === "connections" ? (
          <Connections
            user={user}
            connections={workspace.connections}
            refresh={refresh}
          />
        ) : page.view === "admin" ? (
          user.role === "admin" && <Administration currentUser={user} />
        ) : page.view === "history" ? (
          <RunHistory
            runs={workspace.runs}
            onDeleteRun={(item) =>
              setDeleteTarget({ id: item.id, title: item.title, kind: "run" })
            }
          />
        ) : editorLoading ? (
          <div className="loading-area" role="status" aria-label="Opening run">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          <>
            <div className="playground-heading">
              <div>
                <Input
                  className="playground-title"
                  aria-label="Playground title"
                  value={draft.title}
                  onChange={(event) => edit({ title: event.target.value })}
                  disabled={running}
                />
                <p>
                  {dirty
                    ? "Unsaved changes"
                    : playgroundId
                      ? "Saved playground"
                      : "Give your model context. Ask a useful question."}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={save}
                disabled={saving || running}
              >
                {saving ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Save
              </Button>
            </div>
            <div className="connection-toolbar">
              {connection && (
                <img
                  className="provider-logo"
                  src={`/brand/${connection.kind === "typesafe" ? "typesafe.png" : "cloudflare.svg"}`}
                  alt={
                    connection.kind === "typesafe" ? "TypeSafe" : "Cloudflare"
                  }
                />
              )}
              <div className="connection-picker">
                <Picker
                  label="Choose a connection"
                  value={draft.connectionId}
                  disabled={running}
                  onChange={(id) => {
                    const selected = workspace.connections.find(
                      (item) => item.id === id,
                    );
                    edit({
                      connectionId: id,
                      model: selected ? DEFAULT_MODELS[selected.kind][0] : "",
                    });
                    setModels([]);
                  }}
                  options={workspace.connections.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              </div>
              {connection && (
                <Badge variant="outline">
                  {connection.shared ? "Shared" : "Personal"}
                </Badge>
              )}
              <div className="model-picker">
                <Picker
                  label="Model name"
                  value={draft.model ? `model:${draft.model}` : ""}
                  onChange={(value) => {
                    if (value === "custom") {
                      setCustomModel(draft.model);
                      setCustomModelOpen(true);
                    } else {
                      edit({ model: value.slice("model:".length) });
                    }
                  }}
                  disabled={running || !connection}
                  options={[
                    ...modelOptions.map((model) => ({
                      value: `model:${model}`,
                      label: model,
                    })),
                    { value: "custom", label: "Enter a model name…" },
                  ]}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={discover}
                  aria-label="Discover models"
                  title="Refresh model list"
                  disabled={!connection || discovering || running}
                >
                  <RefreshCw className={cn(discovering && "animate-spin")} />
                </Button>
              </div>
              <Button
                onClick={execute}
                disabled={running || !connection || !!incompatible || uploading}
                className="run-button"
              >
                {running ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <Play data-icon="inline-start" />
                )}
                {running ? "Running…" : "Run questions"}
              </Button>
            </div>
            {!workspace.connections.length && (
              <div className="workspace-notice">
                <Alert>
                  <Plug />
                  <AlertDescription>
                    <span>
                      Add your first provider connection to run this playground.
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/connections">Add connection</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}
            {incompatible && (
              <div className="workspace-notice">
                <Alert>
                  <AlertDescription>
                    Clef accepts images but does not support Box. Choose a
                    TypeSafe model that supports Box, or remove the Box
                    question.
                  </AlertDescription>
                </Alert>
              </div>
            )}
            <div className="split-workspace">
              <section className="editor-pane">
                <fieldset disabled={running}>
                  <FieldGroup>
                    <Field>
                      <div className="section-heading">
                        <FieldLabel htmlFor="state-input">
                          <h2>State</h2>
                        </FieldLabel>
                        <ToggleGroup
                          type="single"
                          spacing={0}
                          className="state-format-control"
                          aria-label="State format"
                          value={draft.stateFormat}
                          disabled={running}
                          onValueChange={(value) => {
                            if (value === "text" || value === "json")
                              edit({ stateFormat: value });
                          }}
                        >
                          <ToggleGroupItem value="text">Text</ToggleGroupItem>
                          <ToggleGroupItem value="json">JSON</ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                      <Textarea
                        id="state-input"
                        className="state-editor"
                        value={draft.state}
                        onChange={(event) =>
                          edit({ state: event.target.value })
                        }
                        placeholder={
                          draft.stateFormat === "json"
                            ? '{\n  "context": "Describe the situation"\n}'
                            : "Supply the context your questions should be evaluated against…"
                        }
                        spellCheck={draft.stateFormat !== "json"}
                        aria-invalid={!validJson}
                        rows={7}
                      />
                      <div className="state-caption">
                        <span>Context shared by every question</span>
                        <span className={cn(!validJson && "invalid-state")}>
                          {draft.stateFormat === "json"
                            ? validJson
                              ? "Valid JSON"
                              : "Invalid JSON"
                            : "Text input"}
                        </span>
                      </div>
                    </Field>
                  </FieldGroup>
                  <div className="image-input-heading">
                    <span>
                      Images{" "}
                      <span className="count-label">
                        {draft.images.length || ""}
                      </span>
                    </span>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) => void upload(event.target.files)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => fileInput.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <ImagePlus data-icon="inline-start" />
                      )}
                      {uploading ? "Preparing…" : "Attach image"}
                    </Button>
                  </div>
                  {draft.images.length > 0 && (
                    <div className="attached-images">
                      {draft.images.map((image) => (
                        <article className="attached-image" key={image.id}>
                          <img src={image.dataUrl} alt={image.name} />
                          <div>
                            <strong>{image.name}</strong>
                            <span>
                              {image.width} × {image.height}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${image.name}`}
                            onClick={() =>
                              edit({
                                images: draft.images.filter(
                                  (item) => item.id !== image.id,
                                ),
                                questions: draft.questions.map((question) =>
                                  question.type === "box" &&
                                  question.targetImageId === image.id
                                    ? { ...question, targetImageId: "" }
                                    : question,
                                ),
                              })
                            }
                          >
                            <X />
                          </Button>
                        </article>
                      ))}
                    </div>
                  )}
                  <QuestionEditor
                    questions={draft.questions}
                    images={draft.images}
                    onChange={(questions) => edit({ questions })}
                  />
                </fieldset>
              </section>
              <Results run={run} pending={running} stale={stale} />
            </div>
            <footer className="workspace-footer">
              <span>
                <LockKeyhole />
                Your inputs and run history are private.
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadJson("kimeru-playground.json", draft)}
              >
                <Download data-icon="inline-start" />
                Export inputs
              </Button>
            </footer>
          </>
        )}
      </main>
      <PasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
      <Modal
        open={customModelOpen}
        onClose={() => setCustomModelOpen(false)}
        title="Enter a model name"
        description="Use the exact model ID supported by your provider."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const model = customModel.trim();
            if (!model) return;
            edit({ model });
            setCustomModelOpen(false);
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="custom-model-name">Model name</FieldLabel>
              <Input
                id="custom-model-name"
                value={customModel}
                onChange={(event) => setCustomModel(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </Field>
            <div className="modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomModelOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!customModel.trim()}>
                Use model
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="A playground for decision AI"
        description="Structured questions, useful answers."
      >
        <div className="help-copy">
          <p>
            Supply state, add typed questions, and run them against your own
            models. Choice returns a distribution, Score rates ordered criteria,
            Noul estimates truth, and Box locates an image region.
          </p>
          <p>
            Personal connections and saved work are private. Administrators can
            share provider access without exposing API keys.
          </p>
          <p>
            Run history preserves the exact inputs and returned results. Editing
            a playground does not change previous runs.
          </p>
        </div>
      </Modal>
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.kind === "run" ? "run" : "playground"}?`}
        description={`“${deleteTarget?.title || ""}” will be permanently removed.`}
      >
        <div className="modal-actions">
          <Button
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={remove} disabled={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
