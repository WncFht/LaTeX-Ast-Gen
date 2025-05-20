/**
 * LaTeX 项目文件相关的工具函数模块。
 * 提供了查找TeX文件、判断文件类型、解析包含路径等与LaTeX项目结构和文件处理相关的特定功能。
 */

import * as nodePath from 'path';
import { fileExistsAsync, readFileAsync, getFileStatsAsync } from '../utils/fileSystem'; 
import { readdir } from 'fs/promises'; 
import { createLogger, Logger } from '../utils/logger';

const logger: Logger = createLogger('latex-utils:projectFileUtils');

/**
 * 在指定目录中递归地查找所有具有指定 TeX 扩展名的文件。
 * @param directoryPath - 要搜索的目录路径。
 * @param extensions - (可选) 包含有效 TeX 文件扩展名的字符串数组。默认为 `['.tex', '.ltx', '.latex']`。
 * @returns 一个 Promise，解析为一个包含所有找到的 TeX 文件绝对路径的字符串数组。
 */
export async function findTexFiles(
  directoryPath: string,
  extensions: string[] = ['.tex', '.ltx', '.latex']
): Promise<string[]> {
  const results: string[] = [];
  const normalizedExtensions = extensions.map(ext => ext.toLowerCase());

  async function findFilesRecursive(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      logger.warn(`无法读取目录 ${dir} 进行 TeX 文件搜索: ${(error as Error).message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findFilesRecursive(fullPath);
      } else if (entry.isFile()) {
        const ext = nodePath.extname(entry.name).toLowerCase();
        if (normalizedExtensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  await findFilesRecursive(directoryPath);
  return results;
}

/**
 * 检查给定的文件路径是否具有类似 TeX 的扩展名。
 * @param filePath - 要检查的文件路径。
 * @param extensions - (可选) 包含有效 TeX 文件扩展名的字符串数组。默认为 `['.tex', '.ltx', '.latex']`。
 * @returns 如果文件扩展名在指定列表中，则返回 `true`，否则返回 `false`。
 */
export function isTexFile(
  filePath: string,
  extensions: string[] = ['.tex', '.ltx', '.latex']
): boolean {
  const ext = nodePath.extname(filePath).toLowerCase();
  return extensions.includes(ext);
}

/**
 * 根据文件内容，简化地检查一个文件是否可能是 LaTeX 项目的根文件。
 * 主要通过查找 `\documentclass` 或 `\begin{document}` 命令。
 * @param content - 文件的文本内容。
 * @returns 如果内容中包含典型的根文件标识，则返回 `true`，否则返回 `false`。
 */
export function isRootFileContent(content: string): boolean {
  return (
    /\\documentclass(?:\s*\[.*?\])?\s*\{.*?[^\\]\}/ms.test(content) ||
    /\\begin\s*\{document\}/m.test(content)
  );
}

/**
 * 解析 LaTeX `\input` 或 `\include` 等命令中引用的文件路径。
 * 如果提供的路径没有扩展名，并且不以点号结尾，则会尝试自动添加默认扩展名 (通常是 `.tex`)。
 * @param baseDir - 当前文件所在的目录，用于解析相对路径。
 * @param includedPathName - 从 TeX 命令中提取的原始、可能不完整的路径字符串。
 * @param defaultExtension - (可选) 在路径没有扩展名时尝试添加的默认扩展名。默认为 `.tex`。
 * @returns 解析并规范化后的绝对路径字符串。此函数不检查文件是否存在。
 */
export function resolveTexPathWithExtension(
  baseDir: string,
  includedPathName: string,
  defaultExtension: string = '.tex'
): string {
  let resolvedPath = includedPathName;
  if (!nodePath.isAbsolute(resolvedPath)) {
    resolvedPath = nodePath.resolve(baseDir, resolvedPath);
  }

  if (!nodePath.extname(resolvedPath) && !resolvedPath.endsWith('.')) {
    const potentialPathWithExt = resolvedPath + defaultExtension;
    return nodePath.normalize(potentialPathWithExt).replace(/\\/g, '/');
  } 
  return nodePath.normalize(resolvedPath).replace(/\\/g, '/');
}

/**
 * 异步检查给定的路径是否指向一个实际存在的目录。
 * @param directoryPath - 要检查的目录路径。
 * @returns 如果路径是一个存在的目录，则返回 `true`，否则返回 `false`。
 */
export async function isDirectory(directoryPath: string): Promise<boolean> {
    try {
        const stats = await getFileStatsAsync(directoryPath); // 使用我们封装的 getFileStatsAsync
        return stats.isDirectory();
    } catch (error) {
        // 如果路径不存在或获取状态失败，则它不是一个有效的目录
        return false; 
    }
} 