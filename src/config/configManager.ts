/**
 * 配置管理器模块。
 * 
 * 负责从各种来源（如命令行参数、API调用提供的选项）加载、合并、验证和解析项目的配置选项，
 * 并生成供解析器核心逻辑使用的、统一的 {@link ResolvedParserConfig} 对象。
 */

import type { Ast } from '../types/index';
import type { CliOptions, ResolvedParserConfig, ParserOptions } from './options';
import { readFileAsync, fileExistsAsync } from '../utils/fileSystem';
import { resolvePath, getDirname } from '../utils/pathUtils';
import { createLogger, Logger } from '../utils/logger'; // LoggerLogLevel 已从 logger.ts 导出

const logger: Logger = createLogger('config:manager');

/**
 * 默认的解析器配置值。
 * 这为 `ResolvedParserConfig` 中那些在 `ParserOptions` 或 `CliOptions` 中是可选的字段提供了基础值。
 * 不包含 `entryPath` 和 `baseDir`，因为它们依赖于运行时输入。
 */
const DEFAULT_PARSER_VALUES: Omit<ResolvedParserConfig, 'entryPath' | 'baseDir'> = {
  customMacroRecord: {},
  customEnvironmentRecord: {},
  loadDefaultMacros: true,
  // 例如: logLevel: LoggerLogLevel.INFO, 
};

/**
 * 从指定的文件路径异步加载 JSON 内容，并将其解析为特定的记录类型 (宏或环境定义)。
 * @param filePath - (可选) 包含 JSON 数据的文件路径。如果未定义，则直接返回 `undefined`。
 * @param baseDir - 用于解析相对文件路径的基目录。
 * @param recordType - 描述记录类型的字符串（例如 "宏" 或 "环境"），主要用于日志记录。
 * @returns 一个 Promise，解析为类型为 `T` 的记录对象；如果文件不存在、无法读取或解析失败，则返回 `undefined`。
 */
async function loadRecordFromFile<T extends Ast.MacroInfoRecord | Ast.EnvInfoRecord>(
  filePath: string | undefined,
  baseDir: string,
  recordType: '宏' | '环境'
): Promise<T | undefined> {
  if (!filePath) {
    return undefined;
  }
  const resolvedPath = resolvePath(baseDir, filePath);
  if (!(await fileExistsAsync(resolvedPath))) {
    logger.warn(`自定义${recordType}定义文件未找到: ${resolvedPath}`);
    return undefined;
  }
  try {
    const content = await readFileAsync(resolvedPath);
    const record = JSON.parse(content) as T;
    if (record && typeof record === 'object') {
      logger.info(`已加载自定义${recordType}定义 (来自 ${resolvedPath}): ${Object.keys(record).length} 个条目。`);
      return record;
    } else {
      logger.warn(`自定义${recordType}定义文件内容格式不正确或为空: ${resolvedPath}`);
      return undefined;
    }
  } catch (error) {
    logger.warn(`无法加载或解析自定义${recordType}定义文件 ${resolvedPath}: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * （主要供 CLI 使用）
 * 将从命令行解析得到的原始 {@link CliOptions} 对象转换为一个中间配置对象。
 * 此对象包含了核心配置，但 `entryPath` 可能是未定义的 (例如用户请求帮助)，且 `baseDir` 未设定。
 * 
 * @param cliOptions - 从命令行解析得到的原始选项对象。
 * @param CWD - (可选) 当前工作目录，用于解析配置文件路径。默认为 `process.cwd()`。
 * @returns 一个 Promise，解析为一个对象，包含已加载的定义和可选的 `entryPath`。
 */
export async function resolveCliOptionsToPartialConfig(
  cliOptions: CliOptions,
  CWD: string = process.cwd()
): Promise<Omit<ResolvedParserConfig, 'entryPath' | 'baseDir'> & { entryPath?: string }> { 
  const configFileBaseDir = CWD;

  const customMacroRecordFromFile = await loadRecordFromFile<Ast.MacroInfoRecord>(
    cliOptions.customMacrosFile, configFileBaseDir, '宏'
  );
  const customEnvironmentRecordFromFile = await loadRecordFromFile<Ast.EnvInfoRecord>(
    cliOptions.customEnvironmentsFile, configFileBaseDir, '环境'
  );

  const loadDefaultMacros = cliOptions.loadDefaultMacros !== undefined
                            ? cliOptions.loadDefaultMacros
                            : DEFAULT_PARSER_VALUES.loadDefaultMacros;

  const partialConfig: Omit<ResolvedParserConfig, 'entryPath' | 'baseDir'> & { entryPath?: string } = {
    loadDefaultMacros: loadDefaultMacros!, 
    customMacroRecord: customMacroRecordFromFile || DEFAULT_PARSER_VALUES.customMacroRecord,
    customEnvironmentRecord: customEnvironmentRecordFromFile || DEFAULT_PARSER_VALUES.customEnvironmentRecord,
    entryPath: cliOptions.entryPath, 
  };

  logger.debug('从CLI选项解析的部分配置 (entryPath可能未定义, baseDir待定):', partialConfig);
  return partialConfig;
}

/**
 * （主要供库 API 调用时使用）
 * 将用户通过库 API 提供的 {@link ParserOptions}（必须包含 `entryPath`）处理并转换为完整的 {@link ResolvedParserConfig}。
 * 此函数会确定 `baseDir`，并从 `macrosFile` 和 `environmentsFile` (如果提供) 加载定义。
 * 
 * @param options - 用户提供的 {@link ParserOptions} 对象。
 * @param CWD - (可选) 当前工作目录，用于将 `options.entryPath` 解析为绝对路径。默认为 `process.cwd()`。
 * @returns 一个 Promise，解析为最终的 {@link ResolvedParserConfig} 对象。
 */
export async function processParserOptions(
    options: ParserOptions,
    CWD: string = process.cwd()
): Promise<ResolvedParserConfig> {
    const resolvedEntryPath = resolvePath(CWD, options.entryPath);
    const baseDir = getDirname(resolvedEntryPath); 

    const macrosFromFile = await loadRecordFromFile<Ast.MacroInfoRecord>(
        options.macrosFile, baseDir, '宏' 
    );
    const envsFromFile = await loadRecordFromFile<Ast.EnvInfoRecord>(
        options.environmentsFile, baseDir, '环境' 
    );

    const resolved: ResolvedParserConfig = {
        entryPath: resolvedEntryPath,
        baseDir: baseDir,
        loadDefaultMacros: options.loadDefaultMacros !== undefined
            ? options.loadDefaultMacros
            : DEFAULT_PARSER_VALUES.loadDefaultMacros!,
        customMacroRecord: options.customMacroRecord || macrosFromFile || DEFAULT_PARSER_VALUES.customMacroRecord,
        customEnvironmentRecord: options.customEnvironmentRecord || envsFromFile || DEFAULT_PARSER_VALUES.customEnvironmentRecord,
    };
    logger.debug('从ParserOptions处理得到的ResolvedConfig:', resolved);
    return resolved;
} 