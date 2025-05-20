/**
 * 单个文件内容解析器模块。
 *
 * 负责处理单个 LaTeX 文件内容的完整解析周期，具体步骤包括：
 * 1. 获取原始 AST (抽象语法树)。
 * 2. 与 {@link DefinitionHandler} 和 {@link DefinitionExtractor} 协作，提取和处理文件内的宏定义及环境定义。
 * 3. 执行多遍的参数附加和环境内容处理流程，以确保定义的正确应用。
 * 4. 从处理后的 AST 中提取文件依赖关系 (例如 `\input` 或 `\include` 的文件)。
 */

import type { Ast, ResolvedParserConfig, InternalFileParseResult } from '../types/index';
import { DefinitionHandler } from './DefinitionHandler';
import { DefinitionExtractor } from './DefinitionExtractor';
import { getParser as getRawParser, attachMacroArgs, processEnvironments, RawLatexParser } from '../latex-utils/unifiedLatexBridge';
import { Logger, createLogger } from '../utils/logger';
import { getDirname } from '../utils/pathUtils';

export class FileContentParser {
    private logger: Logger;
    private rawParser: RawLatexParser;
    private definitionHandlerRef: DefinitionHandler; // 对项目中共享的 DefinitionHandler 实例的引用
    private definitionExtractor: DefinitionExtractor; // 用于从 AST 提取各种定义的实例

    /**
     * 创建一个新的 `FileContentParser` 实例。
     * @param config - 已解析的、全局的解析器配置对象 {@link ResolvedParserConfig}。
     * @param definitionHandler - 对项目中共享的 {@link DefinitionHandler} 实例的引用，用于管理和查询宏/环境定义。
     */
    constructor(config: ResolvedParserConfig, definitionHandler: DefinitionHandler) {
        this.logger = createLogger('core:FileContentParser');
        this.rawParser = getRawParser({ flags: { autodetectExpl3AndAtLetter: true } }); // 获取原始解析器
        this.definitionHandlerRef = definitionHandler;
        
        // DefinitionExtractor 依赖一个函数来获取当前所有已知宏的名称集合，
        // 以便在推断未知宏时避免重复处理。此函数从 DefinitionHandler 获取这些信息。
        this.definitionExtractor = new DefinitionExtractor(() => {
            const effectiveMacros = this.definitionHandlerRef.getEffectiveMacroInfoRecord();
            return new Set(Object.keys(effectiveMacros));
        });
        this.logger.debug('FileContentParser 已初始化。这条是 DEBUG 日志。');
    }

