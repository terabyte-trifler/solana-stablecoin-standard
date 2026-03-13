import { Request, Response, NextFunction } from "express";
import pino from "pino";
import { AppConfig } from "../config";
export declare function createWriteGuard(config: AppConfig, logger: pino.Logger): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
