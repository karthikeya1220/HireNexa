"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = void 0;
// Explicit origin allowlist. Set CORS_ORIGINS as a comma-separated list,
// e.g. CORS_ORIGINS="https://app.hirenexa.com,https://hirenexa.vercel.app"
const allowedOrigins = ((_a = process.env.CORS_ORIGINS) !== null && _a !== void 0 ? _a : '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
// Local development origins (never applied in production).
if (process.env.NODE_ENV !== 'production') {
    for (const devOrigin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
        if (!allowedOrigins.includes(devOrigin)) {
            allowedOrigins.push(devOrigin);
        }
    }
}
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    console.warn('[CORS] CORS_ORIGINS is not set — all cross-origin browser requests will be blocked.');
}
// CORS configuration for API.
// Origins are never reflected: unknown origins get no CORS headers, and
// credentials are only enabled for explicitly allowed origins.
exports.corsOptions = {
    origin: (origin, callback) => {
        // Requests without an Origin header (same-origin, curl, server-to-server)
        // are not subject to CORS and are always allowed.
        if (!origin) {
            return callback(null, true);
        }
        return callback(null, allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Total-Count'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400 // 24 hours
};