    /**
     * 解析所提供的 LaTeX 文件字符串内容。
     * 此方法执行多阶段的 AST 处理，包括宏/环境的提取、参数附加和内容处理。
     * @param filePath - 正在解析的文件的（通常是绝对）路径。主要用于日志记录和解析相对路径（例如文件包含）。
     * @param fileContent - 要解析的 LaTeX 文件的完整字符串内容。
     * @returns 返回一个 Promise，该 Promise 解析为 {@link InternalFileParseResult} 对象，
     *          其中包含处理后的 AST、此文件中新发现的定义、包含的文件列表以及任何解析错误。
     */
    public async parseFileContent(
        filePath: string, 
        fileContent: string
    ): Promise<InternalFileParseResult> {
        this.logger.info(`开始解析文件内容: ${filePath}`);
        let ast: Ast.Root | null = null;
        let parsingError: string | undefined;

        try {
            // 阶段 1: 获取原始 AST
            ast = this.rawParser.parse(fileContent);
            this.logger.debug('原始 AST 已成功生成。');

            // 获取文件所在目录，用于解析 extractIncludedFiles 中的相对路径
            const baseDir = getDirname(filePath);

            // --- 多阶段 AST 处理流程 ---
            
            // 阶段 2: 从原始AST中提取本文档定义的【宏】
            const definedInThisFileMacros = this.definitionExtractor.extractDefinedMacrosFromAst(ast);
            // 将新发现的宏添加到全局 DefinitionHandler 中
            this.definitionHandlerRef.addDocumentDefinedMacros(definedInThisFileMacros);
            this.logger.debug(`提取并添加了 ${Object.keys(definedInThisFileMacros).length} 个文档内定义的宏。`);

            // 阶段 3: 第一次宏参数附加
            // 使用当前所有已知的宏 (包括默认宏、用户提供宏以及刚从本文档提取的宏)
            // 目的是为了确保后续提取环境定义时，定义环境的宏 (如 \newenvironment, \newtcolorbox) 的参数能够被正确解析。
            let macrosForFirstPass = this.definitionHandlerRef.getEffectiveMacroInfoRecord();
            attachMacroArgs(ast, macrosForFirstPass);
            this.logger.debug('第一次宏参数附加操作完成。');

            // 阶段 4: 从(可能已部分处理参数的)AST中提取本文档定义的【环境】
            const definedInThisFileEnvs = this.definitionExtractor.extractDefinedEnvironmentsFromAst(ast);
            // 将新发现的环境添加到全局 DefinitionHandler 中
            this.definitionHandlerRef.addDocumentDefinedEnvironments(definedInThisFileEnvs);
            this.logger.debug(`提取并添加了 ${Object.keys(definedInThisFileEnvs).length} 个文档内定义的环境。`);

            // 阶段 5: 第二次宏参数附加
            // 获取更新后的、最完整的宏定义记录 (此时可能包含了因环境定义间接引入的宏，
            // 或者用户提供的宏可能影响了环境定义的解析方式)。
            // 再次附加参数以确保一致性，特别是如果环境定义本身引入了新的宏或依赖特定宏的解析。
            let macrosForSecondPass = this.definitionHandlerRef.getEffectiveMacroInfoRecord();
            attachMacroArgs(ast, macrosForSecondPass);
            this.logger.debug('第二次宏参数附加操作完成。');

            // 阶段 6: 环境处理
            // 使用当前所有已知的环境定义 (包含本文档刚刚提取的环境) 为 AST 中的环境附加参数并处理其内容。
            const envsForProcessing = this.definitionHandlerRef.getEffectiveEnvInfoRecord();
            try {
                processEnvironments(ast, envsForProcessing);
                this.logger.debug('环境参数附加和内容处理完成。');
            } catch (envProcessingError) {
                const message = envProcessingError instanceof Error ? envProcessingError.message : String(envProcessingError);
                this.logger.warn(`在文件 ${filePath} 中处理环境时发生错误: ${message}`);
                // 注意：这类错误通常不会阻止后续步骤，但可能影响AST的准确性。可以考虑是否作为文件级错误记录。
            }

            // 阶段 7: 从AST中提取使用了但仍未知的宏（启发式推断其签名）
            const inferredInThisFileMacros = this.definitionExtractor.extractInferredUsedMacros(ast);
            // 将推断出的宏添加到全局 DefinitionHandler (仅当它们之前未被任何方式定义时)
            this.definitionHandlerRef.addInferredUsedMacros(inferredInThisFileMacros);
            this.logger.debug(`提取并添加了 ${Object.keys(inferredInThisFileMacros).length} 个推断出的宏。`);
            
            // 阶段 8: 最终的宏参数附加
            // 使用包含推断宏在内的、最终生效的宏定义列表，确保所有（包括推断出的）宏的参数都得到处理。
            const finalMacrosForAttachment = this.definitionHandlerRef.getEffectiveMacroInfoRecord();
            attachMacroArgs(ast, finalMacrosForAttachment);
            this.logger.debug('最终的宏参数附加操作完成。');
            
            // 阶段 9: 从最终处理的 AST 中提取此文件包含的其他文件引用
            const includedFiles = this.definitionExtractor.extractIncludedFiles(ast, baseDir);
            this.logger.debug(`从文件 ${filePath} 中提取到 ${includedFiles.length} 个包含的文件引用。`);

            return {
                ast,
                newlyFoundMacros: { ...definedInThisFileMacros, ...inferredInThisFileMacros }, // 本文件贡献的所有新宏
                newlyFoundEnvironments: definedInThisFileEnvs, // 本文件贡献的所有新环境
                includedFiles,
                error: parsingError, // 如果在 try...catch 外部的特定步骤中设置了错误信息
            };

        } catch (error) {
            // 捕获在上述任一步骤中可能发生的未预料错误
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`解析文件 ${filePath} 内容时发生严重错误: ${message}`);
            parsingError = `文件内容解析失败: ${message}`;
            // 即使发生严重错误，也返回一个符合接口的结构，并将 ast 设为 null
            return {
                ast: null, 
                newlyFoundMacros: {},
                newlyFoundEnvironments: {},
                includedFiles: [],
                error: parsingError,
            };
        }
    }
} 