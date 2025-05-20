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
import { processEnvironments } from '@unified-latex/unified-latex-util-environments';

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
      
      const rawParser = getParser({ flags: { autodetectExpl3AndAtLetter: true } });
      let ast: Ast.Root | null;
      try {
        ast = rawParser.parse(content);
      } catch (parseError) {
        console.error(`[FileParser] Raw parsing failed for ${filePath}:`, parseError);
        return { ast: null, newMacros: {}, includedFiles: [], error: `Raw parsing failed: ${(parseError as Error).message}` };
      }

      if (ast) {
        const baseDir = path.dirname(filePath);
        
        // 步骤 2: 从原始AST中提取本文档定义的【宏】，并更新到全局处理器
        const definedInThisFileMacros = this.projectMacroHandlerRef.extractDefinedMacros(ast);
        this.projectMacroHandlerRef.addDefinedInDocMacros(definedInThisFileMacros);
        
        // 步骤 3: 第一次参数附加 - 使用当前已知的宏 (包括默认宏和刚刚提取的文档内宏)
        // 目的是为了让定义环境的命令（如 \newenvironment, \newtcolorbox）的参数能被正确解析
        let macrosForFirstPass = this.projectMacroHandlerRef.getMacrosForAttachment();
        console.log("[FileParser-debug] Macros for FIRST pass attachMacroArgs - newtcolorbox:", JSON.stringify(macrosForFirstPass['newtcolorbox']));
        console.log("[FileParser-debug] Macros for FIRST pass attachMacroArgs - newenvironment:", JSON.stringify(macrosForFirstPass['newenvironment']));
        this.reattachMacroArgs(ast, macrosForFirstPass); // 原地修改 ast
        
        // 步骤 4: 现在环境定义命令的参数已附加，从AST中提取本文档定义的【环境】
        this.projectMacroHandlerRef.extractAndProcessEnvironmentDefinitions(ast);
        
        // 步骤 5: 获取更新后的最全的宏定义 (可能包含因环境定义间接引入的宏)
        const currentAllMacros = this.projectMacroHandlerRef.getMacrosForAttachment();
        // 如果在步骤3之后，宏定义有变化，可以考虑再次附加参数，但通常上一步已处理了主要命令的参数。
        // 为确保一致性，可以再次运行，或者优化为仅当 macrosForFirstPass 和 currentAllMacros 不同时运行。
        // 为了简单和确保，我们再次运行一次，特别是如果环境定义本身引入了新的宏。
        console.log("[FileParser-debug] Macros for SECOND pass attachMacroArgs - newtcolorbox:", JSON.stringify(currentAllMacros['newtcolorbox']));
        this.reattachMacroArgs(ast, currentAllMacros); 
        
        // 步骤 6: 获取当前最全的环境定义 (包含本文档刚刚提取的环境)
        const currentAllEnvs = this.projectMacroHandlerRef.getEnvironmentsForProcessing();
        if (currentAllEnvs['mainbox']) { 
          console.log("[FileParser-debug] EnvInfo for 'mainbox' before processEnvironments:", JSON.stringify(currentAllEnvs['mainbox']));
        } else {
          console.warn("[FileParser-debug] 'mainbox' not found in currentAllEnvs before processEnvironments.");
        }
        if (currentAllEnvs['promptbox']) { 
            console.log("[FileParser-debug] EnvInfo for 'promptbox' before processEnvironments:", JSON.stringify(currentAllEnvs['promptbox']));
        } else {
            console.warn("[FileParser-debug] 'promptbox' not found in currentAllEnvs before processEnvironments.");
        }
        try {
          processEnvironments(ast, currentAllEnvs); // 原地修改 ast，为环境附加参数
        } catch (envProcessingError) {
          console.warn(`[FileParser] Error processing environments in ${filePath}: ${(envProcessingError as Error).message}`);
        }
        
        // 步骤 7: 提取AST中使用的、但仍然未知的宏（推断其签名）
        const inferredInThisFileMacros = this.projectMacroHandlerRef.extractUsedCustomMacros(ast);
        this.projectMacroHandlerRef.addInferredUsedMacros(inferredInThisFileMacros);
        
        // 步骤 8: 最终参数附加，确保推断出的宏的参数也被处理
        const finalMacrosForAttachment = this.projectMacroHandlerRef.getMacrosForAttachment();
        console.log("[FileParser-debug] Macros for FINAL (third) pass attachMacroArgs - newtcolorbox:", JSON.stringify(finalMacrosForAttachment['newtcolorbox']));
        this.reattachMacroArgs(ast, finalMacrosForAttachment);
        
        // 步骤 9: 提取此文件包含的其他文件
        const includedFiles = this.extractIncludedFiles(ast, baseDir);
        
        return {
          ast,
          newMacros: { ...definedInThisFileMacros, ...inferredInThisFileMacros }, 
          includedFiles
        };
      } else {
        return { ast: null, newMacros: {}, includedFiles: [], error: `文件 ${filePath} 解析后AST为空` };
      }
    } catch (error) {
      return { ast: null, newMacros: {}, includedFiles: [], error: `处理文件 ${filePath} 时出错: ${(error as Error).message}` };
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
    console.log(`[FileParser-debug] reattachMacroArgs: Attempting to attach args. Macro record for newtcolorbox:`, JSON.stringify(macroRecord['newtcolorbox']));
    visit(ast, (node) => {
        if (node.type === 'macro' && node.content === 'newtcolorbox') {
            console.log(`[FileParser-debug] newtcolorbox node BEFORE attachMacroArgs for this specific call (args might be undefined if first pass on raw AST):`, JSON.stringify(node));
        }
    });

    try {
      attachMacroArgs(ast, macroRecord);
      console.log(`[FileParser-debug] reattachMacroArgs: attachMacroArgs call completed.`);
      visit(ast, (node) => {
          if (node.type === 'macro' && node.content === 'newtcolorbox') {
              console.log(`[FileParser-debug] newtcolorbox node AFTER attachMacroArgs for this specific call:`, JSON.stringify(node));
          }
      });
    } catch (error) {
      console.warn(`[FileParser] 附加宏参数时出错: ${(error as Error).message}`, error);
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
    const includeCommands = ['input', 'include', 'subfile'];
    
    visit(ast, (node) => {
      if (node.type !== 'macro') return;
      const macroNode = node as Ast.Macro;
      if (includeCommands.includes(macroNode.content)) {
        if (!macroNode.args || macroNode.args.length < 1) {
            // 如果宏没有参数（可能因为之前的 attachMacroArgs 失败或宏本身就没有），则尝试从原始AST中"贪婪"地读取路径。
            // 这是一个简化的回退，更稳健的方法是确保 attachMacroArgs 总是填充参数。
            // console.warn("[FileParser-debug] Included file macro '" + macroNode.content + "' has no arguments. Path extraction might be unreliable.");
            // 简单的尝试：假设路径是紧跟在宏后面的第一个 group 或 string。这里不实现复杂逻辑，依赖于 attachMacroArgs。
            return; 
        }
        const firstArg = macroNode.args[0];
        if (!firstArg || firstArg.type !== 'argument') return;
        let rawPath = '';
        if (Array.isArray(firstArg.content)) {
          rawPath = firstArg.content
            .map((n) => { 
              if (n.type === 'string') return (n as Ast.String).content;
              return ''; 
            })
            .join('');
        }
        if (!rawPath) return;
        let resolvedPath = utils.resolvePath(baseDir, rawPath);
        if (!path.extname(resolvedPath) && !resolvedPath.endsWith('.')) {
          resolvedPath += '.tex';
        }
        const normalizedPath = utils.normalizePath(resolvedPath);
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