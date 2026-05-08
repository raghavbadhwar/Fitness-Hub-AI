import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import {
  apiErrorHandler,
  attachApiRequestLogContext,
  getRequestLogContext,
  logger,
} from "./lib/logger";
import {
  configureTrustProxy,
  createCorsMiddleware,
  createSecurityHeadersMiddleware,
} from "./lib/http-security";

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY is required. Add it to .env.local before starting the API.");
}

const app: Express = express();
configureTrustProxy(app);
const corsMiddleware = createCorsMiddleware();
const securityHeadersMiddleware = createSecurityHeadersMiddleware();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    customProps(req, res) {
      return getRequestLogContext(req, res);
    },
  }),
);

app.use(corsMiddleware);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", securityHeadersMiddleware, attachApiRequestLogContext, router);
app.use("/api", apiErrorHandler);

export default app;
