import { DatabaseSync } from "node:sqlite";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type {
  Connection,
  ConnectionInput,
  DecisionInput,
  Playground,
  ProviderResult,
  Run,
  RunSummary,
  User,
  Workspace,
} from "../lib/domain.ts";
import {
  createSessionToken,
  hashPassword,
  SESSION_SECONDS,
  tokenDigest,
  verifyPassword,
} from "./auth.ts";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  disabled: number;
  created_at: string;
  password_hash: string;
};
type ConnectionRow = {
  id: string;
  owner_id: string;
  name: string;
  kind: "typesafe" | "cloudflare";
  base_url: string;
  account_id: string;
  shared: number;
  secret: string;
  created_at: string;
};
type PlaygroundRow = {
  id: string;
  owner_id: string;
  input_json: string;
  updated_at: string;
};
type RunRow = {
  id: string;
  owner_id: string;
  title: string;
  model: string;
  connection_name: string;
  status: "success" | "error";
  duration_ms: number;
  created_at: string;
  error: string | null;
  input_json: string;
  result_json: string | null;
};
type StoredInput = Omit<DecisionInput, "images"> & {
  images: Array<
    Omit<DecisionInput["images"][number], "dataUrl"> & { storageId: string }
  >;
};
const publicUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  disabled: Boolean(row.disabled),
  createdAt: row.created_at,
});
const publicConnection = (row: ConnectionRow): Connection => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  kind: row.kind,
  baseUrl: row.base_url,
  accountId: row.account_id,
  shared: Boolean(row.shared),
  hasKey: Boolean(row.secret),
  createdAt: row.created_at,
});
const summary = (row: RunRow): RunSummary => ({
  id: row.id,
  title: row.title,
  model: row.model,
  connectionName: row.connection_name,
  status: row.status,
  durationMs: row.duration_ms,
  createdAt: row.created_at,
  ...(row.error ? { error: row.error } : {}),
});

export class Repository {
  readonly db: DatabaseSync;
  readonly directory: string;
  private readonly key: Buffer;

