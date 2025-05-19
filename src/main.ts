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
    const options = parseCliArgs(process.argv.slice(2));
    
    if (options.help) {
      yargs.showHelp();
      process.exit(0);
    }
    
    if (!options.entryPath) {
      console.error('错误: 必须提供入口文件或项目目录路径');
      yargs.showHelp();
      process.exit(1);
    }
    
    let customMacroRecord: Ast.MacroInfoRecord | undefined;
    if (options.customMacros) { // 注意：parseCliArgs中这个选项可能是 customMacros 或 macros
      try {
        const macrosContent = await utils.readFileAsync(options.customMacros);
        customMacroRecord = JSON.parse(macrosContent) as Ast.MacroInfoRecord;
        if (customMacroRecord && typeof customMacroRecord === 'object') {
          console.log(`已加载自定义宏定义 (来自 ${options.customMacros}): ${Object.keys(customMacroRecord).length} 个宏`);
        }
      } catch (error) {
        console.warn(`警告: 无法加载自定义宏文件 ${options.customMacros}: ${(error as Error).message}`);
      }
    }
    
    const parserOptions: ParserOptions = { 
      entryPath: options.entryPath, 
      // macrosFile 选项似乎在你的 yargs 定义中没有直接对应，需要确认
      // 如果 'custom-macros' 和 'macros' 是同一个意思，确保 yargs 解析正确
      macrosFile: options.macrosFile || options.customMacros, // 假设 customMacros 也可以是 macrosFile
      loadDefaultMacros: !options.noDefaultMacros,
      customMacroRecord
    };
    
    console.log('正在解析LaTeX项目...');
    const projectAst: ProjectAST = await parseLatexProject(parserOptions);
    
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
    
    const jsonOutput = serializeProjectAstToJson(projectAst, options.pretty);
    
    if (options.output) {
      await utils.writeFileAsync(options.output, jsonOutput);
      console.log(`项目AST已写入文件: ${options.output}`);
    } else {
      // 如果不输出到文件，则可能不需要打印整个JSON到控制台，除非用户明确要求
      // console.log(jsonOutput); 
    }
    
    // 打印分类的宏信息
    if (projectAst._detailedMacros) {
      const { defaultAndUser, definedInDocument, inferredUsed, finalEffectiveMacros } = projectAst._detailedMacros;
      
      console.log(`\n--- 宏定义摘要 ---`);

      const printMacroCategory = (categoryName: string, macros: Ast.MacroInfoRecord) => {
        const macroNames = Object.keys(macros);
        if (macroNames.length > 0) {
          console.log(`\n[${categoryName}] (${macroNames.length} 个):`);
          // 只打印前几个示例，避免刷屏
          macroNames.slice(0, 20).forEach(name => {
            console.log(`- \\${name}${macros[name].signature ? ` [${macros[name].signature}]` : ''}`);
          });
          if (macroNames.length > 20) {
            console.log(`  ...以及其他 ${macroNames.length - 20} 个宏`);
          }
        } else {
          console.log(`\n[${categoryName}]: 无`);
        }
      };

      printMacroCategory("默认及用户提供/外部文件宏 (Default/User/External)", defaultAndUser);
      printMacroCategory("文档中定义的宏 (Defined in Document via \\newcommand etc.)", definedInDocument);
      printMacroCategory("使用但未知，启发式推断的宏 (Inferred Used)", inferredUsed);
      
      console.log(`\n[最终生效的宏列表] (共 ${Object.keys(finalEffectiveMacros).length} 个)`);
      // 可以选择在这里也打印一些 finalEffectiveMacros 的例子或总数

    } else if (projectAst.macros) { // 向后兼容的打印
      console.warn("\n注意: 使用了旧版的宏信息结构进行打印。");
      const customMacros = Object.keys(projectAst.macros); // 假设所有都是 custom
      if (customMacros.length > 0) {
        console.log(`\n检测到的宏 (${customMacros.length}):`);
        for (const macro of customMacros) {
          const signature = projectAst.macros[macro].signature;
          console.log(`- \\${macro}${signature ? ` [${signature}]` : ''}`);
        }
      }
    }
    
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
    .option('c', {
      alias: 'custom-macros',
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
      type: 'boolean',
      default: false
    })
    .option('save-individual-ast', {
      describe: '将每个文件的AST保存为单独的JSON文件',
      type: 'boolean',
      default: false
    })
    .option('individual-ast-dir', {
      describe: '存储单独AST文件的目录',
      type: 'string',
      default: 'individual_asts'
    })
    .help('h')
    .alias('h', 'help')
    .epilog('示例: latex-ast-parser ./main.tex -o ast.json --custom-macros ./my_macros.json');

  const argv = parser.parseSync();
  
  const entryPath = argv._[0] as string | undefined;
  
  // 基本的 ParserOptions，确保类型正确
  const parserOptions: ParserOptions = {
    entryPath: entryPath || '',
    macrosFile: argv.customMacros as string | undefined,
    loadDefaultMacros: !argv.noDefaultMacros, // 从 argv.noDefaultMacros 计算
    customMacroRecord: undefined, // 这个由 mainCli 内部逻辑填充
  };

  // CliSpecificOptions 和其他 yargs 解析出的参数
  // argv 中已经包含了如 output, pretty, help, customMacros (路径), noDefaultMacros 等
  // 直接将 argv 展开，然后覆盖/添加特定计算或处理的字段
  return {
    ...argv, // 首先展开 argv，它包含了 yargs 解析的所有选项
    ...parserOptions, // 然后用明确构造的 parserOptions覆盖或补充，特别是类型转换和逻辑计算后的字段
    // output, pretty, help 等字段会由 ...argv 提供，类型由 yargs 保证
    // customMacros (作为文件路径) 也由 ...argv 提供
  } as ParserOptions & CliSpecificOptions;
}

if (require.main === module) {
  mainCli().catch(error => {
    console.error(`未处理的错误: ${error.message}`);
    process.exit(1);
  });
} 