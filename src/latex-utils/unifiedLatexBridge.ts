/**
 * Unified LaTeX 工具桥接模块
 *
 * 此模块作为与 `unified-latex` 生态系统库交互的桥梁或外观 (Facade)。
 * 它集中了对 `unified-latex` 相关工具的调用，例如解析、附加宏参数、处理环境等。
 * 这有助于将对这些工具的直接依赖从核心解析逻辑中抽象出来，
 * 便于未来管理更新或替换底层库。
 */

import type { Ast } from '../types/index'; // Assuming Ast types (like Root, MacroInfoRecord, EnvInfoRecord) are exported from here
import { getParser as getUnifiedLatexParser } from '@unified-latex/unified-latex-util-parse';
import { attachMacroArgs as unifiedAttachMacroArgs } from '@unified-latex/unified-latex-util-arguments';
import { processEnvironments as unifiedProcessEnvironments } from '@unified-latex/unified-latex-util-environments';
import { printRaw as unifiedPrintRaw } from '@unified-latex/unified-latex-util-print-raw';

/**
 * LaTeX 解析器创建选项。
 * 如果需要更多来自 `unified-latex-util-parse` 的特定解析器标志，可以扩展此接口。
 */
export interface ParserCreationOptions {
  flags?: {
    autodetectExpl3AndAtLetter?: boolean; // 是否自动检测 expl3 和 @letter 语法
    // 可根据 unified-latex 文档添加其他标志
  };
  // 可添加其他解析器选项（如果可用/需要）
}

/**
 * 表示从 `unified-latex-util-parse` 获取的原始解析器接口。
 */
export interface RawLatexParser {
  /**
   * 解析给定的 LaTeX 字符串内容。
   * @param content - 要解析的 LaTeX 字符串。
   * @returns 解析生成的 AST 根节点 ({@link Ast.Root})。
   */
  parse: (content: string) => Ast.Root;
}

/**
 * 从 `unified-latex-util-parse` 获取一个原始 LaTeX 解析器实例。
 * @param options - (可选) 解析器的配置选项 {@link ParserCreationOptions}。
 * @returns 一个原始 LaTeX 解析器，能够将字符串解析为 AST。
 */
export function getParser(options?: ParserCreationOptions): RawLatexParser {
  return getUnifiedLatexParser(options);
}

/**
 * 根据提供的宏信息记录 ({@link Ast.MacroInfoRecord})，将参数附加到 AST 中的宏节点上。
 * 此函数是对 `unified-latex-util-arguments::attachMacroArgs` 的封装。
 * 注意：AST 会被原地修改。
 * @param ast - 要处理的 LaTeX AST ({@link Ast.Root} 节点)。
 * @param macros - 包含已知宏及其签名的记录。
 */
export function attachMacroArgs(ast: Ast.Root, macros: Ast.MacroInfoRecord): void {
  unifiedAttachMacroArgs(ast, macros);
}

/**
 * 根据提供的环境信息记录 ({@link Ast.EnvInfoRecord})，处理 AST 中的环境，
 * 包括附加参数和处理其内容。
 * 此函数是对 `unified-latex-util-environments::processEnvironments` 的封装。
 * 注意：AST 会被原地修改。
 * @param ast - 要处理的 LaTeX AST ({@link Ast.Root} 节点)。
 * @param environments - 包含已知环境签名和处理器的记录。
 */
export function processEnvironments(ast: Ast.Root, environments: Ast.EnvInfoRecord): void {
  unifiedProcessEnvironments(ast, environments);
}

/**
 * 将一个 AST 节点或 AST 节点数组转换为其原始的 LaTeX 字符串表示形式。
 * 此函数是对 `unified-latex-util-print-raw::printRaw` 的封装。
 * @param nodes - 要字符串化的 AST 节点 ({@link Ast.Ast}) 或 AST 节点数组 ({@link Ast.Ast[]})。
 * @returns 原始的 LaTeX 字符串表示。
 */
export function printRaw(nodes: Ast.Ast | Ast.Ast[]): string {
  // TODO: (中文) 审查此类型断言。我们的 Ast.Ast 类型与 unifiedPrintRaw 精确期望的类型 (Printable) 之间可能存在细微不匹配。
  return unifiedPrintRaw(nodes as any);
} 