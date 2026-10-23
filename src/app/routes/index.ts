/**
 * Mounts every API module under /api (see app.ts).
 *
 *   /api/auth           login, logout, current admin       (Auth/auth.routes.ts)
 *   /api/public/akama   public records only, no login      (Akama/akama.routes.ts)
 *   /api/admin/akama    full record management, login only (Akama/akama.routes.ts)
 *   /api/admin/absher   Absher account management, login only (Absher/absher.routes.ts)
 *   /api/app/absher     mobile app: login with ID + PIN -> full details (Absher/absher.routes.ts)
 */
import { Router } from "express";
import { AdminAbsherRoutes, AppAbsherRoutes } from "../modules/Absher/absher.routes";
import { AdminAkamaRoutes, PublicAkamaRoutes } from "../modules/Akama/akama.routes";
import { AuthRoutes } from "../modules/Auth/auth.routes";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/public/card",
    route: PublicAkamaRoutes,
  },
  {
    path: "/admin/card",
    route: AdminAkamaRoutes,
  },
  // Legacy API aliases let existing clients transition to the Card routes.
  { path: "/public/akama", route: PublicAkamaRoutes },
  { path: "/admin/akama", route: AdminAkamaRoutes },
  // Absher accounts: admin management + the mobile app
  { path: "/admin/absher", route: AdminAbsherRoutes },
  { path: "/app/absher", route: AppAbsherRoutes },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
