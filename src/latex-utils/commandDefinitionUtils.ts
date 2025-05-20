/**
 * LaTeX 命令定义提取工具模块
 *
 * 提供从 AST 中提取宏定义和环境定义的底层功能函数。
 * 这些函数通常直接与 `unified-latex` 的 AST 结构和工具库交互。
 */
import type { Ast, NewCommandSpec, NewEnvironmentSpec, EnvironmentParameter } from '../types/index';
import { UtilNewCommandSpec, listNewcommands as unifiedListNewcommands } from '@unified-latex/unified-latex-util-macros';
import { Matcher, VisitorFn, visit, createMacroMatcher, VisitInfo } from './astQuery';
import { printRaw } from './unifiedLatexBridge';
import { Logger, createLogger } from '../utils/logger';

const logger: Logger = createLogger('latex-utils:commandDefinitionUtils');

// --- 宏定义提取 --- 
/**
 * 从给定的 AST 中提取通过 `\newcommand`, `\renewcommand` 等 LaTeX 命令定义的宏。
 * 这是对 `@unified-latex/unified-latex-util-macros` 包中 `listNewcommands` 函数的直接使用。
 * 
 * @param tree - 要扫描的 LaTeX AST 的根节点。
 * @returns {@link NewCommandSpec} 对象的数组，每个对象描述一个新定义的宏。
 */
export function extractNewCommands(tree: Ast.Ast): NewCommandSpec[] {
  const specs: UtilNewCommandSpec[] = unifiedListNewcommands(tree);
  logger.debug(`提取到 ${specs.length} 个宏定义 (UtilNewCommandSpec)。`);
  return specs.map((spec: UtilNewCommandSpec): NewCommandSpec => ({
      ...spec,
      name: spec.name.startsWith('\\') ? spec.name.substring(1) : spec.name,
  }));
}

// --- 环境定义提取 (从原 environment-parser/*) ---
/**
 * 标准的环境定义命令 (如 \newenvironment)
 */
export const STANDARD_ENVIRONMENT_DEFINERS = new Set([
    "newenvironment",
    "renewenvironment",
    "provideenvironment",
]);

/**
 * tcolorbox 包的环境定义命令
 */
export const TCOLORBOX_ENVIRONMENT_DEFINERS = new Set([
    "newtcolorbox",
    "DeclareTColorBox",
]);

/**
 * amsthm 包的定理类环境定义命令
 */
export const AMSTHM_THEOREM_DEFINERS = new Set([
    "newtheorem",
]);

/**
 * enumitem 包的列表环境定义命令。
 */
export const ENUMITEM_LIST_DEFINERS = new Set([
    "newlist",
]);

/**
 * 所有已知的环境定义命令的集合。
 */
export const ALL_ENVIRONMENT_DEFINERS = new Set<string>([
    ...STANDARD_ENVIRONMENT_DEFINERS,
    ...TCOLORBOX_ENVIRONMENT_DEFINERS,
    ...AMSTHM_THEOREM_DEFINERS,
    ...ENUMITEM_LIST_DEFINERS,
]);

/**
 * 从定义环境的宏节点中提取环境名称。
 * @param node - 宏节点。
 * @param definingCommand - 定义环境的命令名称 (例如 "newenvironment")。
 * @returns 环境名称字符串，如果无法提取则返回 `null`。
 */
