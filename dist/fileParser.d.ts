/**
 * 文件解析器模块
 * 解析单个LaTeX源文件，提取AST、宏定义和文件引用
 */
import type * as Ast from '@unified-latex/unified-latex-types';
import { InternalFileParseResult } from './types';
/**
 * 文件解析器类
 * 处理单个LaTeX文件的解析
 */
export declare class FileParser {
    /**
     * 解析指定的LaTeX文件
     *
     * @param filePath 要解析的文件的绝对路径
     * @param currentMacroRecord 当前已知的宏定义集合
     * @returns 包含AST、新宏定义和包含的文件的解析结果
     */
    parseFile(filePath: string, currentMacroRecord: Ast.MacroInfoRecord): Promise<InternalFileParseResult>;
    /**
     * 解析LaTeX文本内容为AST
     *
     * @param content LaTeX文本内容
     * @param macroRecord 宏定义记录
     * @returns 解析得到的AST，如果解析失败则为null
     * @private
     */
    private parseLatexContent;
    /**
     * 从AST中提取新定义的宏
     *
     * @param ast LaTeX AST
     * @returns 新宏定义的记录
     * @private
     */
    private extractNewMacros;
    /**
     * 访问AST中的所有宏节点
     *
     * @param node AST节点
     * @param callback 回调函数
     */
    private visitMacros;
    /**
     * 处理newcommand或renewcommand宏定义
     *
     * @param node 宏节点
     * @param macros 宏定义记录
     * @private
     */
    private processMacroDefinition;
    /**
     * 处理DeclareMathOperator宏定义
     *
     * @param node 宏节点
     * @param macros 宏定义记录
     * @private
     */
    private processMathOperator;
    /**
     * 从AST中提取包含的文件
     *
     * @param ast LaTeX AST
     * @param baseDir 基础目录路径
     * @returns 包含文件信息的数组
     * @private
     */
    private extractIncludedFiles;
}
