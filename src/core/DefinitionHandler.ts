/**
 * 定义处理器模块
 *
 * 在整个项目解析生命周期中管理 LaTeX 的宏定义和环境定义。
 * 这包括加载默认定义、用户通过配置或文件提供的定义、
 * 从文档内容中提取的定义，以及为使用了但未知的宏推断出的定义。
 * 同时，它还负责处理这些不同来源定义的优先级和合并逻辑。
 */

import type { Ast, ResolvedParserConfig, NewCommandSpec, NewEnvironmentSpec } from '../types/index';
import { environmentInfo as ctanPackageEnvironmentInfo } from "@unified-latex/unified-latex-ctan";
import { createLogger, Logger } from '../utils/logger';
// 注意：从外部文件加载（例如通过 utils.readFileAsync，现在是 fileSystem.readFileAsync）
// 的逻辑已由 ConfigManager 处理。DefinitionHandler 通过 ResolvedParserConfig 直接接收已加载的记录。

export class DefinitionHandler {
  private logger: Logger;

  // 分类存储宏定义
  private defaultMacros: Ast.MacroInfoRecord;         // 默认宏
  private userProvidedMacros: Ast.MacroInfoRecord;    // 用户通过配置对象提供的宏 (customMacroRecord)
  private definedInDocMacros: Ast.MacroInfoRecord;    // 文档中定义的宏 (例如 \newcommand)
  private inferredUsedMacros: Ast.MacroInfoRecord;    // 从用法中推断出的宏

  // 分类存储环境定义
  private ctanEnvs: Ast.EnvInfoRecord;                // 来自 CTAN 的标准环境
  private userProvidedEnvs: Ast.EnvInfoRecord;        // 用户通过配置对象提供的环境 (customEnvironmentRecord)
  private definedInDocEnvs: Ast.EnvInfoRecord;        // 文档中定义的环境 (例如 \newenvironment)
  // 环境通常不像宏那样被"推断"，因为它们的使用（\begin{env} ... \end{env}）更为明确。
  // 但如果未完全指定，它们的签名可能会根据用法进行细化或确认。

  /**
   * 创建一个新的 DefinitionHandler 实例。
   * @param config - 已解析的解析器配置对象 {@link ResolvedParserConfig}。
   */
  constructor(private config: ResolvedParserConfig) {
    this.logger = createLogger('core:DefinitionHandler');
    this.logger.debug('初始化 DefinitionHandler, 配置为:', config);

    // 初始化宏存储
    this.defaultMacros = {};
    this.userProvidedMacros = { ...config.customMacroRecord }; // 已由 ConfigManager 加载
    this.definedInDocMacros = {};
    this.inferredUsedMacros = {};

    // 初始化环境存储
    this.ctanEnvs = this.loadCtanEnvironments();
    this.userProvidedEnvs = { ...config.customEnvironmentRecord }; // 已由 ConfigManager 加载
    this.definedInDocEnvs = {};

    if (config.loadDefaultMacros) {
      this.defaultMacros = this.loadDefaultMacroSignatures();
      this.logger.info(`已加载 ${Object.keys(this.defaultMacros).length} 个默认宏。`);
    }
    
    this.logger.info(`初始化时，用户提供的宏数量: ${Object.keys(this.userProvidedMacros).length} 个。`);
    this.logger.info(`初始化时，用户提供的环境数量: ${Object.keys(this.userProvidedEnvs).length} 个。`);
    this.logger.info(`初始化时，CTAN 标准环境数量: ${Object.keys(this.ctanEnvs).length} 个。`);
  }

  /**
   * 从 `ctanPackageEnvironmentInfo` 加载 LaTeX 标准环境定义。
   * @returns 一个包含所有CTAN标准环境的 {@link Ast.EnvInfoRecord} 对象。
   */
  private loadCtanEnvironments(): Ast.EnvInfoRecord {
    let flatCtanEnvs: Ast.EnvInfoRecord = {};
    if (ctanPackageEnvironmentInfo && typeof ctanPackageEnvironmentInfo === 'object') {
        for (const packageName in ctanPackageEnvironmentInfo) {
            if (Object.prototype.hasOwnProperty.call(ctanPackageEnvironmentInfo, packageName)) {
                // 类型断言，因为 ctanPackageEnvironmentInfo 的类型较为通用
                const packageEnvs = (ctanPackageEnvironmentInfo as any)[packageName] as Ast.EnvInfoRecord;
                if (packageEnvs && typeof packageEnvs === 'object') {
                    flatCtanEnvs = { ...flatCtanEnvs, ...packageEnvs };
                }
            }
        }
    }
    return flatCtanEnvs;
  }

