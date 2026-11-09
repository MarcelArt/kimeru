import { randomUUID } from "node:crypto";
import type {
  Answer,
  Connection,
  DecisionInput,
  ImageAttachment,
  JsonValue,
  ProviderKind,
  ProviderResult,
  Question,
} from "../lib/domain.ts";

/** System One, Clef, and OpenAI Decisions wire contracts, verified against their official references.
 * https://docs.typesafe.ai/api/system-one (2026-11-08)
 * https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/workers-ai-models/clef.json (2026-11-08)
 * https://developers.openai.com/api/docs/guides/decisions (2026-11-09)
 * https://developers.openai.com/api/reference/resources/decisions/methods/create (2026-11-09)
 * Never import this module into client code; the server function owns credentials.
 */
export type SecretConnection = Connection & { apiKey: string };
export type ProviderRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};
type ProviderOptions = { fetch?: typeof fetch; timeoutMs?: number };
const MIB = 1024 * 1024;
const MEDIA_FIELD = "__kimeru_images";
const CLOUDFLARE_MODELS = ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash"];
/** OpenAI's model catalog lists every model, so it cannot tell which ones serve /decisions. */
const OPENAI_MODELS = ["gpt-6-luna"];
const DEFAULT_BASE_URLS: Record<ProviderKind, string> = {
  typesafe: "https://api.typesafe.ai/v1",
  cloudflare: "https://api.cloudflare.com/client/v4",
  openai: "https://api.openai.com/v1",
};
const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function fail(message: string): never {
  throw new Error(message);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function unit(value: unknown): value is number {
  return finite(value) && value >= 0 && value <= 1;
}

function assertJsonValue(
  value: unknown,
  depth = 0,
): asserts value is JsonValue {
  if (depth > 64)
    fail("Provider response exceeds the maximum JSON nesting depth of 64.");
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    finite(value)
  )
    return;
  if (Array.isArray(value)) {
    value.forEach((child) => assertJsonValue(child, depth + 1));
    return;
  }
  if (
    isRecord(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    Object.values(value).forEach((child) => assertJsonValue(child, depth + 1));
    return;
  }
  fail("Provider returned a value that cannot be represented as JSON.");
}

/** Custom origins are intentional for self-hosted compatible services. Redirects are forbidden below. */
export function providerEndpoint(
  connection: Pick<Connection, "kind" | "baseUrl" | "accountId">,
  model?: string,
): string {
  let url: URL;
  try {
    url = new URL(connection.baseUrl || DEFAULT_BASE_URLS[connection.kind]);
  } catch {
    return fail("Enter a valid provider base URL.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    fail(
      "Provider base URLs must use HTTP or HTTPS without embedded credentials, query parameters, or fragments.",
    );
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (connection.kind === "typesafe") {
    if (!path) path = "/v1";
    path = path.replace(/\/(systemone|models)$/, "");
    url.pathname = `${path}/${model === undefined ? "models" : "systemone"}`;
  } else if (connection.kind === "openai") {
    if (!path) path = "/v1";
    url.pathname = `${path.replace(/\/decisions$/, "")}/decisions`;
  } else {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(connection.accountId))
      fail("Cloudflare requires a valid account ID.");
    if (!path) path = "/client/v4";
    const selected = model?.replace(/^@cf\/cloudflare\//, "");
    if (selected !== "clef" && selected !== "clef-flash")
      fail("Select Clef or Clef-flash for this Cloudflare connection.");
    url.pathname = `${path}/accounts/${connection.accountId}/ai/run/@cf/cloudflare/${selected}`;
  }
  return url.toString();
}

function readState(input: DecisionInput): unknown {
  if (!input.state.trim()) fail("Provide a state before running questions.");
  if (input.stateFormat === "text") return input.state;
  let state: unknown;
  try {
    state = JSON.parse(input.state);
  } catch {
    return fail("State is not valid JSON.");
  }
  if (
    state === null ||
    (!Array.isArray(state) && typeof state !== "string" && !isRecord(state))
  ) {
    fail("JSON state must be an object, array, or string.");
  }
  validateJSON(state);
  return state;
}

function validateJSON(value: unknown, depth = 0): void {
  if (depth > 64) fail("JSON state exceeds the maximum nesting depth of 64.");
  if (typeof value === "number" && !Number.isFinite(value))
    fail("JSON state must contain only finite numbers.");
  if (Array.isArray(value))
    value.forEach((child) => validateJSON(child, depth + 1));
  else if (isRecord(value))
    Object.values(value).forEach((child) => validateJSON(child, depth + 1));
}

function readImage(
  image: ImageAttachment,
  kind: ProviderKind,
): { data: string; bytes: number } {
  const cloudflare = kind === "cloudflare";
  if (!image.id || dangerousKeys.has(image.id))
    fail("An image has an invalid identifier.");
  const match =
    /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      image.dataUrl,
    );
  if (!match || match[1] !== image.mime || match[2].length % 4 !== 0)
    fail("Images must be embedded PNG or JPEG files.");
  const bytes = Buffer.from(match[2], "base64");
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (
    (image.mime === "image/png" && !png) ||
    (image.mime === "image/jpeg" && !jpeg)
  )
    fail("An image does not match its declared format.");
  const dimensions = imageDimensions(bytes, png);
  if (
    !dimensions ||
    dimensions.width !== image.width ||
    dimensions.height !== image.height
  )
    fail(
      "Image dimensions do not match the uploaded file. Re-upload the image.",
    );
  if (kind !== "openai" && bytes.length > (cloudflare ? 4 : 16) * MIB)
    fail(
      cloudflare
        ? "Clef images must be at most 4 MiB each."
        : "TypeSafe images must be at most 16 MiB each.",
    );
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width < 1 ||
    image.height < 1
  )
    fail("Image dimensions are missing or invalid.");
  if (cloudflare && image.width * image.height > 16_000_000)
    fail("Clef images must be at most 16 megapixels.");
  if (
    kind === "typesafe" &&
    (Math.min(image.width, image.height) < 280 ||
      Math.max(image.width, image.height) > 1568)
  ) {
    fail(
      "TypeSafe images must be between 280 and 1568 pixels on each side. Resize the image before running.",
    );
  }
  return { data: match[2], bytes: bytes.length };
}

