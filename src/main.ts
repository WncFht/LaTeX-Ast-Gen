#!/usr/bin/env node
/**
 * 主入口模块 - CLI包装器
 * 命令行工具的程序入口点
 */

import yargs from 'yargs';
import { parseLatexProject, serializeProjectAstToJson } from './index';
import { ParserOptions, CliSpecificOptions, ProjectAST } from './types';
import * as utils from './utils';

/**
 * CLI主执行函数
 */
async function mainCli(): Promise<void> {
  try {
    // 解析命令行参数
    const options = parseCliArgs(process.argv.slice(2));
    
    // 如果请求帮助，显示帮助信息并退出
    if (options.help) {
      yargs.showHelp();
      process.exit(0);
    }
    
    // 验证入口路径是否提供
    if (!options.entryPath) {
      console.error('错误: 必须提供入口文件或项目目录路径');
      yargs.showHelp();
      process.exit(1);
    }
    
    // 准备库调用选项
    const parserOptions: ParserOptions = { 
      entryPath: options.entryPath, 
      macrosFile: options.macrosFile, 
      loadDefaultMacros: options.loadDefaultMacros 
    };
    
    // 调用核心库进行项目解析
    const projectAst: ProjectAST = await parseLatexProject(parserOptions);
    
    // 序列化AST
    const jsonOutput = serializeProjectAstToJson(projectAst, options.pretty);
    
    // 输出结果
    if (options.output) {
      await utils.writeFileAsync(options.output, jsonOutput);
      console.log(`AST已写入文件: ${options.output}`);
    } else {
      console.log(jsonOutput);
    }
    
    // 打印错误摘要
    if (projectAst.errors && projectAst.errors.length > 0) {
      console.error('\n解析过程中遇到的错误:');
      projectAst.errors.forEach(error => {
        console.error(`- ${error}`);
      });
    }
  } catch (error) {
    console.error(`错误: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * 解析命令行参数
 * 
 * @param args 命令行参数数组
 * @returns 解析后的选项对象
 */
function parseCliArgs(args: string[]): ParserOptions & CliSpecificOptions {
  const parser = yargs(args)
    .usage('用法: $0 <入口路径> [选项]')
    .option('o', {
      alias: 'output',
      describe: '输出JSON文件的路径',
      type: 'string'
    })
    .option('m', {
      alias: 'macros',
      describe: '包含自定义宏定义的JSON文件路径',
      type: 'string'
    })
    .option('pretty', {
      describe: '格式化JSON输出',
      type: 'boolean',
      default: false
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
  const entryPath = argv._[0] as string | undefined;
  
  return {
    ...argv,
    entryPath: entryPath || ''
  } as ParserOptions & CliSpecificOptions;
}

// 执行CLI主函数
if (require.main === module) {
  mainCli().catch(error => {
    console.error(`未处理的错误: ${error.message}`);
    process.exit(1);
  });
} 