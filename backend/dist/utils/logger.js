"use strict";
// backend/src/utils/logger.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
function createLogger(level = "info") {
    const isProduction = process.env.NODE_ENV === "production";
    return (0, pino_1.default)({
        level,
        transport: isProduction
            ? undefined
            : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
        base: { service: "sss-backend" },
        serializers: {
            err: pino_1.default.stdSerializers.err,
            req: pino_1.default.stdSerializers.req,
            res: pino_1.default.stdSerializers.res,
        },
    });
}
