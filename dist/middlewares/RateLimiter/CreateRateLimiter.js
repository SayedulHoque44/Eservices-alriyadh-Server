"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLimiter = void 0;
const sendResponse_1 = __importDefault(require("../../app/utils/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const RateLimit_model_1 = require("../../app/modules/RateLimiter/RateLimit.model");
function createRateLimiter({ windowMs, maxRequests, type, }) {
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        // Determine identifier based on type
        let identifier;
        // req.ip honours "trust proxy" (first X-Forwarded-For address)
        const ipAddress = req.ip || "UNKNOWN_IP";
        switch (type) {
            case "auth":
                identifier = `auth:${ipAddress}`;
                break;
            case "api":
                identifier = req.user
                    ? `api:user:${req.user.id}`
                    : `api:ip:${ipAddress}`;
                break;
            default:
                identifier = `global:${ipAddress}`;
        }
        const { allowed, remaining, reset, timeLeft } = yield CheckRateLimit(identifier, windowMs, maxRequests);
        if (!allowed) {
            // const retryAfter = Math.ceil(
            //   (reset.getTime() - new Date().getTime()) / 1000,
            // );
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.TOO_MANY_REQUESTS,
                success: false,
                message: `Too many requests! Limit exceeded. Try again in ${timeLeft}`,
                data: {
                    "RateLimit-Limit": maxRequests.toString(),
                    "RateLimit-Remaining": remaining.toString(),
                    "RateLimit-Reset": Math.floor(reset.getTime() / 1000).toString(),
                },
            });
            // return res.status(429).json({
            //   error: "Too many requests",
            //   message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            //   retryAfter,
            // });
        }
        // Set rate limit headers
        res.set({
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": Math.floor(reset.getTime() / 1000).toString(),
        });
        next();
    });
}
const CheckRateLimit = (identifier, windowMs, maxRequests) => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    try {
        // Single atomic upsert to avoid duplicate-key races under concurrency.
        // Pipeline keeps logic server-side; avoids $setOnInsert (not allowed in pipeline updates).
        const result = yield RateLimit_model_1.RateLimitModel.findOneAndUpdate({ key: identifier }, [
            // Initialize missing fields when inserting (or if somehow null).
            {
                $set: {
                    firstRequest: { $ifNull: ["$firstRequest", now] },
                    count: { $ifNull: ["$count", 0] },
                },
            },
            // Determine if the window is expired.
            {
                $set: {
                    expired: { $lt: ["$firstRequest", windowStart] },
                },
            },
            // Reset window if expired, otherwise increment.
            {
                $set: {
                    count: {
                        $cond: [{ $eq: ["$expired", true] }, 1, { $add: ["$count", 1] }],
                    },
                    firstRequest: {
                        $cond: [{ $eq: ["$expired", true] }, now, "$firstRequest"],
                    },
                    lastRequest: now,
                },
            },
            { $unset: "expired" },
        ], {
            new: true,
            upsert: true,
            projection: { count: 1, firstRequest: 1 },
        });
        // console.log(result);
        if (!result) {
            throw new Error("Rate limit record not found or created");
        }
        // Calculate remaining requests and reset time
        const remaining = Math.max(0, maxRequests - result.count);
        const resetTimestamp = result.firstRequest.getTime() + windowMs;
        const resetTime = new Date(resetTimestamp);
        const secondsLeft = Math.ceil((resetTimestamp - now.getTime()) / 1000);
        // Format the time left in human-readable way
        let timeLeftFormatted = "";
        if (secondsLeft <= 60) {
            timeLeftFormatted = `${secondsLeft} sec`;
        }
        else {
            const minutes = Math.floor(secondsLeft / 60);
            const seconds = secondsLeft % 60;
            if (minutes < 60) {
                timeLeftFormatted = `${minutes} min${seconds > 0 ? ` ${seconds} sec` : ""}`;
            }
            else {
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                timeLeftFormatted = `${hours} hour${hours > 1 ? "s" : ""}`;
                if (remainingMinutes > 0) {
                    timeLeftFormatted += ` ${remainingMinutes} min`;
                }
                if (seconds > 0 && remainingMinutes === 0) {
                    timeLeftFormatted += ` ${seconds} sec`;
                }
            }
        }
        return {
            allowed: remaining > 0,
            remaining: remaining,
            reset: resetTime,
            timeLeft: timeLeftFormatted, // Added human-readable time left
        };
    }
    catch (err) {
        console.error("Rate limit check error:", err);
        // Fail open - allow request if rate limiter fails
        return { allowed: true, remaining: maxRequests, reset: now, timeLeft: "" };
    }
});
exports.ConfigLimiter = {
    // Applied to every request in app.ts
    global: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
        type: "global",
    }),
    // Applied to POST /api/auth/login in Auth/auth.routes.ts
    auth: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10, // login attempts per IP
        type: "auth",
    }),
    // Available for future use (not currently applied to any route)
    api: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 500,
        type: "api",
    }),
};
exports.default = createRateLimiter;
