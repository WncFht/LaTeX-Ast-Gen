/**
 * AST序列化器模块
 * 负责将解析得到的项目级AST数据结构转换为JSON字符串
 */

import type * as Ast from '@unified-latex/unified-latex-types';
import { ProjectAST } from './types';

/**
 * 序列化输出数据的接口
 */
interface SerializedOutput {
  _metadata?: {
    rootFilePath?: string;
    projectGlobalErrors?: string[];
    macros?: Ast.MacroInfoRecord;
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
    outputData._metadata = {};
    
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