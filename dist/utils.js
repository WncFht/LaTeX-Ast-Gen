"use strict";
/**
 * 工具函数模块
 * 提供文件系统操作和路径处理等通用工具函数
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileAsync = readFileAsync;
exports.fileExistsAsync = fileExistsAsync;
exports.getFileStats = getFileStats;
exports.resolvePath = resolvePath;
exports.normalizePath = normalizePath;
exports.findTexFiles = findTexFiles;
exports.isTexFile = isTexFile;
exports.isRootFileContent = isRootFileContent;
exports.writeFileAsync = writeFileAsync;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * 异步读取文件内容
 *
 * @param filePath 要读取的文件路径
 * @returns 文件内容的字符串
 */
async function readFileAsync(filePath) {
    try {
        return await fs.readFile(filePath, 'utf-8');
    }
    catch (error) {
        throw new Error(`读取文件 ${filePath} 失败: ${error.message}`);
    }
}
/**
 * 异步检查文件是否存在
 *
 * @param filePath 要检查的文件路径
 * @returns 如果文件存在则为true，否则为false
 */
async function fileExistsAsync(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 获取文件状态
 *
 * @param filePath 文件路径
 * @returns 文件状态对象
 */
async function getFileStats(filePath) {
    try {
        return await fs.open(filePath, 'r');
    }
    catch (error) {
        throw new Error(`获取文件 ${filePath} 状态失败: ${error.message}`);
    }
}
/**
 * 根据基础路径解析相对路径，得到绝对路径
 *
 * @param basePath 基础目录路径
 * @param relativePath 相对路径
 * @returns 解析后的绝对路径
 */
function resolvePath(basePath, relativePath) {
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
function normalizePath(filePath) {
    return path.normalize(filePath).replace(/\\/g, '/');
}
/**
 * 在目录中递归查找所有具有指定TeX扩展名的文件
 *
 * @param directoryPath 要搜索的目录路径
 * @param extensions 文件扩展名数组，默认为['.tex', '.ltx', '.latex']
 * @returns 找到的文件路径数组
 */
async function findTexFiles(directoryPath, extensions = ['.tex', '.ltx', '.latex']) {
    const results = [];
    async function findFiles(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await findFiles(fullPath);
            }
            else if (entry.isFile() && isTexFile(fullPath, extensions)) {
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
function isTexFile(filePath, extensions = ['.tex', '.ltx', '.latex']) {
    const ext = path.extname(filePath).toLowerCase();
    return extensions.includes(ext);
}
/**
 * 根据文件内容简化检查文件是否可能是LaTeX根文件
 *
 * @param content 文件内容
 * @returns 如果看起来像根文件内容则为true
 */
function isRootFileContent(content) {
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
async function writeFileAsync(filePath, content) {
    try {
        // 确保目录存在
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
    }
    catch (error) {
        throw new Error(`写入文件 ${filePath} 失败: ${error.message}`);
    }
}
//# sourceMappingURL=utils.js.map