function getEnvironmentNameFromMacro(node: Ast.Macro, definingCommand: string): string | null {
    if (!node.args || node.args.length === 0) {
        logger.warn(`宏 ${definingCommand} 缺少参数，无法提取环境名称。`);
        return null;
    }
    let nameArg: Ast.Argument | undefined;
    switch (definingCommand) {
        case "newenvironment":
        case "renewenvironment":
        case "provideenvironment":
            nameArg = node.args[2];
            break;
        case "newtcolorbox":
            nameArg = node.args[1];
            break;
        case "DeclareTColorBox":
            nameArg = node.args[0];
            break;
        case "newtheorem":
            const firstArgContent = node.args[0]?.content;
            if (Array.isArray(firstArgContent) && firstArgContent.length === 1 && firstArgContent[0].type === 'string' && (firstArgContent[0] as Ast.String).content === '*') {
                 nameArg = node.args[1]; 
            } else {
                 nameArg = node.args[0];
            }
            break;
        case "newlist":
            nameArg = node.args[0];
            break;
        default:
            logger.warn(`环境名称提取逻辑未显式处理命令 '${definingCommand}'，默认尝试第一个参数。`);
            nameArg = node.args[0];
            break;
    }
    if (nameArg?.content && Array.isArray(nameArg.content) && nameArg.content.length > 0) {
        const printedName = printRaw(nameArg.content).trim();
        if (printedName) {
            return printedName;
        }
    }
    logger.warn(`无法从命令 '${definingCommand}' 的参数中提取环境名称。参数详情:`, JSON.stringify(node.args, null, 2));
    return null;
}

/**
 * 解析环境定义中的参数数量和可选参数默认值，以构建参数签名字符串和结构化参数列表。
 * @param args - 宏节点的参数数组。
 * @param numArgsIndex - 指示参数数量的参数在 `args` 中的索引。
 * @param defaultOptArgIndex - 指示可选参数默认值的参数在 `args` 中的索引。
 * @returns 包含签名、参数列表和参数数量的对象。
 */
function parseEnvironmentArgsForSignature(
    args: Ast.Argument[] | undefined,
    numArgsIndex: number,
    defaultOptArgIndex: number
): { signature: string; parameters: EnvironmentParameter[]; numArgs: number } {
    let numArgs = 0;
    let defaultOptionNode: Ast.Argument | null = null;
    const parameters: EnvironmentParameter[] = [];
    let signature = "";
    const numArgsArg = args?.[numArgsIndex];
    const defaultOptArg = args?.[defaultOptArgIndex];
    if (numArgsArg?.openMark === '[' && numArgsArg.closeMark === ']') {
        try {
            const numArgsVal = parseInt(printRaw(numArgsArg.content), 10);
            if (!isNaN(numArgsVal) && numArgsVal >= 0) { 
                numArgs = numArgsVal;
                if (numArgs > 0 && defaultOptArg?.openMark === '[' && defaultOptArg.closeMark === ']') {
                    defaultOptionNode = defaultOptArg;
                }
            }
        } catch (e) {
            logger.warn('解析环境参数数量时出错:', e);
        }
    }

    if (numArgs > 0) {
        if (defaultOptionNode) {
            signature = "o";
            parameters.push({ type: 'optional', defaultValue: defaultOptionNode.content as Ast.Ast[] });
            for (let i = 1; i < numArgs; i++) {
                signature += " m";
                parameters.push({ type: 'mandatory' });
            }
        } else {
            for (let i = 0; i < numArgs; i++) {
                signature += (i > 0 ? " " : "") + "m";
                parameters.push({ type: 'mandatory' });
            }
        }
    }
    return { signature: signature.trim(), parameters, numArgs };
}

/**
 * 从定义环境的宏节点中提取并生成参数签名和详细参数列表。
 * @param node - 宏节点。
 * @param definingCommand - 定义命令的名称。
 * @returns 包含签名、参数列表和参数数量的对象。
 */
