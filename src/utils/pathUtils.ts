/**
 * 路径处理模块。
 * 提供通用的路径操作封装，主要基于 Node.js `path` 模块。
 */

import * as nodePath from 'path';

/**
 * 根据基础路径解析相对路径，得到绝对路径。
 * 如果 `relativePath` 已经是绝对路径，则直接返回它。
 * @param basePath - 基础目录路径。
 * @param relativePath - 相对路径。
 * @returns 解析后的绝对路径。
 */
export function resolvePath(basePath: string, relativePath: string): string {
  if (nodePath.isAbsolute(relativePath)) {
    return relativePath;
  }
  return nodePath.resolve(basePath, relativePath);
}

/**
 * 规范化路径。
 * 将所有反斜杠替换为正斜杠，然后使用 `path.posix.normalize` 进行规范化，
 * 以确保输出为 POSIX 风格的路径，并解析了 `.` 和 `..` 片段。
 * @param filePath - 要规范化的文件路径。
 * @returns 规范化后的 POSIX 风格路径。
 */
export function normalizePath(filePath: string): string {
  if (filePath === null || filePath === undefined) {
    // path.normalize(undefined) or path.normalize(null) throws error
    // For consistency with path.normalize('') -> '.'
    // we can decide how to handle null/undefined. Here, let's return empty string or throw.
    // Or, more simply, rely on TS to prevent null/undefined if arg is string.
    // Assuming filePath is always string as per type def.
  }
  const posixPath = filePath.replace(/\\/g, '/');
  let normalized = nodePath.posix.normalize(posixPath);

  // path.posix.normalize('') is '.', and path.posix.normalize('/') is '/'
  // If the original path was empty or just a slash, and normalize turned it into '.',
  // but we want to preserve an empty string for an empty input, or preserve a single slash,
  // we might need post-processing. However, for general path usage, '.' is fine for empty.
  // If the input was something like "//foo" normalize might keep it or change to "/foo"
  // If the input was "foo//bar", normalize will make it "foo/bar"
  
  // A common issue: Windows paths like C:/Users/name
  // filePath.replace will make it C:/Users/name
  // nodePath.posix.normalize("C:/Users/name") will return "C:/Users/name"
  // This is generally fine as it's a valid POSIX-like representation of that segment.

  // If normalized results in an empty string (e.g. from input like "./" then normalize(".")), but original was not empty
  // it might be better to return '.' consistent with path.normalize('')
  if (normalized === '' && filePath !== '') {
      return '.';
  }
  // path.posix.normalize('') returns '.', so this handles empty input too.
  return normalized;
}

/**
 * 获取路径中目录的名称。
 * 行为类似于 Node.js `path.dirname()`。
 * @param filePath - 文件路径。
 * @returns 目录路径字符串。
 */
export function getDirname(filePath: string): string {
  return nodePath.dirname(filePath);
}

/**
 * 获取路径中最后一部分（通常是文件名或目录名）。
 * 行为类似于 Node.js `path.basename()`。
 * @param filePath - 文件路径。
 * @param ext - (可选) 文件扩展名。如果提供，并且文件名以该扩展名结尾，则会从结果中移除此扩展名。
 * @returns 路径的最后一部分。
 */
export function getBasename(filePath: string, ext?: string): string {
  return nodePath.basename(filePath, ext);
}

/**
 * 获取路径中的文件扩展名。
 * 行为类似于 Node.js `path.extname()`。
 * @param filePath - 文件路径。
 * @returns 文件扩展名 (例如 ".txt")。如果路径没有扩展名，则返回空字符串。
 */
export function getExtname(filePath: string): string {
  return nodePath.extname(filePath);
}

/**
 * 连接所有给定的路径段，然后规范化结果路径。
 * 行为类似于 Node.js `path.join()`。
 * @param paths - 一个或多个路径段序列。
 * @returns 连接并规范化后的路径字符串。
 */
export function joinPaths(...paths: string[]): string {
  return nodePath.join(...paths);
}

/**
 * 判断一个路径是否是绝对路径。
 * 行为类似于 Node.js `path.isAbsolute()`。
 * @param filePath - 要检查的路径。
 * @returns 如果路径是绝对路径则为 `true`，否则为 `false`。
 */
export function isAbsolutePath(filePath: string): boolean {
  return nodePath.isAbsolute(filePath);
} 