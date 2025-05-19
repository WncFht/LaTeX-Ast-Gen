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
    // 用于向后兼容或快速查看最终生效的宏
    effectiveMacros?: Ast.MacroInfoRecord; 
    // 新增：分类后的宏信息
    macrosByCategory?: {
        defaultAndUser: Ast.MacroInfoRecord;
        definedInDocument: Ast.MacroInfoRecord;
        inferredUsed: Ast.MacroInfoRecord;
        finalEffectiveMacros: Ast.MacroInfoRecord; // 重复 effectiveMacros，但作为分类的一部分
    };
    // customMacros 列表可以基于 finalEffectiveMacros 生成，或移除，因为分类信息更全
    // customMacros?: string[]; 
    processInfo?: {
      timestamp: string;
      version: string; // 应该从 package.json 获取
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
 * @param projectAST 项目AST对象，期望包含 _detailedMacros
 * @param prettyPrint 是否格式化输出的JSON字符串
 * @returns 表示项目AST的JSON字符串
 */
export function serializeProjectAstToJson(
  projectAST: ProjectAST,
  prettyPrint: boolean = false
): string {
  const outputData: SerializedOutput = {};
  
  if (!outputData._metadata) {
    outputData._metadata = {
        processInfo: {
            timestamp: new Date().toISOString(),
            // TODO: 从 package.json 动态获取版本
            version: '1.0.1' // 示例版本
        }
    };
  }
  
  if (projectAST.rootFilePath !== null) {
    outputData._metadata.rootFilePath = projectAST.rootFilePath;
  }
  
  if (projectAST.errors && projectAST.errors.length > 0) {
    outputData._metadata.projectGlobalErrors = projectAST.errors;
  }
  
  // 使用详细的分类宏信息
  if (projectAST._detailedMacros) {
    outputData._metadata.macrosByCategory = projectAST._detailedMacros;
    // 为了方便，也可以保留一个扁平的最终生效宏列表
    outputData._metadata.effectiveMacros = projectAST._detailedMacros.finalEffectiveMacros;
  } else if (projectAST.macros) {
    // 向后兼容，如果 _detailedMacros 不存在，则使用 projectAST.macros
    outputData._metadata.effectiveMacros = projectAST.macros;
  }
  
  // (可选) 重新生成 customMacros 列表，如果需要的话
  // const finalMacros = projectAST._detailedMacros ? projectAST._detailedMacros.finalEffectiveMacros : projectAST.macros;
  // if (finalMacros) {
  //   const standardMacros = new Set([ /* ... 你的标准宏列表 ... */ ]);
  //   const customMacrosList = Object.keys(finalMacros)
  //     .filter(macro => !standardMacros.has(macro))
  //     .sort();
  //   if (customMacrosList.length > 0) {
  //     outputData._metadata.customMacros = customMacrosList;
  //   }
  // }

  for (const fileAstEntry of projectAST.files) {
    outputData[fileAstEntry.filePath] = {
      ast: fileAstEntry.ast
    };
    if (fileAstEntry.error) {
      outputData[fileAstEntry.filePath].parsingError = fileAstEntry.error;
    }
  }
  
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
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const jsonContent = prettyPrint 
      ? JSON.stringify(ast, null, 2) 
      : JSON.stringify(ast);
    
    fs.writeFileSync(outputPath, jsonContent, 'utf8');
    return true;
  } catch (error) {
    console.error(`保存AST到文件 ${outputPath} 失败:`, error);
    return false;
  }
} 