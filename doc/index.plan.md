# Plan: `index.ts` (库主入口)

## 1. 文件目的

`index.ts` 文件是 `latex-ast-parser` 作为 **TypeScript/JavaScript 库** 的主入口点。它负责导出所有公共 API，使得其他项目可以通过 `import { ... } from 'latex-ast-parser'` (假设包名为 `latex-ast-parser`) 来使用其功能。这个文件将重新导出核心解析函数、主要的配置和结果类型，以及任何被认为是公共接口一部分的辅助类或工具。

## 2. 导出的主要 API

以下是建议从 `index.ts` 导出的主要成员：

*   **核心解析函数:**
    *   `parseLatexProject(options: ParserOptions): Promise<ProjectAST>`
        *   **来源**: 在 `projectParser.ts` 中定义（或由一个包装了 `ProjectParser` 类实例化的新函数提供）。
        *   **描述**: 库的主要入口函数，接收 `ParserOptions`，异步解析 LaTeX 项目并返回包含所有文件 AST 和元数据的 `ProjectAST` 对象。

*   **核心类 (可选，供高级用户使用):**
    *   `ProjectParser` 类
        *   **来源**: `projectParser.ts`
        *   **描述**: 允许用户实例化并更细致地控制项目解析过程（例如，如果他们想多次调用 `parse` 方法或以特定方式管理 `MacroHandler`）。
    *   `MacroHandler` 类
        *   **来源**: `macroHandler.ts`
        *   **描述**: 允许用户创建和配置自定义的宏处理器实例，然后可能将其传递给 `ProjectParser` 的构造函数（如果 `ProjectParser` 支持）。

*   **主要类型和接口:**
    *   `ProjectAST`
    *   `ProjectFileAst`
    *   `ParserOptions`
    *   (以及从 `@unified-latex/unified-latex-types` 重新导出的核心类型，如果认为对库用户方便的话)
        *   `unifiedLatex.Root as LatexAstNodeRoot` (使用别名以区分)
        *   `unifiedLatex.Node as LatexAstNode`
        *   `unifiedLatex.Macro as LatexAstMacroNode`
        *   `unifiedLatex.Argument as LatexAstArgumentNode`
        *   `unifiedLatex.MacroInfoRecord`
        *   `unifiedLatex.EnvInfoRecord`
    *   **来源**: `types.ts` 和 `@unified-latex/unified-latex-types`。

*   **辅助工具 (可选):**
    *   `serializeProjectAstToJson(projectAST: ProjectAST, prettyPrint?: boolean): string`
        *   **来源**: `astSerializer.ts`
        *   **描述**: 将 `ProjectAST` 对象转换为 JSON 字符串的辅助函数。
    *   `normalizePath(filePath: string): string`
        *   **来源**: `utils.ts`
    *   `isTexFile(filePath: string, extensions?: string[]): boolean`
        *   **来源**: `utils.ts`

## 3. 文件结构示例 (`index.ts`)

```typescript
// 核心解析功能
export { parseLatexProject } from './projectParser'; // 或者来自一个新的顶层API文件

// 核心类 (供高级使用)
export { ProjectParser } from './projectParser';
export { MacroHandler } from './macroHandler';

// 主要类型定义
export type {
    ProjectAST,
    ProjectFileAst,
    ParserOptions,
    // Potentially CliSpecificOptions if the lib also wants to expose CLI building blocks
} from './types';

// 重新导出 unified-latex 核心类型，可能带别名
export type {
    Root as LatexAstNodeRoot,
    Node as LatexAstNode,
    Macro as LatexAstMacroNode,
    Argument as LatexAstArgumentNode,
    MacroInfoRecord,
    EnvInfoRecord,
} from '@unified-latex/unified-latex-types';

// 辅助工具
export { serializeProjectAstToJson } from './astSerializer';
export { normalizePath, isTexFile } from './utils';

```

## 4. 实现考量

*   **API 简洁性**: 导出的 API 应该力求简洁和易用。对于大多数用户，`parseLatexProject` 和相关的选项/结果类型就足够了。
*   **内部与外部**: 清晰区分哪些模块是内部实现细节，哪些是稳定的公共 API。
*   **文档**: 公共 API 需要有良好的 JSDoc/TSDoc 文档。
*   **打包**: 在构建库时 (`package.json` 中的 `main` 或 `module` 字段)，应确保 `index.ts` 是指定的入口点。

## 5. 与其他模块的协调

*   `projectParser.ts`: 可能需要创建一个新的顶层函数 `parseLatexProject`，该函数内部实例化 `ProjectParser` 并调用其 `parse` 方法。或者，`ProjectParser.parse` 方法本身就可以设计为直接由 `ParserOptions` 驱动，从而使 `ProjectParser` 类成为主要的 API 接触点。
*   `types.ts`: 需要确保所有计划导出的类型都被正确定义并标记为导出。
*   `utils.ts`, `astSerializer.ts`: 确认哪些函数适合作为公共辅助工具导出。

此文件定义了库的公共表面，是库用户与之交互的主要方式。 