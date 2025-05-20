import * as Ast from "@unified-latex/unified-latex-types";
import { printRaw } from "@unified-latex/unified-latex-util-print-raw";
import { NewEnvironmentSpec, EnvironmentParameter } from "./types";
// import { getNamedArgsContent } from "@unified-latex/unified-latex-util-arguments"; // 暂时不用，直接访问args数组

// 定义环境的命令集合
export const STANDARD_ENVIRONMENT_DEFINERS = new Set([
    "newenvironment",
    "renewenvironment",
    "provideenvironment", // 添加 provideenvironment
]);

export const TCOLORBOX_ENVIRONMENT_DEFINERS = new Set([
    "newtcolorbox",
    "DeclareTColorBox",
]);

export const AMSTHM_THEOREM_DEFINERS = new Set([
    "newtheorem",
]);

export const ENUMITEM_LIST_DEFINERS = new Set([
    "newlist",
]);

// 可以合并所有支持的命令到一个集合中，供 list-newenvironments.ts 使用
export const ALL_ENVIRONMENT_DEFINERS = new Set([
    ...STANDARD_ENVIRONMENT_DEFINERS,
    ...TCOLORBOX_ENVIRONMENT_DEFINERS,
    ...AMSTHM_THEOREM_DEFINERS,
    ...ENUMITEM_LIST_DEFINERS,
]);

/**
 * 从定义环境的宏节点中提取环境名称。
 * @param node 宏节点
 * @param definingCommand 定义命令的名称 (如 "newenvironment")
 * @returns 环境名称字符串，如果无法提取则返回 null。
 */
export function environmentDefiningMacroToName(node: Ast.Macro, definingCommand: string): string | null {
    console.log(`[env-parser-debug] environmentDefiningMacroToName for '${definingCommand}'. Node args:`, JSON.stringify(node.args, null, 2));
    if (!node.args || node.args.length === 0) {
        console.warn(`[env-parser] Macro ${definingCommand} is missing arguments.`);
        return null;
    }

    let nameArg: Ast.Argument | undefined;
    switch (definingCommand) {
        case "newenvironment":
        case "renewenvironment":
        case "provideenvironment":
            nameArg = node.args[0];
            break;
        case "newtcolorbox":
            nameArg = node.args[1]; // Signature: o m o o m -> name is args[1]
            break;
        case "DeclareTColorBox":
            nameArg = node.args[0]; // Signature: m m m -> name is args[0]
            break;
        case "newtheorem":
            // Default signature in MacroHandler is 'm o m'.
            // However, amsthm's `newtheorem` can also be `\newtheorem*{env_name}{title}` (s m m)
            // or a more complex one if it's defined by amsthm package in unified-latex-ctan.
            // Based on logs, args[0] is empty, args[1] is {envName}. So name is at index 1.
            // This suggests the effective signature being applied by attachMacroArgs is like `s m ...` or `o m ...`
            nameArg = node.args[1];
            break;
        case "newlist":
            nameArg = node.args[0]; // Signature: m m m -> name is args[0]
            break;
        default:
            console.warn(`[env-parser] Name extraction for ${definingCommand} not specifically handled, assuming first arg.`);
            nameArg = node.args[0];
            break;
    }

    if (nameArg && nameArg.content && Array.isArray(nameArg.content) && nameArg.content.length > 0) {
        const firstContentNode = nameArg.content[0];
        console.log(`[env-parser-debug] nameArg for '${definingCommand}' firstContentNode type: ${firstContentNode?.type}, content:`, JSON.stringify(firstContentNode));
        if (firstContentNode && firstContentNode.type === "string") {
            const extractedName = (firstContentNode as Ast.String).content;
            console.log(`[env-parser-debug] Extracted name for '${definingCommand}' via string node: '${extractedName}'`);
            if (extractedName && extractedName.trim() !== "") return extractedName.trim();
        }
        const printedName = printRaw(nameArg.content).trim();
        console.log(`[env-parser-debug] Extracted name for '${definingCommand}' via printRaw: '${printedName}'`);
        if (printedName && printedName !== "") return printedName;
    }
    console.warn(`[env-parser-debug] Conditions for name extraction not met for '${definingCommand}'. nameArg used:`, JSON.stringify(nameArg));
    console.warn(`[env-parser] Could not extract environment name for ${definingCommand} from node.args:`, JSON.stringify(node.args));
    return null;
}

