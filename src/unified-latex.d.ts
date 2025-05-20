/**
 * 为 `unified-latex` 相关模块及项目内部可能使用的旧 `unified.js` 声明 TypeScript 类型定义。
 * 本文件整合并规范化了原项目中多个 `.d.ts` 文件的内容。
 * 主要目标是为本项目使用的 `unified-latex` 工具链部分提供准确的类型信息，
 * 同时处理与旧有本地脚本 (如 `resources/unified.js`) 可能存在的类型兼容性问题。
 */

//----------------------------------------------------------------------
// 为本地/遗留的 unified.js (位于 ../resources/unified.js) 提供的类型声明
// 注意：这部分可能与最新的 @unified-latex/unified-latex-types 中的类型有差异。
//----------------------------------------------------------------------
declare module '../resources/unified.js' {
  // 此模块内 Node 的基础类型定义
  export interface Node {
    type: string;
  }

  export interface Root extends Node {
    type: 'root';
    content: Node[];
  }

  export interface Macro extends Node {
    type: 'macro';
    content: string; // 宏名称
    args?: Argument[]; // 宏参数
  }

  export interface String extends Node {
    type: 'string';
    content: string;
  }

  export interface Argument extends Node {
    type: 'argument';
    content: (Node | string)[] | string; // 参数内容可以是节点数组或简单字符串
  }

  // 这些是为本地 unified.js 简化的信息记录类型。
  // @unified-latex/unified-latex-types 提供了更完整的版本。
  export interface MacroInfoRecord {
    [key: string]: {
      signature: string;
    };
  }

  export interface EnvInfoRecord {
    [key: string]: {
      signature?: string;
    };
  }

  export function getParser(options?: any): { parse: (content: string) => Root };
  export function attachMacroArgs(ast: Root, macros: MacroInfoRecord): void;
  export function toString(ast: Node): string;
}

//----------------------------------------------------------------------
// 为 @unified-latex/unified-latex-types 核心包声明的类型
// (通常这些类型应该由库本身提供，这里的声明是为了确保项目内部一致性或补充)
//----------------------------------------------------------------------
declare module '@unified-latex/unified-latex-types' {
  /**
   * AST 节点的基础接口 (LaTeX AST 中任何部分的基础类型)。
   */
  export interface Ast {
    type: string;
    position?: Position; // 节点在源文件中的位置信息
    /** 特定节点类型可能存在的其他属性 */
    [key: string]: any;
  }

  /**
   * 位置信息 (AST 节点在源文件中的位置)。
   */
  export interface Position {
    start: Point;
    end: Point;
  }

  /**
   * 位置点 (源文件中的一个特定点)。
   */
  export interface Point {
    line: number;    // 1-基于索引的行号
    column: number;  // 1-基于索引的列号
    offset: number;  // 0-基于索引的字符偏移量
  }

  /**
   * 根节点 (LaTeX AST 的根)。
   */
  export interface Root extends Ast {
    type: 'root';
    content: Ast[]; // 内容是 Ast 节点的数组
  }

  /**
   * 宏节点 (表示一个 LaTeX 宏, 例如 `\foo`)。
   */
  export interface Macro extends Ast {
    type: 'macro';
    content: string; // 宏的名称 (例如 "foo")
    args?: Argument[]; // 宏参数
  }

  /**
   * 参数节点 (表示 LaTeX 宏或环境的参数)。
   */
  export interface Argument extends Ast {
    type: 'argument';
    openMark: string;  // 参数的开始标记, 例如 "{", "["
    closeMark: string; // 参数的结束标记, 例如 "}", "]"
    content: Ast[];    // 内容是 Ast 节点的数组
  }

  /**
   * 字符串节点 (表示 LaTeX 中的普通文本字符串)。
   */
  export interface String extends Ast {
    type: 'string';
    content: string;
  }
  
  /**
   * 表示空白字符的节点。
   */
  export interface Whitespace extends Ast {
    type: "whitespace";
  }

  /**
   * 表示注释的节点。
   */
  export interface Comment extends Ast {
    type: "comment";
    content: string; // 注释内容，不含开头的 %
    leadingWhitespace?: boolean; // 同一行注释前是否有空白
    suffixParbreak?: boolean;    // 注释是否以 \n\n 序列结束
  }

  /**
   * 表示内联数学环境内容的节点 (例如 `$ ... $` 或 `\( ... \)` 中的内容)。
   */
  export interface Inlinemath extends Ast {
    type: "inlinemath";
    content: Ast[]; // 通常是字符串，但可以是更复杂的数学 AST 结构
  }

  /**
   * 表示独立数学环境的节点 (例如 `$$ ... $$` 或 `\[ ... \]`)。
   */
  export interface Displaymath extends Ast {
    type: "displaymath";
    content: Ast[];
  }

  /**
   * 表示 LaTeX 环境的节点 (例如 `\begin{foo} ... \end{foo}`)。
   */
  export interface Environment extends Ast {
    type: "environment";
    env: string; // 环境的名称 (例如 "foo")
    args?: Argument[]; // 环境参数
    content: Ast[];   // 环境内容
  }
  
