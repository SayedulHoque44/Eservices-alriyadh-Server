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
 * Command-line seed for the administrator account.
 *
 * Usage:
 *   npm run seed         -> create the administrator if none exists
 *   npm run seed:reset   -> set the administrator's email/password to ADMIN_EMAIL/ADMIN_PASSWORD
 *
 * Connects to the database from .env, runs the seed, then disconnects.
 */
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const admin_seed_1 = require("../app/modules/Admin/admin.seed");
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.connect(config_1.default.database_url);
    if (process.argv.includes("--reset")) {
        yield (0, admin_seed_1.resetAdminCredentials)();
    }
    else {
        const result = yield (0, admin_seed_1.seedAdmin)();
        if (!result.created)
            console.log(`Administrator already exists (${result.email}). Nothing to do.`);
    }
    yield mongoose_1.default.disconnect();
});
run().catch((error) => __awaiter(void 0, void 0, void 0, function* () {
    console.error(error);
    yield mongoose_1.default.disconnect();
    process.exit(1);
}));
