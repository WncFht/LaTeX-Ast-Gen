/**
 * 库主入口模块
 * 导出所有公共API
 */

// 核心解析功能
export { parseLatexProject, findRootFile } from './projectParser';

// 核心类 (供高级使用)
export { ProjectParser } from './projectParser';
export { MacroHandler } from './macroHandler';

// 主要类型定义
export type {
  ProjectAST,
  ProjectFileAst,
  ParserOptions,
  CliSpecificOptions,
} from './types';

// @unified-latex类型重新导出
export type * as AstTypes from '@unified-latex/unified-latex-types';

// 辅助工具
export { serializeProjectAstToJson, saveAstAsJson } from './astSerializer';
export { normalizePath, isTexFile, findTexFiles, isRootFileContent } from './utils'; 