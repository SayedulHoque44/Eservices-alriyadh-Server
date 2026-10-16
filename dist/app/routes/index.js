"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Mounts every API module under /api (see app.ts).
 *
 *   /api/auth           login, logout, current admin       (Auth/auth.routes.ts)
 *   /api/public/akama   public records only, no login      (Akama/akama.routes.ts)
 *   /api/admin/akama    full record management, login only (Akama/akama.routes.ts)
 */
const express_1 = require("express");
const akama_routes_1 = require("../modules/Akama/akama.routes");
const auth_routes_1 = require("../modules/Auth/auth.routes");
const router = (0, express_1.Router)();
const moduleRoutes = [
    {
        path: "/auth",
        route: auth_routes_1.AuthRoutes,
    },
    {
        path: "/public/card",
        route: akama_routes_1.PublicAkamaRoutes,
    },
    {
        path: "/admin/card",
        route: akama_routes_1.AdminAkamaRoutes,
    },
    // Legacy API aliases let existing clients transition to the Card routes.
    { path: "/public/akama", route: akama_routes_1.PublicAkamaRoutes },
    { path: "/admin/akama", route: akama_routes_1.AdminAkamaRoutes },
];
moduleRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
