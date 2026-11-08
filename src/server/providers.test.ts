import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DecisionInput, ImageAttachment } from "../lib/domain.ts";
import {
  buildProviderRequest,
  discoverModels,
  normalizeProviderResult,
  providerEndpoint,
  runProvider,
} from "./providers.ts";
import type { SecretConnection } from "./providers.ts";

const connection: SecretConnection = {
  id: "c",
  ownerId: "u",
  name: "Provider",
  kind: "typesafe",
  baseUrl: "https://api.typesafe.ai/v1",
  accountId: "",
  shared: false,
  hasKey: true,
  createdAt: "",
  apiKey: "never-expose-this-token",
};
const cf: SecretConnection = {
  ...connection,
  kind: "cloudflare",
  baseUrl: "https://api.cloudflare.com/client/v4",
  accountId: "account123",
};
const image: ImageAttachment = {
  id: "image-one",
  name: "product.jpg",
  mime: "image/jpeg",
  width: 1000,
  height: 667,
  dataUrl: `data:image/jpeg;base64,${readFileSync(new URL("../../design-demos/assets/sample-mug.jpg", import.meta.url)).toString("base64")}`,
};
const input: DecisionInput = {
  title: "Test",
  connectionId: "c",
  model: "jev-latest",
  state: '{"ticket":"Payment failed"}',
  stateFormat: "json",
  images: [],
  questions: [
    {
      id: "team",
      type: "choice",
      instructions: "Which team?",
      criteria: { billing: "Payment issues", technical: "Software problems" },
    },
    {
      id: "urgency",
      type: "score",
      instructions: "How urgent?",
      criteria: ["Low", "Medium", "High"],
    },
    {
      id: "refund",
      type: "noul",
      instructions: "Is a refund needed?",
      criteria: { true: "Refund requested", false: "No refund requested" },
    },
  ],
};
function rawResult() {
  return {
    model: "jev-1.14.0",
    answers: {
      team: {
        type: "choice",
        choice: "billing",
        confidence: 0.6,
        probabilities: { billing: 0.8, technical: 0.2 },
      },
      urgency: {
        type: "score",
        score: 1.5,
        confidence: 0.3,
        probabilities: { "0": 0, "1": 0.5, "2": 0.5 },
        legend: { "0": "Low", "1": "Medium", "2": "High" },
      },
      refund: { type: "noul", noul: 0.9 },
    },
    usage: { input_tokens: 200, output_tokens: 20 },
  };
}
function mockFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (url, init) =>
    handler(String(url), init ?? {})) as typeof fetch;
}

