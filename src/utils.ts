/**
 * 工具函数模块
 * 提供文件系统操作和路径处理等通用工具函数
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 异步读取文件内容
 * 
 * @param filePath 要读取的文件路径
 * @returns 文件内容的字符串
 */
export async function readFileAsync(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`读取文件 ${filePath} 失败: ${(error as Error).message}`);
  }
}

/**
 * 异步检查文件是否存在
 * 
 * @param filePath 要检查的文件路径
 * @returns 如果文件存在则为true，否则为false
 */
export async function fileExistsAsync(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取文件状态
 * 
 * @param filePath 文件路径
 * @returns 文件状态对象
 */
export async function getFileStats(filePath: string): Promise<fs.FileHandle> {
  try {
    return await fs.open(filePath, 'r');
  } catch (error) {
    throw new Error(`获取文件 ${filePath} 状态失败: ${(error as Error).message}`);
  }
}

/**
 * 根据基础路径解析相对路径，得到绝对路径
 * 
 * @param basePath 基础目录路径
 * @param relativePath 相对路径
 * @returns 解析后的绝对路径
 */
export function resolvePath(basePath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.resolve(basePath, relativePath);
}

/**
 * 规范化路径，解析.和..片段，确保路径分隔符一致
 * 
 * @param filePath 要规范化的文件路径
 * @returns 规范化后的路径
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * 在目录中递归查找所有具有指定TeX扩展名的文件
 * 
 * @param directoryPath 要搜索的目录路径
 * @param extensions 文件扩展名数组，默认为['.tex', '.ltx', '.latex']
 * @returns 找到的文件路径数组
 */
export async function findTexFiles(
  directoryPath: string, 
  extensions: string[] = ['.tex', '.ltx', '.latex']
): Promise<string[]> {
  const results: string[] = [];
  
  async function findFiles(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await findFiles(fullPath);
      } else if (entry.isFile() && isTexFile(fullPath, extensions)) {
        results.push(fullPath);
      }
    }
  }
  
  await findFiles(directoryPath);
  return results;
}

/**
 * 检查给定文件路径是否具有类似TeX的扩展名
 * 
 * @param filePath 文件路径
 * @param extensions 文件扩展名数组，默认为['.tex', '.ltx', '.latex']
 * @returns 如果是TeX文件则为true，否则为false
 */
export function isTexFile(
  filePath: string, 
  extensions: string[] = ['.tex', '.ltx', '.latex']
): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return extensions.includes(ext);
}

/**
 * 根据文件内容简化检查文件是否可能是LaTeX根文件
 * 
 * @param content 文件内容
 * @returns 如果看起来像根文件内容则为true
 */
export function isRootFileContent(content: string): boolean {
  // 根据文件内容检查是否包含\documentclass或\begin{document}
  return /\\documentclass(?:\s*\[.*\])?\s*\{.*\}/ms.test(content) ||
         /\\begin\s*{document}/m.test(content);
}

/**
 * 异步写入内容到文件
 * 
 * @param filePath 文件路径
 * @param content 要写入的内容
 */
export async function writeFileAsync(filePath: string, content: string): Promise<void> {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`写入文件 ${filePath} 失败: ${(error as Error).message}`);
  }
} 