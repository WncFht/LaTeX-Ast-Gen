/**
 * 宏处理器模块
 * 负责在整个项目解析生命周期中管理LaTeX宏定义和环境定义
 */

import * as utils from './utils';
import type * as Ast from '@unified-latex/unified-latex-types';
import { ParserOptions } from './types';
import { listNewcommands } from "@unified-latex/unified-latex-util-macros";
import { visit, VisitorInfo } from "@unified-latex/unified-latex-util-visit";
import { listNewEnvironments } from './environment-parser/list-newenvironments';
import { environmentInfo as ctanPackageEnvironmentInfo } from "@unified-latex/unified-latex-ctan";

/**
 * 宏处理器类
 * 管理项目中的LaTeX宏定义和环境定义。
 * 它能够加载默认宏、用户通过选项或文件提供的自定义宏、
 * 提取文档中通过 \\newcommand 等定义的宏，以及推断在文档中使用但未定义的宏的参数签名。
 */
export class MacroHandler {
  /**
   * 存储默认宏、用户通过选项提供的宏、以及从外部文件加载的宏。
   * 这些是解析开始时或由用户明确提供的宏定义。
   */
  private defaultAndUserMacros: Ast.MacroInfoRecord;
  /**
   * 存储在文档中通过 \\newcommand, \\renewcommand 等命令定义的宏。
   * 这些宏是在解析特定文件时从其内容中发现的。
   */
  private definedInDocMacros: Ast.MacroInfoRecord;
  /**
   * 存储在文档中使用但未在任何已知来源（默认、用户、文档内定义）中明确定义的宏，
   * 其参数签名是通过启发式方法（基于其后跟随的group数量）推断出来的。
   */
  private inferredUsedMacros: Ast.MacroInfoRecord;

  // 新增: 存储环境定义相关信息
  private ctanEnvs: Ast.EnvInfoRecord; // 存储来自CTAN的标准环境
  private userProvidedEnvs: Ast.EnvInfoRecord; // 存储用户通过选项提供的环境
  private definedInDocEnvs: Ast.EnvInfoRecord;   // 存储文档中定义的环境

  /**
   * 创建一个新的MacroHandler实例。
   * @param options 解析器选项，用于配置宏的加载行为。
   */
  constructor(options?: ParserOptions) {
    this.defaultAndUserMacros = {};
    this.definedInDocMacros = {};
    this.inferredUsedMacros = {};

    // 初始化环境相关记录
    this.ctanEnvs = this.loadCtanEnvironments();
    this.userProvidedEnvs = { ...(options?.customEnvironmentRecord || {}) } as Ast.EnvInfoRecord; // 类型断言
    this.definedInDocEnvs = {};

    if (!options || options.loadDefaultMacros !== false) {
      this.defaultAndUserMacros = this.loadDefaultMacros();
    }
    if (options?.customMacroRecord) {
      this.addMacrosToRecord(this.defaultAndUserMacros, options.customMacroRecord);
    }
    if (options?.macrosFile) {
      this.loadExternalMacrosFromFile(options.macrosFile)
        .then(macros => {
          if (macros) {
            this.addMacrosToRecord(this.defaultAndUserMacros, macros);
          }
        })
        .catch(error => {
          console.error(`[MacroHandler] 加载宏定义文件失败: ${error.message}`);
        });
    }
    if (options?.environmentsFile) {
      this.loadExternalEnvironmentsFromFile(options.environmentsFile)
        .then(envsFromFile => {
          if (envsFromFile) {
            this.addEnvironmentsToRecord(this.userProvidedEnvs, envsFromFile);
          }
        })
        .catch(error => {
          console.error(`[MacroHandler] 加载环境定义文件失败: ${error.message}`);
        });
    }
  }

