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
    if (options.customMacros) {
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
    
    let customEnvironmentRecord: Ast.EnvInfoRecord | undefined;
    if (options.customEnvironments) {
      try {
        const envsContent = await utils.readFileAsync(options.customEnvironments);
        customEnvironmentRecord = JSON.parse(envsContent) as Ast.EnvInfoRecord;
        if (customEnvironmentRecord && typeof customEnvironmentRecord === 'object') {
          console.log(`已加载自定义环境定义 (来自 ${options.customEnvironments}): ${Object.keys(customEnvironmentRecord).length} 个环境`);
        }
      } catch (error) {
        console.warn(`警告: 无法加载自定义环境文件 ${options.customEnvironments}: ${(error as Error).message}`);
      }
    }
    
    const parserOptions: ParserOptions = { 
      entryPath: options.entryPath, 
      macrosFile: options.macrosFile || options.customMacros,
      loadDefaultMacros: !options.noDefaultMacros,
      customMacroRecord,
      customEnvironmentRecord,
      environmentsFile: options.environmentsFile || options.customEnvironments
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
    
    // 新增：打印分类的环境信息
    if (projectAst._detailedEnvironments) {
      const { ctanEnvironments, userProvidedEnvironments, definedInDocumentEnvironments, finalEffectiveEnvironments } = projectAst._detailedEnvironments;
      console.log(`\n--- 环境定义摘要 ---`);
      const printEnvCategory = (categoryName: string, envs: Ast.EnvInfoRecord) => {
        const envNames = Object.keys(envs);
        if (envNames.length > 0) {
          console.log(`\n[${categoryName}] (${envNames.length} 个):`);
          envNames.slice(0, 20).forEach(name => {
            console.log(`- ${name}${envs[name].signature ? ` [${envs[name].signature}]` : ''}`);
          });
          if (envNames.length > 20) {
            console.log(`  ...以及其他 ${envNames.length - 20} 个环境`);
          }
        } else {
          console.log(`\n[${categoryName}]: 无`);
        }
      };
      printEnvCategory("CTAN标准环境 (CTAN Standard Environments)", ctanEnvironments);
      printEnvCategory("用户提供/外部文件环境 (User-Provided/External)", userProvidedEnvironments);
      printEnvCategory("文档中定义的环境 (Defined in Document via \\newenvironment etc.)", definedInDocumentEnvironments);
      console.log(`\n[最终生效的环境列表] (共 ${Object.keys(finalEffectiveEnvironments).length} 个)`);
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
function parseCliArgs(args: string[]): ParserOptions & CliSpecificOptions & { customEnvironments?: string, environmentsFile?: string } {
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
    .option('e', {
      alias: 'custom-environments',
      describe: '包含自定义环境定义的JSON文件路径',
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
    .epilog('示例: latex-ast-parser ./main.tex -o ast.json --custom-macros ./my_macros.json --custom-environments ./my_envs.json');

  const argv = parser.parseSync();
  
  const entryPath = argv._[0] as string | undefined;
  
  const parserOptions: ParserOptions = {
    entryPath: entryPath || '',
    macrosFile: argv.customMacros as string | undefined,
    loadDefaultMacros: !argv.noDefaultMacros,
    customMacroRecord: undefined,
    customEnvironmentRecord: undefined,
    environmentsFile: argv.customEnvironments as string | undefined,
  };

  return {
    ...argv,
    ...parserOptions,
    customEnvironments: argv.customEnvironments as string | undefined,
    environmentsFile: argv.customEnvironments as string | undefined,
  } as ParserOptions & CliSpecificOptions & { customEnvironments?: string, environmentsFile?: string };
}

if (require.main === module) {
  mainCli().catch(error => {
    console.error(`未处理的错误: ${error.message}`);
    process.exit(1);
  });
} 