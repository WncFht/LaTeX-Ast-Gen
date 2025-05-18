/**
 * 宏处理器模块
 * 负责在整个项目解析生命周期中管理LaTeX宏定义
 */

import * as utils from './utils';
import { ParserOptions } from './types';

/**
 * 宏处理器类
 * 管理项目中的LaTeX宏定义
 */
export class MacroHandler {
  /**
   * 存储所有已知宏定义的记录
   */
  private macroRecord: Record<string, { signature: string }>;

  /**
   * 创建一个新的MacroHandler实例
   * @param options 解析器选项
   */
  constructor(options?: ParserOptions) {
    this.macroRecord = {};

    if (!options) {
      this.macroRecord = this.loadDefaultMacros();
      return;
    }

    // 加载默认宏
    if (options.loadDefaultMacros !== false) {
      this.macroRecord = this.loadDefaultMacros();
    }

    // 合并自定义宏记录（优先级高）
    if (options.customMacroRecord) {
      this.addMacros(options.customMacroRecord);
    }

    // 从文件加载宏（如果提供）
    if (options.macrosFile) {
      this.loadExternalMacrosFromFile(options.macrosFile)
        .then(macros => {
          if (macros) {
            this.addMacros(macros);
          }
        })
        .catch(error => {
          console.error(`加载宏定义文件失败: ${error.message}`);
        });
    }
  }

  /**
   * 添加新的宏定义到现有记录
   * @param newMacros 新的宏定义记录
   */
  public addMacros(newMacros: Record<string, { signature: string }>): void {
    for (const [macroName, macroInfo] of Object.entries(newMacros)) {
      this.macroRecord[macroName] = macroInfo;
    }
  }

  /**
   * 获取当前所有宏定义的副本
   * @returns 宏定义记录的深拷贝
   */
  public getCurrentMacros(): Record<string, { signature: string }> {
    return JSON.parse(JSON.stringify(this.macroRecord));
  }

  /**
   * 加载预定义的常用LaTeX宏
   * @returns 预定义宏的记录
   * @private
   */
  private loadDefaultMacros(): Record<string, { signature: string }> {
    // 预定义常用LaTeX宏参数规范
    // 这些宏定义改编自LaTeX-Workshop的src/parse/parser/unified-defs.ts
    return {
      // 基础文档结构命令
      'documentclass': { signature: 'o m' },
      'usepackage': { signature: 'o m' },
      'input': { signature: 'm' },
      'include': { signature: 'm' },
      'subfile': { signature: 'm' },
      
      // 常用格式化命令
      'textbf': { signature: 'm' },
      'textit': { signature: 'm' },
      'texttt': { signature: 'm' },
      'underline': { signature: 'm' },
      'emph': { signature: 'm' },
      
      // 数学环境命令
      'mathbb': { signature: 'm' },
      'mathbf': { signature: 'm' },
      'mathcal': { signature: 'm' },
      'mathrm': { signature: 'm' },
      'frac': { signature: 'm m' },
      'sqrt': { signature: 'o m' },
      
      // 常用的宏定义
      'newcommand': { signature: 'm o o m' },
      'renewcommand': { signature: 'm o o m' },
      'DeclareMathOperator': { signature: 'm m' },
      'DeclarePairedDelimiter': { signature: 'm m m' },
      
      // 常用表格和环境命令
      'begin': { signature: 'm o' },
      'end': { signature: 'm' },
      'item': { signature: 'o' },
      
      // 引用和索引
      'label': { signature: 'm' },
      'ref': { signature: 'm' },
      'cite': { signature: 'o m' },
      'bibliography': { signature: 'm' },
      'bibliographystyle': { signature: 'm' },
      
      // 图形和表格
      'includegraphics': { signature: 'o o m' },
      'caption': { signature: 'o m' },
      
      // 更多命令可以根据需要添加...
    };
  }

  /**
   * 从文件加载外部宏定义
   * @param filePath 宏定义文件路径
   * @returns 宏定义记录，如果加载失败则为null
   * @private
   */
  private async loadExternalMacrosFromFile(filePath: string): Promise<Record<string, { signature: string }> | null> {
    try {
      const content = await utils.readFileAsync(filePath);
      return JSON.parse(content) as Record<string, { signature: string }>;
    } catch (error) {
      throw new Error(`加载宏定义文件 ${filePath} 失败: ${(error as Error).message}`);
    }
  }
} 