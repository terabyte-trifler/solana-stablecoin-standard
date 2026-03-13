// backend/src/utils/logger.ts

import pino from "pino";

export function createLogger(level: string = "info"): pino.Logger {
  const isProduction = process.env.NODE_ENV === "production";

  return pino({
    level,
    transport: isProduction
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
    base: { service: "sss-backend" },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  });
}
