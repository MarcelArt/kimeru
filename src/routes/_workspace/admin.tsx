import { createFileRoute } from "@tanstack/react-router";

// Administration, for administrators only. The workspace layout renders it.
export const Route = createFileRoute("/_workspace/admin")({});
