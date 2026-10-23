/**
 * Central configuration for the API.
 *
 * Every environment variable is read here (and only here) so the rest of the
 * code imports one typed `config` object instead of touching `process.env`.
 * Values come from `Server/.env` (see `.env.example` for descriptions).
 */
import dotenv from "dotenv"; //dotenv
import path from "path"; //node.js buildin mobule

// Load Server/.env. dotenv never overrides variables that are already set,
// which lets tests and hosting platforms supply their own values.
dotenv.config({ path: path.join(process.cwd(), ".env") }); //-->(currentWorkingDirectory+.env)

// Turns "a, b,c" into ["a", "b", "c"] (used for comma separated env values)
const list = (value?: string) =>
  (value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

const node_env = process.env.NODE_ENV || "development";

export default {
  // ---------- Runtime ----------
  node_env,
  is_production: node_env === "production",
  port: process.env.PORT || 5000,
  database_url: process.env.mongoDbUrl,

  // ---------- URLs ----------
  // Origins allowed to call the API directly from a browser (comma separated).
  // The Next.js client proxies /api/* to this server, so most requests are same-origin.
  client_origins: list(process.env.CLIENT_ORIGINS || "http://localhost:3000"),

  // Canonical public website URL used in share links and QR codes,
  // e.g. https://yourdomain.com (no trailing slash).
  // Falls back to the first CLIENT_ORIGINS entry, then localhost (development only).
  public_app_url: (
    process.env.PUBLIC_APP_URL ||
    list(process.env.CLIENT_ORIGINS)[0] ||
    "http://localhost:3000"
  ).replace(/\/+$/, ""),

  // ---------- Admin session ----------
  // Secret used to sign the admin session JWT (variable name kept from the original project)
  jwt_access_secret: process.env.JWT_ACCESS_SECRCT,
  // How long a login lasts, in jsonwebtoken format ("7d", "12h", ...)
  admin_session_expires_in: process.env.ADMIN_SESSION_EXPIRES_IN || "7d",
  // Name of the HTTP-only cookie holding the session (also checked by Client/proxy.ts)
  admin_cookie_name: "scs_admin_session",

  // ---------- Initial administrator (used only by the idempotent seed) ----------
  admin_email: process.env.ADMIN_EMAIL,
  admin_password: process.env.ADMIN_PASSWORD,
  seed_admin_on_start: process.env.SEED_ADMIN_ON_START !== "false",

  // ---------- Image upload ----------
  // Largest accepted image, in megabytes
  max_upload_mb: Number(process.env.MAX_UPLOAD_MB) || 4,

  // ---------- AWS S3 (all Akama images are stored here) ----------
  aws_s3_bucket_name: process.env.AWS_S3_BUCKET_NAME,
  aws_s3_bucket_region: process.env.AWS_S3_BUCKET_REGION,
  aws_access_key: process.env.AWS_ACCESS_KEY,
  aws_secret_key: process.env.AWS_SECRET_KEY,
  // Default folder inside the bucket when the client sends no folderName
  aws_s3_prefix: process.env.AWS_S3_PREFIX || "cards",
  // CloudFront in front of the bucket: image URL = <this>/<key> (no trailing slash)
  aws_images_cdn_base_url: (process.env.AWS_IMAGES_CDN_BASE_URL || "").replace(/\/+$/, ""),
};