  private loadCtanEnvironments(): Ast.EnvInfoRecord {
    let flatCtanEnvs: Ast.EnvInfoRecord = {};
    for (const packageName in ctanPackageEnvironmentInfo) {
      if (Object.prototype.hasOwnProperty.call(ctanPackageEnvironmentInfo, packageName)) {
        const packageEnvs = (ctanPackageEnvironmentInfo as any)[packageName] as Ast.EnvInfoRecord;
        flatCtanEnvs = { ...flatCtanEnvs, ...packageEnvs };
      }
    }
    return flatCtanEnvs;
  }

  /**
   * 辅助函数，将新的宏定义合并到目标宏记录中。
   * @param targetRecord 要更新的宏记录对象。
   * @param newMacros 要添加的新宏定义，同名宏将被覆盖。
   */
  private addMacrosToRecord(targetRecord: Ast.MacroInfoRecord, newMacros: Ast.MacroInfoRecord): void {
    Object.assign(targetRecord, newMacros);
  }
  
  /**
   * 添加在文档中通过 \\newcommand 等命令定义的宏到 `definedInDocMacros` 记录中。
   * @param newlyDefinedMacros 从当前文件AST中提取的已定义宏。
   */
  public addDefinedInDocMacros(newlyDefinedMacros: Ast.MacroInfoRecord): void {
    this.addMacrosToRecord(this.definedInDocMacros, newlyDefinedMacros);
  }

  /**
   * 添加通过启发式方法推断出的、在文档中使用的宏到 `inferredUsedMacros` 记录中。
   * 只添加那些在 `defaultAndUserMacros` 和 `definedInDocMacros` 中都未定义的宏，
   * 以避免用不准确的推断覆盖明确的定义。
   * @param newlyInferredMacros 从当前文件AST中提取的推断宏。
   */
  public addInferredUsedMacros(newlyInferredMacros: Ast.MacroInfoRecord): void {
    for (const [macroName, macroInfo] of Object.entries(newlyInferredMacros)) {
      if (!this.defaultAndUserMacros[macroName] && !this.definedInDocMacros[macroName] && !this.inferredUsedMacros[macroName]) {
        this.inferredUsedMacros[macroName] = macroInfo;
      }
    }
  }
  
  /**
   * 获取用于参数附加的最终生效的宏记录。
   * 宏定义的优先级顺序为：
   * 1. 文档中定义的宏 (`definedInDocMacros`) - 最高优先级。
   * 2. 默认的、用户通过选项或外部文件提供的宏 (`defaultAndUserMacros`) - 中等优先级。
   * 3. 推断出的在文档中使用的宏 (`inferredUsedMacros`) - 最低优先级。
   * 当合并时，高优先级的定义会覆盖低优先级的同名宏定义。
   * @returns 合并后的、用于参数附加的宏定义记录。
   */
  public getMacrosForAttachment(): Ast.MacroInfoRecord {
    return {
      ...this.inferredUsedMacros,   
      ...this.defaultAndUserMacros, 
      ...this.definedInDocMacros,   
    };
  }

  /**
   * 获取用于环境处理的最终生效的环境信息记录。
   */
  public getEnvironmentsForProcessing(): Ast.EnvInfoRecord {
    console.log("[MacroHandler-debug] getEnvironmentsForProcessing: this.ctanEnvs contains 'mainbox':", !!this.ctanEnvs['mainbox']);
    console.log("[MacroHandler-debug] getEnvironmentsForProcessing: this.userProvidedEnvs contains 'mainbox':", !!this.userProvidedEnvs['mainbox']);
    console.log("[MacroHandler-debug] getEnvironmentsForProcessing: this.definedInDocEnvs contains 'mainbox':", !!this.definedInDocEnvs['mainbox']);
    if(this.definedInDocEnvs['mainbox']) {
      console.log("[MacroHandler-debug] getEnvironmentsForProcessing: this.definedInDocEnvs['mainbox'] details:", JSON.stringify(this.definedInDocEnvs['mainbox']));
    }
    return {
      ...this.ctanEnvs,
      ...this.userProvidedEnvs,
      ...this.definedInDocEnvs,
    };
  }