function getEnvironmentSignatureAndParams(
    node: Ast.Macro,
    definingCommand: string
): { signature: string; parameters: EnvironmentParameter[]; numArgs: number } {
    switch (definingCommand) {
        case "newenvironment":
        case "renewenvironment":
        case "provideenvironment":
            return parseEnvironmentArgsForSignature(node.args, 3, 4);
        case "newtcolorbox":
            return parseEnvironmentArgsForSignature(node.args, 2, 3);
        case "DeclareTColorBox":
            const argSpecArg = node.args?.[1];
            if (argSpecArg?.content && Array.isArray(argSpecArg.content) && argSpecArg.content.length > 0) {
                const specString = printRaw(argSpecArg.content).trim();
                const sigParts = specString.match(/[moO](?:\{[^}]*\})?/g) || [];
                const parameters: EnvironmentParameter[] = [];
                const signature = sigParts.map(p => {
                    if (p === 'm') parameters.push({type: 'mandatory', rawSpecifier: 'm'});
                    else if (p === 'o') parameters.push({type: 'optional', rawSpecifier: 'o'});
                    else if (p.startsWith('O')) {
                        parameters.push({type: 'optional', rawSpecifier: p });
                        return 'o'; 
                    }
                    return p.charAt(0);
                }).join(" ");
                logger.debug(`DeclareTColorBox: 解析参数规范 '${specString}' -> 签名 '${signature}'`);
                return { signature, parameters, numArgs: parameters.length };
            }
            return { signature: "", parameters: [], numArgs: 0 };
        case "newtheorem":
            return { signature: "o", parameters: [{ type: 'optional' }], numArgs: 1 };
        case "newlist":
            return { signature: "", parameters: [], numArgs: 0 };
        default:
            logger.warn(`环境签名提取逻辑未处理命令 '${definingCommand}'。`);
            return { signature: "", parameters: [], numArgs: 0 };
    }
}

/**
 * 根据定义环境的宏节点，生成 {@link NewEnvironmentSpec} 对象。
 * @param node - 宏节点，必须是定义新环境的命令之一。
 * @returns {@link NewEnvironmentSpec} 对象，如果无法解析则返回 `null`。
 */
export function macroToEnvironmentSpec(node: Ast.Macro): NewEnvironmentSpec | null {
    const definingCommand = node.content;
    if (!ALL_ENVIRONMENT_DEFINERS.has(definingCommand)) {
        return null;
    }
    const name = getEnvironmentNameFromMacro(node, definingCommand);
    if (!name) {
        logger.warn(`无法确定命令 '${definingCommand}' 定义的环境名称。`);
        return null;
    }
    const { signature, parameters, numArgs } = getEnvironmentSignatureAndParams(node, definingCommand);
    let beginCode: Ast.Ast[] | undefined;
    let endCode: Ast.Ast[] | undefined;
    let theoremTitle: string | undefined;
    let tcolorboxOptions: Ast.Ast[] | string | undefined;

    if (STANDARD_ENVIRONMENT_DEFINERS.has(definingCommand)) {
        beginCode = node.args?.[5]?.content as Ast.Ast[]; 
        endCode = node.args?.[6]?.content as Ast.Ast[];
    } else if (AMSTHM_THEOREM_DEFINERS.has(definingCommand)) {
        let titleArgIndex = 1; // 默认情况: \newtheorem{envName}{title}, title 在第二个参数 (index 1)
        const firstArg = node.args?.[0];
        const secondArg = node.args?.[1];
        
        // 检查星号版本: \newtheorem*{envName}{title}
        // 此时, args[0] 的内容是 "*", args[1] 是 envName, args[2] 是 title
        const firstArgContentNodes = firstArg?.content;
        if (Array.isArray(firstArgContentNodes) && 
            firstArgContentNodes.length === 1 && 
            firstArgContentNodes[0].type === 'string' && 
            (firstArgContentNodes[0] as Ast.String).content === '*') {
            titleArgIndex = 2; 
        } 
        // 检查带计数器版本: \newtheorem{envName}[counterLike]{title}
        // 此时, args[0] 是 envName, args[1] 是 [counterLike], args[2] 是 title
        else if (secondArg?.openMark === '[') {
            titleArgIndex = 2;
        }

        const titleArg = node.args?.[titleArgIndex];
        if(titleArg?.content && Array.isArray(titleArg.content) && titleArg.content.length > 0) {
            theoremTitle = printRaw(titleArg.content).trim();
        }
    } else if (definingCommand === "newtcolorbox") {
        const optionsArg = node.args?.[4]; 
        if (optionsArg?.content && Array.isArray(optionsArg.content)) {
            tcolorboxOptions = optionsArg.content;
        }
    } else if (definingCommand === "DeclareTColorBox") {
        const optionsArg = node.args?.[2];
        if (optionsArg?.content && Array.isArray(optionsArg.content)) {
            tcolorboxOptions = optionsArg.content; 
        }
    }
    return {
        name,
        signature,
        parameters: parameters.length > 0 ? parameters : undefined,
        definitionMacro: node,
        definingCommand,
        beginCode,
        endCode,
        theoremTitle,
        tcolorboxOptions,
        packageSource: getPackageSourceForDefiningCommand(definingCommand),
    };
}

