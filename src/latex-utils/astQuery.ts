/**
 * AST 查询工具模块
 *
 * 此模块提供用于查询和导航 LaTeX AST 的实用函数，
 * 主要通过封装来自 `@unified-latex/unified-latex-util-visit`
 * 和 `@unified-latex/unified-latex-util-match` 的功能实现。
 */

import type { Ast } from '../types/index'; 
import {
  visit as unifiedVisit,
  VisitorResult as UnifiedVisitorResult, 
  VisitInfo as UnifiedVisitInfo, 
  Visitor as UnifiedVisitorType, // 重命名以避免与下面的 VisitorFn 混淆
  Visitors as UnifiedVisitorsType,
  VisitOptions as UnifiedVisitOptions,
  CONTINUE as UNIST_CONTINUE,
  EXIT as UNIST_EXIT, 
  SKIP as UNIST_SKIP,
} from '@unified-latex/unified-latex-util-visit';

import { match as unifiedMatchObject } from '@unified-latex/unified-latex-util-match';

// 重新导出 visit 控制符号和结果类型
export { UNIST_CONTINUE as CONTINUE, UNIST_EXIT as EXIT, UNIST_SKIP as SKIP }; 
export type VisitorResult = UnifiedVisitorResult;

/** 实际传递给访问器回调的上下文信息对象类型。 */
export type VisitInfo = UnifiedVisitInfo;

/**
 * `visit` 工具中使用的访问器函数类型。
 * @param node - 当前被访问的 AST 节点 ({@link Ast.Ast})。
 * @param info - 包含上下文信息的 {@link VisitInfo} 对象。
 * @returns 可以是 `void` (继续遍历)，或者特定的符号 (如 `EXIT`, `SKIP`) 来控制遍历行为，
 *          或者一个数字 (表示下一个要访问的同级节点的索引)。
 */
export type VisitorFn = (node: Ast.Ast, info: VisitInfo) => VisitorResult;

/** `visit` 工具的选项接口，可包含 test 函数 */
export type VisitOptions = UnifiedVisitOptions<Ast.Ast>;

/**
 * 使用访问器函数遍历 AST (抽象语法树) 中的节点。
 * 此函数是对 `@unified-latex/unified-latex-util-visit` 中 `visit` 函数的直接封装。
 * 
 * @param tree - 要遍历的 AST (通常是 {@link Ast.Root} 节点，但可以是任何 {@link Ast.Ast} 节点)。
 * @param visitor - 访问器函数 ({@link VisitorFn}) 或包含 `enter` 和/或 `leave` 访问器的对象。
 * @param options - (可选) {@link VisitOptions} 配置对象，可包含 `test` 函数 (`(node, info) => boolean`) 等。
 */
export function visit(
    tree: Ast.Ast,
    visitor: VisitorFn | { enter?: VisitorFn; leave?: VisitorFn },
    options?: VisitOptions
): void {
    let adaptedVisitor: UnifiedVisitorType<Ast.Ast> | UnifiedVisitorsType<Ast.Ast>;

    if (typeof visitor === 'function') {
        const singleVisitorFn = visitor; 
        adaptedVisitor = (node: Ast.Ast, info: UnifiedVisitInfo): VisitorResult => {
            return singleVisitorFn(node, info); 
        };
    } else {
        adaptedVisitor = {};
        if (visitor.enter) {
            const enterFn = visitor.enter;
            (adaptedVisitor as UnifiedVisitorsType<Ast.Ast>).enter = (node: Ast.Ast, info: UnifiedVisitInfo): VisitorResult => {
                return enterFn(node, info);
            };
        }
        if (visitor.leave) {
            const leaveFn = visitor.leave;
            (adaptedVisitor as UnifiedVisitorsType<Ast.Ast>).leave = (node: Ast.Ast, info: UnifiedVisitInfo): VisitorResult => {
                return leaveFn(node, info);
            };
        }
    }
    // 调用实际的 visit 函数, options 可以直接传递
    // console.log("[DEBUG] [astQuery.visit] Calling unifiedVisit with adaptedVisitor and options:", adaptedVisitor, options);
    unifiedVisit(tree, adaptedVisitor, options);
}


// --- 匹配相关 --- 
export type Matcher = (node: Ast.Ast | undefined | null) => boolean;
export const match = {
    string: (node: Ast.Ast | undefined | null, content?: string): node is Ast.String => {
        return unifiedMatchObject.isString(node) && (content === undefined || node.content === content);
    },
    macro: (node: Ast.Ast | undefined | null, name?: string | string[]): node is Ast.Macro => {
        return unifiedMatchObject.isMacro(node) && 
               (name === undefined || 
                (typeof name === 'string' && node.content === name) || 
                (Array.isArray(name) && name.includes(node.content)));
    },
    environment: (node: Ast.Ast | undefined | null, name?: string | string[]): node is Ast.Environment => {
        return unifiedMatchObject.isEnvironment(node) &&
               (name === undefined ||
                (typeof name === 'string' && node.env === name) ||
                (Array.isArray(name) && name.includes(node.env)));
    },
    group: (node: Ast.Ast | undefined | null): node is Ast.Group => {
        return unifiedMatchObject.isGroup(node);
    },
    createMacroMatcher: (names: string | string[] | Set<string>): Matcher => {
      return unifiedMatchObject.createMacroMatcher(names);
    },
    createEnvironmentMatcher: (names: string | string[] | Set<string>): Matcher => {
      return unifiedMatchObject.createEnvironmentMatcher(names);
    }
};

export function createMacroMatcher(names: string | string[] | Set<string>): Matcher {
  return unifiedMatchObject.createMacroMatcher(names);
}
export function createEnvironmentMatcher(names: string | string[] | Set<string>): Matcher {
  return unifiedMatchObject.createEnvironmentMatcher(names);
} 