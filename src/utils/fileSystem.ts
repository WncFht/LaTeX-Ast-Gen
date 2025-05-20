/**
 * 文件系统操作模块。
 * 提供通用的、基于 Promise 的文件系统操作封装。
 */

import * as fsPromises from 'fs/promises';
import { Stats } from 'fs'; // <--- 从 'fs' 导入 Stats
import * as nodePath from 'path'; // 使用 nodePath 避免与自定义 pathUtils 冲突

/**
 * 异步读取文件内容。
 * @param filePath - 要读取的文件路径。
 * @returns 返回一个 Promise，解析为文件内容的字符串。
 * @throws 如果读取文件失败，则抛出错误。
 */
export async function readFileAsync(filePath: string): Promise<string> {
  try {
    return await fsPromises.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`读取文件 ${filePath} 失败: ${(error as Error).message}`);
  }
}

/**
 * 异步将内容写入文件。
 * 如果目标目录不存在，会尝试递归创建它。
 * @param filePath - 要写入的文件路径。
 * @param content - 要写入文件的字符串内容。
 * @returns 返回一个 Promise，在写入成功时解析。
 * @throws 如果写入文件或创建目录失败，则抛出错误。
 */
export async function writeFileAsync(filePath: string, content: string): Promise<void> {
  try {
    const dir = nodePath.dirname(filePath);
    // recursive: true 使得如果目录已存在也不会报错
    await fsPromises.mkdir(dir, { recursive: true });
    await fsPromises.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`写入文件 ${filePath} 失败: ${(error as Error).message}`);
  }
}

/**
 * 异步检查文件是否存在。
 * @param filePath - 要检查的文件路径。
 * @returns 返回一个 Promise，如果文件存在则解析为 `true`，否则为 `false`。
 */
export async function fileExistsAsync(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 异步获取文件或目录的状态信息。
 * @param filePath - 文件或目录的路径。
 * @returns 返回一个 Promise，解析为 Node.js `fs.Stats` 对象。
 * @throws 如果获取状态失败（例如路径不存在），则抛出错误。
 */
export async function getFileStatsAsync(filePath: string): Promise<Stats> { // <--- 使用导入的 Stats 类型
  try {
    return await fsPromises.stat(filePath);
  } catch (error) {
    throw new Error(`获取文件 ${filePath} 状态失败: ${(error as Error).message}`);
  }
}

/**
 * 异步创建目录，包括所有必需的父目录。
 * 如果目录已存在，则不执行任何操作，也不会报错。
 * @param dirPath - 要创建的目录路径。
 * @returns 返回一个 Promise，在目录成功创建或已存在时解析。
 * @throws 如果创建目录失败（非目录已存在原因），则抛出错误。
 */
export async function mkdirRecursiveAsync(dirPath: string): Promise<void> {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // fsPromises.mkdir({ recursive: true }) 在目录已存在时不会抛错，
    // 所以这里的错误通常是其他类型的文件系统错误。
    throw new Error(`创建目录 ${dirPath} 失败: ${(error as Error).message}`);
  }
} 