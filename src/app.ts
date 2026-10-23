/**
 * Express application: global middleware + all routes.
 *
 * Request flow:
 *   body parsers -> CORS -> /api routes
 *   -> error handler (for thrown errors) -> 404 handler (no route matched)
 *
 * Kept separate from server.ts so tests can mount the app without starting
 * a real database connection or port.
 */
import cors from "cors";
import express, { Request, Response } from "express";
import router from "./app/routes";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import notFoundHandler from "./middlewares/notFoundHandler";

const app = express();

// Don't advertise "Express" in response headers
app.disable("x-powered-by");
// Running behind the Next.js proxy / hosting platform: trust X-Forwarded-For for req.ip
app.set("trust proxy", true);

// parser – JSON / form bodies are tiny here (uploads use multipart, handled per route)
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));

// CORS – the API may be called from any website, the mobile app WebView and tools.
// The admin session cookie is SameSite=Lax (middlewares/auth.ts), so browsers do
// not send it with requests coming from another website.
app.use(
  cors({
    origin: true, // echo back whichever site is calling = every site is allowed
    credentials: true, // also works when the caller sends cookies (axios withCredentials)
  }),
);

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
