"use strict";
// sdk/src/types.ts
//
// All public types for the @stbr/sss-token SDK.
// These mirror the on-chain account structs but use TypeScript-native types.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleType = void 0;
// ============================================================================
// ROLE MANAGEMENT
// ============================================================================
/** Role types matching the on-chain RoleType enum. */
var RoleType;
(function (RoleType) {
    RoleType["Burner"] = "burner";
    RoleType["Pauser"] = "pauser";
    RoleType["Blacklister"] = "blacklister";
    RoleType["Seizer"] = "seizer";
})(RoleType || (exports.RoleType = RoleType = {}));
//# sourceMappingURL=types.js.map