function imageDimensions(
  bytes: Buffer,
  png: boolean,
): { width: number; height: number } | null {
  if (png)
    return bytes.length >= 24
      ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
      : null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    ) {
      return length >= 7
        ? {
            height: bytes.readUInt16BE(offset + 3),
            width: bytes.readUInt16BE(offset + 5),
          }
        : null;
    }
    offset += length;
  }
  return null;
}

function requestQuestion(
  question: Question,
  images: ImageAttachment[],
  cloudflare: boolean,
): Record<string, unknown> {
  if (!question.id.trim() || dangerousKeys.has(question.id))
    fail("Each question needs a valid unique identifier.");
  if (cloudflare && !/^[A-Za-z0-9_.-]{1,100}$/.test(question.id))
    fail(
      "Clef question IDs must use letters, digits, underscores, dots, or hyphens, up to 100 characters.",
    );
  if (!question.instructions.trim())
    fail(`Question "${question.id}" needs instructions.`);
  const base = { type: question.type, instructions: question.instructions };
  if (question.type === "choice") {
    const entries = Object.entries(question.criteria);
    if (
      entries.length < 2 ||
      entries.length > 255 ||
      entries.some(([key, val]) => !key.trim() || typeof val !== "string")
    ) {
      fail(`Choice "${question.id}" needs 2–255 named criteria.`);
    }
    return { ...base, criteria: question.criteria };
  }
  if (question.type === "score") {
    if (
      question.criteria.length < 2 ||
      question.criteria.length > 10 ||
      question.criteria.some((level) => !level.trim())
    ) {
      fail(`Score "${question.id}" needs 2–10 ordered level descriptions.`);
    }
    return { ...base, criteria: question.criteria };
  }
  if (question.type === "noul") {
    const criteria = Object.fromEntries(
      Object.entries(question.criteria ?? {}).filter(([, value]) =>
        value?.trim(),
      ),
    );
    return Object.keys(criteria).length ? { ...base, criteria } : base;
  }
  if (cloudflare)
    fail(
      "Clef supports images, but not Box questions. Choose a supporting TypeSafe model or remove the Box questions.",
    );
  const index = images.findIndex(
    (image) => image.id === question.targetImageId,
  );
  if (index < 0) fail(`Box "${question.id}" needs a target image.`);
  return {
    ...base,
    instructions: `${base.instructions}\nTarget image: \`${MEDIA_FIELD}[${index}].image\`.`,
  };
}

