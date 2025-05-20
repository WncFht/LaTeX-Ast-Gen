#!/usr/bin/env node
/**
 * 主入口模块 - CLI 包装器 (重构版)
 *
 * 命令行工具的程序入口点。
 * 使用新的模块化结构 (ProjectProcessor, ConfigManager, AstSerializer等)。
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { Ast, ProjectAST, CliOptions, ParserOptions } from '../types/index';
import { ProjectProcessor } from '../core/ProjectProcessor';
import { serializeProjectAstToJson, saveAstDataAsJson } from '../ast/AstSerializer';
import { writeFileAsync } from '../utils/fileSystem';
import { joinPaths, getDirname, getBasename } from '../utils/pathUtils';
import { createLogger, Logger, setGlobalLogLevel, LoggerLogLevel } from '../utils/logger';

// 初始化顶层 logger
const cliLogger: Logger = createLogger('cli:main');

// 全局类型导出 (如果其他CLI工具可能需要从这个主文件导入)
export type { Ast };

/**
 * 解析命令行参数。
 * @param args - 来自 process.argv 的参数数组 (通常是 process.argv.slice(2) 或 yargs 的 hideBin(process.argv))。
 * @returns 解析后的 CliOptions 对象。
 */
function parseCliArguments(args: string[]): CliOptions {
  const parser = yargs(args)
    .usage('用法: $0 <入口路径> [选项]')
    .positional('entryPath', {
      describe: '根 .tex 文件或项目目录的路径',
      type: 'string',
    })
    .option('output', {
      alias: 'o',
      describe: '输出JSON文件的路径',
      type: 'string',
      default: 'ast.json',
    })
    .option('custom-macros-file', {
      alias: 'c',
      describe: '包含自定义宏定义的JSON文件路径',
      type: 'string',
    })
    .option('custom-environments-file', {
      alias: 'e',
      describe: '包含自定义环境定义的JSON文件路径',
      type: 'string',
    })
    .option('pretty', {
      describe: '格式化JSON输出',
      type: 'boolean',
      default: true,
    })
    .option('load-default-macros', {
      describe: '是否加载默认宏定义',
      type: 'boolean',
      default: true,
    })
    .option('save-individual-ast', {
      describe: '将每个文件的AST保存为单独的JSON文件',
      type: 'boolean',
      default: false,
    })
    .option('individual-ast-dir', {
      describe: '存储单独AST文件的目录',
      type: 'string',
      default: 'individual_asts',
    })
    .option('verbose', {
        alias: 'v',
        describe: '输出详细日志 (DEBUG级别)',
        type: 'boolean',
        default: false,
    })
    .option('silent', {
        describe: '禁止所有日志输出 (NONE级别)',
        type: 'boolean',
        default: false,
    })
    .help('h')
    .alias('h', 'help')
    .epilog('示例: latex-ast-parser ./main.tex -o project_ast.json -c ./my_macros.json');

  const argv = parser.parseSync();

  const entryPath = argv._[0] as string | undefined;
  // 如果不是请求帮助信息，并且没有提供入口路径，则报错并退出
  if (!entryPath && args.length > 0 && !args.includes('-h') && !args.includes('--help') && !argv.help) { 
      cliLogger.error('错误: 必须提供入口文件或项目目录路径。');
      parser.showHelp();
      process.exit(1);
  }
  
  return {
    entryPath: entryPath,
    output: argv.output as string,
    customMacrosFile: argv.customMacrosFile as string | undefined,
    customEnvironmentsFile: argv.customEnvironmentsFile as string | undefined,
    pretty: argv.pretty as boolean,
    loadDefaultMacros: argv.loadDefaultMacros as boolean, 
    saveIndividualAst: argv.saveIndividualAst as boolean,
    individualAstDir: argv.individualAstDir as string,
    showHelp: argv.help as boolean,
    verbose: argv.verbose as boolean,
    silent: argv.silent as boolean,
  } as CliOptions; 
}

/**
 * CLI 主执行函数 (重构版)。
 */
