"use strict";
/**
 * 项目解析器模块
 * 作为核心协调器管理整个LaTeX项目的解析过程
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
exports.ProjectParser = void 0;
exports.parseLatexProject = parseLatexProject;
const path = __importStar(require("path"));
const utils = __importStar(require("./utils"));
const fileParser_1 = require("./fileParser");
const macroHandler_1 = require("./macroHandler");
/**
 * 项目解析器类
 * 管理整个LaTeX项目的解析过程
 */
class ProjectParser {
    /**
     * 创建一个新的ProjectParser实例
     * @param customMacroHandler 可选的预配置MacroHandler实例
     */
    constructor(customMacroHandler) {
        this.fileParser = new fileParser_1.FileParser();
        this.macroHandler = customMacroHandler || new macroHandler_1.MacroHandler();
        this.parsedFiles = new Set();
        this.projectAstMap = new Map();
        this.projectFileErrors = new Map();
        this.projectGlobalErrors = [];
        this.rootFilePath = null;
    }
    /**
     * 解析LaTeX项目
     * @param entryPath 入口文件路径或项目目录
     * @param options 解析选项
     * @returns 项目AST
     */
    async parse(entryPath, options) {
        // 重置状态以支持多次调用
        this.parsedFiles.clear();
        this.projectAstMap.clear();
        this.projectFileErrors.clear();
        this.projectGlobalErrors = [];
        this.rootFilePath = null;
        // 如果提供了选项，重新配置MacroHandler
        if (options) {
            // 如果提供了macrosFile或customMacroRecord，创建新的MacroHandler
            if (options.macrosFile || options.customMacroRecord !== undefined || options.loadDefaultMacros !== undefined) {
                this.macroHandler = new macroHandler_1.MacroHandler({
                    entryPath,
                    macrosFile: options.macrosFile,
                    customMacroRecord: options.customMacroRecord,
                    loadDefaultMacros: options.loadDefaultMacros
                });
            }
        }
        // 确定根文件
        const rootFile = await this.determineRootFile(entryPath);
        if (!rootFile) {
            this.projectGlobalErrors.push(`无法确定根文件，入口路径: ${entryPath}`);
            // 返回包含错误信息的部分结果
            return {
                rootFilePath: null,
                files: [],
                macros: this.macroHandler.getCurrentMacros(),
                errors: this.projectGlobalErrors
            };
        }
        this.rootFilePath = rootFile;
        // 初始化解析队列
        const filesToParse = [this.rootFilePath];
        // 循环解析文件
        while (filesToParse.length > 0) {
            const currentFilePath = filesToParse.shift();
            const normalizedPath = utils.normalizePath(currentFilePath);
            // 防止重复解析
            if (this.parsedFiles.has(normalizedPath)) {
                continue;
            }
            this.parsedFiles.add(normalizedPath);
            // 解析文件
            const parseResult = await this.fileParser.parseFile(normalizedPath, this.macroHandler.getCurrentMacros());
            // 记录AST（即使为null）
            this.projectAstMap.set(normalizedPath, parseResult.ast);
            // 记录错误（如果有）
            if (parseResult.error) {
                this.projectFileErrors.set(normalizedPath, parseResult.error);
            }
            // 更新宏定义
            if (Object.keys(parseResult.newMacros).length > 0) {
                this.macroHandler.addMacros(parseResult.newMacros);
            }
            // 添加包含的文件到解析队列
            for (const includedFile of parseResult.includedFiles) {
                filesToParse.push(includedFile.path);
            }
        }
        // 构建结果
        const projectFileAstArray = [];
        for (const [filePath, ast] of this.projectAstMap.entries()) {
            if (ast !== null) {
                projectFileAstArray.push({
                    filePath,
                    ast,
                    error: this.projectFileErrors.get(filePath)
                });
            }
            else {
                // 对于解析失败的文件，只添加错误信息到全局错误
                if (this.projectFileErrors.has(filePath)) {
                    this.projectGlobalErrors.push(`文件 ${filePath} 解析失败: ${this.projectFileErrors.get(filePath)}`);
                }
            }
        }
        // 返回ProjectAST
        return {
            rootFilePath: this.rootFilePath,
            files: projectFileAstArray,
            macros: this.macroHandler.getCurrentMacros(),
            errors: this.projectGlobalErrors.length > 0 ? this.projectGlobalErrors : undefined
        };
    }
    /**
     * 确定根文件
     * @param entryPath 入口路径（文件或目录）
     * @returns 根文件路径，如果找不到则为null
     * @private
     */
    async determineRootFile(entryPath) {
        try {
            // 检查入口路径是否存在
            const entryExists = await utils.fileExistsAsync(entryPath);
            if (!entryExists) {
                this.projectGlobalErrors.push(`入口路径不存在: ${entryPath}`);
                return null;
            }
            // 获取路径状态
            const fileHandle = await utils.getFileStats(entryPath);
            const stats = await fileHandle.stat();
            await fileHandle.close();
            // 如果是文件
            if (stats.isFile()) {
                // 检查是否是TeX文件
                if (utils.isTexFile(entryPath)) {
                    return utils.normalizePath(path.resolve(entryPath));
                }
                else {
                    this.projectGlobalErrors.push(`入口文件不是TeX文件: ${entryPath}`);
                    return null;
                }
            }
            // 如果是目录
            if (stats.isDirectory()) {
                // 策略1: 检查常见根文件名
                const commonRootFileNames = ['main.tex', 'root.tex', 'master.tex', 'document.tex'];
                for (const fileName of commonRootFileNames) {
                    const filePath = path.join(entryPath, fileName);
                    if (await utils.fileExistsAsync(filePath)) {
                        return utils.normalizePath(path.resolve(filePath));
                    }
                }
                // 策略2: 查找包含\documentclass的文件
                const texFiles = await utils.findTexFiles(entryPath);
                const rootCandidates = [];
                for (const texFile of texFiles) {
                    try {
                        const content = await utils.readFileAsync(texFile);
                        if (utils.isRootFileContent(content)) {
                            rootCandidates.push(texFile);
                        }
                    }
                    catch (error) {
                        // 忽略读取错误，继续检查其他文件
                    }
                }
                if (rootCandidates.length === 1) {
                    return utils.normalizePath(path.resolve(rootCandidates[0]));
                }
                else if (rootCandidates.length > 1) {
                    this.projectGlobalErrors.push(`发现多个可能的根文件: ${rootCandidates.join(', ')}，使用第一个: ${rootCandidates[0]}`);
                    return utils.normalizePath(path.resolve(rootCandidates[0]));
                }
                this.projectGlobalErrors.push(`在目录 ${entryPath} 中未找到根文件`);
                return null;
            }
            this.projectGlobalErrors.push(`入口路径既不是文件也不是目录: ${entryPath}`);
            return null;
        }
        catch (error) {
            this.projectGlobalErrors.push(`确定根文件时出错: ${error.message}`);
            return null;
        }
    }
}
exports.ProjectParser = ProjectParser;
/**
 * 解析LaTeX项目
 * 提供简单的API入口点
 * @param options 解析选项
 * @returns 项目AST
 */
async function parseLatexProject(options) {
    const macroOptsForHandler = {
        macrosFile: options.macrosFile,
        loadDefaultMacros: options.loadDefaultMacros,
        customMacroRecord: options.customMacroRecord
    };
    const macroHandler = new macroHandler_1.MacroHandler({
        entryPath: options.entryPath,
        ...macroOptsForHandler
    });
    const projectParser = new ProjectParser(macroHandler);
    return projectParser.parse(options.entryPath);
}
//# sourceMappingURL=projectParser.js.map