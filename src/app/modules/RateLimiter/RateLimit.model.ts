/**
 * One counter document per rate-limit key (e.g. "auth:<ip>").
 * Used by middlewares/RateLimiter/CreateRateLimiter.ts. Old documents are removed
 * automatically one hour after the last request (TTL index on lastRequest).
 */
import mongoose from "mongoose";

interface IRateLimit {
  key: string;
  count: number;
  firstRequest?: Date;
  lastRequest?: Date;
}

// Optimized Rate Limit Schema
const rateLimitSchema = new mongoose.Schema<IRateLimit>(
  {
    key: {
      type: String,
      required: true,
      index: true,
      unique: true,
      collation: { locale: "en", strength: 1 }, // Case-insensitive index
    },
    count: {
      type: Number,
      min: 0,
    },
    firstRequest: {
      type: Date,
      default: Date.now,
    },
    lastRequest: {
      type: Date,
      index: { expireAfterSeconds: 3600 }, // TTL index
    },
  },
  {
    autoIndex: true,
    minimize: false, // Better storage alignment
  },
);

const RateLimitModel = mongoose.model("RateLimit", rateLimitSchema);

export { RateLimitModel, IRateLimit };
