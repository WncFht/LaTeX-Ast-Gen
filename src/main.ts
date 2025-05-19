#!/usr/bin/env node
/**
 * 主入口模块 - CLI包装器
 * 命令行工具的程序入口点
 */

import yargs from 'yargs';
import { parseLatexProject, serializeProjectAstToJson, saveAstAsJson } from './index';
import { ParserOptions, CliSpecificOptions, ProjectAST } from './types';
import type * as Ast from '@unified-latex/unified-latex-types';
import * as utils from './utils';
import * as path from 'path';

// 导出统一LaTeX类型供CLI扩展或调用方使用
export type { Ast };

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
    
    // 加载自定义宏定义（如果提供）
    let customMacroRecord: Ast.MacroInfoRecord | undefined;
    if (options.customMacros) {
      try {
        const macrosContent = await utils.readFileAsync(options.customMacros);
        customMacroRecord = JSON.parse(macrosContent) as Ast.MacroInfoRecord;
        if (customMacroRecord && typeof customMacroRecord === 'object') {
          console.log(`已加载自定义宏定义: ${Object.keys(customMacroRecord).length} 个宏`);
        }
      } catch (error) {
        console.warn(`警告: 无法加载自定义宏文件 ${options.customMacros}: ${(error as Error).message}`);
      }
    }
    
    // 准备库调用选项
    const parserOptions: ParserOptions = { 
      entryPath: options.entryPath, 
      macrosFile: options.macrosFile, 
      loadDefaultMacros: !options.noDefaultMacros,
      customMacroRecord
    };
    
    console.log('正在解析LaTeX项目...');
    
    // 调用核心库进行项目解析
    const projectAst: ProjectAST = await parseLatexProject(parserOptions);
    
    // 导出独立的AST文件
    if (options.saveIndividualAst) {
      const outputDir = options.individualAstDir || path.dirname(options.output || 'ast_files');
      console.log(`正在导出独立的AST文件到目录: ${outputDir}`);
      
      let fileCount = 0;
      for (const fileAst of projectAst.files) {
        const baseName = path.basename(fileAst.filePath, '.tex');
        const astFilePath = path.join(outputDir, `${baseName}.ast.json`);
        
        if (saveAstAsJson(fileAst.ast, astFilePath, options.pretty)) {
          fileCount++;
        }
      }
      
      console.log(`成功导出 ${fileCount} 个独立AST文件`);
    }
    
    // 序列化项目AST
    const jsonOutput = serializeProjectAstToJson(projectAst, options.pretty);
    
    // 输出结果
    if (options.output) {
      await utils.writeFileAsync(options.output, jsonOutput);
      console.log(`项目AST已写入文件: ${options.output}`);
    } else {
      console.log(jsonOutput);
    }
    
    // 打印自定义宏信息
    if (projectAst.macros) {
      const standardMacros = new Set([
        'documentclass', 'usepackage', 'input', 'include', 'subfile',
        'textbf', 'textit', 'texttt', 'underline', 'emph',
        'mathbb', 'mathbf', 'mathcal', 'mathrm', 'frac', 'sqrt',
        'newcommand', 'renewcommand', 'DeclareMathOperator',
        'begin', 'end', 'item', 'label', 'ref', 'cite',
        'bibliography', 'bibliographystyle', 'includegraphics', 'caption'
      ]);
      
      const customMacros = Object.keys(projectAst.macros)
        .filter(macro => !standardMacros.has(macro));
      
      if (customMacros.length > 0) {
        console.log(`\n检测到的自定义宏 (${customMacros.length}):`);
        for (const macro of customMacros) {
          const signature = projectAst.macros[macro].signature;
          console.log(`- \\${macro}${signature ? ` [${signature}]` : ''}`);
        }
      }
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
      type: 'string',
      default: 'ast.json'
    })
    .option('m', {
      alias: 'macros',
      describe: '包含自定义宏定义的JSON文件路径',
      type: 'string',
    })
    .option('c', {
      alias: 'custom-macros',
      describe: '包含自定义宏定义的JSON文件路径（更高优先级）',
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
    .option('save-individual-ast', {
      describe: '将每个文件的AST保存为单独的JSON文件',
      type: 'boolean',
      default: false
    })
    .option('individual-ast-dir', {
      describe: '存储单独AST文件的目录',
      type: 'string'
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