/** Preserve original object state fields. Attachments are automatically available to every question. */
export function buildProviderRequest(
  connection: SecretConnection,
  input: DecisionInput,
): ProviderRequest {
  if (!connection.apiKey.trim()) fail("This connection has no API key.");
  if (!input.model.trim()) fail("Select a model before running.");
  const cloudflare = connection.kind === "cloudflare";
  if (!input.questions.length) fail("Add at least one question.");
  if (cloudflare && input.questions.length > 64)
    fail("Clef accepts at most 64 questions per run.");
  if (new Set(input.questions.map((q) => q.id)).size !== input.questions.length)
    fail("Question identifiers must be unique.");
  if (
    new Set(input.images.map((image) => image.id)).size !== input.images.length
  )
    fail("Image identifiers must be unique.");
  if (connection.kind === "openai")
    return buildOpenAIRequest(connection, input);
  if (cloudflare && input.images.length > 4)
    fail("Clef accepts at most four images per run.");
  const knownJev = /^jev-(\d+)\.(\d+)/.exec(input.model);
  if (
    !cloudflare &&
    knownJev &&
    input.questions.some((q) => q.type === "box") &&
    (Number(knownJev[1]) < 1 ||
      (Number(knownJev[1]) === 1 && Number(knownJev[2]) < 14))
  )
    fail("Box questions require Jev 1.14 or newer.");
  if (
    !cloudflare &&
    knownJev &&
    input.images.length &&
    Number(knownJev[1]) === 1 &&
    Number(knownJev[2]) < 13
  )
    fail("Image inputs require Jev 1.13 or newer.");
  let state = readState(input);
  const assets: Record<string, unknown> = Object.create(null);
  let totalImageBytes = 0;
  const images = input.images.map((image, index) => {
    const parsed = readImage(image, connection.kind);
    totalImageBytes += parsed.bytes;
    const reference = `kimeru-image-${randomUUID()}`;
    if (!cloudflare)
      assets[reference] = {
        type: "image",
        format: image.mime === "image/png" ? "png" : "jpg",
        data_base64: parsed.data,
      };
    return {
      name: image.name,
      image: cloudflare ? `Image ${index + 1}` : reference,
    };
  });
  if (cloudflare && totalImageBytes > 8 * MIB)
    fail("Clef accepts at most 8 MiB of decoded images in total.");
  if (images.length) {
    if (isRecord(state) && Object.hasOwn(state, MEDIA_FIELD))
      fail(
        `The state field "${MEDIA_FIELD}" is reserved for image attachments. Rename that field.`,
      );
    const metadata = cloudflare
      ? input.images.map((image, index) => ({
          name: image.name,
          image: `Image ${index + 1} in the attached images array`,
        }))
      : images;
    state = isRecord(state)
      ? { ...state, [MEDIA_FIELD]: metadata }
      : { context: state, [MEDIA_FIELD]: metadata };
  }
  const questions = Object.fromEntries(
    input.questions.map((question) => [
      question.id,
      requestQuestion(question, input.images, cloudflare),
    ]),
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${connection.apiKey}`,
  };
  const body: Record<string, unknown> = {
    model: cloudflare
      ? input.model.replace(/^@cf\/cloudflare\//, "")
      : input.model,
    state,
    questions,
  };
  if (input.images.length) {
    if (cloudflare) body.images = input.images.map((image) => image.dataUrl);
    else body.assets = assets;
  }
  if (
    !cloudflare &&
    (input.images.length || input.questions.some((q) => q.type === "box"))
  )
    headers["TypeSafe-Danger-Zone-Images"] = "true";
  if (Buffer.byteLength(JSON.stringify(body)) > (cloudflare ? 13 : 32) * MIB)
    fail("The provider request is too large. Reduce the state or image sizes.");
  return { url: providerEndpoint(connection, input.model), headers, body };
}

function readProbabilities(
  value: unknown,
  keys: string[],
  id: string,
): Record<string, number> {
  if (!isRecord(value) || keys.some((key) => !unit(value[key])))
    fail(`Provider returned invalid probabilities for "${id}".`);
  const entries = Object.entries(value);
  if (entries.some(([key, number]) => !keys.includes(key) || !unit(number)))
    fail(`Provider returned unexpected probability options for "${id}".`);
  const probabilities = Object.fromEntries(entries) as Record<string, number>;
  if (
    Math.abs(
      Object.values(probabilities).reduce(
        (sum, probability) => sum + probability,
        0,
      ) - 1,
    ) > 0.02
  )
    fail(`Provider probabilities do not sum to one for "${id}".`);
  return probabilities;
}

/** Keep the wire response available, while making typed display values explicit and validated. */
export function normalizeProviderResult(
  raw: unknown,
  input: DecisionInput,
  cloudflare = false,
): ProviderResult {
  assertJsonValue(raw);
  let payload = raw;
  if (cloudflare) {
    if (!isRecord(raw) || raw.success !== true || !isRecord(raw.result))
      fail(
        "Cloudflare reported an unsuccessful response. Check the connection and request.",
      );
    payload = raw.result;
  }
  if (!isRecord(payload) || !isRecord(payload.answers))
    fail("Provider response did not contain a System One answers object.");
  const answers: Record<string, Answer> = Object.create(null);
  for (const question of input.questions) {
    const value = payload.answers[question.id];
    if (!isRecord(value) || value.type !== question.type)
      fail(
        `Provider returned a missing or mismatched answer for "${question.id}".`,
      );
    const answer: Answer = { type: question.type };
    if (question.type !== "noul") {
      if (!unit(value.confidence))
        fail(`Provider returned invalid confidence for "${question.id}".`);
      answer.confidence = value.confidence;
    }
    if (question.type === "choice") {
      if (
        typeof value.choice !== "string" ||
        !Object.hasOwn(question.criteria, value.choice)
      )
        fail(`Provider returned an unknown choice for "${question.id}".`);
      answer.choice = value.choice;
      answer.probabilities = readProbabilities(
        value.probabilities,
        Object.keys(question.criteria),
        question.id,
      );
      if (
        answer.probabilities[value.choice] + 0.02 <
        Math.max(...Object.values(answer.probabilities))
      )
        fail(
          `Provider returned a choice inconsistent with its probabilities for "${question.id}".`,
        );
    } else if (question.type === "score") {
      if (
        !finite(value.score) ||
        value.score < 0 ||
        value.score > question.criteria.length - 1
      )
        fail(`Provider returned an out-of-range score for "${question.id}".`);
      answer.score = value.score;
      answer.probabilities = readProbabilities(
        value.probabilities,
        question.criteria.map((_, index) => String(index)),
        question.id,
      );
      const weighted = Object.entries(answer.probabilities).reduce(
        (sum, [level, probability]) => sum + Number(level) * probability,
        0,
      );
      if (Math.abs(value.score - weighted) > 0.02)
        fail(
          `Provider returned a score inconsistent with its probabilities for "${question.id}".`,
        );
      if (
        !isRecord(value.legend) ||
        Object.keys(value.legend).length !== question.criteria.length
      )
        fail(`Provider returned an invalid score legend for "${question.id}".`);
      const legend = value.legend;
      answer.legend = question.criteria.map((_, index) => {
        const description = legend[String(index)];
        if (typeof description !== "string")
          fail(
            `Provider returned an invalid score legend for "${question.id}".`,
          );
        return description;
      });
    } else if (question.type === "noul") {
      if (!unit(value.noul))
        fail(
          `Provider returned an invalid truth probability for "${question.id}".`,
        );
      answer.noul = value.noul;
      delete answer.confidence;
    } else {
      if (!isRecord(value.box))
        fail(`Provider returned no rectangle for "${question.id}".`);
      const { left, top, right, bottom } = value.box;
      if (
        !unit(left) ||
        !unit(top) ||
        !unit(right) ||
        !unit(bottom) ||
        left >= right ||
        top >= bottom
      )
        fail(
          `Provider returned invalid image coordinates for "${question.id}".`,
        );
      answer.box = { left, top, right, bottom };
      answer.targetImageId = question.targetImageId;
    }
    answers[question.id] = answer;
  }
  return {
    model: typeof payload.model === "string" ? payload.model : input.model,
    answers,
    raw,
  };
}

/* ---------------------------------------------------------------------------
 * OpenAI Decisions API (POST /v1/decisions).
 * Questions are an ordered array keyed by `name`; answers return in the same order.
 * Kimeru's Noul maps to `predicate`. Box has no OpenAI equivalent.
 * ------------------------------------------------------------------------- */
const OPENAI_MAX_QUESTIONS = 400;
const OPENAI_JSON_LIMITS = { depth: 32, values: 10_000, bytes: 256 * 1024 };

/** `input_json` accepts an object or an array of objects within documented size limits. */
function openAIStatePart(input: DecisionInput): Record<string, unknown> {
  const state = readState(input);
  if (input.stateFormat === "text" || typeof state === "string")
    return { type: "input_text", text: state };
  if (
    Array.isArray(state) &&
    (!state.length || state.some((item) => !isRecord(item)))
  )
    return { type: "input_text", text: JSON.stringify(state) };
  let values = 0;
  let maxDepth = 0;
  const walk = (value: unknown, depth: number) => {
    values++;
    if (Array.isArray(value) || isRecord(value)) {
      maxDepth = Math.max(maxDepth, depth);
      Object.values(value).forEach((child) => walk(child, depth + 1));
    }
  };
  walk(state, 1);
  if (
    maxDepth > OPENAI_JSON_LIMITS.depth ||
    values > OPENAI_JSON_LIMITS.values ||
    Buffer.byteLength(JSON.stringify(state)) > OPENAI_JSON_LIMITS.bytes
  )
    fail(
      "JSON state exceeds OpenAI's structured input limits (32 levels, 10,000 values, 256 KiB). Reduce it or switch the state format to Text.",
    );
  return { type: "input_json", data: state };
}

function openAIQuestion(question: Question): Record<string, unknown> {
  if (!question.id.trim() || dangerousKeys.has(question.id))
    fail("Each question needs a valid unique identifier.");
  if (!question.instructions.trim())
    fail(`Question "${question.id}" needs instructions.`);
  const base = { name: question.id, instructions: question.instructions };
  if (question.type === "choice") {
    const entries = Object.entries(question.criteria);
    if (
      entries.length < 2 ||
      entries.length > 255 ||
      entries.some(([key, val]) => !key.trim() || typeof val !== "string")
    )
      fail(`Choice "${question.id}" needs 2–255 named criteria.`);
    return {
      type: "choice",
      ...base,
      choices: entries.map(([value, description]) =>
        description.trim() ? { value, description } : { value },
      ),
    };
  }
  if (question.type === "score") {
    if (
      question.criteria.length < 2 ||
      question.criteria.length > 10 ||
      question.criteria.some((level) => !level.trim())
    )
      fail(`Score "${question.id}" needs 2–10 ordered level descriptions.`);
    return {
      type: "score",
      ...base,
      levels: question.criteria.map((label) => ({ label })),
    };
  }
  if (question.type === "noul") {
    const guidance = [
      question.criteria?.true?.trim() &&
        `True when: ${question.criteria.true.trim()}`,
      question.criteria?.false?.trim() &&
        `False when: ${question.criteria.false.trim()}`,
    ].filter(Boolean);
    return {
      type: "predicate",
      ...base,
      instructions: guidance.length
        ? `${question.instructions}\n\n${guidance.join("\n")}`
        : question.instructions,
    };
  }
  return fail(
    "OpenAI Decisions does not support Box questions. Choose a TypeSafe model that supports Box, or remove the Box questions.",
  );
}

function buildOpenAIRequest(
  connection: SecretConnection,
  input: DecisionInput,
): ProviderRequest {
  if (input.questions.length > OPENAI_MAX_QUESTIONS)
    fail(
      `OpenAI Decisions accepts at most ${OPENAI_MAX_QUESTIONS} questions per run.`,
    );
  const questions = input.questions.map(openAIQuestion);
  const content: Record<string, unknown>[] = [openAIStatePart(input)];
  input.images.forEach((image, index) => {
    readImage(image, "openai");
    content.push(
      { type: "input_text", text: `Image ${index + 1}: ${image.name}` },
      { type: "input_image", image_url: image.dataUrl, detail: "auto" },
    );
  });
  return {
    url: providerEndpoint(connection, input.model),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${connection.apiKey}`,
    },
    body: {
      model: input.model,
      input: [{ role: "user", content }],
      questions,
    },
  };
}

