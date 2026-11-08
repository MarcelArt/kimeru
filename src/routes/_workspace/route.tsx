import { createFileRoute } from "@tanstack/react-router";
import { getBootstrap, getWorkspace } from "#/server/api";
import { App } from "#/components/playground/App";

// Every workspace page renders through this layout, so the editor's unsaved
// work survives moving between pages. App reads the page from the URL.
export const Route = createFileRoute("/_workspace")({
  loader: async () => {
    const bootstrap = await getBootstrap();
    return {
      bootstrap,
      workspace: bootstrap.user ? await getWorkspace() : null,
    };
  },
  // App keeps its own copy of this data current, so changing pages must not
  // fetch the whole workspace again.
  shouldReload: false,
  component: Workspace,
});

function Workspace() {
  const { bootstrap, workspace } = Route.useLoaderData();
  return <App initialBootstrap={bootstrap} initialWorkspace={workspace} />;
}
