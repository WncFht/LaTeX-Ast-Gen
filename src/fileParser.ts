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
   * 宏处理器实例
   * @private
   */
  private macroHandler: MacroHandler;

  /**
   * 创建一个新的FileParser实例
   */
  constructor() {
    this.macroHandler = new MacroHandler();
  }

  /**
   * 解析指定的LaTeX文件
   * 
   * @param filePath 要解析的文件的绝对路径
   * @param currentMacroRecord 当前已知的宏定义集合
   * @returns 包含AST、新宏定义和包含的文件的解析结果
   */
  public async parseFile(
    filePath: string,
    currentMacroRecord: Ast.MacroInfoRecord
  ): Promise<InternalFileParseResult> {
    try {
      // 读取文件内容
      const content = await utils.readFileAsync(filePath);
      
      // 创建宏处理器并加载当前宏
      this.macroHandler = new MacroHandler();
      this.macroHandler.addMacros(currentMacroRecord);
      
      // 解析AST
      const ast = this.parseLatexContent(content);
      
      // 如果解析成功，提取新宏和包含的文件
      if (ast) {
        const baseDir = path.dirname(filePath);
        
        // 提取文档中定义的宏
        const definedMacros = this.macroHandler.extractDefinedMacros(ast);
        
        // 提取AST中使用的自定义宏
        const usedCustomMacros = this.macroHandler.extractUsedCustomMacros(ast);
        
        // 合并宏定义
        const newMacros: Ast.MacroInfoRecord = { ...usedCustomMacros, ...definedMacros };
        
        // 将新发现的宏添加回去，以便后续处理
        this.macroHandler.addMacros(newMacros);
        
        // 再次附加宏参数，使用更新后的宏定义
        const fullMacros = this.macroHandler.getCurrentMacros();
        this.reattachMacroArgs(ast, fullMacros);
        
        const includedFiles = this.extractIncludedFiles(ast, baseDir);
        
        return {
          ast,
          newMacros,
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
   * 解析LaTeX文本内容为AST
   * 
   * @param content LaTeX文本内容
   * @returns 解析得到的AST，如果解析失败则为null
   * @private
   */
  private parseLatexContent(content: string): Ast.Root | null {
    try {
      // 创建解析器实例，参考LaTeX-Workshop的实现
      const parser = getParser({ 
        flags: { autodetectExpl3AndAtLetter: true } 
      });
      
      // 解析内容为AST
      const ast = parser.parse(content);
      
      // 获取当前宏定义
      const macroRecord = this.macroHandler.getCurrentMacros();
      
      // 附加宏参数
      this.reattachMacroArgs(ast, macroRecord);
      
      return ast;
    } catch (error) {
      console.error('解析LaTeX内容时出错:', error);
      return null;
    }
  }

  /**
   * 将宏参数附加到AST
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
      console.warn('附加宏参数时出错:', error);
    }
  }

  /**
   * 从AST中提取包含的文件
   * 
   * @param ast LaTeX AST
   * @param baseDir 基础目录路径
   * @returns 包含文件信息的数组
   * @private
   */
  private extractIncludedFiles(
    ast: Ast.Root,
    baseDir: string
  ): { path: string; command: string; rawPath: string }[] {
    const includedFiles: { path: string; command: string; rawPath: string }[] = [];
    
    // 包含文件的命令列表
    const includeCommands = ['input', 'include', 'subfile'];
    
    // 使用unified-latex的visit函数访问AST中的所有宏节点
    visit(ast, (node: any) => {
      // 只处理宏节点
      if (node.type !== 'macro') return;
      
      // 检查是否是包含文件的命令
      if (includeCommands.includes(node.content)) {
        // 确保节点有args属性
        if (!node.args || node.args.length < 1) return;
        
        // 提取文件路径
        const firstArg = node.args[0];
        if (!firstArg || firstArg.type !== 'argument') return;
        
        let rawPath = '';
        
        // 提取路径字符串
        if (Array.isArray(firstArg.content)) {
          // 如果内容是数组，将其转换为字符串
          rawPath = firstArg.content
            .map((n: any) => {
              if (typeof n === 'string') return n;
              if (n.type === 'string' && 'content' in n) return n.content;
              return '';
            })
            .join('');
        } else if (typeof firstArg.content === 'string') {
          // 如果内容是字符串，直接使用
          rawPath = firstArg.content;
        }
        
        if (!rawPath) return;
        
        // 解析相对路径
        let resolvedPath = utils.resolvePath(baseDir, rawPath);
        
        // 如果没有扩展名，尝试添加.tex
        if (!path.extname(resolvedPath)) {
          resolvedPath += '.tex';
        }
        
        // 规范化路径
        const normalizedPath = utils.normalizePath(resolvedPath);
        
        // 添加到包含文件列表
        includedFiles.push({
          path: normalizedPath,
          command: node.content,
          rawPath: rawPath
        });
      }
    });
    
    return includedFiles;
  }
} 