/** OpenAI reports distributions as `[{ value, probability }]`; omitted options count as zero. */
function openAIProbabilities(
  value: unknown,
  keys: string[],
  id: string,
): Record<string, number> {
  if (!Array.isArray(value))
    fail(`Provider returned invalid probabilities for "${id}".`);
  const record: Record<string, unknown> = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !["string", "number"].includes(typeof entry.value) ||
      dangerousKeys.has(String(entry.value))
    )
      fail(`Provider returned invalid probabilities for "${id}".`);
    record[String(entry.value)] = entry.probability;
  }
  return readProbabilities(record, keys, id);
}

export function normalizeOpenAIResult(
  raw: unknown,
  input: DecisionInput,
): ProviderResult {
  assertJsonValue(raw);
  if (!isRecord(raw) || !Array.isArray(raw.answers))
    fail(
      "Provider response did not contain an OpenAI Decisions answers array.",
    );
  if (raw.answers.length !== input.questions.length)
    fail(
      `Provider returned ${raw.answers.length} answers for ${input.questions.length} questions.`,
    );
  const answers: Record<string, Answer> = Object.create(null);
  input.questions.forEach((question, index) => {
    const value = (raw.answers as unknown[])[index];
    const wireType = question.type === "noul" ? "predicate" : question.type;
    if (
      !isRecord(value) ||
      (value.name != null && value.name !== question.id) ||
      (value.type !== wireType && value.type !== "refusal")
    )
      fail(
        `Provider returned a missing or mismatched answer for "${question.id}".`,
      );
    const answer: Answer = { type: question.type };
    if (value.type === "refusal") {
      answer.refused = true;
    } else if (question.type === "noul") {
      if (!unit(value.probability))
        fail(
          `Provider returned an invalid truth probability for "${question.id}".`,
        );
      answer.noul = value.probability;
    } else if (question.type === "choice") {
      if (!finite(value.confidence))
        fail(`Provider returned invalid confidence for "${question.id}".`);
      if (
        typeof value.choice !== "string" ||
        !Object.hasOwn(question.criteria, value.choice)
      )
        fail(`Provider returned an unknown choice for "${question.id}".`);
      answer.choice = value.choice;
      answer.confidence = value.confidence;
      answer.probabilities = openAIProbabilities(
        value.probabilities,
        Object.keys(question.criteria),
        question.id,
      );
      if (
        answer.probabilities[value.choice] + 0.02 <
        Math.max(...Object.values(answer.probabilities))
      )
        fail(
          `Provider returned a choice inconsistent with its probabilities for "${question.id}".`,
        );
    } else if (question.type === "score") {
      if (!finite(value.confidence))
        fail(`Provider returned invalid confidence for "${question.id}".`);
      if (
        !finite(value.score) ||
        value.score < 0 ||
        value.score > question.criteria.length - 1
      )
        fail(`Provider returned an out-of-range score for "${question.id}".`);
      answer.score = value.score;
      answer.confidence = value.confidence;
      answer.probabilities = openAIProbabilities(
        value.probabilities,
        question.criteria.map((_, level) => String(level)),
        question.id,
      );
      const weighted = Object.entries(answer.probabilities).reduce(
        (sum, [level, probability]) => sum + Number(level) * probability,
        0,
      );
      if (Math.abs(value.score - weighted) > 0.02)
        fail(
          `Provider returned a score inconsistent with its probabilities for "${question.id}".`,
        );
      answer.legend = [...question.criteria];
    } else {
      fail(`OpenAI Decisions does not support Box questions.`);
    }
    answers[question.id] = answer;
  });
  return {
    model: typeof raw.model === "string" ? raw.model : input.model,
    answers,
    raw,
  };
}