  /**
   * 获取所有宏和环境的分类视图。
   */
  public getAllDefinitionsCategorized(): {
    defaultAndUserMacros: Ast.MacroInfoRecord;
    definedInDocumentMacros: Ast.MacroInfoRecord;
    inferredUsedMacros: Ast.MacroInfoRecord;
    finalEffectiveMacros: Ast.MacroInfoRecord;
    ctanEnvironments: Ast.EnvInfoRecord;
    userProvidedEnvironments: Ast.EnvInfoRecord;
    definedInDocumentEnvironments: Ast.EnvInfoRecord;
    finalEffectiveEnvironments: Ast.EnvInfoRecord;
  } {
    const finalEffectiveMacros = this.getMacrosForAttachment();
    const finalEffectiveEnvs = this.getEnvironmentsForProcessing();
    return {
      defaultAndUserMacros: { ...this.defaultAndUserMacros },
      definedInDocumentMacros: { ...this.definedInDocMacros },
      inferredUsedMacros: { ...this.inferredUsedMacros },
      finalEffectiveMacros: { ...finalEffectiveMacros },
      ctanEnvironments: { ...this.ctanEnvs },
      userProvidedEnvironments: { ...this.userProvidedEnvs },
      definedInDocumentEnvironments: { ...this.definedInDocEnvs },
      finalEffectiveEnvironments: { ...finalEffectiveEnvs },
    };
  }

  /**
   * 从给定的AST中提取通过 \\newcommand, \\renewcommand 等LaTeX命令定义的宏。
   * 它使用 `@unified-latex/unified-latex-util-macros` 包中的 `listNewcommands` 函数。
   * 
   * @param ast 要扫描的LaTeX AST的根节点。
   * @returns 一个 `Ast.MacroInfoRecord` 对象，其中键是宏的名称（不带前导反斜杠），
   *          值是包含参数签名 (`signature`) 的对象。
   */
  public extractDefinedMacros(ast: Ast.Root): Ast.MacroInfoRecord {
    const newMacros: Ast.MacroInfoRecord = {};
    const commandSpecs = listNewcommands(ast);
    for (const spec of commandSpecs) {
      const macroName = spec.name.startsWith('\\') ? spec.name.substring(1) : spec.name;
      if (macroName) {
        newMacros[macroName] = { signature: spec.signature };
      }
    }
    return newMacros;
  }