  /**
   * 加载一组预定义的常用 LaTeX 宏签名。
   * 此方法迁移自旧的 `MacroHandler::loadDefaultMacros`。
   * @returns 一个包含预定义宏的 {@link Ast.MacroInfoRecord} 对象。
   */
  private loadDefaultMacroSignatures(): Ast.MacroInfoRecord {
    return {
      'documentclass': { signature: 'o m' },
      'usepackage': { signature: 'o m' },
      'input': { signature: 'm' },
      'include': { signature: 'm' },
      'subfile': { signature: 'm' },
      'textbf': { signature: 'm' },
      'textit': { signature: 'm' },
      'texttt': { signature: 'm' },
      'underline': { signature: 'm' },
      'emph': { signature: 'm' },
      'mathbb': { signature: 'm' },
      'mathbf': { signature: 'm' },
      'mathcal': { signature: 'm' },
      'mathrm': { signature: 'm' },
      'frac': { signature: 'm m' },
      'sqrt': { signature: 'o m' },
      'newcommand': { signature: 'm o o m' },
      'renewcommand': { signature: 'm o o m' },
      'DeclareMathOperator': { signature: 's m m' }, // amsmath 包通常使用星号版本
      'DeclarePairedDelimiter': { signature: 'm m m' },
      'begin': { signature: 'm o' }, // \begin 命令自身的签名
      'end': { signature: 'm' },     // \end 命令自身的签名
      'item': { signature: 'o' },
      'label': { signature: 'm' },
      'ref': { signature: 'm' },
      'eqref': { signature: 'm' }, // amsmath 包中常见
      'cite': { signature: 'o m' },
      'bibliography': { signature: 'm' },
      'bibliographystyle': { signature: 'm' },
      'includegraphics': { signature: 'o o m' },
      'caption': { signature: 'o m' },
      'newcounter': { signature: 'm o' },
      // 环境定义命令的签名在此处至关重要
      'newenvironment': { signature: 'm o o m m' },
      'renewenvironment': { signature: 'm o o m m' },
      'provideenvironment': { signature: 'm o o m m' },
      'newtheorem': { signature: 's m o m' }, // 常见形式: \newtheorem*{theorem}{Theorem}[section]
      'newtcolorbox': { signature: 'o m o o m' },
      'DeclareTColorBox': { signature: 'm m m' }, // name, arg_spec, options
      'newlist': { signature: 'm m m' }, // name, counter, max_depth
    };
  }
  
  /**
   * 根据定义的优先级合并宏记录。
   * 优先级顺序: 文档内定义 > 用户提供 > 默认 > 推断。
   * @returns 合并后的 {@link Ast.MacroInfoRecord} 对象。
   */
  private mergeMacroRecords(): Ast.MacroInfoRecord {
    return {
      ...this.inferredUsedMacros,    // 最低优先级
      ...this.defaultMacros,
      ...this.userProvidedMacros,
      ...this.definedInDocMacros,    // 最高优先级
    };
  }

  /**
   * 根据定义的优先级合并环境记录。
   * 优先级顺序: 文档内定义 > 用户提供 > CTAN标准。
   * @returns 合并后的 {@link Ast.EnvInfoRecord} 对象。
   */
  private mergeEnvironmentRecords(): Ast.EnvInfoRecord {
    return {
      ...this.ctanEnvs,             // 最低优先级 (相对于用户和文档内)
      ...this.userProvidedEnvs,
      ...this.definedInDocEnvs,     // 最高优先级
    };
  }
  
  /**
   * 添加从文档内容中提取的宏 (例如通过 `\newcommand` 定义的)。
   * @param docMacros - 一个包含在文档中定义的宏的 {@link Ast.MacroInfoRecord} 对象。
   */
  public addDocumentDefinedMacros(docMacros: Ast.MacroInfoRecord): void {
    this.logger.debug(`添加 ${Object.keys(docMacros).length} 个文档内定义的宏。键:`, Object.keys(docMacros));
    // 文档内定义的宏具有较高优先级，因此会覆盖同名的用户提供或默认宏。
    Object.assign(this.definedInDocMacros, docMacros);
  }

