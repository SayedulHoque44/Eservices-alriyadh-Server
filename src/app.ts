/**
 * Express application: global middleware + all routes.
 *
 * Request flow:
 *   body parsers -> CORS -> global rate limiter -> /api routes
 *   -> error handler (for thrown errors) -> 404 handler (no route matched)
 *
 * Kept separate from server.ts so tests can mount the app without starting
 * a real database connection or port.
 */
import cors from "cors";
import express, { Request, Response } from "express";
import router from "./app/routes";
import config from "./app/config";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import notFoundHandler from "./middlewares/notFoundHandler";
import { ConfigLimiter } from "./middlewares/RateLimiter/CreateRateLimiter";

const app = express();

// Don't advertise "Express" in response headers
app.disable("x-powered-by");
// Running behind the Next.js proxy / hosting platform: trust X-Forwarded-For for req.ip
// (needed so rate limiting sees the visitor's IP instead of the proxy's)
app.set("trust proxy", true);

// parser – JSON / form bodies are tiny here (uploads use multipart, handled per route)
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));

// Only needed for browsers calling the API directly (normal traffic goes through
// the Next.js proxy and is same-origin). credentials: true allows the session cookie.
app.use(
  cors({
    origin: config.client_origins,
    credentials: true,
  }),
);

// Apply global rate limiter to all routes (per IP, see CreateRateLimiter.ts)
app.use(ConfigLimiter.global);

// All API routes: /api/auth, /api/public/akama, /api/admin/akama (see app/routes/index.ts)
app.use("/api/", router);

// Simple health check
app.get("/", (req: Request, res: Response) => {
  res.send("Saudi Computer Services API");
});

// ErrorHandler – turns thrown errors into consistent JSON responses
app.use(globalErrorHandler);
// notFound – no route matched
app.use(notFoundHandler);
export default app;
