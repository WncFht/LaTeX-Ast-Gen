/**
 * 文件解析器模块
 * 解析单个LaTeX源文件，提取AST、宏定义和文件引用
 */

import * as path from 'path';
import { getParser } from '@unified-latex/unified-latex-util-parse';
import { attachMacroArgs } from '@unified-latex/unified-latex-util-arguments';
import * as utils from './utils';
import type * as Ast from '@unified-latex/unified-latex-types';
import { InternalFileParseResult } from './types';
import { MacroHandler } from './macroHandler';
import { visit } from '@unified-latex/unified-latex-util-visit';

/**
 * 文件解析器类
 * 处理单个LaTeX文件的解析
 */
export class FileParser {
  /**
   * 对项目级宏处理器的引用，用于在文件解析过程中更新和查询全局宏状态
   * @private
   */
  private projectMacroHandlerRef: MacroHandler;

  /**
   * 创建一个新的FileParser实例
   * @param projectMacroHandler 对项目级MacroHandler实例的引用
   */
  constructor(projectMacroHandler: MacroHandler) {
    this.projectMacroHandlerRef = projectMacroHandler;
  }

  /**
   * 解析指定的LaTeX文件。
   * 此方法会：
   * 1. 读取文件内容。
   * 2. 使用当前项目已知的宏进行初步的AST解析和参数附加。
   * 3. 从当前文件的AST中提取明确定义的宏 (如 \\newcommand) 并更新到项目级宏处理器。
   * 4. 从当前文件的AST中提取使用但未知的宏，并尝试推断其签名，然后更新到项目级宏处理器。
   * 5. 使用更新后的、最完整的宏记录对当前文件的AST再次进行参数附加。
   * 6. 提取此文件包含的其他文件。
   * 
   * @param filePath 要解析的文件的绝对路径
   * @returns 包含AST、从此文件新发现/定义的宏、以及包含的文件的解析结果
   */
  public async parseFile(
    filePath: string,
  ): Promise<InternalFileParseResult> {
    try {
      const content = await utils.readFileAsync(filePath);
      
      // 1. 使用当前项目已知的宏进行初步的AST解析和参数附加
      const initialMacrosForAttachment = this.projectMacroHandlerRef.getMacrosForAttachment();
      const ast = this.parseLatexContent(content, initialMacrosForAttachment);
      
      if (ast) {
        const baseDir = path.dirname(filePath);
        
        // 2. 提取文档中定义的宏 (\\newcommand 等)
        const definedInThisFile = this.projectMacroHandlerRef.extractDefinedMacros(ast);
        // 将这些宏添加到项目级宏处理器的 definedInDocMacros 记录中
        this.projectMacroHandlerRef.addDefinedInDocMacros(definedInThisFile);
        
        // 3. 提取AST中使用的、但仍然未知的宏（推断其签名）
        // extractUsedCustomMacros 内部会使用 getMacrosForAttachment 来获取最新的已知宏列表
        // 因此它只会推断那些在默认、用户提供、或已在文档中定义的宏之外的宏
        const inferredInThisFile = this.projectMacroHandlerRef.extractUsedCustomMacros(ast);
        // 将这些推断出的宏添加到项目级宏处理器的 inferredUsedMacros 记录中
        this.projectMacroHandlerRef.addInferredUsedMacros(inferredInThisFile);

        // 4. 使用更新最全的宏定义（包含本文件新发现的），对当前文件的 AST 再次附加参数
        // 这一步确保了在同一文件中，定义在后的宏也能作用于定义之前的调用（如果适用）
        const finalMacrosForAttachment = this.projectMacroHandlerRef.getMacrosForAttachment();
        this.reattachMacroArgs(ast, finalMacrosForAttachment);
        
        // 5. 提取此文件包含的其他文件
        const includedFiles = this.extractIncludedFiles(ast, baseDir);
        
        return {
          ast,
          // 返回从此文件新发现/定义的宏，ProjectParser 可以选择是否使用此信息，
          // 主要的宏状态更新已经通过引用作用于 projectMacroHandlerRef
          newMacros: { ...definedInThisFile, ...inferredInThisFile }, 
          includedFiles
        };
      } else {
        // 解析失败，返回null AST
        return {
          ast: null,
          newMacros: {},
          includedFiles: [],
          error: `文件 ${filePath} 解析失败`
        };
      }
    } catch (error) {
      // 处理文件读取或解析错误
      return {
        ast: null,
        newMacros: {},
        includedFiles: [],
        error: `处理文件 ${filePath} 时出错: ${(error as Error).message}`
      };
    }
  }

