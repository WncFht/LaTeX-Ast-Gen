/**
 * 库主入口模块
 * 导出所有公共API
 */

// 核心解析功能
export { parseLatexProject } from './projectParser';

// 核心类 (供高级使用)
export { ProjectParser } from './projectParser';
export { MacroHandler } from './macroHandler';

// 主要类型定义
export type {
  ProjectAST,
  ProjectFileAst,
  ParserOptions,
} from './types';

// 辅助工具
export { serializeProjectAstToJson } from './astSerializer';
export { normalizePath, isTexFile } from './utils'; 