  /**
   * 添加从文档内容中提取的环境 (例如通过 `\newenvironment` 定义的)。
   * @param docEnvs - 一个包含在文档中定义的环境的 {@link Ast.EnvInfoRecord} 对象。
   */
  public addDocumentDefinedEnvironments(docEnvs: Ast.EnvInfoRecord): void {
    this.logger.debug(`添加 ${Object.keys(docEnvs).length} 个文档内定义的环境。键:`, Object.keys(docEnvs));
    Object.assign(this.definedInDocEnvs, docEnvs);
  }

  /**
   * 添加通过用法推断出签名的宏。
   * 这些宏具有最低优先级，仅当它们未在其他地方被定义时才会被添加。
   * @param inferredMacros - 一个包含带有推断签名的宏的 {@link Ast.MacroInfoRecord} 对象。
   */
  public addInferredUsedMacros(inferredMacros: Ast.MacroInfoRecord): void {
    let count = 0;
    for (const [macroName, macroInfo] of Object.entries(inferredMacros)) {
      if (
        !this.defaultMacros[macroName] &&
        !this.userProvidedMacros[macroName] &&
        !this.definedInDocMacros[macroName] &&
        !this.inferredUsedMacros[macroName] // 同时检查是否已被推断，以避免重复记录日志
      ) {
        this.inferredUsedMacros[macroName] = macroInfo;
        count++;
      }
    }
    if (count > 0) {
        this.logger.debug(`新增了 ${count} 个推断出的宏。`);
    }
  }

  /**
   * 获取用于解析或附加参数的有效 {@link Ast.MacroInfoRecord}。
   * 此方法会根据优先级合并所有已知的宏来源。
   * @returns 合并后的宏信息记录。
   */
  public getEffectiveMacroInfoRecord(): Ast.MacroInfoRecord {
    return this.mergeMacroRecords();
  }

  /**
   * 获取用于解析或处理环境的有效 {@link Ast.EnvInfoRecord}。
   * 此方法会根据优先级合并所有已知的环境来源。
   * @returns 合并后的环境信息记录。
   */
  public getEffectiveEnvInfoRecord(): Ast.EnvInfoRecord {
    return this.mergeEnvironmentRecords();
  }

  /**
   * 返回所有宏和环境定义的分类视图。
   * 此方法主要用于在最终的 {@link ProjectAST} 元数据中提供详细信息。
   * @returns 一个包含所有分类定义的记录的对象。
   */
  public getAllDefinitionsCategorized(): {
    defaultAndUserMacros: Ast.MacroInfoRecord;       // 默认宏和用户通过配置提供的宏的合并
    definedInDocumentMacros: Ast.MacroInfoRecord;    // 文档中定义的宏
    inferredUsedMacros: Ast.MacroInfoRecord;         // 从用法中推断的宏
    finalEffectiveMacros: Ast.MacroInfoRecord;       // 所有宏合并后的最终生效列表
    ctanEnvironments: Ast.EnvInfoRecord;             // CTAN 标准环境
    userProvidedEnvironments: Ast.EnvInfoRecord;     // 用户通过配置提供的环境
    definedInDocumentEnvironments: Ast.EnvInfoRecord; // 文档中定义的环境
    finalEffectiveEnvironments: Ast.EnvInfoRecord;    // 所有环境合并后的最终生效列表
  } {
    const finalEffectiveMacros = this.getEffectiveMacroInfoRecord();
    const finalEffectiveEnvs = this.getEffectiveEnvInfoRecord();
    return {
      // 返回副本以防止外部修改
      defaultAndUserMacros: { ...this.defaultMacros, ...this.userProvidedMacros }, 
      definedInDocumentMacros: { ...this.definedInDocMacros },
      inferredUsedMacros: { ...this.inferredUsedMacros },
      finalEffectiveMacros: { ...finalEffectiveMacros }, 
      ctanEnvironments: { ...this.ctanEnvs },
      userProvidedEnvironments: { ...this.userProvidedEnvs },
      definedInDocumentEnvironments: { ...this.definedInDocEnvs },
      finalEffectiveEnvironments: { ...finalEffectiveEnvs }, 
    };
  }
} 