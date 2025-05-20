/**
 * 轻量级日志记录模块。
 * 提供基本的、支持不同日志级别和可选作用域的日志记录功能。
 */

/**
 * 日志级别枚举。
 * 定义了从 DEBUG (最详细) 到 NONE (不输出) 的不同级别。
 */
enum LogLevel {
  DEBUG = 0, // 调试信息，非常详细
  INFO = 1,  // 普通信息，例如操作流程、状态变更
  WARN = 2,  // 警告信息，表示潜在问题但不影响当前操作
  ERROR = 3, // 错误信息，表示操作失败或遇到严重问题
  NONE = 4,  // 特殊级别，用于完全禁止所有级别的日志输出
}

/**
 * Logger 构造函数选项接口。
 */
interface LoggerOptions {
  /** (可选)为此 Logger 实例设置特定的日志级别，但当前实现中所有实例共享全局级别。 */
  level?: LogLevel;
  /** (可选)为此 Logger 实例设置的作用域名称字符串。 */
  scope?: string;
}

// TODO: 未来考虑从环境变量 (例如 DEBUG=*, DEBUG_LEVEL=info) 或应用配置来初始化默认日志级别。
let currentLogLevel: LogLevel = LogLevel.INFO; // 恢复为 INFO

/**
 * 设置全局日志记录级别。
 * 所有 Logger 实例将仅记录等于或高于此级别的消息。
 * @param level - 要设置的新日志级别。
 */
export function setGlobalLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * 获取当前设置的全局日志记录级别。
 * @returns 当前的 {@link LogLevel}。
 */
export function getGlobalLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * 内部日志函数，根据级别格式化并输出消息。
 * @param level - 此条消息的日志级别。
 * @param message - 主要的日志消息字符串。
 * @param scope - (可选) 此条消息的来源或作用域。
 * @param optionalParams - (可选) 附加到日志消息的其他参数，行为类似 `console.log`。
 */
function log(level: LogLevel, message: string, scope?: string, ...optionalParams: any[]): void {
  if (level < currentLogLevel) { // 如果消息级别低于当前设置的全局级别，则不记录
    return;
  }

  const timestamp = new Date().toISOString();
  const levelStr = LogLevel[level].padEnd(5, ' '); // 例如 "INFO "
  const scopeStr = scope ? `[${scope}] ` : ''; // 例如 "[core:Parser] "

  const formattedMessage = `${timestamp} [${levelStr}] ${scopeStr}${message}`;

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage, ...optionalParams);
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, ...optionalParams);
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, ...optionalParams);
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage, ...optionalParams);
      break;
    // LogLevel.NONE 不会在此处处理，因为它会通过 level < currentLogLevel 过滤掉
    default:
      // 对于未预期的级别，可以选择静默处理或在 console.log 输出
      // console.log(formattedMessage, ...optionalParams);
      break;
  }
}

/**
 * Logger 类，提供带作用域的日志记录方法。
 */
export class Logger {
  private scope?: string;

  /**
   * 创建一个新的 Logger 实例。
   * @param optionsOrScope - 可以是 {@link LoggerOptions} 对象或表示作用域的字符串。
   */
  constructor(optionsOrScope?: LoggerOptions | string) {
    if (typeof optionsOrScope === 'string') {
      this.scope = optionsOrScope;
    } else {
      this.scope = optionsOrScope?.scope;
      // 注意：当前实现中，实例的 `level` 选项被忽略，所有实例共享 `currentLogLevel`。
    }
  }

  /**
   * 记录 DEBUG 级别的消息。
   * @param message - 日志消息。
   * @param optionalParams - 附加参数。
   */
  debug(message: string, ...optionalParams: any[]): void {
    log(LogLevel.DEBUG, message, this.scope, ...optionalParams);
  }

  /**
   * 记录 INFO 级别的消息。
   * @param message - 日志消息。
   * @param optionalParams - 附加参数。
   */
  info(message: string, ...optionalParams: any[]): void {
    log(LogLevel.INFO, message, this.scope, ...optionalParams);
  }

  /**
   * 记录 WARN 级别的消息。
   * @param message - 日志消息。
   * @param optionalParams - 附加参数。
   */
  warn(message: string, ...optionalParams: any[]): void {
    log(LogLevel.WARN, message, this.scope, ...optionalParams);
  }

  /**
   * 记录 ERROR 级别的消息。
   * @param message - 日志消息。
   * @param optionalParams - 附加参数。
   */
  error(message: string, ...optionalParams: any[]): void {
    log(LogLevel.ERROR, message, this.scope, ...optionalParams);
  }
}

/**
 * 创建一个具有指定作用域的新 Logger 实例。
 * @param scope - 日志作用域的名称字符串。
 * @returns 返回一个新的 {@link Logger} 实例。
 */
export function createLogger(scope: string): Logger {
  return new Logger(scope);
}

// 为方便起见，导出不带作用域的顶级日志函数
/** 记录 DEBUG 级别的全局日志消息。 */
export const debug = (message: string, ...optionalParams: any[]) => log(LogLevel.DEBUG, message, undefined, ...optionalParams);
/** 记录 INFO 级别的全局日志消息。 */
export const info = (message: string, ...optionalParams: any[]) => log(LogLevel.INFO, message, undefined, ...optionalParams);
/** 记录 WARN 级别的全局日志消息。 */
export const warn = (message: string, ...optionalParams: any[]) => log(LogLevel.WARN, message, undefined, ...optionalParams);
/** 记录 ERROR 级别的全局日志消息。 */
export const error = (message: string, ...optionalParams: any[]) => log(LogLevel.ERROR, message, undefined, ...optionalParams);

// 重新导出 LogLevel 枚举，通常命名为 LoggerLogLevel 以避免与可能的外部 LogLevel 冲突
export { LogLevel as LoggerLogLevel }; 