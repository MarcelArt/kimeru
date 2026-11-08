import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Repository } from "./store.ts";
import { decisionSchema, playgroundSchema } from "./validation.ts";
import { assertRequestOrigin } from "./auth.ts";
import type { DecisionInput } from "../lib/domain.ts";

const password = "a-strong-test-password";
const adminIdentity = {
  name: "Administrator",
  email: "admin@example.test",
  password,
};
const fixture = (): DecisionInput => ({
  title: "Private decision",
  connectionId: "",
  model: "jev-latest",
  state: '{"message":"Private content"}',
  stateFormat: "json",
  questions: [
    { id: "present", type: "noul", instructions: "The item is present." },
  ],
  images: [],
});
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "kimeru-store-"));
  const repository = new Repository(directory);
  const admin = await repository.registerFirstAdmin(adminIdentity);
  const alice = await repository.createUser(admin.id, {
    name: "Alice",
    email: "alice@example.test",
    password,
    role: "user",
  });
  const bob = await repository.createUser(admin.id, {
    name: "Bob",
    email: "bob@example.test",
    password,
    role: "user",
  });
  return {
    directory,
    repository,
    admin,
    alice,
    bob,
    dispose() {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("first-admin registration has one winner even across concurrent password hashing", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kimeru-bootstrap-")),
    repository = new Repository(directory);
  try {
    const outcomes = await Promise.allSettled([
      repository.registerFirstAdmin(adminIdentity),
      repository.registerFirstAdmin({
        ...adminIdentity,
        email: "other@example.test",
      }),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(repository.needsSetup(), false);
    assert.equal(
      (
        repository.db.prepare("SELECT count(*) AS total FROM users").get() as {
          total: number;
        }
      ).total,
      1,
    );
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("passwords are hashed, opaque sessions are stored by digest, and logout revokes them", async () => {
  const context = await setup(),
    { repository, alice } = context;
  try {
    assert.equal(
      (await repository.authenticate("ALICE@example.test", password)).id,
      alice.id,
    );
    await assert.rejects(
      repository.authenticate("alice@example.test", "incorrect"),
      /Invalid email or password/,
    );
    await assert.rejects(
      repository.authenticate("absent@example.test", "incorrect"),
      /Invalid email or password/,
    );
    const row = repository.db
      .prepare("SELECT password_hash FROM users WHERE id=?")
      .get(alice.id) as { password_hash: string };
    assert.notEqual(row.password_hash, password);
    const token = repository.createSession(alice.id);
    assert.equal(repository.userForSession(token)?.id, alice.id);
    assert.equal(
      repository.db
        .prepare("SELECT digest FROM sessions WHERE digest=?")
        .get(token),
      undefined,
    );
    repository.revokeSession(token);
    assert.equal(repository.userForSession(token), null);
    assert.throws(() => repository.workspace("not-a-user"), /sign in/);
  } finally {
    context.dispose();
  }
});

test("personal provider keys stay encrypted and private; shared access never returns a key", async () => {
  const context = await setup(),
    { repository, directory, admin, alice, bob } = context;
  try {
    const secret = "provider-key-that-must-not-be-visible";
    const input = {
      name: "Personal",
      kind: "typesafe" as const,
      baseUrl: "https://api.typesafe.ai",
      accountId: "",
      shared: false,
      apiKey: secret,
    };
    const personal = repository.saveConnection(alice.id, input);
    assert.equal("apiKey" in personal, false);
    assert.equal(repository.listConnections(bob.id).length, 0);
    assert.equal(repository.listConnections(admin.id).length, 0);
    assert.throws(
      () => repository.connectionForRun(bob.id, personal.id),
      /available provider/,
    );
    assert.throws(
      () => repository.connectionForRun(admin.id, personal.id),
      /available provider/,
    );
    assert.throws(
      () => repository.saveConnection(bob.id, { ...input, id: personal.id }),
      /not editable/,
    );
    assert.throws(
      () => repository.deleteConnection(admin.id, personal.id),
      /not editable/,
    );
    const encrypted = repository.db
      .prepare("SELECT secret FROM connections WHERE id=?")
      .get(personal.id) as { secret: string };
    assert.equal(encrypted.secret.includes(secret), false);
    assert.equal(
      readFileSync(join(directory, "kimeru.sqlite")).includes(
        Buffer.from(secret),
      ),
      false,
    );
    assert.equal(
      repository.connectionForRun(alice.id, personal.id).apiKey,
      secret,
    );
    repository.saveConnection(alice.id, {
      ...input,
      id: personal.id,
      apiKey: "",
      name: "Renamed",
    });
    assert.equal(
      repository.connectionForRun(alice.id, personal.id).apiKey,
      secret,
    );
    assert.throws(
      () => repository.saveConnection(alice.id, { ...input, shared: true }),
      /administrators/,
    );
    const shared = repository.saveConnection(admin.id, {
      ...input,
      shared: true,
    });
    assert.equal(repository.listConnections(bob.id)[0]?.id, shared.id);
    assert.equal("apiKey" in repository.listConnections(bob.id)[0]!, false);
    assert.throws(
      () => repository.deleteConnection(bob.id, shared.id),
      /not editable/,
    );
  } finally {
    context.dispose();
  }
});

test("private playgrounds and run snapshots remain isolated even from administrators", async () => {
  const context = await setup(),
    { repository, admin, alice, bob } = context;
  try {
    const input = fixture(),
      playground = repository.savePlayground(alice.id, input);
    const run = repository.recordRun(
      alice.id,
      input,
      "Deleted connection",
      24,
      {
        model: "jev-1.14.0",
        answers: { present: { type: "noul", noul: 0.9 } },
        raw: { answers: {} },
      },
    );
    input.state = "changed after execution";
    assert.notEqual(
      repository.getRun(alice.id, run.id).input.state,
      input.state,
    );
    for (const outsider of [bob, admin]) {
      assert.deepEqual(repository.listPlaygrounds(outsider.id), []);
      assert.deepEqual(repository.listRuns(outsider.id), []);
      assert.throws(() => repository.getRun(outsider.id, run.id), /not found/);
      assert.throws(
        () => repository.deleteRun(outsider.id, run.id),
        /not found/,
      );
      assert.throws(
        () => repository.deletePlayground(outsider.id, playground.id),
        /not found/,
      );
      assert.throws(
        () =>
          repository.savePlayground(outsider.id, {
            ...fixture(),
            id: playground.id,
          }),
        /not found/,
      );
    }
    repository.deletePlayground(alice.id, playground.id);
    assert.equal(repository.getRun(alice.id, run.id).title, fixture().title);
  } finally {
    context.dispose();
  }
});

test("uploaded images are stored privately and retained until their last snapshot is deleted", async () => {
  const context = await setup(),
    { repository, directory, alice } = context;
  try {
    const input = fixture();
    input.images = [
      {
        id: "photo",
        name: "pixel.png",
        mime: "image/png",
        width: 1,
        height: 1,
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1kAAAAASUVORK5CYII=",
      },
    ];
    const saved = repository.savePlayground(alice.id, input);
    const run = repository.recordRun(
      alice.id,
      input,
      "Example",
      10,
      null,
      "Illustrative provider failure",
    );
    const raw = repository.db
      .prepare("SELECT input_json FROM runs WHERE id=?")
      .get(run.id) as { input_json: string };
    assert.equal(raw.input_json.includes("data:image"), false);
    assert.equal(
      repository.getRun(alice.id, run.id).input.images[0]?.dataUrl,
      input.images[0]?.dataUrl,
    );
    repository.deletePlayground(alice.id, saved.id);
    assert.equal(readdirSync(join(directory, "uploads", alice.id)).length, 1);
    repository.deleteRun(alice.id, run.id);
    assert.equal(readdirSync(join(directory, "uploads", alice.id)).length, 0);
  } finally {
    context.dispose();
  }
});

test("disabling and changing roles revokes sessions, and the final enabled admin is preserved", async () => {
  const context = await setup(),
    { repository, admin, alice } = context;
  try {
    assert.throws(
      () =>
        repository.updateUser(admin.id, {
          id: admin.id,
          role: "user",
          disabled: false,
        }),
      /at least one/,
    );
    assert.throws(
      () =>
        repository.updateUser(admin.id, {
          id: admin.id,
          role: "admin",
          disabled: true,
        }),
      /at least one/,
    );
    assert.throws(() => repository.listUsers(alice.id), /Administrator/);
    const token = repository.createSession(alice.id);
    repository.updateUser(admin.id, {
      id: alice.id,
      role: "admin",
      disabled: false,
    });
    assert.equal(repository.userForSession(token), null);
    const promotedSession = repository.createSession(alice.id);
    repository.updateUser(admin.id, {
      id: alice.id,
      role: "admin",
      disabled: true,
    });
    assert.equal(repository.userForSession(promotedSession), null);
    await assert.rejects(
      repository.authenticate(alice.email, password),
      /Invalid/,
    );
  } finally {
    context.dispose();
  }
});

test("changing password revokes all existing sessions and rejects the old password", async () => {
  const context = await setup(),
    { repository, alice } = context;
  try {
    const token = repository.createSession(alice.id);
    await assert.rejects(
      repository.changePassword(alice.id, "wrong", "another-strong-password"),
      /current password/,
    );
    await repository.changePassword(
      alice.id,
      password,
      "another-strong-password",
    );
    assert.equal(repository.userForSession(token), null);
    await assert.rejects(
      repository.authenticate(alice.email, password),
      /Invalid/,
    );
    assert.equal(
      (await repository.authenticate(alice.email, "another-strong-password"))
        .id,
      alice.id,
    );
  } finally {
    context.dispose();
  }
});

test("input validation rejects duplicate question IDs, malformed JSON, and unbound boxes", () => {
  assert.equal(decisionSchema.safeParse(fixture()).success, true);
  assert.equal(
    decisionSchema.safeParse({ ...fixture(), state: "{" }).success,
    false,
  );
  assert.equal(
    decisionSchema.safeParse({
      ...fixture(),
      questions: [fixture().questions[0], fixture().questions[0]],
    }).success,
    false,
  );
  assert.equal(
    decisionSchema.safeParse({
      ...fixture(),
      questions: [
        {
          id: "box",
          type: "box",
          instructions: "Find the item",
          targetImageId: "missing",
        },
      ],
    }).success,
    false,
  );
});

test("drafts preserve incomplete work while execution rejects it", () => {
  const empty = {
    ...fixture(),
    model: "",
    questions: [],
    state: "{ unfinished",
  };
  assert.equal(playgroundSchema.safeParse(empty).success, true);
  assert.equal(decisionSchema.safeParse(empty).success, false);
  const partial = {
    ...fixture(),
    questions: [
      { id: "category", type: "choice", instructions: "", criteria: {} },
      { id: "region", type: "box", instructions: "", targetImageId: "" },
    ],
  };
  assert.equal(playgroundSchema.safeParse(partial).success, true);
  assert.equal(decisionSchema.safeParse(partial).success, false);
});

test("CSRF rejects missing, sibling, wrong-port, and insecure origins; reverse-proxy origin is explicit", () => {
  const request = (headers: Record<string, string> = {}) =>
    new Request("https://kimeru.example.test/_serverFn/action", {
      method: "POST",
      headers,
    });
  assert.doesNotThrow(() =>
    assertRequestOrigin(request({ origin: "https://kimeru.example.test" })),
  );
  assert.doesNotThrow(() =>
    assertRequestOrigin(request({ "sec-fetch-site": "same-origin" })),
  );
  assert.doesNotThrow(() =>
    assertRequestOrigin(
      request({ referer: "https://kimeru.example.test/playground" }),
    ),
  );
  assert.throws(() => assertRequestOrigin(request()), /same-origin/);
  assert.throws(
    () =>
      assertRequestOrigin(
        request({
          origin: "https://other.example.test",
          "sec-fetch-site": "same-site",
        }),
      ),
    /Cross-origin/,
  );
  assert.throws(
    () =>
      assertRequestOrigin(
        request({ origin: "https://kimeru.example.test:444" }),
      ),
    /origin does not match/,
  );
  assert.throws(
    () =>
      assertRequestOrigin(request({ origin: "http://kimeru.example.test" })),
    /origin does not match/,
  );
  assert.throws(
    () => assertRequestOrigin(request({ origin: "null" })),
    /origin does not match/,
  );
  const proxied = new Request("http://localhost:3000/_serverFn/action", {
    method: "POST",
    headers: { origin: "https://kimeru.example.test" },
  });
  assert.throws(() => assertRequestOrigin(proxied), /origin does not match/);
  assert.doesNotThrow(() =>
    assertRequestOrigin(proxied, "https://kimeru.example.test"),
  );
});
