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
/* eslint-disable no-console */
/**
 * Entry point of the API (`npm run dev` / `npm start`).
 *
 * Startup order:
 *   1. check required settings
 *   2. connect to MongoDB
 *   3. create the administrator if none exists (idempotent seed)
 *   4. start listening for HTTP requests (routes live in app.ts)
 */
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./app/config"));
const admin_seed_1 = require("./app/modules/Admin/admin.seed");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 1. Fail fast with a clear message if .env is incomplete
            if (!config_1.default.database_url)
                throw new Error("mongoDbUrl is not set in .env");
            if (!config_1.default.jwt_access_secret)
                throw new Error("JWT_ACCESS_SECRCT is not set in .env");
            // Share links and QR codes are built from PUBLIC_APP_URL; warn loudly if
            // production would print codes that point at a development address.
            if (config_1.default.is_production && /localhost|127\.0\.0\.1/.test(config_1.default.public_app_url)) {
                console.error("WARNING: PUBLIC_APP_URL is not set to the live website. Share links and QR codes will point to", config_1.default.public_app_url);
            }
            // 2. Database
            yield mongoose_1.default.connect(config_1.default.database_url);
            // 3. Make sure the single administrator exists. A failure here (e.g. missing
            //    ADMIN_EMAIL) is logged but does not stop the server.
            if (config_1.default.seed_admin_on_start) {
                try {
                    yield (0, admin_seed_1.seedAdmin)();
                }
                catch (error) {
                    console.error("Admin seed skipped:", error.message);
                }
            }
            // 4. HTTP server. If the port is taken, exit instead of running half-started.
            app_1.default
                .listen(config_1.default.port, () => {
                console.log(`Saudi Computer Services API listening on port ${config_1.default.port}`);
            })
                .on("error", error => {
                console.error(`Could not start on port ${config_1.default.port}:`, error.message);
                process.exit(1);
            });
        }
        catch (err) {
            console.error(err);
            process.exitCode = 1;
        }
    });
}
main();
// Last-resort logging so unexpected errors are visible in the server logs
process.on("unhandledRejection", err => {
    console.error("Unhandled Rejection detected,", err);
});
process.on("uncaughtException", err => {
    console.error("uncaughtException detected,", err);
});
