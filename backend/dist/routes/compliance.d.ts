import { Router } from "express";
import { ComplianceService } from "../services/compliance";
import pino from "pino";
export declare function complianceRoutes(complianceService: ComplianceService, logger: pino.Logger): Router;