  constructor(directory = process.env.KIMERU_DATA_DIR || ".data") {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    mkdirSync(join(this.directory, "uploads"), {
      recursive: true,
      mode: 0o700,
    });
    const secretPath = join(this.directory, "instance.key");
    if (process.env.KIMERU_ENCRYPTION_KEY) {
      const value = process.env.KIMERU_ENCRYPTION_KEY;
      if (!/^[a-fA-F0-9]{64}$/.test(value))
        throw new Error(
          "KIMERU_ENCRYPTION_KEY must contain 64 hexadecimal characters.",
        );
      this.key = Buffer.from(value, "hex");
    } else {
      if (!existsSync(secretPath)) {
        try {
          writeFileSync(secretPath, randomBytes(32), {
            mode: 0o600,
            flag: "wx",
          });
        } catch (error) {
          if (!existsSync(secretPath)) throw error;
        }
      }
      this.key = readFileSync(secretPath);
      if (this.key.length !== 32)
        throw new Error("The instance encryption key is invalid.");
    }
    this.db = new DatabaseSync(join(this.directory, "kimeru.sqlite"));
    chmodSync(join(this.directory, "kimeru.sqlite"), 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')), disabled INTEGER NOT NULL DEFAULT 0, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, kind TEXT NOT NULL, base_url TEXT NOT NULL, account_id TEXT NOT NULL, shared INTEGER NOT NULL, secret TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS playgrounds (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), input_json TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, model TEXT NOT NULL, connection_name TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL, created_at TEXT NOT NULL, error TEXT, input_json TEXT NOT NULL, result_json TEXT);
      CREATE TABLE IF NOT EXISTS assets (owner_id TEXT NOT NULL REFERENCES users(id), hash TEXT NOT NULL, PRIMARY KEY(owner_id,hash));
      CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS runs_owner_created ON runs(owner_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS playgrounds_owner ON playgrounds(owner_id);
      PRAGMA user_version=1;`);
  }

  close() {
    this.db.close();
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  needsSetup(): boolean {
    return (
      (
        this.db.prepare("SELECT count(*) AS total FROM users").get() as {
          total: number;
        }
      ).total === 0
    );
  }
  getUser(id: string): User | null {
    const row = this.db
      .prepare("SELECT * FROM users WHERE id=? AND disabled=0")
      .get(id) as UserRow | undefined;
    return row ? publicUser(row) : null;
  }
  requireUser(id: string): User {
    const user = this.getUser(id);
    if (!user) throw new Error("Please sign in to continue.");
    return user;
  }
  requireAdmin(id: string): User {
    const user = this.requireUser(id);
    if (user.role !== "admin")
      throw new Error("Administrator access is required.");
    return user;
  }
  async registerFirstAdmin(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    if (!this.needsSetup())
      throw new Error(
        "Setup is complete. Ask an administrator to create your account.",
      );
    const hash = await hashPassword(data.password);
    return this.transaction(() => {
      if (!this.needsSetup())
        throw new Error(
          "Setup is complete. Ask an administrator to create your account.",
        );
      return this.insertUser(data, "admin", hash);
    });
  }
  private insertUser(
    data: { name: string; email: string },
    role: "admin" | "user",
    hash: string,
  ): User {
    const id = randomUUID(),
      email = data.email.trim().toLowerCase();
    if (this.db.prepare("SELECT id FROM users WHERE email=?").get(email))
      throw new Error("An account with this email already exists.");
    this.db
      .prepare(
        "INSERT INTO users (id,email,name,role,password_hash,created_at) VALUES (?,?,?,?,?,?)",
      )
      .run(id, email, data.name.trim(), role, hash, new Date().toISOString());
    return this.requireUser(id);
  }
  async createUser(
    actor: string,
    data: {
      name: string;
      email: string;
      password: string;
      role: "admin" | "user";
    },
  ): Promise<User> {
    this.requireAdmin(actor);
    const hash = await hashPassword(data.password);
    this.requireAdmin(actor);
    return this.insertUser(data, data.role, hash);
  }
  async authenticate(email: string, password: string): Promise<User> {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(email.trim().toLowerCase()) as UserRow | undefined;
    const valid = await verifyPassword(password, row?.password_hash);
    const current = row
      ? (this.db.prepare("SELECT * FROM users WHERE id=?").get(row.id) as
          UserRow | undefined)
      : undefined;
    if (
      !row ||
      !valid ||
      !current ||
      current.disabled ||
      current.password_hash !== row.password_hash
    )
      throw new Error("Invalid email or password.");
    return this.requireUser(row.id);
  }
  createSession(userId: string): string {
    this.requireUser(userId);
    this.db
      .prepare("DELETE FROM sessions WHERE expires_at < ?")
      .run(Date.now());
    const token = createSessionToken();
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(tokenDigest(token), userId, Date.now() + SESSION_SECONDS * 1000);
    return token;
  }
  userForSession(token: string | undefined): User | null {
    if (!token || token.length > 100) return null;
    const row = this.db
      .prepare("SELECT user_id FROM sessions WHERE digest=? AND expires_at>?")
      .get(tokenDigest(token), Date.now()) as { user_id: string } | undefined;
    return row ? this.getUser(row.user_id) : null;
  }
  revokeSession(token: string | undefined) {
    if (token)
      this.db
        .prepare("DELETE FROM sessions WHERE digest=?")
        .run(tokenDigest(token));
  }
  listUsers(actor: string): User[] {
    this.requireAdmin(actor);
    return (
      this.db
        .prepare("SELECT * FROM users ORDER BY created_at")
        .all() as UserRow[]
    ).map(publicUser);
  }
  updateUser(
    actor: string,
    data: { id: string; role: "admin" | "user"; disabled: boolean },
  ): User {
    this.requireAdmin(actor);
    return this.transaction(() => {
      const target = this.db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(data.id) as UserRow | undefined;
      if (!target) throw new Error("Account not found.");
      const admins = (
        this.db
          .prepare(
            "SELECT count(*) AS total FROM users WHERE role='admin' AND disabled=0",
          )
          .get() as { total: number }
      ).total;
      if (
        target.role === "admin" &&
        !target.disabled &&
        (data.disabled || data.role !== "admin") &&
        admins <= 1
      )
        throw new Error("Keep at least one enabled administrator.");
      this.db
        .prepare("UPDATE users SET role=?,disabled=? WHERE id=?")
        .run(data.role, Number(data.disabled), data.id);
      if (
        data.role !== target.role ||
        data.disabled !== Boolean(target.disabled)
      )
        this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(data.id);
      return publicUser(
        this.db
          .prepare("SELECT * FROM users WHERE id=?")
          .get(data.id) as UserRow,
      );
    });
  }
  async changePassword(
    actor: string,
    currentPassword: string,
    newPassword: string,
  ) {
    this.requireUser(actor);
    const row = this.db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(actor) as UserRow;
    if (!(await verifyPassword(currentPassword, row.password_hash)))
      throw new Error("The current password is incorrect.");
    const hash = await hashPassword(newPassword);
    this.requireUser(actor);
    this.transaction(() => {
      this.db
        .prepare("UPDATE users SET password_hash=? WHERE id=?")
        .run(hash, actor);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(actor);
    });
  }
  consumeLimit(bucket: string, maximum: number, windowMs: number) {
    const now = Date.now(),
      key = tokenDigest(bucket);
    this.db.prepare("DELETE FROM rate_limits WHERE reset_at<?").run(now);
    const row = this.db
      .prepare("SELECT count,reset_at FROM rate_limits WHERE bucket=?")
      .get(key) as { count: number; reset_at: number } | undefined;
    if (row && row.count >= maximum)
      throw new Error("Too many attempts. Please try again later.");
    this.db
      .prepare(
        "INSERT INTO rate_limits VALUES (?,?,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1",
      )
      .run(key, 1, now + windowMs);
  }
  private encrypt(value: string): string {
    const nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return `${nonce.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
  }
  private decrypt(value: string): string {
    try {
      const [nonce, tag, ciphertext] = value.split(".");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(nonce!, "base64"),
      );
      decipher.setAuthTag(Buffer.from(tag!, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext!, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error(
        "This connection cannot be decrypted. Restore the instance key or replace its API key.",
      );
    }
  }
  listConnections(actor: string): Connection[] {
    this.requireUser(actor);
    return (
      this.db
        .prepare(
          "SELECT * FROM connections WHERE owner_id=? OR shared=1 ORDER BY created_at",
        )
        .all(actor) as ConnectionRow[]
    ).map(publicConnection);
  }
  connectionForRun(actor: string, id: string): Connection & { apiKey: string } {
    this.requireUser(actor);
    const row = this.db
      .prepare(
        "SELECT * FROM connections WHERE id=? AND (owner_id=? OR shared=1)",
      )
      .get(id, actor) as ConnectionRow | undefined;
    if (!row) throw new Error("Choose an available provider connection.");
    return { ...publicConnection(row), apiKey: this.decrypt(row.secret) };
  }
  saveConnection(actor: string, input: ConnectionInput): Connection {
    const user = this.requireUser(actor);
    const existing = input.id
      ? (this.db
          .prepare("SELECT * FROM connections WHERE id=?")
          .get(input.id) as ConnectionRow | undefined)
      : undefined;
    if (
      input.id &&
      (!existing ||
        (existing.owner_id !== actor &&
          !(existing.shared && user.role === "admin")))
    )
      throw new Error("Connection not found or not editable.");
    if ((input.shared || existing?.shared) && user.role !== "admin")
      throw new Error("Only administrators can manage shared connections.");
    if (!existing && !input.apiKey) throw new Error("An API key is required.");
    const id = existing?.id || randomUUID(),
      created = existing?.created_at || new Date().toISOString();
    const secret = input.apiKey ? this.encrypt(input.apiKey) : existing!.secret;
    const owner = existing && input.shared ? existing.owner_id : actor;
    this.db
      .prepare(
        "INSERT INTO connections VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,name=excluded.name,kind=excluded.kind,base_url=excluded.base_url,account_id=excluded.account_id,shared=excluded.shared,secret=excluded.secret",
      )
      .run(
        id,
        owner,
        input.name,
        input.kind,
        input.baseUrl.replace(/\/+$/, ""),
        input.accountId,
        Number(input.shared),
        secret,
        created,
      );
    return publicConnection(
      this.db
        .prepare("SELECT * FROM connections WHERE id=?")
        .get(id) as ConnectionRow,
    );
  }
  deleteConnection(actor: string, id: string) {
    const user = this.requireUser(actor);
    const row = this.db
      .prepare("SELECT * FROM connections WHERE id=?")
      .get(id) as ConnectionRow | undefined;
    if (
      !row ||
      (row.owner_id !== actor && !(row.shared && user.role === "admin")) ||
      (row.shared && user.role !== "admin")
    )
      throw new Error("Connection not found or not editable.");
    this.db.prepare("DELETE FROM connections WHERE id=?").run(id);
  }
  private storeInput(actor: string, input: DecisionInput): string {
    const images = input.images.map((image) => {
      const bytes = Buffer.from(image.dataUrl.split(",")[1]!, "base64");
      const prefix =
        image.mime === "image/png"
          ? "data:image/png;base64,"
          : "data:image/jpeg;base64,";
      const validImage =
        image.mime === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      if (
        !image.dataUrl.startsWith(prefix) ||
        !validImage ||
        bytes.length > 16 * 1024 * 1024
      )
        throw new Error("Upload a valid PNG or JPEG below 16 MiB.");
      const storageId = createHash("sha256").update(bytes).digest("hex");
      const directory = join(this.directory, "uploads", actor);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const file = join(directory, storageId);
      if (!existsSync(file)) writeFileSync(file, bytes, { mode: 0o600 });
      this.db
        .prepare("INSERT OR IGNORE INTO assets VALUES (?,?)")
        .run(actor, storageId);
      const { dataUrl: _dataUrl, ...metadata } = image;
      return { ...metadata, storageId };
    });
    return JSON.stringify({ ...input, images });
  }
  private hydrate(actor: string, json: string): DecisionInput {
    const input = JSON.parse(json) as StoredInput;
    return {
      ...input,
      images: input.images.map(({ storageId, ...image }) => {
        if (!/^[a-f0-9]{64}$/.test(storageId))
          throw new Error("Stored image is invalid.");
        return {
          ...image,
          dataUrl: `data:${image.mime};base64,${readFileSync(join(this.directory, "uploads", actor, storageId)).toString("base64")}`,
        };
      }),
    };
  }
  private pruneAssets(actor: string) {
    const refs = new Set<string>();
    const rows = this.db
      .prepare(
        "SELECT input_json FROM playgrounds WHERE owner_id=? UNION ALL SELECT input_json FROM runs WHERE owner_id=?",
      )
      .all(actor, actor) as Array<{ input_json: string }>;
    for (const row of rows)
      for (const image of (JSON.parse(row.input_json) as StoredInput).images)
        refs.add(image.storageId);
    for (const asset of this.db
      .prepare("SELECT hash FROM assets WHERE owner_id=?")
      .all(actor) as Array<{ hash: string }>)
      if (!refs.has(asset.hash)) {
        try {
          unlinkSync(join(this.directory, "uploads", actor, asset.hash));
        } catch {
          /* already absent */
        }
        this.db
          .prepare("DELETE FROM assets WHERE owner_id=? AND hash=?")
          .run(actor, asset.hash);
      }
  }
  savePlayground(
    actor: string,
    input: DecisionInput & { id?: string },
  ): Playground {
    this.requireUser(actor);
    if (
      input.id &&
      !this.db
        .prepare("SELECT id FROM playgrounds WHERE id=? AND owner_id=?")
        .get(input.id, actor)
    )
      throw new Error("Playground not found.");
    if (input.connectionId) this.connectionForRun(actor, input.connectionId);
    const { id: suppliedId, ...decision } = input,
      id = suppliedId || randomUUID(),
      updatedAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO playgrounds VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET input_json=excluded.input_json,updated_at=excluded.updated_at",
      )
      .run(id, actor, this.storeInput(actor, decision), updatedAt);
    this.pruneAssets(actor);
    return { ...decision, id, updatedAt };
  }
  listPlaygrounds(actor: string): Playground[] {
    this.requireUser(actor);
    return (
      this.db
        .prepare(
          "SELECT * FROM playgrounds WHERE owner_id=? ORDER BY updated_at DESC",
        )
        .all(actor) as PlaygroundRow[]
    ).map((row) => ({
      ...this.hydrate(actor, row.input_json),
      id: row.id,
      updatedAt: row.updated_at,
    }));
  }
  deletePlayground(actor: string, id: string) {
    this.requireUser(actor);
    const result = this.db
      .prepare("DELETE FROM playgrounds WHERE id=? AND owner_id=?")
      .run(id, actor);
    if (!result.changes) throw new Error("Playground not found.");
    this.pruneAssets(actor);
  }
  recordRun(
    actor: string,
    input: DecisionInput,
    connectionName: string,
    durationMs: number,
    result: ProviderResult | null,
    error?: string,
  ): Run {
    this.requireUser(actor);
    const id = randomUUID(),
      createdAt = new Date().toISOString();
    this.db
      .prepare("INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        actor,
        input.title,
        result?.model || input.model,
        connectionName,
        error ? "error" : "success",
        Math.max(0, Math.round(durationMs)),
        createdAt,
        error || null,
        this.storeInput(actor, input),
        result ? JSON.stringify(result) : null,
      );
    return this.getRun(actor, id);
  }
  listRuns(actor: string): RunSummary[] {
    this.requireUser(actor);
    return (
      this.db
        .prepare(
          "SELECT id,title,model,connection_name,status,duration_ms,created_at,error FROM runs WHERE owner_id=? ORDER BY created_at DESC",
        )
        .all(actor) as RunRow[]
    ).map(summary);
  }
  getRun(actor: string, id: string): Run {
    this.requireUser(actor);
    const row = this.db
      .prepare("SELECT * FROM runs WHERE id=? AND owner_id=?")
      .get(id, actor) as RunRow | undefined;
    if (!row) throw new Error("Run not found.");
    return {
      ...summary(row),
      input: this.hydrate(actor, row.input_json),
      result: row.result_json
        ? (JSON.parse(row.result_json) as ProviderResult)
        : null,
    };
  }
  deleteRun(actor: string, id: string) {
    this.requireUser(actor);
    if (
      !this.db
        .prepare("DELETE FROM runs WHERE id=? AND owner_id=?")
        .run(id, actor).changes
    )
      throw new Error("Run not found.");
    this.pruneAssets(actor);
  }
  workspace(actor: string): Workspace {
    return {
      user: this.requireUser(actor),
      connections: this.listConnections(actor),
      playgrounds: this.listPlaygrounds(actor),
      runs: this.listRuns(actor),
    };
  }
}

let repository: Repository | undefined;
export function getRepository(): Repository {
  return (repository ??= new Repository());
}