  /**
   * 解析LaTeX文本内容为AST，并进行初步的宏参数附加。
   * 
   * @param content LaTeX文本内容
   * @param macrosForAttachment 用于此次参数附加的宏定义记录
   * @returns 解析得到的AST，如果解析失败则为null
   * @private
   */
  private parseLatexContent(content: string, macrosForAttachment: Ast.MacroInfoRecord): Ast.Root | null {
    try {
      // 创建解析器实例，启用 expl3 和 @-letter 宏的自动检测
      const parser = getParser({ 
        flags: { autodetectExpl3AndAtLetter: true } 
      });
      
      // 解析内容为AST
      const ast = parser.parse(content);
      
      // 进行参数附加
      this.reattachMacroArgs(ast, macrosForAttachment);
      
      return ast;
    } catch (error) {
      console.error(`解析LaTeX内容 '${content.substring(0,100)}...' 时出错:`, error);
      return null;
    }
  }

  /**
   * 将宏参数附加到AST。
   * 这是一个辅助方法，封装了 attachMacroArgs 的调用和错误处理。
   * 
   * @param ast LaTeX AST
   * @param macroRecord 宏定义记录
   * @private
   */
  private reattachMacroArgs(ast: Ast.Root, macroRecord: Ast.MacroInfoRecord): void {
    try {
      // 附加宏参数
      attachMacroArgs(ast, macroRecord);
    } catch (error) {
      // 参数附加失败通常不应中断整个文件解析，因此只记录警告
      console.warn(`附加宏参数时出错: ${(error as Error).message}`);
    }
  }

  /**
   * 从AST中提取通过 \\input, \\include, \\subfile 等命令包含的文件。
   * 会解析相对路径并尝试添加 .tex 扩展名（如果缺失）。
   * 
   * @param ast LaTeX AST
   * @param baseDir 当前文件所在的目录，用于解析相对路径
   * @returns 包含文件信息的数组，每个对象包含规范化路径、原始命令和原始路径
   * @private
   */
  private extractIncludedFiles(
    ast: Ast.Root,
    baseDir: string
  ): { path: string; command: string; rawPath: string }[] {
    const includedFiles: { path: string; command: string; rawPath: string }[] = [];
    const includeCommands = ['input', 'include', 'subfile']; // 支持的包含文件命令
    
    visit(ast, (node) => { // 移除 Ast.Node 类型注解，让 visit 推断
      if (node.type !== 'macro') return;
      
      const macroNode = node as Ast.Macro;
      if (includeCommands.includes(macroNode.content)) {
        if (!macroNode.args || macroNode.args.length < 1) return;
        
        const firstArg = macroNode.args[0];
        if (!firstArg || firstArg.type !== 'argument') return;
        
        let rawPath = '';
        
        // 提取路径字符串
        if (Array.isArray(firstArg.content)) {
          // 如果内容是数组，将其转换为字符串
          rawPath = firstArg.content
            .map((n) => { // 移除 Ast.Node 类型注解，让 map 推断
              if (n.type === 'string') return (n as Ast.String).content;
              // 可以根据需要处理其他节点类型，如宏节点
              return ''; 
            })
            .join('');
        } else if (typeof (firstArg.content as any) === 'string') { // Should not happen based on types, but as a fallback
          rawPath = firstArg.content as unknown as string;
        }
        
        if (!rawPath) return;
        
        // 解析相对路径
        let resolvedPath = utils.resolvePath(baseDir, rawPath);
        if (!path.extname(resolvedPath) && !resolvedPath.endsWith('.')) {
          resolvedPath += '.tex';
        }
        
        // 规范化路径
        const normalizedPath = utils.normalizePath(resolvedPath);
        
        // 添加到包含文件列表
        includedFiles.push({
          path: normalizedPath,
          command: macroNode.content,
          rawPath: rawPath
        });
      }
    });
    
    return includedFiles;
  }
} 