async function mainCli(): Promise<void> {
  const cliArgs = parseCliArguments(hideBin(process.argv));

  if (cliArgs.showHelp && !cliArgs.entryPath) { 
    process.exit(0);
  }

  if (!cliArgs.entryPath) {
    cliLogger.error('入口路径未提供。请使用 --help 查看用法。');
    process.exit(1);
  }

  if (cliArgs.silent) {
    setGlobalLogLevel(LoggerLogLevel.NONE);
  } else if (cliArgs.verbose) {
    setGlobalLogLevel(LoggerLogLevel.DEBUG);
  }

  cliLogger.info('LaTeX AST 解析器 CLI 开始运行...');
  cliLogger.debug('解析得到的CLI参数:', cliArgs);

  try {
    const projectProcessor = new ProjectProcessor();
    
    const parserOptions: Omit<ParserOptions, 'entryPath'> = {
        macrosFile: cliArgs.customMacrosFile,
        environmentsFile: cliArgs.customEnvironmentsFile,
        customMacroRecord: undefined, 
        customEnvironmentRecord: undefined, 
        loadDefaultMacros: cliArgs.loadDefaultMacros,
    };

    cliLogger.info(`正在解析LaTeX项目，入口: ${cliArgs.entryPath}`);
    const projectAst: ProjectAST = await projectProcessor.parse(cliArgs.entryPath, parserOptions);
    cliLogger.info('项目解析完成。');

    if (cliArgs.saveIndividualAst && projectAst.files) {
      const outputDir = cliArgs.individualAstDir || 'individual_asts';
      cliLogger.info(`正在导出独立的AST文件到目录: ${outputDir}`);
      let fileCount = 0;
      for (const fileAst of projectAst.files) {
        if (!fileAst.ast) { 
            cliLogger.warn(`跳过导出文件 ${fileAst.filePath} 的AST，因为它未能成功解析。`);
            continue;
        }
        const parentDirName = getDirname(fileAst.filePath).split(/[\/\\]/).pop() || 'unknown_parent';
        const fileNameWithoutExt = getBasename(fileAst.filePath, '.tex');
        const astBaseName = `${parentDirName}_${fileNameWithoutExt}`;
        const astFilePath = joinPaths(outputDir, `${astBaseName}.ast.json`);
        if (await saveAstDataAsJson(fileAst.ast, astFilePath, cliArgs.pretty)) {
          fileCount++;
        }
      }
      cliLogger.info(`成功导出 ${fileCount} 个独立AST文件。`);
    }

    const jsonOutput = serializeProjectAstToJson(projectAst, cliArgs.pretty);

    if (cliArgs.output && cliArgs.output !== '-') { 
      await writeFileAsync(cliArgs.output, jsonOutput);
      cliLogger.info(`项目AST已写入文件: ${cliArgs.output}`);
    } else {
      console.log(jsonOutput); 
    }

    if (projectAst._detailedMacros) {
        cliLogger.info(`\n--- 宏定义摘要 ---`);
        const { defaultAndUser, definedInDocument, inferredUsed, finalEffectiveMacros } = projectAst._detailedMacros;
        const printMacroCat = (catName: string, macros: Ast.MacroInfoRecord) => {
            const names = Object.keys(macros);
            cliLogger.info(`[${catName}] (${names.length} 个):` + (names.length > 0 ? '' : ' 无'));
            names.slice(0, 10).forEach(name => cliLogger.info(`  - \\${name}${macros[name].signature ? ` [${macros[name].signature}]` : ''}`));
            if (names.length > 10) cliLogger.info(`  ...及其他 ${names.length - 10} 个`);
        };
        printMacroCat("默认/用户提供", defaultAndUser);
        printMacroCat("文档内定义", definedInDocument);
        printMacroCat("推断使用", inferredUsed);
        cliLogger.info(`[最终生效宏] (${Object.keys(finalEffectiveMacros).length} 个)`);
    }
    if (projectAst._detailedEnvironments) {
        cliLogger.info(`\n--- 环境定义摘要 ---`);
        const { ctanEnvironments, userProvidedEnvironments, definedInDocumentEnvironments, finalEffectiveEnvironments } = projectAst._detailedEnvironments;
        const printEnvCat = (catName: string, envs: Ast.EnvInfoRecord) => {
            const names = Object.keys(envs);
            cliLogger.info(`[${catName}] (${names.length} 个):` + (names.length > 0 ? '' : ' 无'));
            names.slice(0, 10).forEach(name => cliLogger.info(`  - ${name}${envs[name].signature ? ` [${envs[name].signature}]` : ''}`));
            if (names.length > 10) cliLogger.info(`  ...及其他 ${names.length - 10} 个`);
        };
        printEnvCat("CTAN标准", ctanEnvironments);
        printEnvCat("用户提供", userProvidedEnvironments);
        printEnvCat("文档内定义", definedInDocumentEnvironments);
        cliLogger.info(`[最终生效环境] (${Object.keys(finalEffectiveEnvironments).length} 个)`);
    }
    
    if (projectAst.errors && projectAst.errors.length > 0) {
        cliLogger.error('\n解析过程中遇到的全局错误:');
        projectAst.errors.forEach(error => {
            cliLogger.error(`- ${error}`);
        });
    }

    cliLogger.info('CLI 执行完毕。');

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cliLogger.error(`CLI执行过程中发生未捕获的错误: ${message}`);
    if (error instanceof Error && error.stack) {
        cliLogger.debug(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  mainCli();
} 