  /**
   * 表示由花括号 `{ ... }` 包围的组。
   */
  export interface Group extends Ast {
    type: "group";
    content: Ast[];
  }
  
  /**
   * 表示 \verb|...| 命令的节点。
   */
  export interface Verb extends Ast {
    type: "verb";
    content: string; // 原始文本内容
    escape: string;  // 用作定界符的字符，例如 "|" 或 "+"
  }

  /**
   * 表示 verbatim 环境 (例如 \begin{verbatim} ... \end{verbatim}) 或类似环境的节点。
   * 通常，它会被解析为一个具有特定 `env` 值的 `Ast.Environment`，
   * 但有时解析器可能将其特殊处理为具有字符串内容的类型。
   * 为简单起见，我们假设它是一个有 `content: string` 的特殊环境类型，
   * 或者是一个 `env` 为 "verbatim" 的标准 `Ast.Environment`，其 `content` 内只有一个字符串节点。
   * 为了更准确，我们这里定义一个 VerbatimEnvironment，但实际应用时需根据解析器行为调整。
   */
  export interface VerbatimEnvironment extends Ast {
    type: "verbatim"; // 或者可能是 "environment"，然后检查 env 字段
    env: string; // 例如 "verbatim", "lstlisting"
    content: string; // 原始文本内容，与标准 Environment 的 Ast.Ast[] content 不同
    args?: Argument[]; // lstlisting 等环境可能有参数
  }

  /**
   * 表示数学模式中的上标或下标节点。
   */
  export interface Superscript extends Ast {
    type: "superscript"; 
    content: Ast[]; // 基底内容
    argument: Ast;  // 上标内容本身 (通常是一个组或单个字符)
  }
  
  export interface Subscript extends Ast {
    type: "subscript";
    content: Ast[]; 
    argument: Ast; 
  }

  /**
   * 宏信息记录类型 (已知宏及其签名的记录表)。
   */
  export interface MacroInfoRecord {
    [macroName: string]: {
      signature: string;  // 参数签名，例如 "m o o"
      renderInfo?: any;  // 供添加渲染信息的插件使用
    };
  }

  /**
   * 环境信息记录类型 (已知环境及其签名的记录表)。
   */
  export interface EnvInfoRecord {
    [envName: string]: EnvInfo; // 值是 EnvInfo 对象
  }

  /**
   * 单个环境的信息。
   */
  export interface EnvInfo {
    signature: string; // 参数签名，例如 "m o O{默认值}"
    renderInfo?: any;  // 供渲染使用
    processContent?: (nodes: Ast.Ast[], env: Ast.Environment) => Ast.Ast[]; // (可选) 用于处理此环境类型内容的函数
  }
}

//----------------------------------------------------------------------
// 为 @unified-latex/… 工具包声明的类型
//----------------------------------------------------------------------
declare module '@unified-latex/unified-latex-util-macros' {
  import * as Ast from '@unified-latex/unified-latex-types';

  /**
   * `listNewcommands` 函数返回的原始新命令规范。
   * (注意：与项目内部 `src/types/index.ts` 中的 `NewCommandSpec` 对应或保持兼容)
   */
  export interface UtilNewCommandSpec {
    name: string;         // 命令名称，例如 "\foo"
    signature: string;    // 参数签名，例如 "m o m"
    body: Ast.Ast[];      // 命令体的 AST 节点数组
    definition: Ast.Macro; // 定义此命令的原始宏节点
  }

  /**
   * 从 AST 中提取所有通过 `\newcommand` 等命令定义的宏。
   */
  export function listNewcommands(tree: Ast.Ast): UtilNewCommandSpec[];

  /**
   * 根据指定的宏定义列表在 AST 中展开宏。
   */
  export function expandMacros(tree: Ast.Ast, macros: { name: string; body: Ast.Ast[] }[]): void;
}

declare module '@unified-latex/unified-latex-util-visit' {
  import * as Ast from '@unified-latex/unified-latex-types';
  import { EXIT as UNIST_EXIT, SKIP as UNIST_SKIP } from 'unist-util-visit'; // 假设这些符号仍来自这里或被重导出

  export const CONTINUE: symbol;
  export const SKIP: symbol; // SKIP 也可能由本模块直接导出
  export const EXIT: symbol; // EXIT 也可能由本模块直接导出

  export type Action = typeof CONTINUE | typeof SKIP | typeof EXIT;
  export type Index = number;
  export type ActionTuple = [Action] | [typeof SKIP, Index] | [typeof CONTINUE, Index];
  export type VisitorResult = null | undefined | Action | Index | ActionTuple | void;

  /** 实际的 VisitorContext 类型，来自源码 */
  export type VisitorContext = {
    inMathMode?: boolean;
    hasMathModeAncestor?: boolean;
  };

