import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { ensureRootAdmin } from "./lib/adminSeed";

const app: Express = express();

// Behind nginx (TLS terminated by the reverse proxy): trust the first proxy hop
// so `req.secure`, `req.protocol` and the client IP (X-Forwarded-*) are correct.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const clerk = clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(req) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
}));

// `clerkMiddleware` throws (calls next(err)) when a request carries a malformed
// or unverifiable Bearer token. That must NOT crash the request: public routes
// (e.g. GET /api/barbers, which the mobile map calls with an attached token)
// have to keep serving, and protected routes still enforce auth via requireAuth
// (getAuth returns no userId → 401). So we swallow clerk errors here and continue
// as unauthenticated instead of surfacing a 500. Without this a stale/mismatched
// token turned every authenticated fetch to a public route into an "Internal
// Server Error".
app.use((req, res, next) => {
  clerk(req, res, (err?: unknown) => {
    if (err) req.log?.warn({ err }, "clerk middleware error — continuing unauthenticated");
    next();
  });
});

app.use("/api", router);

// Catch-all error handler: return clean JSON (not Express's default HTML page),
// so clients get a parseable error body instead of a raw "<!DOCTYPE html> …
// Internal Server Error" string. Must be registered after the routes and keep
// the 4-arg signature so Express treats it as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log?.error({ err }, "unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal Server Error" });
});

// Fire-and-forget — startup seed shouldn't block boot. Errors are logged.
ensureRootAdmin().catch((err) => logger.error({ err }, "ensureRootAdmin failed"));

export default app;
