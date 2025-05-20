/**
 * 类型定义模块
 * 定义LaTeX AST解析器使用的所有核心TypeScript类型和接口。
 * 这个文件整合了原有的 types.ts 和 environment-parser/types.ts 的内容。
 */

// 从 unified-latex 库导入基础 AST 类型，并考虑重命名导出以供内部使用或直接使用。
// MacroInfoRecord 和 EnvInfoRecord 已经由 @unified-latex/unified-latex-types 定义，我们将直接使用它们。
import type * as Ast from '@unified-latex/unified-latex-types';

// 重新导出 Ast 模块，以便项目其他部分可以统一从这里导入
export type { Ast };

/**
 * 表示单个LaTeX文件的AST及相关元数据。
 */
export interface ProjectFileAst {
  /** 指向LaTeX源文件的绝对或规范化路径 */
  filePath: string;
  /** 文件的AST，由unified-latex生成 */
  ast: Ast.Root;
  /** 可选的错误信息，如果解析此特定文件失败 */
  error?: string;
}

/**
 * 表示整个LaTeX项目的AST及相关元数据。
 */
export interface ProjectAST {
  /** 指向项目中已识别的根.tex文件的绝对路径。如果无法确定根文件，则为null */
  rootFilePath: string | null;
  /** 项目中每个已解析文件的AST和元数据 */
  files: ProjectFileAst[];
  /** 
   * 用于解析项目的最终聚合宏定义。
   * 注意：@unified-latex/unified-latex-types 定义了 Ast.MacroInfoRecord 
   */
  macros: Ast.MacroInfoRecord;
  /** 可选：按来源分类的详细宏信息，用于调试或更细致的分析 */
  _detailedMacros?: {
    defaultAndUser: Ast.MacroInfoRecord;
    definedInDocument: Ast.MacroInfoRecord;
    inferredUsed: Ast.MacroInfoRecord;
    finalEffectiveMacros: Ast.MacroInfoRecord;
  };
  /** 
   * 项目的最终聚合环境定义。
   * 注意：@unified-latex/unified-latex-types 定义了 Ast.EnvInfoRecord
   */
  environments?: Ast.EnvInfoRecord; // 使用 Ast.EnvInfoRecord 替代旧的 ProjectAST.environments
  /** 可选：按来源分类的详细环境信息 */
  _detailedEnvironments?: {
    ctanEnvironments: Ast.EnvInfoRecord;
    userProvidedEnvironments: Ast.EnvInfoRecord;
    definedInDocumentEnvironments: Ast.EnvInfoRecord;
    finalEffectiveEnvironments: Ast.EnvInfoRecord;
  };
  /** 项目解析期间遇到的全局错误消息列表 */
  errors?: string[];
  // 可选：包含处理元数据，如版本、时间戳等
  _processingInfo?: {
    timestamp: string;
    parserVersion: string; // 应从 package.json 或其他地方获取
  };
}

/**
 * 解析器库API的配置选项。
 */
export interface ParserOptions {
  /** 指向根.tex文件或项目目录的路径 */
  entryPath: string;
  /** 
   * (可选) 指向包含自定义宏定义的JSON文件的路径。
   * 如果提供了 customMacroRecord，则此选项可能被忽略。
   */
  macrosFile?: string;
  /** 
   * (可选) 是否加载一组预定义的常用LaTeX宏。
   * 默认为 true。
   */
  loadDefaultMacros?: boolean;
  /** 
   * (可选) 直接传入的MacroInfoRecord对象，用于自定义宏。
   * 如果提供，通常优先于 macrosFile。
   */
  customMacroRecord?: Ast.MacroInfoRecord;
  /** 
   * (可选) 指向包含自定义环境定义的JSON文件的路径。
   * 如果提供了 customEnvironmentRecord，则此选项可能被忽略。
   */
  environmentsFile?: string;
  /** 
   * (可选) 用户提供的自定义环境信息记录。
   * 如果提供，通常优先于 environmentsFile。
   */
  customEnvironmentRecord?: Ast.EnvInfoRecord;
  // 可以添加更多特定于库调用的选项，例如日志级别等
}

/**
 * CLI 工具特有的配置选项。
 * 这些通常由CLI参数解析而来。
 */
export interface CliOptions {
  /** 入口路径，可以是文件或目录 */
  entryPath?: string; // 在CLI中通常是位置参数，但这里也列出
  /** 输出JSON文件路径 */
  output?: string;
  /** 是否以易读格式（带缩进）输出JSON */
  pretty?: boolean;
  /** 自定义宏定义文件路径 (对应 ParserOptions.macrosFile 和/或 ParserOptions.customMacroRecord) */
  customMacrosFile?: string; // 在main.ts中是 customMacros
  /** 自定义环境定义文件路径 (对应 ParserOptions.environmentsFile 和/或 ParserOptions.customEnvironmentRecord) */
  customEnvironmentsFile?: string; // 在main.ts中是 customEnvironments
  /** 是否加载默认宏 (对应 ParserOptions.loadDefaultMacros) */
  loadDefaultMacros?: boolean; // 在main.ts中是 noDefaultMacros 的反义
  /** 是否保存每个文件的AST为单独的JSON文件 */
  saveIndividualAst?: boolean;
  /** 存储单独AST文件的目录 */
  individualAstDir?: string;
  /** 显示帮助信息的标志 */
  showHelp?: boolean;
  /** 是否输出详细日志 (DEBUG级别) */
  verbose?: boolean;
  /** 是否禁止所有日志输出 (NONE级别) */
  silent?: boolean;
  // 可以添加CLI特有的日志级别控制等
}

