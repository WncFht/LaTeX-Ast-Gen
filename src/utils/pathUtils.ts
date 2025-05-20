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
 * 解析路径中的 `.` 和 `..` 片段，并确保路径分隔符统一为 POSIX 风格的 `/`。
 * @param filePath - 要规范化的文件路径。
 * @returns 规范化后的路径，使用 POSIX 分隔符。
 */
export function normalizePath(filePath: string): string {
  return nodePath.normalize(filePath).replace(/\\/g, '/');
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