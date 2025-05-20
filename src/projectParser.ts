/**
 * 项目解析器模块
 * 作为核心协调器管理整个LaTeX项目的解析过程
 */

import * as path from 'path';
import * as utils from './utils';
import type * as Ast from '@unified-latex/unified-latex-types';
import { FileParser } from './fileParser';
import { MacroHandler } from './macroHandler';
import { ParserOptions, ProjectAST, ProjectFileAst } from './types';

/**
 * 项目解析器类
 * 管理整个LaTeX项目的解析过程
 */
export class ProjectParser {
  private fileParser: FileParser;
  private macroHandler: MacroHandler;
  private parsedFiles: Set<string>;
  private projectAstMap: Map<string, Ast.Root | null>;
  private projectFileErrors: Map<string, string>;
  private projectGlobalErrors: string[];
  private rootFilePath: string | null;

  /**
   * 创建一个新的ProjectParser实例。
   * MacroHandler 的具体初始化将延迟到 parse 方法中，以便应用传入的选项。
   */
  constructor() {
    // MacroHandler 和 FileParser 的初始化移至 parse 方法，
    // 以确保它们在 options 可用后正确配置。
    // 临时的占位或者在parse中完全重新创建。
    this.macroHandler = new MacroHandler(); // 初始默认实例
    this.fileParser = new FileParser(this.macroHandler); 

    this.parsedFiles = new Set<string>();
    this.projectAstMap = new Map<string, Ast.Root | null>();
    this.projectFileErrors = new Map<string, string>();
    this.projectGlobalErrors = [];
    this.rootFilePath = null;
  }