/**
 * 根据定义环境的命令获取其可能的包来源。
 * @param definingCommand - 定义环境的命令。
 * @returns 包来源字符串或 `undefined`。
 */
function getPackageSourceForDefiningCommand(definingCommand: string): string | undefined {
    if (STANDARD_ENVIRONMENT_DEFINERS.has(definingCommand)) return "latex2e";
    if (TCOLORBOX_ENVIRONMENT_DEFINERS.has(definingCommand)) return "tcolorbox";
    if (AMSTHM_THEOREM_DEFINERS.has(definingCommand)) return "amsthm";
    if (ENUMITEM_LIST_DEFINERS.has(definingCommand)) return "enumitem";
    return undefined;
}

/**
 * 选项接口，用于 `listNewEnvironments` 函数。
 */
export interface ListNewEnvironmentsOptions {
    /**
     * (可选) 指定要查找的环境定义命令的集合。
     * 如果未提供，则使用 {@link ALL_ENVIRONMENT_DEFINERS}。
     */
    definingCommands?: Set<string>;
}

/**
 * 从 AST 中列出所有新定义的环境。
 * 它会查找由特定宏命令（如 `\newenvironment`, `\newtheorem`, `\newtcolorbox` 等）定义的环境，
 * 并提取其名称、参数签名等信息。
 * 
 * @param tree - 要扫描的 LaTeX AST 树。
 * @param options - 可选配置项，例如指定要关注的环境定义命令。
 * @returns {@link NewEnvironmentSpec} 对象的数组，每个对象描述一个新定义的环境。
 */
export function listNewEnvironments(
    tree: Ast.Ast,
    options?: ListNewEnvironmentsOptions
): NewEnvironmentSpec[] {
    const newEnvSpecs: NewEnvironmentSpec[] = [];
    const definersToConsider = options?.definingCommands || ALL_ENVIRONMENT_DEFINERS;
    if (definersToConsider.size === 0) {
        logger.warn("listNewEnvironments 调用时未指定任何环境定义命令。");
        return [];
    }
    const definerMatcher: Matcher = createMacroMatcher(Array.from(definersToConsider));
    let matchedNodesCount = 0;

    const visitor: VisitorFn = (node: Ast.Ast, _info: VisitInfo) => { 
        const macroNode = node as Ast.Macro; 
        matchedNodesCount++;
        const spec = macroToEnvironmentSpec(macroNode);
        if (spec) {
            newEnvSpecs.push(spec);
        }

    };

    const testFn = (node: Ast.Ast, _info?: VisitInfo): boolean => 
        !!(node && typeof node === 'object' && 'type' in node && node.type === 'macro' && definerMatcher(node));

    visit(tree, visitor, { test: testFn });

    logger.debug(`listNewEnvironments: 检查了 ${matchedNodesCount} 个可能是环境定义的宏。`);
    logger.debug(`listNewEnvironments 完成。找到了 ${newEnvSpecs.length} 个环境规范。`);
    return newEnvSpecs;
}