function redactSecret(value: JsonValue, secret: string): JsonValue {
  if (typeof value === "string") return value.split(secret).join("[redacted]");
  if (Array.isArray(value))
    return value.map((child) => redactSecret(child, secret));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key.split(secret).join("[redacted]"),
        redactSecret(child, secret),
      ]),
    );
  return value;
}

function statusMessage(status: number): string {
  if (status === 401 || status === 403)
    return "Provider authentication failed. Check the API key and its permissions.";
  if (status === 404)
    return "Provider endpoint or model was not found. Check the base URL, account ID, and model.";
  if (status === 400 || status === 422)
    return "Provider rejected the request. Check its model, question criteria, and image capabilities.";
  if (status === 413)
    return "Provider rejected the request size. Reduce the state or image sizes.";
  if (status === 429)
    return "Provider rate limit reached. Wait before running again.";
  if (status === 529 || status >= 500)
    return "Provider is temporarily unavailable. Try again shortly.";
  return `Provider request failed (HTTP ${status}).`;
}

async function fetchJSON(
  url: string,
  init: RequestInit,
  options: ProviderOptions,
): Promise<JsonValue> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 60_000);
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(url, {
      ...init,
      redirect: "error",
      signal,
    });
  } catch {
    return fail(
      signal.aborted
        ? "Provider request timed out. Try a smaller request or run again."
        : "Could not reach the provider. Check its base URL and network access. Redirects are not permitted.",
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    fail(statusMessage(response.status));
  }
  if (Number(response.headers.get("content-length")) > 4 * MIB) {
    await response.body?.cancel();
    fail("Provider response exceeded the 4 MiB limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) fail("Provider returned an empty response.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4 * MIB) {
        await reader.cancel();
        fail("Provider response exceeded the 4 MiB limit.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Provider response exceeded the 4 MiB limit."
    )
      throw error;
    return fail(
      signal.aborted
        ? "Provider request timed out while reading its response."
        : "Provider response was interrupted. Try again.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return fail(
      "Provider returned invalid JSON. Check that the base URL is a System One-compatible endpoint.",
    );
  }
  assertJsonValue(parsed);
  return parsed;
}

export async function runProvider(
  connection: SecretConnection,
  input: DecisionInput,
  options: ProviderOptions = {},
): Promise<ProviderResult> {
  const request = buildProviderRequest(connection, input);
  const raw = await fetchJSON(
    request.url,
    {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
    },
    options,
  );
  const safe = redactSecret(raw, connection.apiKey);
  if (connection.kind === "openai") return normalizeOpenAIResult(safe, input);
  return normalizeProviderResult(safe, input, connection.kind === "cloudflare");
}

export async function discoverModels(
  connection: SecretConnection,
  options: ProviderOptions = {},
): Promise<string[]> {
  if (connection.kind === "cloudflare") return [...CLOUDFLARE_MODELS];
  if (connection.kind === "openai") return [...OPENAI_MODELS];
  if (!connection.apiKey.trim()) fail("This connection has no API key.");
  const response = await fetchJSON(
    providerEndpoint(connection),
    {
      method: "GET",
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    },
    options,
  );
  const raw = redactSecret(response, connection.apiKey);
  if (!isRecord(raw) || !Array.isArray(raw.models))
    fail(
      "Provider returned an invalid model catalog. Enter a model name manually.",
    );
  const names = raw.models.flatMap((item) =>
    isRecord(item) && typeof item.name === "string" && item.name.trim()
      ? [item.name]
      : [],
  );
  if (!names.length)
    fail(
      "No models were returned for this account. Check provider access or enter a model name manually.",
    );
  return [...new Set(names)];
}
