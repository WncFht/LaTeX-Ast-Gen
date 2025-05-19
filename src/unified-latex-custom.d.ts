/**
 * 为unified-latex相关模块声明类型
 */

// 宏处理功能
declare module '@unified-latex/unified-latex-util-macros' {
  import * as Ast from '@unified-latex/unified-latex-types';
  
  /**
   * 新命令规范
   */
  export interface NewCommandSpec {
    name: string;
    signature: string;
    body: Ast.Node[];
    definition: Ast.Macro;
  }
  
  /**
   * 提取AST中定义的所有newcommand等宏命令
   * @param tree AST树
   * @returns 宏定义数组
   */
  export function listNewcommands(tree: Ast.Ast): NewCommandSpec[];
  
  /**
   * 根据指定宏列表展开AST中的宏
   * @param tree AST树
   * @param macros 宏列表
   */
  export function expandMacros(tree: Ast.Ast, macros: { name: string; body: Ast.Node[] }[]): void;
}

// AST遍历功能
declare module '@unified-latex/unified-latex-util-visit' {
  import * as Ast from '@unified-latex/unified-latex-types';
  
  /**
   * 访问器信息
   */
  export interface VisitorInfo {
    parents: Ast.Node[];
    index: number;
    siblings: Ast.Node[];
  }
  
  /**
   * 访问AST树中的节点
   * @param tree AST树
   * @param visitor 访问器函数
   * @param options 可选的访问器选项
   */
  export function visit(
    tree: Ast.Ast, 
    visitor: (node: Ast.Node, info: VisitorInfo) => void | boolean,
    options?: { test?: Function, includeArrays?: boolean }
  ): void;
}

// 节点匹配功能
declare module '@unified-latex/unified-latex-util-match' {
  import * as Ast from '@unified-latex/unified-latex-types';
  
  interface Matcher {
    (node: Ast.Node): boolean;
  }
  
  export interface MatchUtils {
    string: (node: Ast.Node, content?: string) => boolean;
    anyMacro: (node: Ast.Node) => boolean;
    macro: (node: Ast.Node, name: string) => boolean;
    createMacroMatcher: (names: string[] | Set<string>) => Matcher;
  }
  
  export const match: MatchUtils;
} 