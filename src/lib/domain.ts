export type ProviderKind = "typesafe" | "cloudflare";
export type QuestionType = "choice" | "score" | "noul" | "box";
export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  disabled: boolean;
  createdAt: string;
};
export type Connection = {
  id: string;
  ownerId: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  accountId: string;
  shared: boolean;
  hasKey: boolean;
  createdAt: string;
};
export type ConnectionInput = {
  id?: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  accountId: string;
  shared: boolean;
  apiKey: string;
};
export type ImageAttachment = {
  id: string;
  name: string;
  mime: "image/jpeg" | "image/png";
  dataUrl: string;
  width: number;
  height: number;
};
type QuestionBase = { id: string; instructions: string };
export type Question =
  | (QuestionBase & { type: "choice"; criteria: Record<string, string> })
  | (QuestionBase & { type: "score"; criteria: string[] })
  | (QuestionBase & {
      type: "noul";
      criteria?: { true?: string; false?: string };
    })
  | (QuestionBase & { type: "box"; targetImageId: string });
export type DecisionInput = {
  title: string;
  connectionId: string;
  model: string;
  state: string;
  stateFormat: "json" | "text";
  questions: Question[];
  images: ImageAttachment[];
};
export type Playground = DecisionInput & { id: string; updatedAt: string };
export type Answer = {
  type: QuestionType;
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
  score?: number;
  legend?: string[];
  noul?: number;
  box?: { top: number; bottom: number; left: number; right: number };
  targetImageId?: string;
};
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ProviderResult = {
  model: string;
  answers: Record<string, Answer>;
  raw: JsonValue;
};
export type RunSummary = {
  id: string;
  title: string;
  model: string;
  connectionName: string;
  status: "success" | "error";
  durationMs: number;
  createdAt: string;
  error?: string;
};
export type Run = RunSummary & {
  input: DecisionInput;
  result: ProviderResult | null;
};
export type Workspace = {
  user: User;
  connections: Connection[];
  playgrounds: Playground[];
  runs: RunSummary[];
};
export type Bootstrap = { needsSetup: boolean; user: User | null };

export const DEFAULT_MODELS: Record<ProviderKind, string[]> = {
  typesafe: ["jev-latest", "jev-1.14.0"],
  cloudflare: ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash"],
};
export const QUESTION_LABELS: Record<QuestionType, string> = {
  choice: "Choice",
  score: "Score",
  noul: "Noul",
  box: "Box",
};