/**
 * 内部文件解析器返回的结果结构。
 */
export interface InternalFileParseResult {
  /** 文件的已解析AST，如果发生致命解析错误则为null */
  ast: Ast.Root | null;
  /** 
   * 从此文件新发现/定义的宏 (包括明确定义和推断的)。
   * 这些宏将被添加到全局的 DefinitionHandler 中。
   */
  newlyFoundMacros: Ast.MacroInfoRecord; 
  /**
   * 从此文件新发现/定义的环境。
   */
  newlyFoundEnvironments: Ast.EnvInfoRecord;
  /** 从此文件包含/输入的文件列表 */
  includedFiles: {
    /** 规范化的文件绝对路径 */
    path: string;
    /** 使用的命令（例如input、include） */
    command: string;
    /** 命令中的原始路径字符串 */
    rawPath: string;
  }[];
  /** 如果解析此文件遇到问题，则为错误信息字符串 */
  error?: string;
}

// --- 从 environment-parser/types.ts 迁移过来的类型 ---

/**
 * 表示解析出的环境参数的详细信息。
 */
export interface EnvironmentParameter {
  /** 参数的类型 */
  type: 'mandatory' | 'optional' | 'optionalStar' | 'until';
  /** 参数的原始规范字符或字符串，例如 'm', 'o', 's', 'u{\\foo}' */
  rawSpecifier?: string;
  /** 可选参数的默认值内容 (AST节点数组) */
  defaultValue?: Ast.Ast[];
}

/**
 * 表示一个新定义的环境的规范，由 DefinitionExtractor 生成。
 * DefinitionHandler 可能会将此转换为 Ast.EnvInfoRecord 的一部分。
 */
export interface NewEnvironmentSpec {
  /** 环境的名称 */
  name: string;
  /** 
   * 环境参数的字符串表示形式 (例如 "m o", "O{default} m")。
   * 这是提供给 unified-latex-util-arguments/gobbleArguments 或 processEnvironments 的签名。
   */
  signature: string;
  /** 
   * (可选) 解析出的更结构化的参数信息列表。
   */
  parameters?: EnvironmentParameter[];
  /** 定义此环境的原始宏节点 */
  definitionMacro: Ast.Macro;
  /** 用于定义此环境的命令的名称 (例如, "newenvironment", "newtcolorbox", "newtheorem") */
  definingCommand: string;
  /** (可选) 开始环境时执行的代码的 AST 节点 (主要用于 \newenvironment) */
  beginCode?: Ast.Ast[];
  /** (可选) 结束环境时执行的代码的 AST 节点 (主要用于 \newenvironment) */
  endCode?: Ast.Ast[];
  /** (可选) 对于定理类环境，这里可以存放其显示的标题 (例如 "Theorem", "Lemma") */
  theoremTitle?: string;
  /** (可选) 对于 tcolorbox，这里可以存放其键值对选项的解析结果 (AST节点或字符串) */
  tcolorboxOptions?: Ast.Ast[] | string; 
  /** (可选) 包来源，例如 "latex2e", "amsthm", "tcolorbox", "enumitem" */
  packageSource?: string;
}

// --- 从 unified-latex-custom.d.ts 迁移过来的类型 (如果适用) ---
// NewCommandSpec 似乎是 listNewcommands 的返回类型，它将被内部使用
// 在 commandDefinitionUtils.ts 中，并可能转换为 MacroInfoRecord。
// 如果需要作为公共API的一部分，则应在此处定义。

/**
 * `listNewcommands` 返回的原始宏规范。
 * DefinitionHandler 或 DefinitionExtractor 会将其转换为 Ast.MacroInfoRecord。
 */
export interface NewCommandSpec {
  name: string;       // 宏名称，可能带反斜杠
  signature: string;  // 宏的参数签名，例如 "m o m"
  body: Ast.Ast[];   // 宏体内容的AST节点数组 (修正：使用 Ast.Ast 替代 Ast.Node)
  definition: Ast.Macro; // 定义此宏的完整宏节点
}

// --- 为 refactor.md 中提到的 ResolvedParserConfig 预留位置 ---
/**
 * 内部使用的、已解析和合并的配置对象。
 * 由 ConfigManager 生成，供核心解析逻辑使用。
 */
export interface ResolvedParserConfig extends Omit<ParserOptions, 'macrosFile' | 'environmentsFile' | 'customMacroRecord' | 'customEnvironmentRecord'> {
  // 直接包含解析后的记录，而不是文件路径
  customMacroRecord: Ast.MacroInfoRecord;
  customEnvironmentRecord: Ast.EnvInfoRecord;
  loadDefaultMacros: boolean; // 确保存在且有默认值
  // 可以包含其他解析后的配置，如日志级别、工作目录等
  baseDir: string; // 项目的基目录，用于解析相对路径等
} 