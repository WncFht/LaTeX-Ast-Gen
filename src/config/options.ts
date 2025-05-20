/**
 * 配置选项类型定义模块。
 * 
 * 本模块主要负责定义或重新导出与解析器配置相关的各种 TypeScript 接口。
 * 核心的配置类型如 `ParserOptions` (用于库API)，`CliOptions` (用于命令行接口参数)，
 * 以及 `ResolvedParserConfig` (项目内部使用的、已解析和合并的配置对象)，
 * 均从中央类型定义文件 `../types/index.ts` 导入并重新导出。
 * 未来可以根据需要在此处添加更多特定于配置加载、验证或转换流程的辅助类型。
 */

// 从主类型文件导入和重新导出核心配置相关的类型
export type {
  ParserOptions,      // 解析器库 API 的选项接口
  CliOptions,         // 命令行接口参数的选项接口
  ResolvedParserConfig, // 项目内部使用的最终配置对象接口
} from '../types/index';

// 示例：未来可能添加的与配置加载/验证流程相关的特定辅助类型
/*
// 例如，用于表示配置来源的类型
export interface ConfigLoadingSource {
  type: 'cli' | 'file' | 'object'; // 配置来源：命令行、文件、直接对象
  path?: string;                   // 如果来源是文件，则为文件路径
}

// 例如，用于表示配置验证错误的类型
export interface ConfigValidationError {
  optionPath: string; // 配置项路径 (例如 "compilerOptions.target")
  message: string;    // 错误描述信息
  value?: any;       //导致错误的配置值
}
*/ 