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
   * 创建一个新的ProjectParser实例
   * @param customMacroHandler 可选的预配置MacroHandler实例
   */
  constructor(customMacroHandler?: MacroHandler) {
    this.fileParser = new FileParser();
    this.macroHandler = customMacroHandler || new MacroHandler();
    this.parsedFiles = new Set<string>();
    this.projectAstMap = new Map<string, Ast.Root | null>();
    this.projectFileErrors = new Map<string, string>();
    this.projectGlobalErrors = [];
    this.rootFilePath = null;
  }

  /**
   * 解析LaTeX项目
   * @param entryPath 入口文件路径或项目目录
   * @param options 解析选项
   * @returns 项目AST
   */
  public async parse(
    entryPath: string,
    options?: Omit<ParserOptions, 'entryPath'>
  ): Promise<ProjectAST> {
    // 重置状态以支持多次调用
    this.parsedFiles.clear();
    this.projectAstMap.clear();
    this.projectFileErrors.clear();
    this.projectGlobalErrors = [];
    this.rootFilePath = null;

    // 如果提供了选项，重新配置MacroHandler
    if (options) {
      // 如果提供了macrosFile或customMacroRecord，创建新的MacroHandler
      if (options.macrosFile || options.customMacroRecord !== undefined || options.loadDefaultMacros !== undefined) {
        this.macroHandler = new MacroHandler({
          entryPath,
          macrosFile: options.macrosFile,
          customMacroRecord: options.customMacroRecord,
          loadDefaultMacros: options.loadDefaultMacros
        });
      }
    }

    // 确定根文件
    const rootFile = await this.determineRootFile(entryPath);
    
    if (!rootFile) {
      this.projectGlobalErrors.push(`无法确定根文件，入口路径: ${entryPath}`);
      // 返回包含错误信息的部分结果
      return {
        rootFilePath: null,
        files: [],
        macros: this.macroHandler.getCurrentMacros(),
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
      
      // 解析文件
      const parseResult = await this.fileParser.parseFile(
        normalizedPath,
        this.macroHandler.getCurrentMacros()
      );
      
      // 记录AST（即使为null）
      this.projectAstMap.set(normalizedPath, parseResult.ast);
      
      // 记录错误（如果有）
      if (parseResult.error) {
        this.projectFileErrors.set(normalizedPath, parseResult.error);
      }
      
      // 更新宏定义
      if (Object.keys(parseResult.newMacros).length > 0) {
        this.macroHandler.addMacros(parseResult.newMacros);
      }
      
      // 添加包含的文件到解析队列
      for (const includedFile of parseResult.includedFiles) {
        filesToParse.push(includedFile.path);
      }
    }
    
    // 构建结果
    const projectFileAstArray: ProjectFileAst[] = [];
    
    for (const [filePath, ast] of this.projectAstMap.entries()) {
      if (ast !== null) {
        projectFileAstArray.push({
          filePath,
          ast,
          error: this.projectFileErrors.get(filePath)
        });
      } else {
        // 对于解析失败的文件，只添加错误信息到全局错误
        if (this.projectFileErrors.has(filePath)) {
          this.projectGlobalErrors.push(
            `文件 ${filePath} 解析失败: ${this.projectFileErrors.get(filePath)}`
          );
        }
      }
    }
    
    // 返回ProjectAST
    return {
      rootFilePath: this.rootFilePath,
      files: projectFileAstArray,
      macros: this.macroHandler.getCurrentMacros(),
      errors: this.projectGlobalErrors.length > 0 ? this.projectGlobalErrors : undefined
    };
  }

  /**
   * 确定根文件
   * @param entryPath 入口路径（文件或目录）
   * @returns 根文件路径，如果找不到则为null
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
          this.projectGlobalErrors.push(
            `发现多个可能的根文件: ${rootCandidates.join(', ')}，使用第一个: ${rootCandidates[0]}`
          );
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
  const parser = new ProjectParser();
  return parser.determineRootFile(entryPath);
}

/**
 * 解析LaTeX项目
 * 提供简单的API入口点
 * @param options 解析选项
 * @returns 项目AST
 */
export async function parseLatexProject(options: ParserOptions): Promise<ProjectAST> {
  const macroOptsForHandler: Pick<ParserOptions, 'macrosFile' | 'loadDefaultMacros' | 'customMacroRecord'> = {
    macrosFile: options.macrosFile,
    loadDefaultMacros: options.loadDefaultMacros,
    customMacroRecord: options.customMacroRecord
  };
  
  const macroHandler = new MacroHandler({
    entryPath: options.entryPath,
    ...macroOptsForHandler
  });
  
  const projectParser = new ProjectParser(macroHandler);
  return projectParser.parse(options.entryPath);
} 