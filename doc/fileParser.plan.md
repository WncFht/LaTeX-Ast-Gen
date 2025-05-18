# Plan: `fileParser.ts` (文件解析器)

## 1. 文件目的

`fileParser.ts` 模块的核心职责是解析单个 LaTeX (`.tex`) 源文件。它接收文件路径和当前的宏定义集合，读取文件内容，使用 `unified-latex` 工具链将其转换为 AST (抽象语法树)，并应用宏定义来正确解析参数。此外，它还将从生成的 AST 中提取在该文件中新定义的宏以及通过 `\input` 或 `\include` 等命令引用的其他文件。

**此模块主要供 `ProjectParser` 内部使用，不直接作为库的公共 API。**

## 2. 关键类与方法

*   **`FileParser` 类**
    *   **`constructor()`**
        *   **目的**: 初始化 `FileParser`。
    *   **`async parseFile(filePath: string, currentMacroRecord: unifiedLatex.MacroInfoRecord): Promise<InternalFileParseResult>` (解析文件)**
        *   **目的**: 解析指定的 `.tex` 文件，返回其 AST、新发现的宏定义和包含的文件列表。
        *   **API**: 
            *   `filePath: string`: 要解析的文件的绝对路径。
            *   `currentMacroRecord: unifiedLatex.MacroInfoRecord`: 当前已知的宏定义集合 (argspecs)，用于辅助解析。
        *   **返回**: `Promise<InternalFileParseResult>` (其中 `InternalFileParseResult` 在 `types.ts` 中定义)，包含:
            *   `ast: unifiedLatex.Root | null`: 解析得到的 AST，如果发生严重错误则为 `null`。
            *   `newMacros: unifiedLatex.MacroInfoRecord`: 在此文件中新定义的宏。
            *   `includedFiles: { path: string, command: string, rawPath: string }[]`: 此文件包含的其他文件的路径列表、使用的命令及原始路径字符串。
            *   `error?: string`: 解析过程中的错误信息。
        *   **逻辑**:
            1.  **读取文件**: 使用 `utils.readFileAsync(filePath)` 读取文件内容。
            2.  **AST 解析 (改编自 `LaTeX-Workshop/src/parse/parser/unified.ts` 的 `parseLaTeX` 和 `parseArgs` 逻辑)**:
                *   尝试使用 `unified()` 创建一个 processor。
                *   使用 `unifiedLatexFromString` (来自 `@unified-latex/unified-latex-from-string`) 插件解析文件内容生成初步的 AST。
                *   设置解析器选项，例如 `flags: { autodetectExpl3AndAtLetter: true }`。
                *   使用 `attachMacroArgs` (来自 `@unified-latex/unified-latex-util-arguments`) 和传入的 `currentMacroRecord` 来处理和附加宏参数到 AST 节点上。
                *   如果在解析或参数附加过程中发生错误，捕获错误，将 `ast` 设为 `null`，并记录错误信息到返回结果的 `error` 字段。
            3.  **提取新宏定义 (改编自 `LaTeX-Workshop/src/parse/newcommandfinder.ts` 的 `parseAst` 逻辑)**:
                *   如果 AST 解析成功，则调用私有辅助方法 `extractNewMacros(ast)` 遍历 AST。
                *   识别 `\newcommand`, `\renewcommand`, `\DeclareMathOperator`, `\DeclarePairedDelimiter` 等宏定义命令。
                *   将这些定义的命令名及其参数规范（如果能可靠提取或有默认值）构造成 `MacroInfoRecord` 格式。
                *   对于参数规范的提取，初期可以简化，例如仅记录宏名，或者对常见定义模式（如 `\newcommand{\foo}[2]{...}`）提取参数数量。
            4.  **提取包含的文件**: 
                *   如果 AST 解析成功，则调用私有辅助方法 `extractIncludedFiles(ast, baseDir)` 遍历 AST。
                *   识别 `\input{file}`, `\include{file}`, `\subfile{file}` (如果计划支持) 等命令。
                *   提取参数（文件名/路径）。
                *   将相对路径转换为相对于当前文件所在目录 (`baseDir = path.dirname(filePath)`) 的路径，或保留绝对路径。
                *   记录原始路径字符串和使用的命令。
            5.  返回 `InternalFileParseResult` 对象。

    *   **`private extractNewMacros(ast: unifiedLatex.Root): unifiedLatex.MacroInfoRecord` (提取新宏 - 辅助函数)**
        *   **目的**: 遍历 AST 并提取所有宏定义节点。
        *   **API**: 接收 AST 根节点，返回 `MacroInfoRecord`。
        *   **逻辑**: 使用 `unified-latex-util-visit` 或自定义的递归遍历。
            *   查找特定名称的宏节点 (如 `newcommand`, `renewcommand`, `DeclareMathOperator` 等)。
            *   从这些节点的参数中提取新定义的宏的名称和（如果可能）其参数规范。
            *   例如，对于 `\newcommand{\cmd}[2][opt]{def}`，提取 `\cmd` 及其参数签名 `o m`。
            *   **简化**: 初期可能只提取宏名，argspec 设为一个通用值或留空，由 `attachMacroArgs` 的默认行为处理，或依赖外部提供更精确的 argspec。
        *   **灵感**: `LaTeX-Workshop/src/parse/newcommandfinder.ts` 中的 `parseAst` 方法。

    *   **`private extractIncludedFiles(ast: unifiedLatex.Root, baseDir: string): { path: string, command: string, rawPath: string }[]` (提取包含文件 - 辅助函数)**
        *   **目的**: 遍历 AST 并提取所有文件包含命令。
        *   **API**: 接收 AST 根节点和当前文件的基目录，返回包含文件信息的数组。
        *   **逻辑**: 使用 `unified-latex-util-visit` 或自定义的递归遍历。
            *   查找特定名称的宏节点 (`input`, `include`, `subfile` 等)。
            *   从参数中提取文件名/路径字符串 (原始路径)。
            *   使用 `utils.resolvePath(baseDir, extractedPath)` 将相对路径转换为更规范的路径（相对于项目或绝对路径）。
            *   返回包含规范化路径、原始命令和原始路径字符串的对象数组。
        *   **灵感**: `LaTeX-Workshop/src/core/cache.ts` 中处理文件依赖的部分（尽管那里可能还涉及 `.fls` 文件）。

