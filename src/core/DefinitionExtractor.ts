/**
 * 定义提取器模块。
 *
 * 负责从 AST (抽象语法树) 中提取各种 LaTeX 定义（如宏、环境）和元信息（例如文件包含指令）。
 * 此模块利用 `commandDefinitionUtils` 来处理底层的、特定于命令的规范提取，
 * 并实现了更高级的提取逻辑，例如基于用法的宏参数签名推断。
 */
import type { Ast, NewCommandSpec, NewEnvironmentSpec } from '../types/index'; // 移除了 ResolvedParserConfig，此类不直接使用它
import { extractNewCommands as extractNewCommandSpecs, listNewEnvironments } from '../latex-utils/commandDefinitionUtils'; // 移除了 macroToEnvironmentSpec，因为它在 listNewEnvironments 内部使用
import { UtilNewCommandSpec, listNewcommands as unifiedListNewcommands } from '@unified-latex/unified-latex-util-macros';
import { visit, VisitInfo, Matcher, createMacroMatcher, match, VisitorFn } from '../latex-utils/astQuery'; 
import { printRaw } from '../latex-utils/unifiedLatexBridge';
import { resolveTexPathWithExtension } from '../latex-utils/projectFileUtils';
import { normalizePath } from '../utils/pathUtils';
import { createLogger, Logger } from '../utils/logger';

export class DefinitionExtractor {
    private logger: Logger;
    private knownMacroNamesProvider: () => Set<string>; 

    /**
     * 创建一个新的 `DefinitionExtractor` 实例。
     * @param knownMacroNamesProvider - 一个回调函数，当被调用时，应返回一个包含当前所有已知宏名称的集合 (字符串不含前导反斜杠)。
     *                                 此集合用于在推断宏签名时避免重复处理或覆盖已明确定义的宏。
     */
    constructor(knownMacroNamesProvider: () => Set<string>) {
        this.logger = createLogger('core:DefinitionExtractor');
        this.knownMacroNamesProvider = knownMacroNamesProvider;
    }

    /**
     * 从给定的 AST 中提取通过 `\newcommand`, `\renewcommand` 等命令明确定义的宏。
     * @param astTree - 要进行扫描的 AST 树 (通常是 {@link Ast.Root} 节点)。
     * @returns 返回一个 {@link Ast.MacroInfoRecord} 对象，其中键是宏名称 (不含前导反斜杠)，值是包含其参数签名的对象。
     */
    public extractDefinedMacrosFromAst(astTree: Ast.Ast): Ast.MacroInfoRecord {
        const newMacros: Ast.MacroInfoRecord = {};
        const commandSpecs: NewCommandSpec[] = extractNewCommandSpecs(astTree);
        for (const spec of commandSpecs) {
            // NewCommandSpec 中的 name 已经由 extractNewCommands 处理过，不含 \
            if (spec.name) {
                newMacros[spec.name] = { signature: spec.signature };
            }
        }
        this.logger.debug(`从AST中提取到 ${Object.keys(newMacros).length} 个明确定义的宏。`);
        return newMacros;
    }

    /**
     * 从给定的 AST 中提取通过 `\newenvironment`, `\newtheorem` 等命令明确定义的环境。
     * @param astTree - 要进行扫描的 AST 树。
     * @returns 返回一个 {@link Ast.EnvInfoRecord} 对象，其中键是环境名称，值是包含其参数签名的对象。
     */
    public extractDefinedEnvironmentsFromAst(astTree: Ast.Ast): Ast.EnvInfoRecord {
        const newEnvs: Ast.EnvInfoRecord = {};
        const envSpecs: NewEnvironmentSpec[] = listNewEnvironments(astTree); 
        for (const spec of envSpecs) {
            if (spec.name) {
                newEnvs[spec.name] = { signature: spec.signature };
                // 注意: NewEnvironmentSpec 包含比 EnvInfo 更详细的参数信息 (spec.parameters)。
                // 如果 EnvInfo 需要这些更详细的信息 (例如用于特定的环境内容处理)，
                // 则可以在此处进行转换和添加，或者直接让 DefinitionHandler 存储 NewEnvironmentSpec。
                // 当前 EnvInfo 主要关注签名，所以直接使用 spec.signature。
            }
        }
        this.logger.debug(`从AST中提取到 ${Object.keys(newEnvs).length} 个明确定义的环境。`);
        return newEnvs;
    }

