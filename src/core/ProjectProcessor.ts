/**
 * 项目处理器模块。
 *
 * 负责协调整个 LaTeX 项目的解析过程，主要职责包括：
 * - 初始化和管理配置 ({@link ResolvedParserConfig})。
 * - 初始化和管理 {@link DefinitionHandler} (用于宏和环境定义) 和 {@link FileContentParser} (用于单个文件解析)。
 * - 实现根文件确定逻辑，找到项目的入口 TeX 文件。
 * - 管理文件处理队列，以递归方式解析根文件及其所有依赖的 TeX 文件。
 * - 调用 `FileContentParser` 来处理每个文件的具体内容解析。
 * - 收集和聚合来自所有已解析文件的 AST (抽象语法树)、错误信息以及最终的宏/环境定义状态。
 * - 构建并返回最终的 {@link ProjectAST} 对象，作为整个项目解析的结果。
 */

import type { Ast, ResolvedParserConfig, ParserOptions, ProjectAST, ProjectFileAst, InternalFileParseResult } from '../types/index';
import { DefinitionHandler } from './DefinitionHandler';
import { FileContentParser } from './FileContentParser';
import { processParserOptions } from '../config/configManager'; 
import { readFileAsync, fileExistsAsync, getFileStatsAsync } from '../utils/fileSystem';
import { resolvePath, normalizePath, getDirname, joinPaths } from '../utils/pathUtils';
import { findTexFiles, isTexFile, isRootFileContent } from '../latex-utils/projectFileUtils';
import { Logger, createLogger } from '../utils/logger';

export class ProjectProcessor {
    private logger: Logger;
    private config!: ResolvedParserConfig; // 已解析的配置，在 initialize 方法中设置
    private definitionHandler!: DefinitionHandler; // 宏和环境定义管理器
    private fileContentParser!: FileContentParser;   // 单个文件内容解析器

    private parsedFilePaths: Set<string>;         // 存储已处理文件的规范化路径，用于防止重复解析
    private projectAstMap: Map<string, Ast.Root | null>; // 映射：文件路径 -> 该文件的 AST (或 null 如果解析失败)
    private projectFileErrors: Map<string, string>;  // 映射：文件路径 -> 该文件的特定解析错误信息
    private projectGlobalErrors: string[];         // 项目级别的全局错误列表（例如找不到根文件、引用的文件不存在等）
    private currentRootFilePath: string | null;    // 当前项目最终确定的根文件路径

    /**
     * 创建一个新的 `ProjectProcessor` 实例。
     */
    constructor() {
        this.logger = createLogger('core:ProjectProcessor');
        this.parsedFilePaths = new Set<string>();
        this.projectAstMap = new Map<string, Ast.Root | null>();
        this.projectFileErrors = new Map<string, string>();
        this.projectGlobalErrors = [];
        this.currentRootFilePath = null;
        this.logger.debug('ProjectProcessor 实例已创建。');
    }

    /**
     * (私有) 初始化项目处理器。
     * 此方法基于最终解析的配置对象设置内部状态和依赖的处理器实例。
     * 也会重置任何可能由先前解析操作遗留的状态，允许实例被复用。
     * @param resolvedConfig - 已完全解析和合并的配置对象 {@link ResolvedParserConfig}。
     */
    private async initialize(resolvedConfig: ResolvedParserConfig): Promise<void> {
        this.config = resolvedConfig;
        this.definitionHandler = new DefinitionHandler(this.config);
        this.fileContentParser = new FileContentParser(this.config, this.definitionHandler);
        
        this.parsedFilePaths.clear();
        this.projectAstMap.clear();
        this.projectFileErrors.clear();
        this.projectGlobalErrors = [];
        this.currentRootFilePath = null;
        this.logger.info('ProjectProcessor 已使用新配置完成初始化。');
    }