## 3. APIs 与用法

`FileParser` 类将被 `ProjectParser` 内部实例化和使用。

## 4. 实现灵感来源

*   **`LaTeX-Workshop/src/parse/parser/unified.ts`**: 这是 `unified-latex` AST 解析和参数附加的核心逻辑来源 (`parseLaTeX`, `parseArgs` 函数)。我们将改编这些逻辑以适应独立应用的需求（例如，不依赖 worker pool，除非后续性能优化需要）。
*   **`LaTeX-Workshop/src/parse/newcommandfinder.ts`**: `parseAst` 方法是提取宏定义的直接灵感来源。
*   **`LaTeX-Workshop/src/core/cache.ts` (`getIncludedTeX` 等)**: 虽然 `cache.ts` 复杂且与 VSCode 事件系统深度集成，但其内部递归解析 `\input` 等命令以构建文件依赖图的思路可供参考，用于 `extractIncludedFiles`。
*   **`unified-latex` 文档和示例**: 参考 `unified-latex` 各个工具库的官方文档对于正确使用其 API 至关重要。

## 5. 使用的库

*   **`unified`**: `unified` 处理流程的核心库。
*   **`@unified-latex/unified-latex-from-string`**: 用于从 LaTeX 字符串创建 AST。
*   **`@unified-latex/unified-latex-util-parse`**: (可能间接使用 `getParser`) 虽然 `LaTeX-Workshop` 使用 `getParser`，但对于更直接的字符串解析，`unifiedLatexFromString` 可能更常用。
*   **`@unified-latex/unified-latex-util-arguments`**: 核心库，用于根据宏定义（argspecs）将参数附加到 AST 节点。
*   **`@unified-latex/unified-latex-types`**: 用于 AST 节点和宏定义的类型。
*   **`@unified-latex/unified-latex-util-visit`** (推荐): 方便遍历 AST 节点的工具。
*   **`@unified-latex/unified-latex-to-string`** (可能需要): 如果在提取宏定义时需要将参数节点转换为字符串。
*   **Node.js `path` 模块 (通过 `utils.ts`)**: 用于处理文件路径。
*   **自定义的 `utils.ts`**: 用于文件读取等。 