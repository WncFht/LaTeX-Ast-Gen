/**
 * 库主入口模块 (重构版)
 *
 * 导出所有公共 API，包括核心解析功能、主要类型定义以及辅助工具函数。
 */

// --- 核心解析功能 --- 

import { ProjectProcessor } from './core/ProjectProcessor';
import type { ParserOptions, ProjectAST } from './types/index'; // 确保从 types/index.ts 导入
// import { processParserOptions } from './config/configManager'; // ProjectProcessor 内部会处理配置
import { Logger, createLogger, setGlobalLogLevel, LoggerLogLevel } from './utils/logger';

const libraryLogger = createLogger('latex-ast-parser:library');

/**
 * 解析 LaTeX 项目。
 * 这是库的主要公共 API 入口点，用于解析整个 LaTeX 项目。
 * 
 * @param options - 解析选项，必须包含 `entryPath`。
 * @returns 一个 Promise，解析为 {@link ProjectAST} 对象。
 * @throws Error 如果 `options.entryPath` 未提供或在解析过程中发生不可恢复的错误。
 */
export async function parseLatexProject(options: ParserOptions): Promise<ProjectAST> {
    if (!options || !options.entryPath) {
        libraryLogger.error('解析错误: 必须在 ParserOptions 中提供 entryPath。');
        throw new Error('必须在 ParserOptions 中提供 entryPath。');
    }
    libraryLogger.info(`通过库API开始解析项目: ${options.entryPath}`);
    
    const projectProcessor = new ProjectProcessor();
    
    const { entryPath, ...restOptions } = options;
    
    return projectProcessor.parse(entryPath, restOptions);
}

// --- 辅助工具和类型 --- 

export { serializeProjectAstToJson, saveAstDataAsJson } from './ast/AstSerializer';

// --- 核心类型定义 --- 
export type {
  Ast,
  ProjectAST,
  ProjectFileAst,
  ParserOptions,
  CliOptions,
  ResolvedParserConfig,
  NewCommandSpec,
  NewEnvironmentSpec,
  EnvironmentParameter,
  // InternalFileParseResult, // 通常不作为公共API导出
} from './types/index';

// --- 日志控制 --- 
/**
 * 设置库的全局日志级别。
 * @param level - 要设置的日志级别 {@link LoggerLogLevel}。
 */
export function setLogLevel(level: LoggerLogLevel): void {
    setGlobalLogLevel(level);
}
export { LoggerLogLevel };

// --- (可选) 高级API导出 --- 
// 如果希望允许用户更细致地控制或扩展解析器，可以导出核心类。
// export { ProjectProcessor } from './core/ProjectProcessor';
// export { DefinitionHandler } from './core/DefinitionHandler';
// export { DefinitionExtractor } from './core/DefinitionExtractor';

/**
 * (辅助函数，如果需要独立于完整解析之外确定根文件)
 * 查找LaTeX项目的根文件。
 * 注意：这是一个简化版本，更推荐通过 `parseLatexProject` 进行完整的项目处理，它内部会执行更可靠的根文件判断。
 * @param entryPath - 入口路径（文件或目录）。
 * @param CWD - （可选）当前工作目录，用于解析相对路径。默认为 `process.cwd()`。
 * @returns 根文件的绝对路径，如果找不到则为 `null`。
 */
export async function findRootFile(entryPath: string, CWD: string = process.cwd()): Promise<string | null> {
    libraryLogger.info(`(辅助工具) 尝试查找根文件，入口: ${entryPath}`);
    // 此函数需要 ProjectProcessor 的 determineRootFile 逻辑。
    // 为避免循环依赖或不必要的实例化，最好将 determineRootFile 的核心逻辑移至一个独立的工具函数中，
    // 例如 projectFileUtils.ts，然后 ProjectProcessor 和此处的 findRootFile 都可以调用它。
    // 目前的 ProjectProcessor.determineRootFile 是私有的且依赖实例状态。
    // 因此，这里我们仅作标记，实际实现需要重构 determineRootFile。
    libraryLogger.warn('findRootFile 功能的当前实现依赖于内部 ProjectProcessor 逻辑的重构。目前可能无法准确工作。');
    // 临时的 ProjectProcessor 实例化 (不推荐用于生产，因其内部状态)
    // const tempProcessor = new ProjectProcessor(); 
    // return (tempProcessor as any).determineRootFile(entryPath, CWD); // 调用私有方法是不可取的
    return null; // 暂时返回 null
} 