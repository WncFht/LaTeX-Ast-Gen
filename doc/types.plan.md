# Plan: `types.ts` (类型定义)

## 1. 文件目的

`types.ts` 文件将定义 `latex-ast-parser` 应用中使用的所有自定义 TypeScript 类型、接口和枚举。这种类型定义的集中化可以增强代码的可读性、可维护性和类型安全性。它将包含 AST 结构（主要依赖 `@unified-latex/unified-latex-types`）、项目级 AST 表示、命令行与库的配置选项以及任何内部数据结构的类型。

**此文件导出的类型将构成库公共 API 的一部分。**

## 2. 关键接口与类型 (将导出供库使用)

### 2.1. 项目 AST 结构

*   **`ProjectFileAst` (项目文件AST)**:
    *   `filePath: string`: 指向 LaTeX 源文件的绝对或规范化路径。
    *   `ast: unifiedLatex.Root`: 该文件的 AST，由 `unified-latex` 生成。
    *   `error?: string`: 可选的错误信息，如果解析此特定文件失败。

*   **`ProjectAST` (项目AST)**:
    *   `rootFilePath: string | null`: 指向项目中已识别的根 `.tex` 文件的绝对路径。如果无法确定根文件，或者正在解析单个非项目文件，则为 `null`。
    *   `files: ProjectFileAst[]`: 一个数组，包含项目中每个已解析文件的 AST 和元数据。
    *   `macros: unifiedLatex.MacroInfoRecord`: 用于解析项目的最终聚合宏定义。对于库的调用者来说，了解这些宏定义可能很有用。
    *   `errors?: string[]`: 一个字符串数组，包含项目解析期间遇到的全局错误消息（例如，未找到根文件、无法解析循环依赖）。

### 2.2. 配置选项 (同时用于 CLI 和库 API)

*   **`ParserOptions` (解析器选项)**:
    *   `entryPath: string`: (CLI中必需，库API中必需) 指向根 `.tex` 文件或项目目录的路径。
    *   `macrosFile?: string`: (CLI和库API中可选) 指向一个 JSON 文件的路径，该文件包含自定义宏定义 (`MacroInfoRecord` 格式)。
    *   `loadDefaultMacros?: boolean`: (CLI和库API中可选, 默认: `true`) 是否加载一组预定义的常用 LaTeX 宏。
    *   `customMacroRecord?: unifiedLatex.MacroInfoRecord`: (库API中可选) 直接传入一个 `MacroInfoRecord` 对象，而不是从文件加载。如果同时提供了 `macrosFile`，则此选项优先或与之合并（需明确合并策略，例如此选项覆盖文件内容）。

*   **`CliSpecificOptions` (CLI特定选项 - 主要由 `main.ts` 使用)**:
    *   `output?: string`: 可选的输出 JSON 文件路径 (仅CLI)。
    *   `pretty?: boolean`: 是否以易读格式（带缩进）输出 JSON (仅CLI)。
    *   `help?: boolean`: 显示帮助信息的标志 (仅CLI)。

*   **`MacroInfoRecord` 和 `EnvInfoRecord`**: 直接从 `@unified-latex/unified-latex-types` 导出，供库用户在提供 `customMacroRecord` 或理解 `ProjectAST.macros` 时使用。

### 2.3. 内部解析器结果 (通常不作为库的直接API导出)

*   **`InternalFileParseResult` (内部文件解析结果)**:
    *   `ast: unifiedLatex.Root | null`: 文件的已解析 AST，如果发生致命解析错误则为 `null`。
    *   `newMacros: unifiedLatex.MacroInfoRecord`: 此文件中定义的宏。
    *   `includedFiles: { path: string, command: string, rawPath: string }[]`:从此文件包含/输入的文件，包括使用的命令（例如 `input`、`include`）和命令中的原始路径字符串。
    *   `error?: string`: 如果解析此文件遇到问题，则为错误信息。

## 3. API 与用法

**库用法示例:**

```typescript
import { parseLatexProject, ParserOptions, ProjectAST, MacroInfoRecord } from 'latex-ast-parser'; // 假设包名为 latex-ast-parser

async function analyzeProject() {
    const options: ParserOptions = {
        entryPath: '/path/to/my/latex/project/main.tex',
        macrosFile: '/path/to/my/custom_macros.json',
        loadDefaultMacros: true
    };

    try {
        const projectAst: ProjectAST = await parseLatexProject(options);
        console.log("解析完成，根文件:", projectAst.rootFilePath);
        projectAst.files.forEach(fileAst => {
            console.log(`文件: ${fileAst.filePath}, AST节点数量: ${fileAst.ast.content.length}`);
        });
        // 可以进一步处理 projectAst.macros 和 projectAst.errors
    } catch (error) {
        console.error("解析项目时出错:", error);
    }
}
```

## 4. 实现灵感来源

*   **`@unified-latex/unified-latex-types`**: AST 节点类型的主要来源。
*   **`LaTeX-Workshop/src/types.ts`**: 大型项目类型组织方式的参考。

## 5. 使用的库

*   **`@unified-latex/unified-latex-types`**: 用于核心 AST 和宏/环境定义类型。

**用法示例:**

```typescript
// 在 projectParser.ts 中
import type { ProjectAST, MacroOptions } from './types';
import type * as unifiedLatex from '@unified-latex/unified-latex-types';

class ProjectParser {
    async parse(rootPathOrDirPath: string, macroOptions?: MacroOptions): Promise<ProjectAST> {
        // ...
    }
}

// 在 fileParser.ts 中
import type { FileParseResult } from './types';
import type * as unifiedLatex from '@unified-latex/unified-latex-types';

class FileParser {
    async parseFile(
        filePath: string,
        currentMacros: unifiedLatex.MacroInfoRecord
    ): Promise<FileParseResult> {
        // ...
    }
}
```

## 4. 实现灵感来源

*   **`@unified-latex/unified-latex-types`**: 这将是 AST 节点类型（`Root`, `Macro`, `Arg`, `Node`, `MacroInfoRecord`, `EnvInfoRecord` 等）的主要来源。我们的自定义类型通常会包装或引用这些类型。
*   **`LaTeX-Workshop/src/types.ts`**: 提供大型项目如何组织其类型的一般结构和示例，尽管我们的需求更侧重于 AST 和项目结构。
*   **`LaTeX-Workshop/src/parse/parser/parserutils.ts` (`LogEntry` 类型)**: 虽然此工具不解析日志，但结构化错误/结果类型的概念是相关的。

## 5. 使用的库

*   **`@unified-latex/unified-latex-types`**: 用于核心 AST 和宏/环境定义类型。
*   定义类型本身不直接需要其他库，但这些类型将与其他模块中的库（如 `unified`、`@unified-latex/unified-latex-from-string` 等）结合使用。 