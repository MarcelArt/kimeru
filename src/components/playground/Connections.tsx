import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  LockKeyhole,
  Users,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Badge } from "#/components/ui/badge";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "#/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "#/components/ui/empty";
import { saveConnection, deleteConnection } from "#/server/api";
import type {
  Connection,
  ConnectionInput,
  ProviderKind,
  User,
} from "#/lib/domain";
import { Modal, Picker, errorMessage } from "./shared";

const newConnection = (): ConnectionInput => ({
  name: "",
  kind: "typesafe",
  baseUrl: "https://api.typesafe.ai",
  accountId: "",
  shared: false,
  apiKey: "",
});

export function Connections({
  user,
  connections,
  refresh,
}: {
  user: User;
  connections: Connection[];
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<ConnectionInput | null>(null);
  const [deleting, setDeleting] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<ConnectionInput>) =>
    setEditing((value) => (value ? { ...value, ...patch } : value));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await saveConnection({ data: editing });
      await refresh();
      setEditing(null);
      toast.success("Connection saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteConnection({ data: { id: deleting.id } });
      await refresh();
      setDeleting(null);
      toast.success("Connection deleted");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <h1>Connections</h1>
          <p>Your providers, ready when you are.</p>
        </div>
        <Button onClick={() => setEditing(newConnection())}>
          <Plus data-icon="inline-start" />
          Add connection
        </Button>
      </div>
      {connections.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockKeyhole />
            </EmptyMedia>
            <EmptyTitle>Bring your first model.</EmptyTitle>
            <EmptyDescription>
              Add a provider URL and API key. Credentials stay on your server.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setEditing(newConnection())}>
              Add connection
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="connection-grid">
          {connections.map((connection) => (
            <article className="connection-card" key={connection.id}>
              <div className="connection-card-heading">
                <img
                  className="provider-logo"
                  src={`/brand/${connection.kind === "typesafe" ? "typesafe.png" : "cloudflare.svg"}`}
                  alt={
                    connection.kind === "typesafe" ? "TypeSafe" : "Cloudflare"
                  }
                />
                <div>
                  <h2>{connection.name}</h2>
                  <span>
                    {connection.kind === "typesafe"
                      ? "System One compatible"
                      : "Workers AI"}
                  </span>
                </div>
                <Badge variant="outline">
                  {connection.shared ? <Users /> : <LockKeyhole />}
                  {connection.shared ? "Shared" : "Personal"}
                </Badge>
              </div>
              <div className="connection-url">{connection.baseUrl}</div>
              {connection.accountId && (
                <p className="connection-account">
                  Account <code>{connection.accountId}</code>
                </p>
              )}
              <div className="connection-card-footer">
                <span>
                  {connection.hasKey
                    ? "API key stored securely"
                    : "API key required"}
                </span>
                {(connection.ownerId === user.id ||
                  (user.role === "admin" && connection.shared)) && (
                  <div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${connection.name}`}
                      onClick={() => setEditing({ ...connection, apiKey: "" })}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${connection.name}`}
                      onClick={() => setDeleting(connection)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="management-note">
        Personal connections belong to you. Shared connections are managed by
        administrators; their API keys are never revealed to other users.
      </p>
      <Modal
        open={!!editing}
        onClose={() => !busy && setEditing(null)}
        title={editing?.id ? "Edit connection" : "Add connection"}
        description="Connect a decision AI provider using your own credentials."
      >
        {editing && (
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="connection-name">Name</FieldLabel>
                <Input
                  id="connection-name"
                  required
                  value={editing.name}
                  onChange={(event) => update({ name: event.target.value })}
                  placeholder="My TypeSafe"
                />
              </Field>
              <Field>
                <FieldLabel>Provider</FieldLabel>
                <Picker
                  label="Provider"
                  value={editing.kind}
                  onChange={(value) =>
                    update({
                      kind: value as ProviderKind,
                      baseUrl:
                        value === "typesafe"
                          ? "https://api.typesafe.ai"
                          : "https://api.cloudflare.com/client/v4",
                    })
                  }
                  options={[
                    {
                      value: "typesafe",
                      label: "TypeSafe / System One compatible",
                    },
                    { value: "cloudflare", label: "Cloudflare Workers AI" },
                  ]}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="connection-url">Base URL</FieldLabel>
                <Input
                  id="connection-url"
                  type="url"
                  required
                  value={editing.baseUrl}
                  onChange={(event) => update({ baseUrl: event.target.value })}
                />
                <FieldDescription>
                  {editing.kind === "typesafe"
                    ? "Use your TypeSafe or System One compatible server URL."
                    : "The Cloudflare API base URL, including /client/v4."}
                </FieldDescription>
              </Field>
              {editing.kind === "cloudflare" && (
                <Field>
                  <FieldLabel htmlFor="connection-account">
                    Cloudflare account ID
                  </FieldLabel>
                  <Input
                    id="connection-account"
                    required
                    value={editing.accountId}
                    onChange={(event) =>
                      update({ accountId: event.target.value })
                    }
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="connection-key">API key</FieldLabel>
                <Input
                  id="connection-key"
                  type="password"
                  autoComplete="new-password"
                  required={!editing.id}
                  value={editing.apiKey}
                  onChange={(event) => update({ apiKey: event.target.value })}
                  placeholder={
                    editing.id
                      ? "Leave blank to keep the stored key"
                      : "Paste your API key"
                  }
                />
                <FieldDescription>
                  {editing.id
                    ? "Existing credentials are never sent back to your browser."
                    : "Stored encrypted on this server."}
                </FieldDescription>
              </Field>
              {user.role === "admin" && (
                <Field>
                  <FieldLabel>Access</FieldLabel>
                  <Picker
                    label="Connection access"
                    value={editing.shared ? "shared" : "personal"}
                    onChange={(value) => update({ shared: value === "shared" })}
                    options={[
                      { value: "personal", label: "Personal — only you" },
                      {
                        value: "shared",
                        label: "Shared — all users on this instance",
                      },
                    ]}
                  />
                </Field>
              )}
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  )}
                  Save connection
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        title="Delete connection?"
        description={`Remove ${deleting?.name || "this connection"}? Existing run history is retained.`}
      >
        <div className="modal-actions">
          <Button
            variant="outline"
            onClick={() => setDeleting(null)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            Delete connection
          </Button>
        </div>
      </Modal>
    </section>
  );
}
