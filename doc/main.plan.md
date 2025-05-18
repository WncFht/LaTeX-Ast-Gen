# Plan: `main.ts` (主入口 - CLI 包装器)

## 1. 文件目的

`main.ts` 是 `latex-ast-parser` **命令行工具 (CLI)** 的程序主入口点。它负责解析命令行特有的参数，然后调用项目核心库提供的公共 API (例如 `parseLatexProject` 函数) 来执行 LaTeX 项目的解析。最后，它处理从库返回的 `ProjectAST` 结果，使用 `AstSerializer` (如果需要，或者库本身已提供序列化)，并将结果输出到用户指定的位置（文件或标准输出）。它还应处理 CLI 相关的错误和帮助信息显示。

## 2. 关键函数

*   **`async function mainCli(): Promise<void>` (CLI主执行函数)**
    *   **目的**: CLI 的顶层执行函数。
    *   **逻辑**:
        1.  **解析命令行参数**: 
            *   调用 `parseCliArgs(process.argv.slice(2))` 获取包含所有 CLI 相关选项和核心解析选项的组合对象 (可能命名为 `CombinedOptions`，它是 `ParserOptions & CliSpecificOptions`)。
            *   如果用户请求帮助 (`options.help` 为 `true`)，则调用 `displayHelp()` 并以状态码 0 退出程序 (`process.exit(0)`)。
        2.  **参数验证 (CLI层面)**: 检查 `options.entryPath` 是否提供，如果未提供则显示错误、帮助信息，并以错误状态码退出。
        3.  **准备库调用选项**: 从 `CombinedOptions` 中提取 `ParserOptions`。
            *   `const parserOptions: ParserOptions = { entryPath: options.entryPath, macrosFile: options.macrosFile, loadDefaultMacros: options.loadDefaultMacros, customMacroRecord: undefined /* CLI 通常不直接接受此对象 */ };`
        4.  **调用核心库进行项目解析**: 
            *   使用 `try...catch` 块包裹。
            *   `const projectAst: ProjectAST = await parseLatexProject(parserOptions);` (从库的 `index.ts` 导入 `parseLatexProject`)
        5.  **序列化 AST (如果库未直接返回字符串)**: 
            *   `const jsonOutput = serializeProjectAstToJson(projectAst, options.pretty);` (从库的 `index.ts` 或 `astSerializer.ts` 导入 `serializeProjectAstToJson`)
        6.  **输出结果**: 
            *   如果 `options.output` 已指定，则使用 `utils.writeFileAsync(options.output, jsonOutput)` 将 JSON 字符串写入文件。
            *   否则，将 `jsonOutput` 打印到 `console.log`。
            *   打印成功/错误摘要信息（例如，从 `projectAst.errors`）。
        7.  **错误处理**: 
            *   如果在库调用或输出过程中发生错误，`catch` 块应将其打印到 `console.error` 并以非零状态码退出 (`process.exit(1)`)。

*   **`function parseCliArgs(args: string[]): ParserOptions & CliSpecificOptions` (解析命令行参数)**
    *   **目的**: 解析原始命令行参数字符串数组为包含所有选项的结构化对象。
    *   **API**: 接收 `args: string[]`。
    *   **返回**: `ParserOptions & CliSpecificOptions` 对象 (这些类型在 `types.ts` 中定义)。
    *   **逻辑**: 使用 `yargs`。
        *   定义参数，包括 `ParserOptions` 中的 `entryPath`, `macrosFile`, `loadDefaultMacros` 和 `CliSpecificOptions` 中的 `output`, `pretty`, `help`。

*   **`function displayHelp(): void` (显示帮助信息)**
    *   **目的**: 向标准输出打印程序的用法、参数说明和选项。
    *   **逻辑**: 
        *   打印类似以下格式的帮助文本：
            ```
            Usage: latex-ast-parser <root_file_or_project_dir> [options]

            Parses a LaTeX project and outputs its AST in JSON format.

            Arguments:
              root_file_or_project_dir  Path to the root .tex file or the project directory.

            Options:
              -o, --output <filepath>   Path to the output JSON file. (default: stdout)
              -m, --macros <filepath>   Path to a JSON file with custom macro definitions.
              --pretty                  Pretty-print the JSON output.
              -h, --help                Display this help message.
            ```
        *   如果使用 `yargs`，这个函数可能不需要手动实现，或者可以调用 `yargs.showHelp()`。

## 3. 程序执行流程 (CLI)

1.  用户运行 CLI 命令。
2.  `mainCli()` 被调用。
3.  `parseCliArgs()` 解析参数。
4.  如需帮助，显示帮助并退出。
5.  参数被验证。
6.  调用核心库函数 `parseLatexProject` 并传入从 CLI 参数转换来的 `ParserOptions`。
7.  核心库返回 `ProjectAST`。
8.  (可选，取决于库API) `serializeProjectAstToJson` 将 `ProjectAST` 转换为 JSON。
9.  JSON 字符串被写入文件或标准输出。
10. CLI 正常退出或因错误退出。

## 4. 实现灵感来源

*   典型的 Node.js CLI 应用结构。
*   `yargs` 库。

## 5. 使用的库

*   **`yargs`**: 用于解析命令行参数。
*   **Node.js `process`**: 用于 `process.argv` 和 `process.exit`。
*   **核心库的导出模块**: `parseLatexProject`, `serializeProjectAstToJson` (如果需要), `ParserOptions`, `ProjectAST`, `CliSpecificOptions`。
*   **`utils.ts`** (用于 `writeFileAsync` 等，如果 CLI 直接调用)。 