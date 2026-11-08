import { linkOptions, useMatches } from "@tanstack/react-router";

/** What the playground editor holds: a new draft, a saved playground, or a past run. */
export type EditorSource =
  | { kind: "new" }
  | { kind: "playground"; id: string }
  | { kind: "run"; id: string };

export type WorkspacePage =
  | { view: "playground"; source: EditorSource }
  | { view: "history" | "connections" | "admin" };

export function sourceKey(source: EditorSource) {
  return source.kind === "new" ? "new" : `${source.kind}:${source.id}`;
}

/** The URL that opens a source in the editor. */
export function editorLink(source: EditorSource) {
  switch (source.kind) {
    case "playground":
      return linkOptions({
        to: "/playgrounds/$playgroundId",
        params: { playgroundId: source.id },
      });
    case "run":
      return linkOptions({ to: "/runs/$runId", params: { runId: source.id } });
    case "new":
      return linkOptions({ to: "/" });
  }
}

/** Reads the workspace page named by the current URL. */
export function useWorkspacePage() {
  return useMatches({
    select: (matches): WorkspacePage => {
      const match = matches[matches.length - 1];
      switch (match?.routeId) {
        case "/_workspace/playgrounds/$playgroundId":
          return {
            view: "playground",
            source: { kind: "playground", id: match.params.playgroundId },
          };
        case "/_workspace/runs/$runId":
          return {
            view: "playground",
            source: { kind: "run", id: match.params.runId },
          };
        case "/_workspace/runs/":
          return { view: "history" };
        case "/_workspace/connections":
          return { view: "connections" };
        case "/_workspace/admin":
          return { view: "admin" };
        default:
          return { view: "playground", source: { kind: "new" } };
      }
    },
    structuralSharing: true,
  });
}
