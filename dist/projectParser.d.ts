/**
 * 项目解析器模块
 * 作为核心协调器管理整个LaTeX项目的解析过程
 */
import { MacroHandler } from './macroHandler';
import { ParserOptions, ProjectAST } from './types';
/**
 * 项目解析器类
 * 管理整个LaTeX项目的解析过程
 */
export declare class ProjectParser {
    private fileParser;
    private macroHandler;
    private parsedFiles;
    private projectAstMap;
    private projectFileErrors;
    private projectGlobalErrors;
    private rootFilePath;
    /**
     * 创建一个新的ProjectParser实例
     * @param customMacroHandler 可选的预配置MacroHandler实例
     */
    constructor(customMacroHandler?: MacroHandler);
    /**
     * 解析LaTeX项目
     * @param entryPath 入口文件路径或项目目录
     * @param options 解析选项
     * @returns 项目AST
     */
    parse(entryPath: string, options?: Omit<ParserOptions, 'entryPath'>): Promise<ProjectAST>;
    /**
     * 确定根文件
     * @param entryPath 入口路径（文件或目录）
     * @returns 根文件路径，如果找不到则为null
     * @private
     */
    private determineRootFile;
}
/**
 * 解析LaTeX项目
 * 提供简单的API入口点
 * @param options 解析选项
 * @returns 项目AST
 */
export declare function parseLatexProject(options: ParserOptions): Promise<ProjectAST>;
