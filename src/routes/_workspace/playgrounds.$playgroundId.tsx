import { createFileRoute } from "@tanstack/react-router";

// A saved playground. The workspace layout renders it.
export const Route = createFileRoute("/_workspace/playgrounds/$playgroundId")(
  {},
);
