import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Kimeru — Decision playground",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "16x16 32x32 48x48",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/brand/kimeru.svg",
        sizes: "any",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster theme="dark" richColors closeButton />
        <Scripts />
      </body>
    </html>
  );
}