test("TypeSafe uses named typed questions and preserves structured state", () => {
  const request = buildProviderRequest(connection, input);
  assert.equal(request.url, "https://api.typesafe.ai/v1/systemone");
  assert.deepEqual(request.body.state, { ticket: "Payment failed" });
  assert.deepEqual(request.body.questions, {
    team: {
      type: "choice",
      instructions: "Which team?",
      criteria: { billing: "Payment issues", technical: "Software problems" },
    },
    urgency: {
      type: "score",
      instructions: "How urgent?",
      criteria: ["Low", "Medium", "High"],
    },
    refund: {
      type: "noul",
      instructions: "Is a refund needed?",
      criteria: { true: "Refund requested", false: "No refund requested" },
    },
  });
  assert.equal(request.headers["TypeSafe-Danger-Zone-Images"], undefined);
});
test("TypeSafe image assets are referenced once and Box explicitly targets its source", () => {
  const withImage = {
    ...input,
    images: [image],
    questions: [
      ...input.questions,
      {
        id: "region",
        type: "box" as const,
        instructions: "Locate the mug.",
        targetImageId: image.id,
      },
    ],
  };
  const request = buildProviderRequest(connection, withImage);
  const state = request.body.state as {
    ticket: string;
    __kimeru_images: { name: string; image: string }[];
  };
  const ref = state.__kimeru_images[0].image;
  assert.match(ref, /^kimeru-image-[0-9a-f-]+$/);
  assert.equal(state.ticket, "Payment failed");
  assert.deepEqual((request.body.assets as Record<string, unknown>)[ref], {
    type: "image",
    format: "jpg",
    data_base64: image.dataUrl.split(",")[1],
  });
  assert.equal(request.headers["TypeSafe-Danger-Zone-Images"], "true");
  assert.match(
    (request.body.questions as Record<string, { instructions: string }>).region
      .instructions,
    /__kimeru_images\[0\]\.image/,
  );
  assert.throws(
    () =>
      buildProviderRequest(connection, { ...withImage, model: "jev-1.13.0" }),
    /1.14/,
  );
  assert.throws(
    () => buildProviderRequest(connection, { ...withImage, images: [] }),
    /target image/,
  );
});
test("text with images stays intact as context; reserved field and forged image dimensions fail", () => {
  const request = buildProviderRequest(connection, {
    ...input,
    stateFormat: "text",
    state: "Original plain text",
    images: [image],
  });
  assert.equal(
    (request.body.state as { context: string }).context,
    "Original plain text",
  );
  assert.throws(
    () =>
      buildProviderRequest(connection, {
        ...input,
        state: '{"__kimeru_images":[]}',
        images: [image],
      }),
    /reserved/,
  );
  assert.throws(
    () =>
      buildProviderRequest(connection, {
        ...input,
        images: [{ ...image, width: 300 }],
      }),
    /dimensions do not match/,
  );
  assert.throws(
    () =>
      buildProviderRequest(connection, { ...input, state: '{"value":1e999}' }),
    /finite numbers/,
  );
});
test("Clef uses account endpoint, short model selector, embedded images, and explicit Box rejection", () => {
  const request = buildProviderRequest(cf, {
    ...input,
    model: "@cf/cloudflare/clef-flash",
    images: [image],
  });
  assert.equal(
    request.url,
    "https://api.cloudflare.com/client/v4/accounts/account123/ai/run/@cf/cloudflare/clef-flash",
  );
  assert.equal(request.body.model, "clef-flash");
  assert.deepEqual(request.body.images, [image.dataUrl]);
  assert.equal(request.body.assets, undefined);
  assert.equal(request.headers["TypeSafe-Danger-Zone-Images"], undefined);
  assert.throws(
    () =>
      buildProviderRequest(cf, {
        ...input,
        model: "clef",
        questions: [
          {
            id: "box",
            type: "box",
            instructions: "Locate mug",
            targetImageId: image.id,
          },
        ],
        images: [image],
      }),
    /not Box/,
  );
  assert.throws(
    () =>
      buildProviderRequest(cf, {
        ...input,
        model: "clef",
        images: Array.from({ length: 5 }, (_, i) => ({
          ...image,
          id: String(i),
        })),
      }),
    /four images/,
  );
});
test("endpoints support custom compatible roots without credentials/query/path confusion", () => {
  assert.equal(
    providerEndpoint(
      { ...connection, baseUrl: "http://localhost:9000" },
      "custom",
    ),
    "http://localhost:9000/v1/systemone",
  );
  assert.equal(
    providerEndpoint({
      ...connection,
      baseUrl: "https://example.org/proxy/v1/systemone",
    }),
    "https://example.org/proxy/v1/models",
  );
  assert.throws(
    () =>
      providerEndpoint({
        ...connection,
        baseUrl: "https://user:pass@example.org",
      }),
    /embedded credentials/,
  );
  assert.throws(
    () =>
      providerEndpoint({
        ...connection,
        baseUrl: "https://example.org/?key=secret",
      }),
    /query/,
  );
  assert.throws(() => providerEndpoint(cf, "../../other"), /Select Clef/);
});
test("wire results preserve probabilities/confidence, normalize score legend, and attach Box image identity", () => {
  const result = normalizeProviderResult(rawResult(), input);
  assert.equal(result.model, "jev-1.14.0");
  assert.equal(result.answers.team.confidence, 0.6);
  assert.equal(result.answers.team.probabilities?.billing, 0.8);
  assert.deepEqual(result.answers.urgency.legend, ["Low", "Medium", "High"]);
  assert.equal(result.answers.refund.noul, 0.9);
  assert.equal(result.answers.refund.confidence, undefined);
  const boxInput = {
    ...input,
    images: [image],
    questions: [
      {
        id: "box",
        type: "box" as const,
        instructions: "Locate mug",
        targetImageId: image.id,
      },
    ],
  };
  const box = normalizeProviderResult(
    {
      answers: {
        box: {
          type: "box",
          box: { left: 0.1, top: 0.2, right: 0.5, bottom: 0.8 },
          confidence: 0.7,
        },
      },
    },
    boxInput,
  );
  assert.equal(box.answers.box.targetImageId, image.id);
  assert.equal(box.answers.box.box?.right, 0.5);
});
test("missing answers, bad probability distributions, and invalid boxes fail instead of displaying invented values", () => {
  assert.throws(
    () => normalizeProviderResult({ answers: {} }, input),
    /missing or mismatched/,
  );
  const bad = rawResult();
  bad.answers.team.probabilities.billing = 0.1;
  assert.throws(() => normalizeProviderResult(bad, input), /sum to one/);
  const badBox = {
    ...input,
    questions: [
      {
        id: "box",
        type: "box" as const,
        instructions: "Find it",
        targetImageId: image.id,
      },
    ],
  };
  assert.throws(
    () =>
      normalizeProviderResult(
        {
          answers: {
            box: {
              type: "box",
              box: { left: 0.9, top: 0.2, right: 0.5, bottom: 0.8 },
              confidence: 0.7,
            },
          },
        },
        badBox,
      ),
    /invalid image coordinates/,
  );
  assert.throws(
    () =>
      normalizeProviderResult(
        { success: false, result: rawResult() },
        input,
        true,
      ),
    /unsuccessful/,
  );
});
test("required confidence, score legends and weighted results cannot be silently fabricated", () => {
  const noConfidence = JSON.parse(JSON.stringify(rawResult()));
  delete noConfidence.answers.team.confidence;
  assert.throws(
    () => normalizeProviderResult(noConfidence, input),
    /invalid confidence/,
  );
  const missingLegend = JSON.parse(JSON.stringify(rawResult()));
  delete missingLegend.answers.urgency.legend["1"];
  assert.throws(
    () => normalizeProviderResult(missingLegend, input),
    /invalid score legend/,
  );
  const wrongScore = rawResult();
  wrongScore.answers.urgency.score = 0.3;
  assert.throws(
    () => normalizeProviderResult(wrongScore, input),
    /score inconsistent/,
  );
  const wrongChoice = rawResult();
  wrongChoice.answers.team.choice = "technical";
  assert.throws(
    () => normalizeProviderResult(wrongChoice, input),
    /choice inconsistent/,
  );
  assert.throws(
    () => normalizeProviderResult({ ...rawResult(), unexpected: NaN }, input),
    /cannot be represented as JSON/,
  );
});
test("transport authenticates server-side, forbids redirects, and unwraps the Cloudflare response", async () => {
  const response = await runProvider(
    cf,
    { ...input, model: "clef" },
    {
      fetch: mockFetch((url, init) => {
        assert.match(url, /accounts\/account123\/ai\/run/);
        assert.equal(init.redirect, "error");
        assert.ok(init.signal instanceof AbortSignal);
        assert.equal(
          (init.headers as Record<string, string>).Authorization,
          `Bearer ${cf.apiKey}`,
        );
        return Response.json({
          success: true,
          result: rawResult(),
          errors: [],
          messages: [],
        });
      }),
    },
  );
  assert.equal(response.answers.team.choice, "billing");
});
test("HTTP failures and successful raw responses never reveal a connection key", async () => {
  await assert.rejects(
    () =>
      runProvider(connection, input, {
        fetch: mockFetch(
          () => new Response(`token=${connection.apiKey}`, { status: 401 }),
        ),
      }),
    (error) =>
      error instanceof Error &&
      /authentication failed/.test(error.message) &&
      !error.message.includes(connection.apiKey),
  );
  const response = await runProvider(connection, input, {
    fetch: mockFetch(() =>
      Response.json({ ...rawResult(), debug: connection.apiKey }),
    ),
  });
  assert.equal((response.raw as { debug: string }).debug, "[redacted]");
  await assert.rejects(
    () =>
      runProvider(connection, input, {
        fetch: mockFetch(() => Response.json({}, { status: 429 })),
      }),
    /rate limit/,
  );
  await assert.rejects(
    () =>
      runProvider(connection, input, {
        fetch: mockFetch(() => new Response("not JSON")),
      }),
    /invalid JSON/,
  );
  await assert.rejects(
    () =>
      runProvider(connection, input, {
        fetch: mockFetch(() => {
          throw new Error(`secret ${connection.apiKey}`);
        }),
      }),
    /Could not reach/,
  );
});
test("model discovery uses TypeSafe names and provides the documented Clef catalog without inference calls", async () => {
  const models = await discoverModels(connection, {
    fetch: mockFetch((url, init) => {
      assert.equal(url, "https://api.typesafe.ai/v1/models");
      assert.equal(init.method, "GET");
      return Response.json({
        models: [
          { name: "jev-latest" },
          { name: "jev-1.14.0" },
          { name: "jev-latest" },
        ],
      });
    }),
  });
  assert.deepEqual(models, ["jev-latest", "jev-1.14.0"]);
  assert.deepEqual(
    await discoverModels(cf, {
      fetch: mockFetch(() => {
        throw new Error("Must not run paid inference");
      }),
    }),
    ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash"],
  );
});
test("slow providers are aborted and oversized responses are rejected before display", async () => {
  await assert.rejects(
    () =>
      runProvider(connection, input, {
        timeoutMs: 5,
        fetch: mockFetch(
          (_url, init) =>
            new Promise((_resolve, reject) => {
              const hold = setTimeout(
                () => reject(new Error("Unexpected delay")),
                100,
              );
              init.signal?.addEventListener("abort", () => {
                clearTimeout(hold);
                reject(new Error("Abort"));
              });
            }),
        ),
      }),
    /timed out/,
  );
  await assert.rejects(
    () =>
      runProvider(connection, input, {
        fetch: mockFetch(
          () =>
            new Response("{}", {
              headers: { "content-length": String(5 * 1024 * 1024) },
            }),
        ),
      }),
    /4 MiB/,
  );
});
