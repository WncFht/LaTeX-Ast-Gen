import * as Ast from "@unified-latex/unified-latex-types";
import { visit } from "@unified-latex/unified-latex-util-visit";
import { match } from "@unified-latex/unified-latex-util-match";
import { NewEnvironmentSpec } from "./types";
import { ALL_ENVIRONMENT_DEFINERS, environmentDefiningMacroToSpec } from "./environment-commands";

export interface ListNewEnvironmentsOptions {
    /**
     * (可选) 指定要查找的环境定义命令的集合。
     * 如果未提供，则使用 ALL_ENVIRONMENT_DEFINERS。
     */
    definingCommands?: Set<string>;
}

/**
 * 从 AST 中列出所有新定义的环境。
 * 它会查找由特定宏命令（如 \newenvironment, \newtheorem, \newtcolorbox 等）定义的环境，
 * 并提取其名称、参数签名等信息。
 * 
 * @param tree 要扫描的 LaTeX AST 树。
 * @param options 可选配置项，例如指定要关注的环境定义命令。
 * @returns NewEnvironmentSpec 对象的数组，每个对象描述一个新定义的环境。
 */
export function listNewEnvironments(
    tree: Ast.Ast,
    options?: ListNewEnvironmentsOptions
): NewEnvironmentSpec[] {
    const newEnvs: NewEnvironmentSpec[] = [];
    const definersSet = options?.definingCommands || ALL_ENVIRONMENT_DEFINERS;

    if (definersSet.size === 0) {
        console.warn("[env-parser] listNewEnvironments called with no defining commands to consider.");
        return [];
    }

    // 将 Set<string> 转换为 string[] 以便 createMacroMatcher 正确处理
    const definersArray = Array.from(definersSet);
    
    // 创建匹配器，仅匹配我们感兴趣的环境定义宏
    const newEnvironmentMatcher = match.createMacroMatcher(definersArray);

    console.log(`[env-parser-debug] listNewEnvironments: Using definers for matcher:`, definersArray);
    let matchedNodeCount = 0;

    visit(
        tree,
        (node, info) => {
            matchedNodeCount++;
           
            const macroNode = node as Ast.Macro;
            console.log(`[env-parser-debug] listNewEnvironments: Matched and visiting macro '${macroNode.content}'. Parent type: ${info.parents[0]?.type}`);
            const spec = environmentDefiningMacroToSpec(macroNode);
            if (spec) {
                console.log(`[env-parser-debug] listNewEnvironments: Successfully created spec for '${spec.name}', signature '${spec.signature}'`);
                newEnvs.push(spec);
            } else {
                console.warn(`[env-parser-debug] listNewEnvironments: environmentDefiningMacroToSpec returned null for '${macroNode.content}'. Args:`, JSON.stringify(macroNode.args));
            }
        },
        { 
            test: (node: Ast.Ast): node is Ast.Macro => {
                if (node && !Array.isArray(node) && node.type === 'macro') {
                    const macroNode = node as Ast.Macro;
                    const isMatch = newEnvironmentMatcher(macroNode);
                    return isMatch;
                }
                return false;
            }
        }
    );
    console.log(`[env-parser-debug] listNewEnvironments: Processed ${matchedNodeCount} macros that passed the matcher test.`);
    console.log(`[env-parser-debug] listNewEnvironments finished. Found ${newEnvs.length} environments.`);
    return newEnvs;
}
