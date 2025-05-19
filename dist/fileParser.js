"use strict";
/**
 * 文件解析器模块
 * 解析单个LaTeX源文件，提取AST、宏定义和文件引用
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
exports.FileParser = void 0;
const path = __importStar(require("path"));
// @ts-expect-error 导入自定义的unified.js文件
const unified_js_1 = require("../resources/unified.js");
const utils = __importStar(require("./utils"));
/**
 * 文件解析器类
 * 处理单个LaTeX文件的解析
 */
class FileParser {
    /**
     * 解析指定的LaTeX文件
     *
     * @param filePath 要解析的文件的绝对路径
     * @param currentMacroRecord 当前已知的宏定义集合
     * @returns 包含AST、新宏定义和包含的文件的解析结果
     */
    async parseFile(filePath, currentMacroRecord) {
        try {
            // 读取文件内容
            const content = await utils.readFileAsync(filePath);
            // 解析AST
            const ast = this.parseLatexContent(content, currentMacroRecord);
            // 如果解析成功，提取新宏和包含的文件
            if (ast) {
                const baseDir = path.dirname(filePath);
                const newMacros = this.extractNewMacros(ast);
                const includedFiles = this.extractIncludedFiles(ast, baseDir);
                return {
                    ast,
                    newMacros,
                    includedFiles
                };
            }
            else {
                // 解析失败，返回null AST
                return {
                    ast: null,
                    newMacros: {},
                    includedFiles: [],
                    error: `文件 ${filePath} 解析失败`
                };
            }
        }
        catch (error) {
            // 处理文件读取或解析错误
            return {
                ast: null,
                newMacros: {},
                includedFiles: [],
                error: `处理文件 ${filePath} 时出错: ${error.message}`
            };
        }
    }
    /**
     * 解析LaTeX文本内容为AST
     *
     * @param content LaTeX文本内容
     * @param macroRecord 宏定义记录
     * @returns 解析得到的AST，如果解析失败则为null
     * @private
     */
    parseLatexContent(content, macroRecord) {
        try {
            // 创建解析器实例，参考LaTeX-Workshop的实现
            const parser = (0, unified_js_1.getParser)({
                flags: { autodetectExpl3AndAtLetter: true }
            });
            // 解析内容为AST
            const ast = parser.parse(content);
            // 附加宏参数
            (0, unified_js_1.attachMacroArgs)(ast, macroRecord);
            return ast;
        }
        catch (error) {
            console.error('解析LaTeX内容时出错:', error);
            return null;
        }
    }
    /**
     * 从AST中提取新定义的宏
     *
     * @param ast LaTeX AST
     * @returns 新宏定义的记录
     * @private
     */
    extractNewMacros(ast) {
        const newMacros = {};
        // 访问AST中的所有宏节点
        this.visitMacros(ast, (node) => {
            // 检查是否是定义新宏的命令
            if (['newcommand', 'renewcommand'].includes(node.content)) {
                this.processMacroDefinition(node, newMacros);
            }
            else if (node.content === 'DeclareMathOperator') {
                this.processMathOperator(node, newMacros);
            }
            // 可以添加更多宏定义命令的处理...
        });
        return newMacros;
    }
    /**
     * 访问AST中的所有宏节点
     *
     * @param node AST节点
     * @param callback 回调函数
     */
    visitMacros(node, callback) {
        if (!node)
            return;
        if (node.type === 'macro') {
            callback(node);
        }
        // 递归处理子节点
        if ('content' in node && Array.isArray(node.content)) {
            for (const child of node.content) {
                if (typeof child === 'object' && child !== null) {
                    this.visitMacros(child, callback);
                }
            }
        }
        // 处理参数
        if ('args' in node && Array.isArray(node.args)) {
            for (const arg of node.args) {
                if (typeof arg === 'object' && arg !== null) {
                    // 处理参数内容
                    if ('content' in arg) {
                        if (Array.isArray(arg.content)) {
                            for (const content of arg.content) {
                                if (typeof content === 'object' && content !== null) {
                                    this.visitMacros(content, callback);
                                }
                            }
                        }
                        else if (typeof arg.content === 'object' && arg.content !== null) {
                            this.visitMacros(arg.content, callback);
                        }
                    }
                }
            }
        }
    }
    /**
     * 处理newcommand或renewcommand宏定义
     *
     * @param node 宏节点
     * @param macros 宏定义记录
     * @private
     */
    processMacroDefinition(node, macros) {
        // 确保节点有args属性
        if (!node.args || node.args.length < 1)
            return;
        // 提取命令名
        const firstArg = node.args[0];
        if (!firstArg || firstArg.type !== 'argument' || !firstArg.content)
            return;
        let macroName = '';
        // 处理命令名参数
        if (Array.isArray(firstArg.content)) {
            // 如果内容是数组，查找macro节点
            const macroNode = firstArg.content.find((n) => n.type === 'macro');
            if (macroNode) {
                macroName = macroNode.content;
            }
        }
        else if (typeof firstArg.content === 'string') {
            // 如果内容是字符串，直接使用
            macroName = firstArg.content;
        }
        if (!macroName)
            return;
        // 确定参数数量
        let argCount = 0;
        let optionalArgSpec = '';
        // 如果有第二个参数，它通常指定参数数量
        if (node.args.length > 1 && node.args[1]?.type === 'argument') {
            const countArg = node.args[1];
            if (typeof countArg.content === 'string') {
                argCount = parseInt(countArg.content, 10) || 0;
            }
        }
        // 如果有第三个参数，它通常指定可选参数的默认值
        if (node.args.length > 2 && node.args[2]?.type === 'argument') {
            optionalArgSpec = 'o';
            argCount = Math.max(0, argCount - 1); // 减去可选参数
        }
        // 构建参数签名
        let signature = optionalArgSpec;
        for (let i = 0; i < argCount; i++) {
            signature += ' m';
        }
        // 添加到宏定义记录
        macros[macroName] = { signature: signature.trim() };
    }
    /**
     * 处理DeclareMathOperator宏定义
     *
     * @param node 宏节点
     * @param macros 宏定义记录
     * @private
     */
    processMathOperator(node, macros) {
        // 确保节点有args属性
        if (!node.args || node.args.length < 1)
            return;
        // 提取命令名
        const firstArg = node.args[0];
        if (!firstArg || firstArg.type !== 'argument' || !firstArg.content)
            return;
        let macroName = '';
        // 处理命令名参数
        if (Array.isArray(firstArg.content)) {
            // 如果内容是数组，查找macro节点
            const macroNode = firstArg.content.find((n) => n.type === 'macro');
            if (macroNode) {
                macroName = macroNode.content;
            }
        }
        else if (typeof firstArg.content === 'string') {
            // 如果内容是字符串，直接使用
            macroName = firstArg.content;
        }
        if (!macroName)
            return;
        // 数学运算符通常没有参数
        macros[macroName] = { signature: '' };
    }
    /**
     * 从AST中提取包含的文件
     *
     * @param ast LaTeX AST
     * @param baseDir 基础目录路径
     * @returns 包含文件信息的数组
     * @private
     */
    extractIncludedFiles(ast, baseDir) {
        const includedFiles = [];
        // 包含文件的命令列表
        const includeCommands = ['input', 'include', 'subfile'];
        // 访问AST中的所有宏节点
        this.visitMacros(ast, (node) => {
            // 检查是否是包含文件的命令
            if (includeCommands.includes(node.content)) {
                // 确保节点有args属性
                if (!node.args || node.args.length < 1)
                    return;
                // 提取文件路径
                const firstArg = node.args[0];
                if (!firstArg || firstArg.type !== 'argument')
                    return;
                let rawPath = '';
                // 提取路径字符串
                if (Array.isArray(firstArg.content)) {
                    // 如果内容是数组，将其转换为字符串
                    rawPath = firstArg.content
                        .map((n) => {
                        if (typeof n === 'string')
                            return n;
                        if (n.type === 'string' && 'content' in n)
                            return n.content;
                        return '';
                    })
                        .join('');
                }
                else if (typeof firstArg.content === 'string') {
                    // 如果内容是字符串，直接使用
                    rawPath = firstArg.content;
                }
                if (!rawPath)
                    return;
                // 解析相对路径
                let resolvedPath = utils.resolvePath(baseDir, rawPath);
                // 如果没有扩展名，尝试添加.tex
                if (!path.extname(resolvedPath)) {
                    resolvedPath += '.tex';
                }
                // 规范化路径
                const normalizedPath = utils.normalizePath(resolvedPath);
                // 添加到包含文件列表
                includedFiles.push({
                    path: normalizedPath,
                    command: node.content,
                    rawPath: rawPath
                });
            }
        });
        return includedFiles;
    }
}
exports.FileParser = FileParser;
//# sourceMappingURL=fileParser.js.map