import { createFileRoute } from "@tanstack/react-router";
import { getBootstrap, getWorkspace } from "#/server/api";
import { App } from "#/components/playground/App";

export const Route = createFileRoute("/")({
  loader: async () => {
    const bootstrap = await getBootstrap();
    return {
      bootstrap,
      workspace: bootstrap.user ? await getWorkspace() : null,
    };
  },
  component: Home,
});

function Home() {
  const { bootstrap, workspace } = Route.useLoaderData();
  return <App initialBootstrap={bootstrap} initialWorkspace={workspace} />;
}
