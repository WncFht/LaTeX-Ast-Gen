/**
 * AST 序列化器模块
 *
 * 负责将解析得到的项目级 AST 数据结构 (ProjectAST) 转换为 JSON 字符串，
 * 并提供将任意 AST 对象保存为 JSON 文件的功能。
 */

import type { Ast, ProjectAST } from '../types/index'; // 使用新的统一类型入口
import { writeFileAsync, mkdirRecursiveAsync } from '../utils/fileSystem'; // 使用新的文件系统工具
import { getDirname } from '../utils/pathUtils'; // 使用新的路径工具
import { createLogger, Logger } from '../utils/logger';

// 注意：原实现中 fs 和 path 是直接导入的，这里改为通过我们封装的工具函数
// import * as fs from 'fs';
// import * as path from 'path';

const logger: Logger = createLogger('ast:AstSerializer');

/**
 * 序列化输出数据的内部接口，定义了 JSON 输出的顶层结构。
 */
interface SerializedOutput {
  _metadata?: {
    rootFilePath?: string | null; // ProjectAST 中 rootFilePath 可以是 null
    projectGlobalErrors?: string[];
    // effectiveMacros 和 effectiveEnvironments 作为顶层扁平化列表，方便快速访问
    effectiveMacros?: Ast.MacroInfoRecord; 
    effectiveEnvironments?: Ast.EnvInfoRecord;
    // macrosByCategory 和 environmentsByCategory 提供更详细的分类信息
    macrosByCategory?: {
        defaultAndUser: Ast.MacroInfoRecord;
        definedInDocument: Ast.MacroInfoRecord;
        inferredUsed: Ast.MacroInfoRecord;
        finalEffectiveMacros: Ast.MacroInfoRecord; 
    };
    environmentsByCategory?: {
        ctanEnvironments: Ast.EnvInfoRecord;
        userProvidedEnvironments: Ast.EnvInfoRecord;
        definedInDocumentEnvironments: Ast.EnvInfoRecord;
        finalEffectiveEnvironments: Ast.EnvInfoRecord;
    };
    processingInfo?: {
      timestamp: string;
      parserVersion: string; 
    };
  };
  // 其余属性是文件路径到其 AST 和错误的映射
  [filePath: string]: {
    ast: Ast.Root;       // 明确类型为 Ast.Root
    parsingError?: string;
  } | any; // `| any` 是为了兼容 _metadata 属性，可以考虑更严格的类型
}

/**
 * 将项目AST对象 ({@link ProjectAST}) 序列化为 JSON 字符串。
 * 
 * @param projectAST - 项目AST对象，期望包含 `_detailedMacros` 和 `_detailedEnvironments`。 
 * @param prettyPrint - 是否格式化输出的 JSON 字符串 (带缩进)。默认为 `false`。
 * @returns 表示项目AST的 JSON 字符串。
 */
export function serializeProjectAstToJson(
  projectAST: ProjectAST,
  prettyPrint: boolean = false
): string {
  const outputData: SerializedOutput = {};
  
  // 初始化 _metadata 对象
  outputData._metadata = {
    processingInfo: {
        timestamp: projectAST._processingInfo?.timestamp || new Date().toISOString(),
        // 版本号应从 projectAST._processingInfo 中获取，如果 ProjectProcessor 填充了它
        parserVersion: projectAST._processingInfo?.parserVersion || 'unknown', 
    }
  };

  if (projectAST.rootFilePath !== undefined) { // rootFilePath 可以是 null
    outputData._metadata.rootFilePath = projectAST.rootFilePath;
  }
  
  if (projectAST.errors && projectAST.errors.length > 0) {
    outputData._metadata.projectGlobalErrors = projectAST.errors;
  }
  
  // 使用详细的分类宏信息
  if (projectAST._detailedMacros) {
    outputData._metadata.macrosByCategory = projectAST._detailedMacros;
    outputData._metadata.effectiveMacros = projectAST._detailedMacros.finalEffectiveMacros;
  } else if (projectAST.macros) {
    // 向后兼容：如果 _detailedMacros 不存在，则使用 projectAST.macros 作为 effectiveMacros
    outputData._metadata.effectiveMacros = projectAST.macros;
  }
  
  // 处理环境信息
  if (projectAST._detailedEnvironments) {
    outputData._metadata.environmentsByCategory = projectAST._detailedEnvironments;
    outputData._metadata.effectiveEnvironments = projectAST._detailedEnvironments.finalEffectiveEnvironments;
  } else if (projectAST.environments) { 
    outputData._metadata.effectiveEnvironments = projectAST.environments;
  }

  // 填充每个文件的 AST 数据
  for (const fileAstEntry of projectAST.files) {
    // 确保 filePath 不是 "_metadata"，以避免覆盖
    if (fileAstEntry.filePath === '_metadata') {
        logger.warn("项目中的文件路径名为 '_metadata'，可能导致序列化问题。已跳过此文件条目。" );
        continue;
    }
    outputData[fileAstEntry.filePath] = {
      ast: fileAstEntry.ast, // ast 可能为 null，如果文件解析失败
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
 * 将任何 AST 对象（或其他数据）异步保存为单独的 JSON 文件。
 * 
 * @param dataToSave - 要保存的 AST 对象或任何可序列化数据。
 * @param outputPath - 输出文件的完整路径。
 * @param prettyPrint - 是否格式化输出的 JSON 字符串。默认为 `false`。
 * @returns 一个 Promise，解析为 `true` 表示保存成功，`false` 表示失败。
 */
export async function saveAstDataAsJson(
  dataToSave: any, // 可以是 Ast.Root, ProjectAST, 或任何其他对象
  outputPath: string,
  prettyPrint: boolean = false
): Promise<boolean> {
  try {
    // 确保目录存在，使用新的 fileSystem 工具
    const dir = getDirname(outputPath);
    // mkdirRecursiveAsync 不需要检查存在性，它会处理
    await mkdirRecursiveAsync(dir);
    
    const jsonContent = prettyPrint 
      ? JSON.stringify(dataToSave, null, 2) 
      : JSON.stringify(dataToSave);
    
    // 使用新的 fileSystem 工具写入文件
    await writeFileAsync(outputPath, jsonContent);
    logger.info(`数据已成功保存到: ${outputPath}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`保存数据到文件 ${outputPath} 失败: ${message}`);
    return false;
  }
} 