    /**
     * 扫描 AST，推断那些在文档中被使用但当前未在已知定义中找到的宏的参数签名。
     * 推断基于宏调用后紧随的花括号 `{...}` 组的数量。
     * 此逻辑迁移自原 `MacroHandler.extractUsedCustomMacros`。
     * @param astTree - 要进行扫描的 AST 树。
     * @returns 返回一个 {@link Ast.MacroInfoRecord} 对象，包含推断出的宏及其基于用法的参数签名。
     */
    public extractInferredUsedMacros(astTree: Ast.Ast): Ast.MacroInfoRecord {
        const inferredMacros: Ast.MacroInfoRecord = {};
        const currentlyKnownMacroNames = this.knownMacroNamesProvider();
        const potentialCustomMacros = new Map<string, { node: Ast.Macro, argCount: number }>();

        const visitorFn: VisitorFn = (node: Ast.Ast, visitInfo: VisitInfo) => { 
            if (!node || typeof node !== 'object' || !('type' in node) || node.type !== 'macro') {
                return;
            }
            const macroNode = node as Ast.Macro;
            const macroName = macroNode.content;
            if (!macroName || currentlyKnownMacroNames.has(macroName)) {
                return;
            }
            let argCount = 0;
            const parentOfMacro = visitInfo?.parents?.[0]; 
            const macroIndexInParent = visitInfo?.index;  
            if (parentOfMacro && 
                'content' in parentOfMacro && 
                Array.isArray(parentOfMacro.content) && 
                macroIndexInParent != null
            ) {
                const parentContent = parentOfMacro.content as Ast.Ast[];
                let currentIndex = macroIndexInParent + 1; 
                while (currentIndex < parentContent.length) {
                    const nextNode = parentContent[currentIndex];
                    if (!nextNode || typeof nextNode !== 'object' || !('type' in nextNode)) {
                        break; 
                    }
                    if (nextNode.type === 'whitespace') { 
                        currentIndex++;
                        continue;
                    }
                    if (nextNode.type === 'group') { 
                        argCount++;
                        currentIndex++;
                    } else {
                        break; 
                    }
                }
            }
            if (!potentialCustomMacros.has(macroName) ||
                (potentialCustomMacros.get(macroName)!.argCount < argCount)) {
                potentialCustomMacros.set(macroName, { node: macroNode, argCount });
            }
        };
        
        visit(astTree, visitorFn);

        for (const [macroName, data] of potentialCustomMacros.entries()) {
            let signature = '';
            for (let i = 0; i < data.argCount; i++) {
                signature += (signature ? ' ' : '') + 'm'; 
            }
            inferredMacros[macroName] = { signature };
        }
        this.logger.debug(`从AST中推断出 ${Object.keys(inferredMacros).length} 个宏的签名。`);
        return inferredMacros;
    }

    /**
     * 从 AST 中提取通过 `\input`, `\include`, `\subfile` 等命令引用的文件路径。
     * @param astTree - 要进行扫描的 AST 树。
     * @param baseDir - 当前文件所在的目录路径，用于解析相对路径。
     * @returns 返回一个对象数组，每个对象包含规范化的文件路径 (`path`)、使用的命令 (`command`) 和原始路径字符串 (`rawPath`)。
     */
    public extractIncludedFiles(
        astTree: Ast.Ast,
        baseDir: string
    ): { path: string; command: string; rawPath: string }[] {
        this.logger.debug(`[DefinitionExtractor] 开始从 ${baseDir} 提取包含文件。 AST根节点类型: ${astTree.type}`);
        const includedFiles: { path: string; command: string; rawPath: string }[] = [];
        const includeCommands = ['input', 'include', 'subfile'];
        const includeCommandMatcher: Matcher = match.createMacroMatcher(includeCommands);

        const testFn = (node: Ast.Ast | null | undefined, _info?: VisitInfo): boolean => {
            // console.log(`[DEBUG] [DefinitionExtractor-testFn] 检查节点: ${node ? (node as any).type + ((node as any).type === 'macro' ? '('+(node as Ast.Macro).content+')' : '') : 'null/undefined'}`);
            if (!node || typeof node !== 'object' || !('type' in node)) {
                return false;
            }
            const isMacroNode = node.type === 'macro';
            if (isMacroNode) {
                const commandName = (node as Ast.Macro).content;
                const isTargetCommand = includeCommands.includes(commandName);
                // console.log(`[DEBUG] [DefinitionExtractor-testFn] 宏节点: \\${commandName}, 是否为目标命令: ${isTargetCommand}`);
                return isTargetCommand;
            }
            return false;
        };

        const visitorFn: VisitorFn = (node: Ast.Ast, info: VisitInfo) => { 
            const macroNode = node as Ast.Macro;
            // console.log(`[DEBUG] [DefinitionExtractor-visitorFn] 处理宏 \\${macroNode.content}，参数:`, JSON.stringify(macroNode.args), `Context Key: ${info.key}, Index: ${info.index}`);

            if (!macroNode.args || macroNode.args.length < 1) {
                this.logger.warn(`文件包含命令 '${macroNode.content}' (位于 ${baseDir} 附近) 没有参数，无法提取路径。`);
                return;
            }
            const firstArg = macroNode.args[0];
            if (firstArg.type !== 'argument') {
                this.logger.warn(`文件包含命令 '${macroNode.content}' 的第一个参数不是有效的 argument 类型。实际类型: ${firstArg.type}`);
                return;
            }
            let rawPath = '';
            if (Array.isArray(firstArg.content)) {
                rawPath = firstArg.content
                    .filter((n: Ast.Ast): n is Ast.String => !!(n && typeof n ==='object' && 'type' in n && n.type === 'string'))
                    .map((n: Ast.String) => n.content)
                    .join('');
            } else if (typeof firstArg.content === 'string') {
                rawPath = firstArg.content; 
            }
            if (!rawPath) {
                this.logger.warn(`文件包含命令 '${macroNode.content}' (位于 ${baseDir} 附近) 的第一个参数内容为空或未能提取出有效字符串。 Arg content:`, firstArg.content);
                return;
            }
            // this.logger.debug(`[DefinitionExtractor] 提取到原始包含路径: '${rawPath}' from command \'${macroNode.content}\'`);
            const resolvedPath = resolveTexPathWithExtension(baseDir, rawPath);
            const normalizedPath = normalizePath(resolvedPath); 
            // this.logger.debug(`[DefinitionExtractor] 原始路径 '${rawPath}' 解析并规范化为: '${normalizedPath}'`);
            includedFiles.push({
                path: normalizedPath,
                command: macroNode.content,
                rawPath: rawPath
            });
        };
        
        visit(astTree, visitorFn, { test: testFn as (node: Ast.Ast, info: VisitInfo) => boolean });

        this.logger.info(`[DefinitionExtractor] 从 (${baseDir} 相关) AST 中提取到 ${includedFiles.length} 个包含的文件引用。`);
        if (includedFiles.length > 0) {
            this.logger.debug('[DefinitionExtractor] 提取到的文件列表:', includedFiles.map(f => f.path));
        }
        return includedFiles;
    }
} 