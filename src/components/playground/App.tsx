import { useEffect, useRef, useState } from "react";
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
import type {
  Bootstrap,
  DecisionInput,
  Playground,
  Run,
  Workspace,
} from "#/lib/domain";
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

type View = "playground" | "history" | "connections" | "admin";
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

export function App({
  initialBootstrap,
  initialWorkspace,
}: {
  initialBootstrap: Bootstrap;
  initialWorkspace: Workspace | null;
}) {
  const [bootstrap, setBootstrap] = useState(initialBootstrap);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [draft, setDraft] = useState<DecisionInput>(() =>
    blankInput(initialWorkspace),
  );
  const [playgroundId, setPlaygroundId] = useState<string>();
  const [view, setView] = useState<View>("playground");
  const [run, setRun] = useState<Run | null>(null);
  const [stale, setStale] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingRun, setLoadingRun] = useState("");
  const [uploading, setUploading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [customModelOpen, setCustomModelOpen] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
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
    const desktop = window.matchMedia("(min-width: 681px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileNav(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
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
  function navigate(next: View) {
    setView(next);
    setMobileNav(false);
  }
  function newPlayground() {
    setDraft(blankInput(workspace));
    setPlaygroundId(undefined);
    setRun(null);
    setStale(false);
    setDirty(false);
    setModels([]);
    navigate("playground");
  }
  function openPlayground(playground: Playground) {
    setDraft(structuredClone(playground));
    setPlaygroundId(playground.id);
    setRun(null);
    setStale(false);
    setDirty(false);
    setModels([]);
    navigate("playground");
  }
  async function save() {
    setSaving(true);
    try {
      const saved = await savePlayground({
        data: { ...draft, id: playgroundId },
      });
      setPlaygroundId(saved.id);
      setDirty(false);
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
    try {
      const result = await executeRun({ data: draft });
      setRun(result);
      setStale(false);
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
      setDraft({
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
      setPlaygroundId(undefined);
      setRun(null);
      setStale(false);
      setDirty(true);
      navigate("playground");
      toast(
        "Example inputs loaded. Run with your provider to get real results.",
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function openRun(id: string) {
    setLoadingRun(id);
    try {
      const saved = await getRun({ data: { id } });
      setRun(saved);
      setDraft(structuredClone(saved.input));
      setPlaygroundId(undefined);
      setStale(false);
      setDirty(false);
      setModels([]);
      navigate("playground");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingRun("");
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "run")
        await deleteRun({ data: { id: deleteTarget.id } });
      else await deletePlayground({ data: { id: deleteTarget.id } });
      if (deleteTarget.id === playgroundId) newPlayground();
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
      setDraft(blankInput(null));
      setRun(null);
      setPlaygroundId(undefined);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (!bootstrap.user || !workspace)
    return (
      <AuthScreen needsSetup={bootstrap.needsSetup} onSignedIn={refresh} />
    );
  const user = workspace.user;
  const navigation = [
    { id: "playground" as const, title: "Playground", icon: FlaskConical },
    { id: "history" as const, title: "Run history", icon: History },
    { id: "connections" as const, title: "Connections", icon: Plug },
  ];
  const navigationContent = (
    <>
      <div className="brand">
        <img className="brand-mark" src="/brand/kimeru.svg" alt="" width={24} height={24} />kimeru
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
        onClick={newPlayground}
        disabled={running}
      >
        <Plus data-icon="inline-start" />
        New playground
      </Button>
      <nav className="primary-nav" aria-label="Workspace">
        {navigation.map((item) => (
          <button
            className={cn("nav-link", view === item.id && "active")}
            key={item.id}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => navigate(item.id)}
          >
            <item.icon />
            {item.title}
          </button>
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
                playgroundId === playground.id &&
                  view === "playground" &&
                  "active",
              )}
              key={playground.id}
            >
              <button
                disabled={running}
                onClick={() => openPlayground(playground)}
                title={playground.title}
              >
                {playground.title}
              </button>
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
      <button className="example-link" onClick={example} disabled={running}>
        <Plus />
        Load example inputs
      </button>
      <div className="sidebar-bottom">
        {user.role === "admin" && (
          <button
            className={cn("nav-link", view === "admin" && "active")}
            onClick={() => navigate("admin")}
          >
            <ShieldCheck />
            Administration
          </button>
        )}
        <button
          className="nav-link"
          onClick={() => {
            setMobileNav(false);
            setHelpOpen(true);
          }}
        >
          <CircleHelp />
          About this workspace
        </button>
        <button
          className="nav-link"
          onClick={() => {
            setMobileNav(false);
            setPasswordOpen(true);
          }}
        >
          <KeyRound />
          Change password
        </button>
        <div className="account-row">
          <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <span>
              {user.role === "admin" ? "Administrator" : "Personal workspace"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </>
  );
  return (
    <div className="application">
      <aside className="app-sidebar desktop-sidebar">{navigationContent}</aside>
      <Dialog open={mobileNav} onOpenChange={setMobileNav}>
        <DialogContent
          className="mobile-navigation"
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
              {view === "playground"
                ? draft.title
                : view === "history"
                  ? "Run history"
                  : view === "connections"
                    ? "Connections"
                    : "Administration"}
            </span>
          </div>
          <Badge variant="outline">
            <LockKeyhole />
            Private workspace
          </Badge>
        </header>
        {view === "connections" ? (
          <Connections
            user={user}
            connections={workspace.connections}
            refresh={refresh}
          />
        ) : view === "admin" && user.role === "admin" ? (
          <Administration currentUser={user} />
        ) : view === "history" ? (
          <RunHistory
            runs={workspace.runs}
            loadingRun={loadingRun}
            onOpenRun={openRun}
            onDeleteRun={(item) =>
              setDeleteTarget({ id: item.id, title: item.title, kind: "run" })
            }
          />
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("connections")}
                    >
                      Add connection
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
