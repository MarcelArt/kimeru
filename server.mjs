import { serve } from "srvx/node";
import { staticMiddleware } from "srvx/static";
import app from "./dist/server/server.js";

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || "0.0.0.0";
serve({
  port,
  hostname,
  maxRequestBodySize: 36 * 1024 * 1024,
  middleware: [
    async (_request, next) => {
      const response = await next();
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "same-origin");
      response.headers.set("X-Frame-Options", "DENY");
      return response;
    },
    staticMiddleware({
      dir: new URL("./dist/client/", import.meta.url).pathname,
      dotfiles: false,
    }),
  ],
  fetch(request) {
    if (new URL(request.url).pathname === "/healthz")
      return Response.json({ status: "ok" });
    return app.fetch(request);
  },
});
