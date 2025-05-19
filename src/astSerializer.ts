/**
 * AST序列化器模块
 * 负责将解析得到的项目级AST数据结构转换为JSON字符串
 */

import type * as Ast from '@unified-latex/unified-latex-types';
import { ProjectAST } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 序列化输出数据的接口
 */
interface SerializedOutput {
  _metadata?: {
    rootFilePath?: string;
    projectGlobalErrors?: string[];
    macros?: Ast.MacroInfoRecord;
    customMacros?: string[]; // 自定义宏列表
    processInfo?: {
      timestamp: string;
      version: string;
    };
  };
  [filePath: string]: {
    ast: Ast.Root;
    parsingError?: string;
  } | any;
}

/**
 * 将项目AST序列化为JSON字符串
 * 
 * @param projectAST 项目AST对象
 * @param prettyPrint 是否格式化输出的JSON字符串
 * @returns 表示项目AST的JSON字符串
 */
export function serializeProjectAstToJson(
  projectAST: ProjectAST,
  prettyPrint: boolean = false
): string {
  // 创建输出对象
  const outputData: SerializedOutput = {};
  
  // 添加元数据
  if (
    projectAST.rootFilePath !== null || 
    (projectAST.errors && projectAST.errors.length > 0) ||
    projectAST.macros
  ) {
    outputData._metadata = {
      processInfo: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    // 添加根文件路径
    if (projectAST.rootFilePath !== null) {
      outputData._metadata.rootFilePath = projectAST.rootFilePath;
    }
    
    // 添加项目级错误
    if (projectAST.errors && projectAST.errors.length > 0) {
      outputData._metadata.projectGlobalErrors = projectAST.errors;
    }
    
    // 添加宏定义记录
    if (projectAST.macros) {
      outputData._metadata.macros = projectAST.macros;
      
      // 提取自定义宏（非标准LaTeX宏）
      const standardMacros = new Set([
        'documentclass', 'usepackage', 'input', 'include', 'subfile',
        'textbf', 'textit', 'texttt', 'underline', 'emph',
        'mathbb', 'mathbf', 'mathcal', 'mathrm', 'frac', 'sqrt',
        'newcommand', 'renewcommand', 'DeclareMathOperator',
        'begin', 'end', 'item', 'label', 'ref', 'cite',
        'bibliography', 'bibliographystyle', 'includegraphics', 'caption'
      ]);
      
      const customMacros = Object.keys(projectAST.macros)
        .filter(macro => !standardMacros.has(macro))
        .sort();
      
      if (customMacros.length > 0) {
        outputData._metadata.customMacros = customMacros;
      }
    }
  }
  
  // 处理文件AST
  for (const fileAstEntry of projectAST.files) {
    // 将文件路径映射到其AST
    outputData[fileAstEntry.filePath] = {
      ast: fileAstEntry.ast
    };
    
    // 如果有错误，添加到文件对象
    if (fileAstEntry.error) {
      outputData[fileAstEntry.filePath].parsingError = fileAstEntry.error;
    }
  }
  
  // 序列化为JSON
  return prettyPrint 
    ? JSON.stringify(outputData, null, 2) 
    : JSON.stringify(outputData);
}

/**
 * 将AST保存为单独的JSON文件
 * 
 * @param ast AST对象
 * @param outputPath 输出文件路径
 * @param prettyPrint 是否格式化输出的JSON字符串
 * @returns 保存是否成功
 */
export function saveAstAsJson(
  ast: any,
  outputPath: string,
  prettyPrint: boolean = false
): boolean {
  try {
    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 序列化为JSON
    const jsonContent = prettyPrint 
      ? JSON.stringify(ast, null, 2) 
      : JSON.stringify(ast);
    
    // 写入文件
    fs.writeFileSync(outputPath, jsonContent, 'utf8');
    return true;
  } catch (error) {
    console.error(`保存AST到文件 ${outputPath} 失败:`, error);
    return false;
  }
} 