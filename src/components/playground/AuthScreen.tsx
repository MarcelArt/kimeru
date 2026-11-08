import { useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { login, registerFirstAdmin } from "#/server/api";
import { errorMessage } from "./shared";

export function AuthScreen({
  needsSetup,
  onSignedIn,
}: {
  needsSetup: boolean;
  onSignedIn: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (needsSetup)
        await registerFirstAdmin({ data: { name, email, password } });
      else await login({ data: { email, password } });
      await onSignedIn();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img className="brand-mark" src="/brand/kimeru.svg" alt="" width={24} height={24} /> kimeru
      </div>
      <main className="auth-card">
        <div className="auth-emblem">
          <ShieldCheck />
        </div>
        <h1>{needsSetup ? "Your decision workspace." : "Welcome back."}</h1>
        <p className="auth-intro">
          {needsSetup
            ? "Create the first administrator account to get started."
            : "Sign in to your private playgrounds and provider connections."}
        </p>
        <form onSubmit={submit}>
          <FieldGroup>
            {needsSetup && (
              <Field>
                <FieldLabel htmlFor="auth-name">Name</FieldLabel>
                <Input
                  id="auth-name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="auth-email">Email</FieldLabel>
              <Input
                id="auth-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="auth-password">Password</FieldLabel>
              <Input
                id="auth-password"
                type="password"
                autoComplete={needsSetup ? "new-password" : "current-password"}
                minLength={needsSetup ? 12 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  needsSetup ? "At least 12 characters" : "Your password"
                }
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending}>
              {pending && (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              )}
              {needsSetup ? "Create administrator" : "Sign in"}
              {!pending && <ArrowRight data-icon="inline-end" />}
            </Button>
          </FieldGroup>
        </form>
        <p className="auth-note">
          {needsSetup
            ? "After setup, administrators create additional accounts. Your playgrounds and run history stay private."
            : "Need an account? Contact the administrator of this instance."}
        </p>
      </main>
      <footer>Bring your models. Make a clearer decision.</footer>
    </div>
  );
}
