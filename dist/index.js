"use strict";
/**
 * 库主入口模块
 * 导出所有公共API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTexFile = exports.normalizePath = exports.serializeProjectAstToJson = exports.MacroHandler = exports.ProjectParser = exports.parseLatexProject = void 0;
// 核心解析功能
var projectParser_1 = require("./projectParser");
Object.defineProperty(exports, "parseLatexProject", { enumerable: true, get: function () { return projectParser_1.parseLatexProject; } });
// 核心类 (供高级使用)
var projectParser_2 = require("./projectParser");
Object.defineProperty(exports, "ProjectParser", { enumerable: true, get: function () { return projectParser_2.ProjectParser; } });
var macroHandler_1 = require("./macroHandler");
Object.defineProperty(exports, "MacroHandler", { enumerable: true, get: function () { return macroHandler_1.MacroHandler; } });
// 辅助工具
var astSerializer_1 = require("./astSerializer");
Object.defineProperty(exports, "serializeProjectAstToJson", { enumerable: true, get: function () { return astSerializer_1.serializeProjectAstToJson; } });
var utils_1 = require("./utils");
Object.defineProperty(exports, "normalizePath", { enumerable: true, get: function () { return utils_1.normalizePath; } });
Object.defineProperty(exports, "isTexFile", { enumerable: true, get: function () { return utils_1.isTexFile; } });
//# sourceMappingURL=index.js.map