    /**
     * 解析给定的 LaTeX 项目。
     * 这是项目解析的主要入口点。
     * @param entryPath - 项目的入口路径，可以是一个 `.tex` 文件或包含项目的目录。
     * @param options - (可选) {@link ParserOptions} 对象，用于覆盖或补充通过其他方式（如配置文件）加载的设置。
     *                  此处的 `entryPath` 优先级高于 `options.entryPath` (如果提供)。
     * @returns 返回一个 Promise，该 Promise 解析为 {@link ProjectAST} 对象，代表整个项目的解析结果。
     */
    public async parse(entryPath: string, options?: Omit<ParserOptions, 'entryPath'>): Promise<ProjectAST> {
        // 1. 配置处理与初始化:
        // 将传入的 entryPath 和可选的 options 合并为 ParserOptions，
        // 然后通过 processParserOptions 解析为最终的 ResolvedParserConfig。
        const initialParserOptions: ParserOptions = {
            entryPath: entryPath, // 确保 entryPath 被正确设置
            ...(options || {}),   // 合并任何通过 API 提供的其他选项
        };
        const resolvedConfig = await processParserOptions(initialParserOptions, process.cwd());
        await this.initialize(resolvedConfig); // 使用最终配置初始化内部状态和处理器

        this.logger.info(`开始解析项目，入口点: ${this.config.entryPath} (项目基目录: ${this.config.baseDir})`);

        // 2. 确定项目的根 TeX 文件:
        this.currentRootFilePath = await this.determineRootFile(this.config.entryPath, this.config.baseDir);

        if (!this.currentRootFilePath) {
            const errorMsg = `无法确定项目的根文件，指定的入口路径为: ${this.config.entryPath}`;
            this.projectGlobalErrors.push(errorMsg);
            this.logger.error(errorMsg + ' 解析中止。');
            return this.buildProjectAstResult(); // 返回包含错误信息的空项目AST结构
        }
        this.logger.info(`项目根文件已确定为: ${this.currentRootFilePath}`);

        // 3. 递归地解析根文件及其所有包含的 TeX 文件:
        const filesToParseQueue: string[] = [this.currentRootFilePath!]; // currentRootFilePath is checked for null above
        const processingOrder: string[] = []; // 记录文件处理顺序

        while (filesToParseQueue.length > 0) {
            const currentFilePath = filesToParseQueue.shift()!;
            const normalizedFilePath = normalizePath(currentFilePath);

            if (this.parsedFilePaths.has(normalizedFilePath)) {
                this.logger.debug(`跳过已解析的文件: ${normalizedFilePath}`);
                continue; 
            }

            processingOrder.push(normalizedFilePath); // 记录处理顺序
            this.parsedFilePaths.add(normalizedFilePath);
            this.logger.info(`[ProjectProcessor] === 正在解析文件 (${processingOrder.length}): ${normalizedFilePath} ===`);

            let fileContent: string;
            try {
                fileContent = await readFileAsync(normalizedFilePath);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`[ProjectProcessor] 读取文件 ${normalizedFilePath} 失败: ${message}`);
                this.projectFileErrors.set(normalizedFilePath, `读取文件失败: ${message}`);
                this.projectAstMap.set(normalizedFilePath, null); 
                continue; 
            }

            const parseResult: InternalFileParseResult = await this.fileContentParser.parseFileContent(
                normalizedFilePath, 
                fileContent
            );

            this.projectAstMap.set(normalizedFilePath, parseResult.ast);
            if (parseResult.error) {
                this.projectFileErrors.set(normalizedFilePath, parseResult.error);
                this.logger.warn(`[ProjectProcessor] 文件 ${normalizedFilePath} 解析时遇到问题: ${parseResult.error}`);
            }
            
            // 调试日志：打印 DefinitionHandler 在处理完此文件后的状态
            const currentDefs = this.definitionHandler.getAllDefinitionsCategorized();
            this.logger.debug(`[ProjectProcessor] 文件 ${normalizedFilePath} 处理完毕后，文档内定义的宏:`, Object.keys(currentDefs.definedInDocumentMacros));
            this.logger.debug(`[ProjectProcessor] 文件 ${normalizedFilePath} 处理完毕后，文档内定义的环境:`, Object.keys(currentDefs.definedInDocumentEnvironments));
            this.logger.debug(`[ProjectProcessor] 文件 ${normalizedFilePath} 处理完毕后，最终生效的宏:`, Object.keys(currentDefs.finalEffectiveMacros).length);

            for (const includedFile of parseResult.includedFiles) {
                const normalizedIncludedPath = normalizePath(includedFile.path);
                if (!this.parsedFilePaths.has(normalizedIncludedPath)) {
                    if (await fileExistsAsync(normalizedIncludedPath)) {
                         filesToParseQueue.push(normalizedIncludedPath);
                         this.logger.debug(`[ProjectProcessor] 将文件 ${normalizedIncludedPath} (从 ${normalizedFilePath} 包含) 加入解析队列。`);
                    } else {
                        const missingMsg = `引用的文件未找到: ${normalizedIncludedPath} (在文件 ${normalizedFilePath} 中通过命令 '${includedFile.command}' 引用，原始路径 '${includedFile.rawPath}')`;
                        this.logger.warn(missingMsg);
                        this.projectGlobalErrors.push(missingMsg);
                        this.projectAstMap.set(normalizedIncludedPath, null);
                        this.projectFileErrors.set(normalizedIncludedPath, `引用的文件未找到。`);
                        this.parsedFilePaths.add(normalizedIncludedPath); 
                    }
                }
            }
        }
        this.logger.info('[ProjectProcessor] 所有文件均已处理完毕。处理顺序:', processingOrder);
        return this.buildProjectAstResult();
    }

    /**
     * (私有) 构建并返回最终的 {@link ProjectAST} 结果对象。
     * 此方法在所有文件处理完成后被调用，用于聚合收集到的数据。
     * @returns 包含整个项目解析结果的 {@link ProjectAST} 对象。
     */
    private buildProjectAstResult(): ProjectAST {
        const projectFileAstArray: ProjectFileAst[] = [];
        for (const [filePath, ast] of this.projectAstMap.entries()) {
            projectFileAstArray.push({
                filePath,
                ast: ast!, // ast可能为null，表示该文件解析失败或不存在。其错误记录在error字段
                error: this.projectFileErrors.get(filePath),
            });
        }
        
        const allDefinitions = this.definitionHandler.getAllDefinitionsCategorized();
        // 尝试从 package.json 读取版本号 (Node.js 环境)
        const version = typeof process !== 'undefined' && process.env && process.env.npm_package_version 
                        ? process.env.npm_package_version 
                        : 'unknown'; // 如果无法获取，则为未知版本

        return {
            rootFilePath: this.currentRootFilePath,
            files: projectFileAstArray,
            macros: allDefinitions.finalEffectiveMacros, // 顶层 `macros` 字段使用最终生效的宏列表
            _detailedMacros: {                         // `_detailedMacros` 提供更详细的分类信息
                defaultAndUser: allDefinitions.defaultAndUserMacros,
                definedInDocument: allDefinitions.definedInDocumentMacros,
                inferredUsed: allDefinitions.inferredUsedMacros,
                finalEffectiveMacros: allDefinitions.finalEffectiveMacros,
            },
            environments: allDefinitions.finalEffectiveEnvironments, // 顶层 `environments` 字段同理
            _detailedEnvironments: {                         
                ctanEnvironments: allDefinitions.ctanEnvironments,
                userProvidedEnvironments: allDefinitions.userProvidedEnvironments,
                definedInDocumentEnvironments: allDefinitions.definedInDocumentEnvironments,
                finalEffectiveEnvironments: allDefinitions.finalEffectiveEnvironments,
            },
            errors: this.projectGlobalErrors.length > 0 ? [...this.projectGlobalErrors] : undefined,
            _processingInfo: {
                timestamp: new Date().toISOString(),
                parserVersion: version 
            }
        };
    }

    /**
     * (私有) 确定项目的根 TeX 文件。
     * 此逻辑迁移并适配自原 `ProjectParser.determineRootFile`。
     * @param entryPathFromConfig - 从配置中获取的、已经过初步解析的入口路径（可能是文件或目录）。
     * @param baseDirForResolution - 用于解析 `entryPathFromConfig` 的基础目录 (通常是 CWD 或 entryPath 的父目录)。
     * @returns 返回根文件的绝对规范化路径，如果找不到则为 `null`。
     */
    private async determineRootFile(entryPathFromConfig: string, baseDirForResolution: string): Promise<string | null> {
        const resolvedEntryPath = entryPathFromConfig; // 假设 entryPathFromConfig 已被 configManager 正确解析
        this.logger.debug(`开始确定根文件，解析后的入口路径 (来自配置): ${resolvedEntryPath}`);

        if (!(await fileExistsAsync(resolvedEntryPath))) {
            const err = `入口路径不存在: ${resolvedEntryPath}`;
            this.projectGlobalErrors.push(err);
            this.logger.warn(err);
            return null;
        }

        const stats = await getFileStatsAsync(resolvedEntryPath);

        if (stats.isFile()) {
            if (isTexFile(resolvedEntryPath)) {
                this.logger.info(`入口路径 '${resolvedEntryPath}' 是一个 TeX 文件，将其作为根文件。`);
                return normalizePath(resolvedEntryPath); 
            }
            const err = `入口文件 '${resolvedEntryPath}' 不是一个有效的 TeX 文件。`;
            this.projectGlobalErrors.push(err);
            this.logger.warn(err);
            return null;
        }

        if (stats.isDirectory()) {
            this.logger.debug(`入口路径 '${resolvedEntryPath}' 是一个目录，开始在目录中搜索根文件。`);
            // 策略1: 检查常见的根文件名
            const commonRootFileNames = ['main.tex', 'root.tex', 'master.tex', 'document.tex', 'thesis.tex'];
            for (const fileName of commonRootFileNames) {
                const filePath = normalizePath(joinPaths(resolvedEntryPath, fileName));
                if (await fileExistsAsync(filePath)) {
                    this.logger.info(`在目录中找到常见根文件名: ${filePath}`);
                    return filePath;
                }
            }
            this.logger.debug('未找到常见根文件名，开始扫描目录中的 .tex 文件以查找包含 \\documentclass 的文件。');
            // 策略2: 查找包含 \documentclass 的文件
            const texFiles = await findTexFiles(resolvedEntryPath);
            const rootCandidates: string[] = [];
            for (const texFile of texFiles) {
                try {
                    const content = await readFileAsync(texFile);
                    if (isRootFileContent(content)) {
                        rootCandidates.push(normalizePath(texFile));
                    }
                } catch (error) {
                    this.logger.warn(`读取文件 ${texFile} 以检查根文件内容时出错: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            if (rootCandidates.length === 1) {
                this.logger.info(`找到唯一包含根文件标识的候选文件: ${rootCandidates[0]}`);
                return rootCandidates[0];
            } else if (rootCandidates.length > 1) {
                const msg = `在目录 '${resolvedEntryPath}' 中发现多个可能的根文件: ${rootCandidates.join(', ')}。将使用第一个找到的: ${rootCandidates[0]}`;
                this.logger.warn(msg);
                // 可以选择是否将此作为全局错误记录，取决于严格程度
                // this.projectGlobalErrors.push(msg);
                return rootCandidates[0];
            }

            const dirMsg = `在目录 ${resolvedEntryPath} 中未能找到可识别的根 TeX 文件。`;
            this.projectGlobalErrors.push(dirMsg);
            this.logger.warn(dirMsg);
            return null;
        }

        const notFileOrDirMsg = `指定的入口路径 '${resolvedEntryPath}' 既不是文件也不是目录。`;
        this.projectGlobalErrors.push(notFileOrDirMsg);
        this.logger.warn(notFileOrDirMsg);
        return null;
    }
}

// findRootFileUtility 保持不变或移除，因为它依赖于私有方法或临时实例
// 更好的做法是在需要时，由外部代码直接实例化 ProjectProcessor 并调用 parse 