  /**
   * 扫描AST中使用的、但当前在任何已知宏记录中（默认、用户、文档定义）都未定义的宏，
   * 并尝试基于其用法（即其后紧随的group节点的数量）来启发式地推断其参数签名。
   *
   * **工作流程解析**：
   * 1. **初始化**：
   *    - `inferredMacros`: 用于存储此函数调用发现的推断宏。
   *    - `currentlyKnownMacroNames`: 一个Set集合，包含在调用此函数时所有已经通过其他方式
   *      (默认列表、用户提供、文档内`\\newcommand`等) 得知其定义的宏的名称。
   *      这是通过调用`this.getMacrosForAttachment()`并获取其键来实现的。推断过程将跳过这些已知的宏。
   *    - `potentialCustomMacros`: 一个Map对象，用于在遍历AST过程中临时存储遇到的未知宏及其
   *      到目前为止观察到的最大参数数量。键是宏名，值是包含宏节点和推断参数数量的对象。
   *      这用于处理同一个未知宏在文档中可能以不同参数数量被调用的情况（例如 `\\foo{a}` 和 `\\foo{a}{b}`），
   *      最终会采纳参数数量最多的那次调用作为推断依据。
   *
   * 2. **遍历AST (`visit`函数)**：
   *    - 对输入的AST (`ast`) 进行深度优先遍历。`visit`函数由`@unified-latex/unified-latex-util-visit`提供。
   *    - 回调函数 `(visitedNode, info: VisitorInfo)` 会被AST中的每个节点（或数组，取决于`visit`选项，此处默认只处理节点）调用。
   *      `visitedNode`是当前访问的节点，`info`包含了关于该节点的上下文信息（如父节点、在兄弟中的索引等）。
   *    - **处理宏节点**：如果 `visitedNode` 的类型不是 'macro'，则直接返回，不进行后续处理。
   *    - **跳过已知宏**：如果当前宏的名称 (`macroName`) 存在于 `currentlyKnownMacroNames` 集合中，
   *      说明这个宏已经有明确的定义（来自默认、用户或文档内定义），因此跳过对它的推断。
   *
   * 3. **推断参数数量 (`argCount`)**：
   *    - 对于被视为未知的宏 (`macroNode`)，开始推断其参数数量，初始化 `argCount = 0`。
   *    - **获取上下文**：从`info`对象中获取其直接父节点 (`parentNode = info.parents[0]`) 和
   *      它在父节点子节点列表中的索引 (`nodeIndexInParent = info.index`)。
   *      `info.parents`是由`visit`工具维护的祖先节点数组，列表中的第一个元素 (`parents[0]`) 是直接父级。
   *      `info.index`是当前`visitedNode`在其父节点的`content`数组（如果父节点有`content`数组）中的数字索引。
   *    - **上下文有效性检查**：在尝试访问`parentNode.content`之前，会进行一系列检查：
   *      - `parentNode` 是否存在。
   *      - `parentNode` 是否具有`content`属性 (例如，`Ast.Root`, `Ast.Environment`, `Ast.Group` 通常有，但 `Ast.Argument` 的子节点组织方式不同)。
   *      - `parentNode.content` 是否确实是一个数组。
   *      - `nodeIndexInParent` 是否不为 `null` (表示当前节点是通过数组索引访问的)。
   *    - **迭代兄弟节点以计数参数**：如果上述上下文都有效：
   *        i.  将 `parentContent` 设置为 `parentNode.content` (类型断言为 `Ast.Ast[]`，表示节点数组)。
   *        ii. `currentIndex` 初始化为 `nodeIndexInParent + 1`，即从当前宏节点的下一个兄弟节点开始检查。
   *        iii.进入 `while` 循环，只要 `currentIndex`仍在 `parentContent` 的有效范围内：
   *            a. 获取 `nextNode = parentContent[currentIndex]`。
   *            b. **跳过空白**：如果 `nextNode` 是一个 `whitespace` 节点，则简单地将 `currentIndex` 向后移一位，并继续下一次循环迭代 (`continue`)。
   *               这允许我们正确处理宏调用和其参数之间可能存在的空格，例如 `\\macro {arg1}`。
   *            c. **计数Group参数**：如果 `nextNode` 是一个 `group` 节点 (通常是由 `{...}` 包裹的内容)，
   *               则认为这是一个参数。`argCount` 增加1，并且 `currentIndex` 向后移一位。
   *            d. **终止计数**：如果 `nextNode` 既不是 `whitespace` 也不是 `group`，则推断逻辑认为宏的参数序列到此结束，
   *               执行 `break` 退出 `while` 循环。这种推断方式仅限于计算连续的、由花括号包裹的参数组。
   *               它不能推断可选参数（如 `[...]`）或没有界定符的单个字符/宏参数。
   *
   * 4. **存储/更新潜在宏信息 (`potentialCustomMacros`)**：
   *    - 在为一个宏调用推断出 `argCount`后，需要将其信息存储到 `potentialCustomMacros` 中。
   *    - 如果这个 `macroName` 还没有在 `potentialCustomMacros` Map 中，则直接添加它，键为 `macroName`，
   *      值为一个包含宏节点本身 (`macroNode`) 和推断出的 `argCount` 的对象。
   *    - 如果 `macroName` 已经存在于 Map 中（意味着这个未知宏在文档中被多次调用），
   *      则比较当前推断出的 `argCount` 与已存储的 `argCount`。
   *      只有当新计算的 `argCount` **大于**已存储的 `argCount` 时，才会更新 Map 中的记录。
   *      这样做是为了确保最终为该宏推断出的参数数量是其在文档中所有用法中参数数量最多的那一种。
   *      例如，如果文档中同时出现了 `\\foo{A}` (推断 argCount=1) 和 `\\foo{A}{B}` (推断 argCount=2)，
   *      那么 `potentialCustomMacros` 中最终会存储 `\\foo` 的 `argCount` 为 2。
   *
   * 5. **生成最终签名**：
   *    - 当AST遍历 (`visit`) 完成后，`potentialCustomMacros` Map 中就包含了所有发现的未知宏及其最大推断参数数量。
   *    - 接下来，遍历 `potentialCustomMacros` Map 中的每一条记录 (`[macroName, data]`)。
   *    - 对于每个宏，根据其 `data.argCount` 生成一个参数签名字符串 `signature`。
   *      例如，如果 `data.argCount` 是 2，则生成的签名是 `"m m"` (表示两个强制参数)。
   *      如果 `data.argCount` 是 0 (即宏后面没有紧跟的group节点)，则签名是空字符串 `""`。
   *      这种简化的签名生成假设所有推断出的参数都是标准的强制参数类型（由花括号包裹）。
   *    - 将宏名 (`macroName`) 和生成的签名 (`{ signature }`) 存储到 `inferredMacros` 对象中。
   *
   * 6. **返回结果**：
   *    - 函数最终返回 `inferredMacros` 对象。
   *    - 这个对象包含了所有在此次 `extractUsedCustomMacros` 调用中新推断出的、之前未知的宏及其基于用法的参数签名。
   * 
   * @param ast 要扫描的LaTeX AST的根节点。
   * @returns 一个 `Ast.MacroInfoRecord` 对象，包含推断出的自定义宏及其推断的参数签名。
   *          宏名不带前导反斜杠。
   */
  public extractUsedCustomMacros(ast: Ast.Root): Ast.MacroInfoRecord {
    const inferredMacros: Ast.MacroInfoRecord = {};
    const currentlyKnownMacroNames = new Set(Object.keys(this.getMacrosForAttachment()));
    const potentialCustomMacros = new Map<string, {node: Ast.Macro, argCount: number}>();
    
    visit(ast, (visitedNode, info: VisitorInfo) => {
      if (visitedNode.type !== 'macro') return;
      
      const macroNode = visitedNode as Ast.Macro;
      const macroName = macroNode.content;
      
      if (!macroName || currentlyKnownMacroNames.has(macroName)) return;
      
      let argCount = 0;
      const parentNode = info.parents[0]; 
      const nodeIndexInParent = info.index; 

      if (parentNode && 'content' in parentNode && parentNode.content && Array.isArray(parentNode.content) && nodeIndexInParent != null) {
        const parentContent = parentNode.content as Ast.Ast[];
        let currentIndex = nodeIndexInParent + 1;

        while (currentIndex < parentContent.length) {
          const nextNode = parentContent[currentIndex];
          if (nextNode && nextNode.type === 'whitespace') {
            currentIndex++;
            continue;
          }
          if (nextNode && nextNode.type === 'group') {
            argCount++;
            currentIndex++;
          } else {
            break;
          }
        }
      }
      
      if (!potentialCustomMacros.has(macroName) || 
          (potentialCustomMacros.get(macroName)!.argCount < argCount)) {
        potentialCustomMacros.set(macroName, {node: macroNode, argCount});
      }
    });
    
    for (const [macroName, data] of potentialCustomMacros.entries()) {
      let signature = '';
      for (let i = 0; i < data.argCount; i++) {
        signature += (signature ? ' ' : '') + 'm';
      }
      inferredMacros[macroName] = { signature };
    }
        
    return inferredMacros;
  }

