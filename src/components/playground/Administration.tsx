import { useEffect, useState } from "react";
import { Plus, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Badge } from "#/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import {
  createUser,
  listUsers,
  updateUser,
  changePassword,
} from "#/server/api";
import type { User } from "#/lib/domain";
import { errorMessage, Modal, Picker } from "./shared";

export function Administration({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as User["role"],
  });
  const [loadError, setLoadError] = useState("");
  async function load() {
    try {
      setUsers(await listUsers());
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createUser({ data: form });
      await load();
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "user" });
      toast.success("Account created");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function change(
    user: User,
    patch: { role?: User["role"]; disabled?: boolean },
  ) {
    setBusy(true);
    try {
      await updateUser({
        data: {
          id: user.id,
          role: patch.role ?? user.role,
          disabled: patch.disabled ?? user.disabled,
        },
      });
      await load();
      toast.success("Account updated");
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
          <h1>Administration</h1>
          <p>Manage access to your instance.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          Create account
        </Button>
      </div>
      <div className="admin-intro">
        <ShieldCheck />
        <p>
          Registration is closed. Administrators create accounts and manage
          shared connections. Everyone’s playgrounds and history stay private.
        </p>
      </div>
      {loading ? (
        <div className="loading-area">
          <LoaderCircle className="animate-spin" />
        </div>
      ) : loadError ? (
        <div className="inline-error">
          {loadError}
          <Button variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="user-list">
          {users.map((user) => (
            <article className="user-row" key={user.id}>
              <span className="avatar">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="user-details">
                <h2>
                  {user.name}{" "}
                  {user.id === currentUser.id && (
                    <span className="optional-label">You</span>
                  )}
                </h2>
                <p>{user.email}</p>
              </div>
              <Badge variant={user.disabled ? "secondary" : "outline"}>
                {user.disabled ? "Disabled" : "Active"}
              </Badge>
              <div className="user-role">
                <Picker
                  label={`Role for ${user.name}`}
                  value={user.role}
                  disabled={busy || user.id === currentUser.id}
                  onChange={(value) =>
                    void change(user, { role: value as User["role"] })
                  }
                  options={[
                    { value: "user", label: "User" },
                    { value: "admin", label: "Administrator" },
                  ]}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy || user.id === currentUser.id}
                onClick={() => void change(user, { disabled: !user.disabled })}
              >
                {user.disabled ? "Enable" : "Disable"}
              </Button>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Create account"
        description="Give a person access to this Kimeru instance."
      >
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-user-name">Name</FieldLabel>
              <Input
                id="new-user-name"
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-user-email">Email</FieldLabel>
              <Input
                id="new-user-email"
                type="email"
                autoComplete="off"
                required
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-user-password">
                Initial password
              </FieldLabel>
              <Input
                id="new-user-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                placeholder="At least 12 characters"
              />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Picker
                label="Account role"
                value={form.role}
                onChange={(value) =>
                  setForm({ ...form, role: value as User["role"] })
                }
                options={[
                  { value: "user", label: "User" },
                  { value: "admin", label: "Administrator" },
                ]}
              />
            </Field>
            <div className="modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
                Create account
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>
    </section>
  );
}

export function PasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await changePassword({ data: { currentPassword, newPassword } });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Change password"
      description="Choose a strong password for your account."
    >
      <form onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="current-password">Current password</FieldLabel>
            <Input
              type="password"
              autoComplete="current-password"
              id="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              type="password"
              autoComplete="new-password"
              id="new-password"
              required
              minLength={12}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy && (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            )}
            Update password
          </Button>
        </FieldGroup>
      </form>
    </Modal>
  );
}
