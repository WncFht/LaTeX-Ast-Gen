/**
 * 宏处理器模块
 * 负责在整个项目解析生命周期中管理LaTeX宏定义
 */

import * as utils from './utils';
import type * as Ast from '@unified-latex/unified-latex-types';
import { ParserOptions, MacroInfo, Node } from './types';
import { listNewcommands } from "@unified-latex/unified-latex-util-macros";
import { visit } from "@unified-latex/unified-latex-util-visit";

/**
 * 宏处理器类
 * 管理项目中的LaTeX宏定义
 */
export class MacroHandler {
  /**
   * 存储所有已知宏定义的记录
   */
  private macroRecord: Ast.MacroInfoRecord;

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
  public addMacros(newMacros: Ast.MacroInfoRecord): void {
    for (const [macroName, macroInfo] of Object.entries(newMacros)) {
      this.macroRecord[macroName] = macroInfo;
    }
  }

  /**
   * 获取当前所有宏定义的副本
   * @returns 宏定义记录的深拷贝
   */
  public getCurrentMacros(): Ast.MacroInfoRecord {
    return JSON.parse(JSON.stringify(this.macroRecord));
  }

  /**
   * 扫描AST中使用的未定义自定义宏
   * @param ast 要扫描的AST
   * @returns 从AST中提取的自定义宏列表
   */
  public extractUsedCustomMacros(ast: Ast.Root): Ast.MacroInfoRecord {
    const customMacros: Ast.MacroInfoRecord = {};
    const knownMacroNames = new Set(Object.keys(this.macroRecord));
    const potentialCustomMacros = new Map<string, {node: any, argCount: number}>();
    
    // 使用unified-latex的visit函数递归访问AST
    visit(ast, (node: any, info: any) => {
      // 只处理宏节点
      if (node.type !== 'macro') return;
      
      const macroName = node.content;
      
      // 如果这是一个已知宏，跳过
      if (knownMacroNames.has(macroName)) return;
      
      // 计算潜在的参数数量 - 检查后面是否跟着group节点
      let argCount = 0;
      
      // 获取父节点和当前节点在父节点内容中的索引
      if (info.parents.length > 0) {
        const parent = info.parents[info.parents.length - 1];
        if (parent && Array.isArray(parent.content)) {
          const index = parent.content.indexOf(node);
          if (index !== -1) {
            // 检查后续节点是否为group类型，可能是未识别的参数
            let currentIndex = index + 1;
            while (currentIndex < parent.content.length) {
              const nextNode = parent.content[currentIndex];
              if (nextNode && nextNode.type === 'group') {
                argCount++;
                currentIndex++;
              } else {
                break;
              }
            }
          }
        }
      }
      
      // 记录这个潜在的自定义宏
      if (!potentialCustomMacros.has(macroName) ||
          potentialCustomMacros.get(macroName)!.argCount < argCount) {
        potentialCustomMacros.set(macroName, {node, argCount});
      }
    });
    
    // 为所有潜在的自定义宏创建签名
    for (const [macroName, info] of potentialCustomMacros.entries()) {
      let signature = '';
      for (let i = 0; i < info.argCount; i++) {
        signature += (signature ? ' ' : '') + 'm';
      }
      customMacros[macroName] = { signature };
    }
    
    return customMacros;
  }

  /**
   * 解析并处理文档中手动定义的宏
   * 使用unified-latex的listNewcommands函数提取宏定义
   * 
   * @param ast LaTeX AST
   * @returns 提取的宏定义
   */
  public extractDefinedMacros(ast: Ast.Root): Ast.MacroInfoRecord {
    const newMacros: Ast.MacroInfoRecord = {};
    
    // 使用unified-latex的listNewcommands获取宏定义
    const commandSpecs = listNewcommands(ast);
    
    // 转换格式为MacroInfoRecord
    for (const spec of commandSpecs) {
      newMacros[spec.name] = { signature: spec.signature };
    }
    
    return newMacros;
  }

  /**
   * 加载预定义的常用LaTeX宏
   * @returns 预定义宏的记录
   * @private
   */
  private loadDefaultMacros(): Ast.MacroInfoRecord {
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
      
      // 常用于数学推导的命令
      'deriv': { signature: 'm m' },    // 导数 \deriv{f}{x}
      'pdv': { signature: 'm m' },      // 偏导 \pdv{f}{x}
      'dv': { signature: 'm m' },       // 微分 \dv{f}{x}
      'norm': { signature: 'm' },       // 范数 \norm{x}
      'abs': { signature: 'm' },        // 绝对值 \abs{x}
      'Set': { signature: 'm' },        // 集合 \Set{x | x > 0}
      
      // 更多命令可以根据需要添加...
    };
  }

  /**
   * 从文件加载外部宏定义
   * @param filePath 宏定义文件路径
   * @returns 宏定义记录，如果加载失败则为null
   * @private
   */
  private async loadExternalMacrosFromFile(filePath: string): Promise<Ast.MacroInfoRecord | null> {
    try {
      const content = await utils.readFileAsync(filePath);
      return JSON.parse(content) as Ast.MacroInfoRecord;
    } catch (error) {
      throw new Error(`加载宏定义文件 ${filePath} 失败: ${(error as Error).message}`);
    }
  }
} 