  /**
   * 解析LaTeX项目。
   * 此方法会协调整个解析流程，包括：
   * 1. 根据选项（重新）初始化MacroHandler。
   * 2. 确定项目的根文件。
   * 3. 递归地解析根文件及其包含的所有TeX文件。
   * 4. 在文件间共享和累积宏定义。
   * 5. 收集所有文件的AST和可能发生的错误。
   * 
   * @param entryPath 入口文件路径或项目目录
   * @param options 解析选项，用于配置宏处理等行为
   * @returns 项目AST对象，包含所有解析文件的AST、最终的宏状态和错误信息
   */
  public async parse(
    entryPath: string,
    options?: Omit<ParserOptions, 'entryPath'> // entryPath 从主参数获取
  ): Promise<ProjectAST> {
    // 重置状态以支持对同一实例的多次调用
    this.parsedFiles.clear();
    this.projectAstMap.clear();
    this.projectFileErrors.clear();
    this.projectGlobalErrors = [];
    this.rootFilePath = null;

    // 根据传入的选项（重新）创建/配置 MacroHandler
    // 确保 ParserOptions 包含 entryPath 字段的定义以便传递
    const macroHandlerOptions: ParserOptions = {
      entryPath: entryPath, // 将 entryPath 传递给 MacroHandler 的选项
      macrosFile: options?.macrosFile,
      customMacroRecord: options?.customMacroRecord,
      loadDefaultMacros: options?.loadDefaultMacros,
      customEnvironmentRecord: options?.customEnvironmentRecord, // 确保传递环境相关选项
      environmentsFile: options?.environmentsFile
    };
    this.macroHandler = new MacroHandler(macroHandlerOptions);
    // FileParser 需要引用最新的 MacroHandler 实例
    this.fileParser = new FileParser(this.macroHandler);

    const rootFile = await this.determineRootFile(entryPath);
    
    if (!rootFile) {
      this.projectGlobalErrors.push(`无法确定根文件，入口路径: ${entryPath}`);
      const allDefs = this.macroHandler.getAllDefinitionsCategorized();
      return {
        rootFilePath: null,
        files: [],
        macros: allDefs.finalEffectiveMacros,
        _detailedMacros: {
            defaultAndUser: allDefs.defaultAndUserMacros,
            definedInDocument: allDefs.definedInDocumentMacros,
            inferredUsed: allDefs.inferredUsedMacros,
            finalEffectiveMacros: allDefs.finalEffectiveMacros
        },
        environments: allDefs.finalEffectiveEnvironments,
        _detailedEnvironments: {
            ctanEnvironments: allDefs.ctanEnvironments,
            userProvidedEnvironments: allDefs.userProvidedEnvironments,
            definedInDocumentEnvironments: allDefs.definedInDocumentEnvironments,
            finalEffectiveEnvironments: allDefs.finalEffectiveEnvironments
        },
        errors: this.projectGlobalErrors
      };
    }

    this.rootFilePath = rootFile;
    
    // 初始化解析队列
    const filesToParse: string[] = [this.rootFilePath];
    
    // 循环解析文件
    while (filesToParse.length > 0) {
      const currentFilePath = filesToParse.shift()!;
      const normalizedPath = utils.normalizePath(currentFilePath);
      
      // 防止重复解析
      if (this.parsedFiles.has(normalizedPath)) {
        continue;
      }
      
      this.parsedFiles.add(normalizedPath);
      
      // FileParser.parseFile 现在通过其内部的 projectMacroHandlerRef 与宏状态交互
      const parseResult = await this.fileParser.parseFile(normalizedPath);
      
      // 记录AST（即使为null）
      this.projectAstMap.set(normalizedPath, parseResult.ast);
      
      // 记录错误（如果有）
      if (parseResult.error) {
        this.projectFileErrors.set(normalizedPath, parseResult.error);
      }
      
      // 宏定义已经通过 FileParser 内部对 projectMacroHandlerRef 的操作进行了更新
      // 此处不再需要显式地从 parseResult.newMacros 添加
      
      // 添加包含的文件到解析队列
      for (const includedFile of parseResult.includedFiles) {
        if (!this.parsedFiles.has(utils.normalizePath(includedFile.path))) {
          filesToParse.push(includedFile.path);
        }
      }
    }
    
    // 构建结果
    const projectFileAstArray: ProjectFileAst[] = [];
    for (const [filePath, ast] of this.projectAstMap.entries()) {
      // 只为成功解析（AST非null）的文件创建条目
      // 解析失败文件的错误已经记录在 projectFileErrors 或 projectGlobalErrors 中
      if (ast) { 
        projectFileAstArray.push({
          filePath,
          ast,
          error: this.projectFileErrors.get(filePath) // 如果有特定于此文件的错误
        });
      } else if (this.projectFileErrors.has(filePath) && !this.projectGlobalErrors.some(e => e.includes(filePath))) {
        // 如果文件解析结果AST为null，且有特定错误信息，则将其添加到全局错误中
        this.projectGlobalErrors.push(
          `文件 ${filePath} 解析失败: ${this.projectFileErrors.get(filePath)}`
        );
      }
    }
    
    // 使用新的方法名 getAllDefinitionsCategorized
    const getAllDefinitionsCategorized = this.macroHandler.getAllDefinitionsCategorized();
    return {
      rootFilePath: this.rootFilePath,
      files: projectFileAstArray,
      macros: getAllDefinitionsCategorized.finalEffectiveMacros, // 从新方法的结果中获取宏
      _detailedMacros: { // 保持 _detailedMacros 结构，但数据源于新方法
        defaultAndUser: getAllDefinitionsCategorized.defaultAndUserMacros,
        definedInDocument: getAllDefinitionsCategorized.definedInDocumentMacros,
        inferredUsed: getAllDefinitionsCategorized.inferredUsedMacros,
        finalEffectiveMacros: getAllDefinitionsCategorized.finalEffectiveMacros
      },
      environments: getAllDefinitionsCategorized.finalEffectiveEnvironments,
      _detailedEnvironments: {
          ctanEnvironments: getAllDefinitionsCategorized.ctanEnvironments,
          userProvidedEnvironments: getAllDefinitionsCategorized.userProvidedEnvironments,
          definedInDocumentEnvironments: getAllDefinitionsCategorized.definedInDocumentEnvironments,
          finalEffectiveEnvironments: getAllDefinitionsCategorized.finalEffectiveEnvironments
      },
      errors: this.projectGlobalErrors.length > 0 ? this.projectGlobalErrors : undefined
    };
  }

