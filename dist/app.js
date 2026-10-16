"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./app/routes"));
const config_1 = __importDefault(require("./app/config"));
const globalErrorHandler_1 = __importDefault(require("./middlewares/globalErrorHandler"));
const notFoundHandler_1 = __importDefault(require("./middlewares/notFoundHandler"));
const CreateRateLimiter_1 = require("./middlewares/RateLimiter/CreateRateLimiter");
const app = (0, express_1.default)();
// Don't advertise "Express" in response headers
app.disable("x-powered-by");
// Running behind the Next.js proxy / hosting platform: trust X-Forwarded-For for req.ip
// (needed so rate limiting sees the visitor's IP instead of the proxy's)
app.set("trust proxy", true);
// parser – JSON / form bodies are tiny here (uploads use multipart, handled per route)
app.use(express_1.default.urlencoded({ extended: true, limit: "100kb" }));
app.use(express_1.default.json({ limit: "100kb" }));
// Only needed for browsers calling the API directly (normal traffic goes through
// the Next.js proxy and is same-origin). credentials: true allows the session cookie.
app.use((0, cors_1.default)({
    origin: config_1.default.client_origins,
    credentials: true,
}));
// Apply global rate limiter to all routes (per IP, see CreateRateLimiter.ts)
app.use(CreateRateLimiter_1.ConfigLimiter.global);
// All API routes: /api/auth, /api/public/akama, /api/admin/akama (see app/routes/index.ts)
app.use("/api/", routes_1.default);
// Simple health check
app.get("/", (req, res) => {
    res.send("Saudi Computer Services API");
});
// ErrorHandler – turns thrown errors into consistent JSON responses
app.use(globalErrorHandler_1.default);
// notFound – no route matched
app.use(notFoundHandler_1.default);
exports.default = app;
