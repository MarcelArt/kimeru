import { z } from "zod";

export const idSchema = z.object({ id: z.string().min(1).max(100) });
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters for the password.")
  .max(256);
export const identitySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase().max(254),
  password: passwordSchema,
});
export const loginSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(1).max(256),
});
export const connectionSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(100),
    kind: z.enum(["typesafe", "cloudflare"]),
    baseUrl: z
      .url()
      .max(2048)
      .refine((value) => {
        const url = new URL(value);
        return (
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      }, "Use an HTTP(S) base URL without embedded credentials, query, or fragment."),
    accountId: z.string().trim().max(100),
    shared: z.boolean(),
    apiKey: z.string().trim().max(4096),
  })
  .refine(
    (value) =>
      value.kind !== "cloudflare" || /^[a-zA-Z0-9_-]+$/.test(value.accountId),
    "Cloudflare requires an account ID.",
  );

const questionBase = {
  id: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]{1,100}$/,
      "Question IDs use letters, digits, dots, underscores, or hyphens.",
    ),
  instructions: z.string().trim().min(1).max(32000),
};
export const questionSchema = z.discriminatedUnion("type", [
  z.object({
    ...questionBase,
    type: z.literal("choice"),
    criteria: z
      .record(z.string().min(1).max(100), z.string().max(8000))
      .refine(
        (value) =>
          Object.keys(value).length >= 2 && Object.keys(value).length <= 255,
        "Choice needs 2–255 options.",
      ),
  }),
  z.object({
    ...questionBase,
    type: z.literal("score"),
    criteria: z.array(z.string().trim().min(1).max(8000)).min(2).max(10),
  }),
  z.object({
    ...questionBase,
    type: z.literal("noul"),
    criteria: z
      .object({
        true: z.string().max(8000).optional(),
        false: z.string().max(8000).optional(),
      })
      .optional(),
  }),
  z.object({
    ...questionBase,
    type: z.literal("box"),
    targetImageId: z.string().min(1).max(100),
  }),
]);

export const imageSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/),
  name: z.string().min(1).max(255),
  mime: z.enum(["image/jpeg", "image/png"]),
  dataUrl: z
    .string()
    .max(23 * 1024 * 1024)
    .regex(
      /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/,
      "Upload a PNG or JPEG image.",
    ),
  width: z.number().int().min(1).max(16000),
  height: z.number().int().min(1).max(16000),
});
export const decisionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    connectionId: z.string().max(100),
    model: z.string().trim().min(1).max(200),
    state: z.string().max(2 * 1024 * 1024),
    stateFormat: z.enum(["json", "text"]),
    questions: z.array(questionSchema).min(1).max(256),
    images: z.array(imageSchema).max(8),
  })
  .superRefine((value, context) => {
    if (value.stateFormat === "json") {
      try {
        JSON.parse(value.state);
      } catch {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "State must be valid JSON.",
        });
      }
    }
    if (
      new Set(value.questions.map((q) => q.id)).size !== value.questions.length
    )
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Each question must have a unique ID.",
      });
    if (
      new Set(value.images.map((image) => image.id)).size !==
      value.images.length
    )
      context.addIssue({
        code: "custom",
        path: ["images"],
        message: "Each image must have a unique ID.",
      });
    if (
      value.images.reduce((size, image) => size + image.dataUrl.length, 0) >
      30 * 1024 * 1024
    )
      context.addIssue({
        code: "custom",
        path: ["images"],
        message: "Combined images must be below 22 MiB.",
      });
    for (const question of value.questions) {
      if (
        question.type === "box" &&
        !value.images.some((image) => image.id === question.targetImageId)
      )
        context.addIssue({
          code: "custom",
          path: ["questions"],
          message: `Select a source image for ${question.id}.`,
        });
    }
  });
// Saving preserves work in progress. Execution still applies every constraint above.
const draftQuestionBase = {
  id: questionBase.id,
  instructions: z.string().max(32000),
};
const draftQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    ...draftQuestionBase,
    type: z.literal("choice"),
    criteria: z
      .record(z.string().max(100), z.string().max(8000))
      .refine((value) => Object.keys(value).length <= 255),
  }),
  z.object({
    ...draftQuestionBase,
    type: z.literal("score"),
    criteria: z.array(z.string().max(8000)).max(10),
  }),
  z.object({
    ...draftQuestionBase,
    type: z.literal("noul"),
    criteria: z
      .object({
        true: z.string().max(8000).optional(),
        false: z.string().max(8000).optional(),
      })
      .optional(),
  }),
  z.object({
    ...draftQuestionBase,
    type: z.literal("box"),
    targetImageId: z.string().max(100),
  }),
]);
export const playgroundSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    title: z.string().trim().min(1).max(200),
    connectionId: z.string().max(100),
    model: z.string().max(200),
    state: z.string().max(2 * 1024 * 1024),
    stateFormat: z.enum(["json", "text"]),
    questions: z.array(draftQuestionSchema).max(256),
    images: z.array(imageSchema).max(8),
  })
  .superRefine((value, context) => {
    if (
      value.images.reduce((size, image) => size + image.dataUrl.length, 0) >
      30 * 1024 * 1024
    )
      context.addIssue({
        code: "custom",
        path: ["images"],
        message: "Combined images must be below 22 MiB.",
      });
    if (
      new Set(value.questions.map((q) => q.id)).size !== value.questions.length
    )
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Each question must have a unique ID.",
      });
    if (
      new Set(value.images.map((image) => image.id)).size !==
      value.images.length
    )
      context.addIssue({
        code: "custom",
        path: ["images"],
        message: "Each image must have a unique ID.",
      });
  });