  /**
   * 确定项目的根TeX文件。
   * 策略：
   * 1. 如果入口是文件且为.tex，则为根文件。
   * 2. 如果入口是目录，查找常见根文件名 (main.tex, root.tex等)。
   * 3. 如果未找到，在目录中查找包含 \\documentclass 的.tex文件。
   * 
   * @param entryPath 入口路径（文件或目录）
   * @returns 根文件的绝对规范化路径，如果找不到则为null
   */
  public async determineRootFile(entryPath: string): Promise<string | null> {
    try {
      // 检查入口路径是否存在
      const entryExists = await utils.fileExistsAsync(entryPath);
      if (!entryExists) {
        this.projectGlobalErrors.push(`入口路径不存在: ${entryPath}`);
        return null;
      }
      
      // 获取路径状态
      const fileHandle = await utils.getFileStats(entryPath);
      const stats = await fileHandle.stat();
      await fileHandle.close();
      
      // 如果是文件
      if (stats.isFile()) {
        // 检查是否是TeX文件
        if (utils.isTexFile(entryPath)) {
          return utils.normalizePath(path.resolve(entryPath));
        } else {
          this.projectGlobalErrors.push(`入口文件不是TeX文件: ${entryPath}`);
          return null;
        }
      }
      
      // 如果是目录
      if (stats.isDirectory()) {
        // 策略1: 检查常见根文件名
        const commonRootFileNames = ['main.tex', 'root.tex', 'master.tex', 'document.tex'];
        for (const fileName of commonRootFileNames) {
          const filePath = path.join(entryPath, fileName);
          if (await utils.fileExistsAsync(filePath)) {
            return utils.normalizePath(path.resolve(filePath));
          }
        }
        
        // 策略2: 查找包含\documentclass的文件
        const texFiles = await utils.findTexFiles(entryPath);
        const rootCandidates: string[] = [];
        
        for (const texFile of texFiles) {
          try {
            const content = await utils.readFileAsync(texFile);
            if (utils.isRootFileContent(content)) {
              rootCandidates.push(texFile);
            }
          } catch (error) {
            // 忽略读取错误，继续检查其他文件
          }
        }
        
        if (rootCandidates.length === 1) {
          return utils.normalizePath(path.resolve(rootCandidates[0]));
        } else if (rootCandidates.length > 1) {
          // 如果有多个候选，记录警告并选择第一个
          const warningMsg = `发现多个可能的根文件: ${rootCandidates.join(', ')}，使用第一个: ${rootCandidates[0]}`;
          console.warn(warningMsg); 
          // this.projectGlobalErrors.push(warningMsg); // 也可以作为错误记录
          return utils.normalizePath(path.resolve(rootCandidates[0]));
        }
        
        this.projectGlobalErrors.push(`在目录 ${entryPath} 中未找到根文件`);
        return null;
      }
      
      this.projectGlobalErrors.push(`入口路径既不是文件也不是目录: ${entryPath}`);
      return null;
    } catch (error) {
      this.projectGlobalErrors.push(`确定根文件时出错: ${(error as Error).message}`);
      return null;
    }
  }
}

/**
 * 独立函数：确定LaTeX项目根文件
 * @param entryPath 入口路径（文件或目录）
 * @returns 根文件路径，如果找不到则为null
 */
export async function findRootFile(entryPath: string): Promise<string | null> {
  // 创建一个临时的ProjectParser实例来调用determineRootFile
  const parser = new ProjectParser();
  return parser.determineRootFile(entryPath);
}

/**
 * 解析LaTeX项目
 * 提供简单的API入口点，处理 MacroHandler 的创建和 ProjectParser 的调用。
 * @param options 解析选项，必须包含 entryPath
 * @returns 项目AST
 */
export async function parseLatexProject(options: ParserOptions): Promise<ProjectAST> {
  const projectParser = new ProjectParser();
  // parseLatexProject 直接返回 projectParser.parse 的结果，
  // 因此 ProjectParser.parse 内部对 getAllDefinitionsCategorized 的调用和结构调整会自动生效。
  return projectParser.parse(options.entryPath, options);
} 