  /**
   * 加载一组预定义的常用LaTeX宏及其参数签名。
   * **注意**: 如果希望某个宏（如 `eqref`）的参数通过 `extractUsedCustomMacros` 推断得出，
   * 则不应将其包含在此默认列表中。如果需要默认支持，请取消注释或添加相应的条目并提供正确签名。
   * @returns 包含预定义宏的 `Ast.MacroInfoRecord` 对象。
   * @private
   */
  private loadDefaultMacros(): Ast.MacroInfoRecord {
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
      'DeclareMathOperator': { signature: 'm m' },
      'DeclarePairedDelimiter': { signature: 'm m m' },
      'begin': { signature: 'm o' },
      'end': { signature: 'm' },
      'item': { signature: 'o' },
      'label': { signature: 'm' },
      'ref': { signature: 'm' },
      'eqref': { signature: 'm' },
      'cite': { signature: 'o m' },
      'bibliography': { signature: 'm' },
      'bibliographystyle': { signature: 'm' },
      'includegraphics': { signature: 'o o m' },
      'caption': { signature: 'o m' },
      'newcounter': { signature: 'm o' },
      'newtcolorbox': { signature: 'o m o o m' },
      'newenvironment': { signature: 'm o o m m' },
      'renewenvironment': { signature: 'm o o m m' },
      'provideenvironment': { signature: 'm o o m m' },
      'newtheorem': { signature: 'm o m' },
      'DeclareTColorBox': { signature: 'm m m' },
      'newlist': { signature: 'm m m' },
    };
  }

  /**
   * 从指定的JSON文件异步加载外部宏定义。
   * @param filePath 包含宏定义的JSON文件的路径。
   * @returns 一个Promise，解析为 `Ast.MacroInfoRecord` 对象，如果加载或解析失败则抛出错误。
   * @private
   */
  private async loadExternalMacrosFromFile(filePath: string): Promise<Ast.MacroInfoRecord | null> {
    try {
      const content = await utils.readFileAsync(filePath);
      return JSON.parse(content) as Ast.MacroInfoRecord;
    } catch (error) {
      console.error(`[MacroHandler] Error loading macros from file ${filePath}:`, error);
      return null;
    }
  }

  private addEnvironmentsToRecord(targetRecord: Ast.EnvInfoRecord, newEnvs: Ast.EnvInfoRecord): void {
    Object.assign(targetRecord, newEnvs);
  }

  private async loadExternalEnvironmentsFromFile(filePath: string): Promise<Ast.EnvInfoRecord | null> {
    try {
      const content = await utils.readFileAsync(filePath);
      return JSON.parse(content) as Ast.EnvInfoRecord;
    } catch (error) {
      console.error(`[MacroHandler] Error loading environments from file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 从AST中提取通过 \\newenvironment, \\newtcolorbox 等命令定义的自定义环境，
   * 并将其参数签名等信息更新到 this.definedInDocEnvs。
   * @param ast 要扫描的LaTeX AST的根节点。
   */
  public extractAndProcessEnvironmentDefinitions(ast: Ast.Root): void {
    const newEnvSpecs = listNewEnvironments(ast);
    console.log(`[MacroHandler-debug] extractAndProcessEnvironmentDefinitions - found ${newEnvSpecs.length} new env specs.`);
    const newEnvsToRegister: Ast.EnvInfoRecord = {};
    for (const spec of newEnvSpecs) {
      if (this.definedInDocEnvs[spec.name]) {
        console.warn(`[MacroHandler] Environment '${spec.name}' is being redefined within the document. Previous definition will be overwritten.`);
      }
      if (this.userProvidedEnvs[spec.name]) {
        console.log(`[MacroHandler] Doc-defined env '${spec.name}' overrides user-provided.`);
      } else if (this.ctanEnvs[spec.name]) {
        console.log(`[MacroHandler] Doc-defined env '${spec.name}' overrides CTAN.`);
      }

      const envInfo = { 
        signature: spec.signature,
      };
      newEnvsToRegister[spec.name] = envInfo;
    }
    this.addDefinedInDocEnvironments(newEnvsToRegister);
  }

  public addDefinedInDocEnvironments(newlyDefinedEnvs: Ast.EnvInfoRecord): void {
    console.log("[MacroHandler-debug] addDefinedInDocEnvironments called with:", newlyDefinedEnvs);
    this.addEnvironmentsToRecord(this.definedInDocEnvs, newlyDefinedEnvs);
    console.log("[MacroHandler-debug] this.definedInDocEnvs after add:", this.definedInDocEnvs);
  }
}
