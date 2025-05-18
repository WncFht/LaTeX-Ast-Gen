# Plan: `projectParser.ts` (项目解析器)

## 1. 文件目的

`projectParser.ts` 模块是 `latex-ast-parser` 程序的核心协调器。它负责管理整个 LaTeX 项目的解析过程，从识别根文件开始，到递归地解析所有相关联的 `.tex` 文件，并聚合它们的 AST。它利用 `FileParser` 解析单个文件，并与 `MacroHandler` 交互以处理项目范围内的宏定义。

**`ProjectParser` 类将作为库的主要导出 API 之一，允许开发者通过编程方式解析 LaTeX 项目。**

## 2. 关键类与方法

*   **`ProjectParser` 类** (导出)
    *   `private fileParser: FileParser`
    *   `private macroHandler: MacroHandler`
    *   `private parsedFiles: Set<string>`
    *   `private projectAstMap: Map<string, unifiedLatex.Root | null>` (值为 null 表示文件解析失败但仍需记录尝试)
    *   `private projectFileErrors: Map<string, string>` (存储每个文件的解析错误)
    *   `private projectGlobalErrors: string[]` (存储项目级别的全局错误)
    *   `private rootFilePath: string | null`

    *   **`constructor(customMacroHandler?: MacroHandler)` (构造函数)** (导出，但通常用户会使用顶层辅助函数)
        *   **目的**: 初始化 `ProjectParser`。允许传入一个预配置的 `MacroHandler` 实例，用于高级自定义。
        *   **API**: 接收一个可选的 `customMacroHandler?: MacroHandler`。
        *   **逻辑**:
            *   实例化 `this.fileParser = new FileParser()`。
            *   `this.macroHandler = customMacroHandler || new MacroHandler();` (如果未提供，则使用默认配置创建新的 MacroHandler)
            *   初始化 `parsedFiles`, `projectAstMap`, `projectFileErrors`, `projectGlobalErrors`, `rootFilePath`。

    *   **`async parse(entryPath: string, options?: Omit<ParserOptions, 'entryPath'>): Promise<ProjectAST>` (解析项目)** (导出为类方法)
        *   **目的**: 解析给定的 LaTeX 项目入口，返回整个项目的 AST 结构。
        *   **API**: 
            *   `entryPath: string`: 单个 `.tex` 文件路径或包含项目的目录路径。
            *   `options?: Omit<ParserOptions, 'entryPath'>`: 可选的解析选项 (不含 `entryPath`)，用于配置此次解析的宏处理（如 `macrosFile`, `loadDefaultMacros`, `customMacroRecord`）。这些选项将用于在此方法内部配置（或重新配置）`this.macroHandler`。
        *   **返回**: `Promise<ProjectAST>`。
        *   **逻辑**:
            1.  **重置状态**: 清理 `parsedFiles`, `projectAstMap`, `projectFileErrors`, `projectGlobalErrors`, `rootFilePath` 以支持多次调用 `parse` 方法（如果设计允许）。
            2.  **配置 MacroHandler**: 如果 `options` 被提供，根据 `options` 中的宏相关设置（`macrosFile`, `customMacroRecord`, `loadDefaultMacros`）重新初始化或更新 `this.macroHandler`。
            3.  **确定根文件**: 调用 `determineRootFile(entryPath)`。
                *   如果找不到根文件，将错误记录到 `this.projectGlobalErrors`，并返回包含错误的 `ProjectAST`。
                *   `this.rootFilePath` 被设置。
            4.  **初始化解析队列**: `filesToParse = [this.rootFilePath!]`。
            5.  **循环解析文件**: (与之前计划类似)
                *   ... 从队列取文件，规范化路径，防重 ...
                *   调用 `this.fileParser.parseFile(...)`。
                *   **处理结果**:
                    *   `this.projectAstMap.set(normalizedPath, parseResult.ast);` (即使 ast 为 null 也要记录)
                    *   如果 `parseResult.error`，存入 `this.projectFileErrors.set(normalizedPath, parseResult.error)`。
                    *   更新 `this.macroHandler`。
                    *   将被包含文件加入队列 (确保在加入前解析并规范化路径)。
            6.  **构建并返回 `ProjectAST`**: 
                *   从 `this.projectAstMap` 和 `this.projectFileErrors` 构建 `ProjectFileAst[]`。
                *   返回 `{ rootFilePath: this.rootFilePath, files: projectFileAstArray, macros: this.macroHandler.getCurrentMacros(), errors: this.projectGlobalErrors }`。

    *   **`private async determineRootFile(entryPath: string): Promise<string | null>` (确定根文件 - 辅助函数)**
        *   **目的**: 根据给定的入口路径（文件或目录）确定项目的根 `.tex` 文件。
        *   **API**: 接收 `entryPath: string`。
        *   **返回**: `Promise<string | null>` (根文件的绝对路径，如果找不到则为 `null`)。
        *   **逻辑 (借鉴 `LaTeX-Workshop/src/core/root.ts` 的策略，但简化版)**:
            1.  检查 `entryPath` 是否存在 (`utils.fileExistsAsync`)。
            2.  获取路径状态（文件还是目录）。
            3.  **如果 `entryPath` 是文件**: 
                *   检查是否是 `.tex` 文件 (`utils.isTexFile`)。如果是，则视其为根文件并返回其规范化路径。
                *   否则，返回 `null` 并记录错误。
            4.  **如果 `entryPath` 是目录**: 
                *   **策略1: 查找常见根文件名**: 在目录中查找如 `main.tex`, `root.tex`, `master.tex` 等文件。如果找到且唯一，则作为根文件。
                *   **策略2: 查找唯一包含 `\documentclass` 的文件**: 读取目录下所有 `.tex` 文件，检查其内容是否包含 `\documentclass` (使用 `utils.isRootFile`)。如果仅找到一个，则作为根文件。
                *   **策略3 (更高级，可选):** 模仿 `LaTeX-Workshop` 中的魔术注释 (`%! TeX root = ...`) 扫描，或向上层目录搜索。
                *   如果以上策略均失败，返回 `null` 并记录错误。
            5.  返回规范化后的根文件路径。


## 3. 顶层库 API 函数 (在 `index.ts` 中或直接导出)

*   **`async function parseLatexProject(options: ParserOptions): Promise<ProjectAST>`** (导出)
    *   **目的**: 作为库的主要、易于使用的入口点。
    *   **API**: 接收 `ParserOptions` (包含 `entryPath` 和宏相关选项)。
    *   **逻辑**:
        1.  创建 `MacroOptions` 子集: `const macroOptsForHandler: Pick<ParserOptions, 'macrosFile' | 'loadDefaultMacros' | 'customMacroRecord'> = options;`
        2.  实例化 `const macroHandler = new MacroHandler(macroOptsForHandler);`
        3.  实例化 `const projectParser = new ProjectParser(macroHandler);`
        4.  `return projectParser.parse(options.entryPath);` // 注意：ProjectParser 的 parse 方法签名需要调整，或者这里做适配
        *   或者，让 `ProjectParser.parse` 直接接受完整的 `ParserOptions`，并在内部处理宏选项的传递给 `MacroHandler` 的初始化/重新配置。

## 4. 实现灵感来源

*   **`LaTeX-Workshop/src/core/root.ts`**
*   **`LaTeX-Workshop/src/core/cache.ts`**

## 5. 使用的库

*   自定义的 `FileParser`, `MacroHandler`, `utils` 模块。
*   自定义的类型定义 (来自 `types.ts`)。
*   `@unified-latex/unified-latex-types`。
*   Node.js `path` 模块。 