/**
 * 解析参数（如数字、默认值）并构建参数签名和详细参数列表。
 */
function parseArgsForSignature(args: Ast.Argument[] | undefined, startIndex: number): { signature: string; parameters: EnvironmentParameter[], numArgs: number } {
    let numArgs = 0;
    let defaultOptionNode: Ast.Argument | null = null;
    const parameters: EnvironmentParameter[] = [];
    let signature = "";

    const numArgsArg = args?.[startIndex];
    const defaultOptArg = args?.[startIndex + 1];

    if (numArgsArg && numArgsArg.openMark === '[' && numArgsArg.closeMark === ']') {
        try {
            const numArgsVal = parseInt(printRaw(numArgsArg.content), 10);
            if (!isNaN(numArgsVal) && numArgsVal > 0) {
                numArgs = numArgsVal;
                if (defaultOptArg && defaultOptArg.openMark === '[' && defaultOptArg.closeMark === ']') {
                    defaultOptionNode = defaultOptArg;
                }
            }
        } catch (e) { /* 忽略解析数字错误 */ }
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
 * @param node 宏节点
 * @param definingCommand 定义命令的名称
 * @returns 参数签名和详细参数列表
 */
export function environmentDefiningMacroToSignatureAndParams(node: Ast.Macro, definingCommand: string): { signature: string; parameters: EnvironmentParameter[], numArgs: number } {
    console.log(`[env-parser-debug] environmentDefiningMacroToSignatureAndParams for '${definingCommand}'. Node args:`, JSON.stringify(node.args, null, 2));
    switch (definingCommand) {
        case "newenvironment":
        case "renewenvironment":
        case "provideenvironment":
            return parseArgsForSignature(node.args, 1);
        case "newtcolorbox":
            // MacroHandler signature: o m o o m -> init_opts(0)[o] name(1){m} num_args(2)[o] default_opt(3)[o] options(4){m}
            return parseArgsForSignature(node.args, 2);
        case "DeclareTColorBox":
            // MacroHandler signature: m m m -> name(0){m} arg_spec(1){m} options(2){m}
            const argSpecArg = node.args?.[1];
            if (argSpecArg?.content && Array.isArray(argSpecArg.content) && argSpecArg.content.length > 0) {
                const specString = printRaw(argSpecArg.content);
                const sigParts = specString.split(/\s+/).filter(p => p === 'm' || p === 'o');
                const parameters: EnvironmentParameter[] = sigParts.map(p => ({ type: p === 'm' ? 'mandatory' : 'optional' }));
                console.warn(`[env-parser] Basic Xparse signature parsing for DeclareTColorBox ('${specString}' -> '${sigParts.join(" ")}').`);
                return { signature: sigParts.join(" "), parameters, numArgs: sigParts.length };
            }
            return { signature: "", parameters: [], numArgs: 0 };
        case "newtheorem":
            // Based on logs, the actual `args` for `\newtheorem{name}[opt]{title}` after `attachMacroArgs` (with an effective `s m o m` or `o m o m` signature from ctan/latex2e)
            // seems to be: args[0]=empty_opt_star, args[1]={name}, args[2]=[opt_counter], args[3]={title}.
            // The environment `name` itself will take one optional argument: `\begin{name}[note]`. Signature `o`.
            return { signature: "o", parameters: [{ type: 'optional' }], numArgs: 1 };
        case "newlist":
            return { signature: "o", parameters: [{ type: 'optional' }], numArgs: 1 };
        default:
            console.warn(`[env-parser] Signature extraction for ${definingCommand} not specifically handled.`);
            return { signature: "", parameters: [], numArgs: 0 };
    }
}

/**
 * 根据定义环境的宏节点，生成 NewEnvironmentSpec 对象。
 * @param node 宏节点，必须是定义新环境的命令之一。
 * @returns NewEnvironmentSpec 对象，如果无法解析则返回 null。
 */
export function environmentDefiningMacroToSpec(node: Ast.Macro): NewEnvironmentSpec | null {
    const definingCommand = node.content;
    if (!ALL_ENVIRONMENT_DEFINERS.has(definingCommand)) {
        return null; // 不是已知的环境定义命令
    }

    // +++ 新增日志 +++
    console.log(`[env-parser-debug] environmentDefiningMacroToSpec for '${definingCommand}'. Node:`, JSON.stringify(node, null, 2));
    // +++ 日志结束 +++

    const name = environmentDefiningMacroToName(node, definingCommand);
    if (!name) {
        console.warn(`[env-parser] Could not determine environment name for macro:`, node);
        return null;
    }

    const { signature, parameters, numArgs } = environmentDefiningMacroToSignatureAndParams(node, definingCommand);
    
    let beginCode: Ast.Ast[] | undefined;
    let endCode: Ast.Ast[] | undefined;
    let theoremTitle: string | undefined;
    let tcolorboxOptions: Ast.Ast[] | undefined;

    if (STANDARD_ENVIRONMENT_DEFINERS.has(definingCommand)) {
        beginCode = node.args?.[3]?.content as Ast.Ast[];
        endCode = node.args?.[4]?.content as Ast.Ast[];
    } else if (AMSTHM_THEOREM_DEFINERS.has(definingCommand)) {
        // name(is node.args[1]), optional_counter(node.args[2]), display_title(node.args[3]) based on effective s m o m / o m o m for `newtheorem` command
        const titleArg = node.args?.[3]; // Displayed name is the FOURTH argument in the node.args after attachMacroArgs
        if(titleArg?.content && Array.isArray(titleArg.content) && titleArg.content.length > 0) {
            theoremTitle = printRaw(titleArg.content);
        }
    } else if (definingCommand === "newtcolorbox") {
        // newtcolorbox[init_opts]{name}[num_args][default_opt]{options}
        // 找到 {options} 参数
        let optionsArg: Ast.Argument | undefined;
        if (node.args) {
            for (let i = node.args.length - 1; i >= 0; i--) {
                if (node.args[i].openMark === '{') {
                    // 最后一个强制参数通常是 options
                    // 但也要考虑 name, begin_code, end_code 也是强制的
                    // 这个逻辑需要更精确，以区分 newenvironment 和 newtcolorbox 的不同数量的强制参数
                    // 假设 newtcolorbox 的最后一个强制参数是 options
                    if (i > 0) { // 确保不是第一个参数（name）
                        optionsArg = node.args[i];
                        break;
                    }
                }
            }
        }
        if (optionsArg?.content && Array.isArray(optionsArg.content)) {
            // TODO: 实际解析 tcolorbox 选项键值对，现在只存为原始文本或AST
            tcolorboxOptions = optionsArg.content; // 或者 printRaw(optionsArg.content)
        }
    } else if (definingCommand === "DeclareTColorBox") {
        // DeclareTColorBox{name}{arg_spec}{options}
        const optionsArg = node.args?.[2];
        if (optionsArg?.content && Array.isArray(optionsArg.content)) {
            tcolorboxOptions = optionsArg.content; // 或者 printRaw(optionsArg.content)
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
        packageSource: getPackageSourceForCommand(definingCommand),
    };
}

/**
 * 根据定义命令获取可能的包来源。
 */
function getPackageSourceForCommand(definingCommand: string): string | undefined {
    if (STANDARD_ENVIRONMENT_DEFINERS.has(definingCommand)) return "latex2e";
    if (TCOLORBOX_ENVIRONMENT_DEFINERS.has(definingCommand)) return "tcolorbox";
    if (AMSTHM_THEOREM_DEFINERS.has(definingCommand)) return "amsthm";
    if (ENUMITEM_LIST_DEFINERS.has(definingCommand)) return "enumitem";
    // if (XPARSE_ENVIRONMENT_DEFINERS.has(definingCommand)) return "xparse";
    return undefined;
}