  /** 
   * 实际的 VisitInfo 类型，作为第二个参数传递给 test 和 visitor 函数。
   * 来自源码。
   */
  export interface VisitInfo {
    readonly key: string | undefined;
    readonly index: number | undefined;
    readonly parents: (Ast.Ast)[]; // 源码是 (Ast.Node | Ast.Argument)[]，统一为 Ast.Ast
    readonly containingArray: (Ast.Ast)[] | undefined; // 源码是 (Ast.Node | Ast.Argument)[]
    readonly context: VisitorContext;
  }

  /** 访问器回调函数的实际类型 */
  export type Visitor<TNode extends Ast.Ast = Ast.Ast> = (
    node: TNode,
    info: VisitInfo
  ) => VisitorResult;

  /** 包含 enter 和/或 leave 访问器的对象类型 */
  export type Visitors<TNode extends Ast.Ast = Ast.Ast> = {
    enter?: Visitor<TNode>;
    leave?: Visitor<TNode>;
  };

  /** visit 函数的选项 */
  export interface VisitOptions<TNode extends Ast.Ast = Ast.Ast> {
    startingContext?: VisitorContext;
    test?: (node: TNode, info: VisitInfo) => boolean;
    includeArrays?: boolean;
  }
  
  /**
   * `VisitorTypeFromOptions` 和 `GuardFromOptions` 是内部帮助类型，我们不需要在这里精确复制，
   * 关键是 visit 函数的导出签名。
   */

  /**
   * 访问 AST 树中的节点。
   */
  export function visit<Opts extends VisitOptions<Ast.Ast>>(
    tree: Ast.Ast,
    visitor: Visitor<Ast.Ast> | Visitors<Ast.Ast>, // VisitorTypeFromOptions<Opts> 可以简化为 Ast.Ast
    options?: Opts
  ): void;
  // 为了简单，我们只声明接受 Ast.Ast 的版本，因为 VisitorTypeFromOptions<Opts> 主要用于更细致的类型推断，
  // 但对于外部声明，一个通用的 Ast.Ast 通常足够，或用户可自行传入更具体的 Opts。
}

declare module '@unified-latex/unified-latex-util-match' {
  import * as Ast from '@unified-latex/unified-latex-types';

  /** 一个测试节点是否满足某些条件的函数。 */
  export type Matcher = (node: Ast.Ast | undefined | null) => boolean;

  /** 包含各种类型守卫和匹配器创建函数的辅助对象类型。 */
  export interface UnifiedMatchHelper {
    /** 检查节点是否为特定类型的字符串节点，并可选择匹配其内容。 */
    string: (node: Ast.Ast | undefined | null, value?: string) => node is Ast.String;
    /** 检查节点是否为宏节点。 */
    anyMacro: (node: Ast.Ast | undefined | null) => node is Ast.Macro; // 通常库中可能没有 anyMacro，而是直接用 isMacro
    /** 检查节点是否为特定名称的宏节点。 */
    macro: (node: Ast.Ast | undefined | null, name?: string | string[]) => node is Ast.Macro;
    /** 检查节点是否为特定名称的环境节点。 */
    environment: (node: Ast.Ast | undefined | null, name?: string | string[]) => node is Ast.Environment;
    /** 检查节点是否为组节点。 */
    group: (node: Ast.Ast | undefined | null) => node is Ast.Group;
    // 其他可能的类型守卫或特定匹配器
    isMacro: (node: any) => node is Ast.Macro;
    isString: (node: any) => node is Ast.String;
    isGroup: (node: any) => node is Ast.Group;
    isEnvironment: (node: any) => node is Ast.Environment;

    /** 创建一个用于匹配特定宏名称的匹配器函数。 */
    createMacroMatcher: (macros: string | string[] | Set<string>) => Matcher;
    /** 创建一个用于匹配特定环境名称的匹配器函数。 */
    createEnvironmentMatcher: (envs: string | string[] | Set<string>) => Matcher;
  }

  /** 导出的 `match` 对象，包含所有匹配相关的辅助函数和类型守卫。 */
  export const match: UnifiedMatchHelper;
}

declare module '@unified-latex/unified-latex-util-arguments' {
  import * as Ast from '@unified-latex/unified-latex-types';
  /** 根据宏定义记录为 AST 中的宏附加参数。 */
  export function attachMacroArgs(ast: Ast.Ast, macros: Ast.MacroInfoRecord): void;
}

declare module '@unified-latex/unified-latex-util-environments' {
  import * as Ast from '@unified-latex/unified-latex-types';
  /** 根据环境定义记录处理 AST 中的环境（附加参数等）。 */
  export function processEnvironments(ast: Ast.Ast, environments: Ast.EnvInfoRecord): void;
}

declare module '@unified-latex/unified-latex-util-print-raw' {
  import * as Ast from '@unified-latex/unified-latex-types';
  /** 将 AST 节点或节点数组转换为其原始 LaTeX 字符串表示。 */
  export function printRaw(nodes: Ast.Ast | Ast.Ast[]): string;
}

declare module "@unified-latex/unified-latex-ctan" {
  import { EnvInfoRecord } from "@unified-latex/unified-latex-types";
  /** CTAN 包提供的环境信息，按包名组织。 */
  export const environmentInfo: Record<string, EnvInfoRecord>; 
} 