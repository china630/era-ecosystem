"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_SUPER_ADMIN_EMAILS = exports.PLATFORM_SUPER_ADMIN_DEFAULT_PASSWORD = void 0;
exports.platformSuperAdminEmails = platformSuperAdminEmails;
exports.platformSuperAdminBootstrapPassword = platformSuperAdminBootstrapPassword;
exports.upsertPlatformSuperAdmins = upsertPlatformSuperAdmins;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const DEFAULT_EMAILS = [
    "inaram84@gmail.com",
    "shirinov.chingiz@gmail.com",
    "chingiz@era.com",
];
const DEFAULT_PASSWORD = "12345678";
const BCRYPT_ROUNDS = 10;
/** Parse `PLATFORM_SUPER_ADMIN_EMAILS` (comma/semicolon/space separated). */
function platformSuperAdminEmails() {
    const raw = process.env.PLATFORM_SUPER_ADMIN_EMAILS?.trim();
    if (!raw)
        return DEFAULT_EMAILS;
    const parsed = [
        ...new Set(raw
            .split(/[,;\s]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.includes("@"))),
    ];
    return parsed.length > 0 ? parsed : DEFAULT_EMAILS;
}
function platformSuperAdminBootstrapPassword() {
    return (process.env.PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD?.trim() ||
        DEFAULT_PASSWORD);
}
/** @deprecated use platformSuperAdminBootstrapPassword() */
exports.PLATFORM_SUPER_ADMIN_DEFAULT_PASSWORD = platformSuperAdminBootstrapPassword();
/** @deprecated use platformSuperAdminEmails() */
exports.PLATFORM_SUPER_ADMIN_EMAILS = platformSuperAdminEmails();
/**
 * Ensures platform super-admin users exist (Orchestrator canonical IdP).
 * - `preserve_password`: only ensure `isSuperAdmin` on update.
 * - `reset_password`: set bootstrap password on every upsert (dev/prod-init).
 */
async function upsertPlatformSuperAdmins(prisma, mode) {
    const password = platformSuperAdminBootstrapPassword();
    const hash = await bcryptjs_1.default.hash(password, BCRYPT_ROUNDS);
    for (const emailRaw of platformSuperAdminEmails()) {
        const email = emailRaw.toLowerCase().trim();
        await prisma.user.upsert({
            where: { email },
            create: {
                email,
                passwordHash: hash,
                isSuperAdmin: true,
            },
            update: {
                isSuperAdmin: true,
                ...(mode === "reset_password" ? { passwordHash: hash } : {}),
            },
        });
    }
}
