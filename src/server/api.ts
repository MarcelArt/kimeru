import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  Bootstrap,
  Connection,
  Playground,
  ProviderResult,
  Run,
  User,
  Workspace,
} from "../lib/domain.ts";
import {
  connectionSchema,
  decisionSchema,
  identitySchema,
  idSchema,
  loginSchema,
  passwordSchema,
  playgroundSchema,
} from "./validation.ts";

export const getBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<Bootstrap> => {
    const { currentUser } = await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    return { needsSetup: getRepository().needsSetup(), user: currentUser() };
  },
);

export const registerFirstAdmin = createServerFn({ method: "POST" })
  .validator(identitySchema)
  .handler(async ({ data }): Promise<User> => {
    const { assertSameOrigin, limitAuthentication, issueSession } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    limitAuthentication(data.email, "setup");
    const user = await getRepository().registerFirstAdmin(data);
    issueSession(user.id);
    console.info(
      JSON.stringify({ event: "initial_admin_created", userId: user.id }),
    );
    return user;
  });

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<User> => {
    const { assertSameOrigin, limitAuthentication, issueSession } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    limitAuthentication(data.email, "login");
    const user = await getRepository().authenticate(data.email, data.password);
    issueSession(user.id);
    console.info(JSON.stringify({ event: "sign_in", userId: user.id }));
    return user;
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { assertSameOrigin, destroySession } =
    await import("./request-context.ts");
  assertSameOrigin();
  destroySession();
  return { ok: true as const };
});

export const getWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<Workspace> => {
    const { requireUser } = await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    return getRepository().workspace(requireUser().id);
  },
);

export const saveConnection = createServerFn({ method: "POST" })
  .validator(connectionSchema)
  .handler(async ({ data }): Promise<Connection> => {
    const { assertSameOrigin, requireUser } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    return getRepository().saveConnection(requireUser().id, data);
  });

export const deleteConnection = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { assertSameOrigin, requireUser } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    getRepository().deleteConnection(requireUser().id, data.id);
    return { ok: true as const };
  });

export const getConnectionModels = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<string[]> => {
    const { assertSameOrigin, requireUser } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    const { discoverModels } = await import("./providers.ts");
    assertSameOrigin();
    const user = requireUser(),
      repository = getRepository();
    repository.consumeLimit(`models:${user.id}`, 30, 60_000);
    return discoverModels(repository.connectionForRun(user.id, data.id));
  });

export const savePlayground = createServerFn({ method: "POST" })
  .validator(playgroundSchema)
  .handler(async ({ data }): Promise<Playground> => {
    const { assertSameOrigin, requireUser } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    return getRepository().savePlayground(requireUser().id, data);
  });

export const deletePlayground = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { assertSameOrigin, requireUser } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    getRepository().deletePlayground(requireUser().id, data.id);
    return { ok: true as const };
  });

export const executeRun = createServerFn({ method: "POST" })
  .validator(decisionSchema)
  .handler(async ({ data }): Promise<Run> => {
    const { assertSameOrigin, requireUser } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    const { runProvider } = await import("./providers.ts");
    assertSameOrigin();
    const repository = getRepository(),
      user = requireUser();
    repository.consumeLimit(`run:${user.id}`, 30, 60_000);
    const connection = repository.connectionForRun(user.id, data.connectionId);
    const started = performance.now();
    let result: ProviderResult | null = null;
    let failure: string | undefined;
    try {
      // The adapter redacts string keys and values before normalization, without
      // changing JSON syntax or numeric/boolean values for short custom tokens.
      result = await runProvider(connection, data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The provider request failed.";
      failure = message
        .split(connection.apiKey)
        .join("[redacted]")
        .slice(0, 1000);
    }
    return repository.recordRun(
      user.id,
      data,
      connection.name,
      performance.now() - started,
      result,
      failure,
    );
  });

export const getRun = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<Run> => {
    const { requireUser } = await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    return getRepository().getRun(requireUser().id, data.id);
  });

export const deleteRun = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { assertSameOrigin, requireUser } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    getRepository().deleteRun(requireUser().id, data.id);
    return { ok: true as const };
  });

export const listUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<User[]> => {
    const { requireAdmin } = await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    return getRepository().listUsers(requireAdmin().id);
  },
);

export const createUser = createServerFn({ method: "POST" })
  .validator(identitySchema.extend({ role: z.enum(["admin", "user"]) }))
  .handler(async ({ data }): Promise<User> => {
    const { assertSameOrigin, requireAdmin } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    return getRepository().createUser(requireAdmin().id, data);
  });

export const updateUser = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1).max(100),
      disabled: z.boolean(),
      role: z.enum(["admin", "user"]),
    }),
  )
  .handler(async ({ data }): Promise<User> => {
    const { assertSameOrigin, requireAdmin } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    return getRepository().updateUser(requireAdmin().id, data);
  });

export const changePassword = createServerFn({ method: "POST" })
  .validator(
    z.object({
      currentPassword: z.string().min(1).max(256),
      newPassword: passwordSchema,
    }),
  )
  .handler(async ({ data }) => {
    const { assertSameOrigin, requireUser, issueSession } =
      await import("./request-context.ts");
    const { getRepository } = await import("./store.ts");
    assertSameOrigin();
    const user = requireUser();
    await getRepository().changePassword(
      user.id,
      data.currentPassword,
      data.newPassword,
    );
    issueSession(user.id);
    return { ok: true as const };
  });
