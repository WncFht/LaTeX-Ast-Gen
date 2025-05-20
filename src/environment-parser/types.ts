import * as Ast from "@unified-latex/unified-latex-types";

/**
 * 表示解析出的环境参数的详细信息。
 */
export interface EnvironmentParameter {
    /** 参数的类型 */
    type: 'mandatory' | 'optional' | 'optionalStar' | 'until'; // 根据需要可以扩展更多类型，如 xparse 的 'd', 'D', 'r', 'R', 'l', 'L', 't', 'T', 'u'
    /** 参数的原始规范字符或字符串，例如 'm', 'o', 's', 'u{\\foo}' */
    rawSpecifier?: string;
    /** 可选参数的默认值内容 (AST节点数组) */
    defaultValue?: Ast.Ast[];
}

/**
 * 表示一个新定义的环境的规范。
 */
export interface NewEnvironmentSpec {
    /** 环境的名称 */
    name: string;
    /** 
     * 环境参数的字符串表示形式 (例如 "m o", "O{default} m").
     * 这是提供给 unified-latex-util-arguments/gobbleArguments 的签名。
     */
    signature: string;
    /** 
     * (可选) 解析出的更结构化的参数信息列表。
     * 用于更精细的分析或处理，例如区分带默认值的可选参数和不带默认值的可选参数。
     */
    parameters?: EnvironmentParameter[];
    /** 定义此环境的原始宏节点 */
    definitionMacro: Ast.Macro;
    /** 用于定义此环境的命令的名称 (例如, "newenvironment", "newtcolorbox", "newtheorem") */
    definingCommand: string;
    /** (可选) 开始环境时执行的代码的 AST 节点 (主要用于 \newenvironment) */
    beginCode?: Ast.Ast[];
    /** (可选) 结束环境时执行的代码的 AST 节点 (主要用于 \newenvironment) */
    endCode?: Ast.Ast[];
    /** (可选) 对于定理类环境，这里可以存放其显示的标题 (例如 "Theorem", "Lemma") */
    theoremTitle?: string;
    /** (可选) 对于 tcolorbox，这里可以存放其键值对选项的解析结果 (具体类型待定) */
    tcolorboxOptions?: any; 
    /** (可选) 包来源，例如 "latex2e", "amsthm", "tcolorbox", "enumitem" */
    packageSource?: string;
}
