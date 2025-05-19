#!/usr/bin/env node
"use strict";
/**
 * 主入口模块 - CLI包装器
 * 命令行工具的程序入口点
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const index_1 = require("./index");
const utils = __importStar(require("./utils"));
/**
 * CLI主执行函数
 */
async function mainCli() {
    try {
        // 解析命令行参数
        const options = parseCliArgs(process.argv.slice(2));
        // 如果请求帮助，显示帮助信息并退出
        if (options.help) {
            yargs_1.default.showHelp();
            process.exit(0);
        }
        // 验证入口路径是否提供
        if (!options.entryPath) {
            console.error('错误: 必须提供入口文件或项目目录路径');
            yargs_1.default.showHelp();
            process.exit(1);
        }
        // 准备库调用选项
        const parserOptions = {
            entryPath: options.entryPath,
            macrosFile: options.macrosFile,
            loadDefaultMacros: options.loadDefaultMacros
        };
        // 调用核心库进行项目解析
        const projectAst = await (0, index_1.parseLatexProject)(parserOptions);
        // 序列化AST
        const jsonOutput = (0, index_1.serializeProjectAstToJson)(projectAst, options.pretty);
        // 输出结果
        if (options.output) {
            await utils.writeFileAsync(options.output, jsonOutput);
            console.log(`AST已写入文件: ${options.output}`);
        }
        else {
            console.log(jsonOutput);
        }
        // 打印错误摘要
        if (projectAst.errors && projectAst.errors.length > 0) {
            console.error('\n解析过程中遇到的错误:');
            projectAst.errors.forEach(error => {
                console.error(`- ${error}`);
            });
        }
    }
    catch (error) {
        console.error(`错误: ${error.message}`);
        process.exit(1);
    }
}
/**
 * 解析命令行参数
 *
 * @param args 命令行参数数组
 * @returns 解析后的选项对象
 */
function parseCliArgs(args) {
    const parser = (0, yargs_1.default)(args)
        .usage('用法: $0 <入口路径> [选项]')
        .option('o', {
        alias: 'output',
        describe: '输出JSON文件的路径',
        type: 'string',
        default: 'ast.json'
    })
        .option('m', {
        alias: 'macros',
        describe: '包含自定义宏定义的JSON文件路径',
        type: 'string',
    })
        .option('pretty', {
        describe: '格式化JSON输出',
        type: 'boolean',
        default: true
    })
        .option('no-default-macros', {
        describe: '不加载默认宏定义',
        type: 'boolean'
    })
        .help('h')
        .alias('h', 'help')
        .epilog('示例: latex-ast-parser ./main.tex -o ast.json --pretty');
    const argv = parser.parseSync();
    // 提取入口路径（第一个非选项参数）
    const entryPath = argv._[0];
    return {
        ...argv,
        entryPath: entryPath || ''
    };
}
// 执行CLI主函数
if (require.main === module) {
    mainCli().catch(error => {
        console.error(`未处理的错误: ${error.message}`);
        process.exit(1);
    });
}
//# sourceMappingURL=main.js.map