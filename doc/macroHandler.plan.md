# Plan: `macroHandler.ts` (宏处理器)

## 1. 文件目的

`macroHandler.ts` 模块负责在整个项目解析生命周期中管理 LaTeX 宏定义（特别是其参数规范，即 "argspecs"）。它加载预定义的宏，整合用户提供文件中的宏，并动态添加在解析各个 `.tex` 文件过程中发现的宏。这套整合的宏定义将提供给 `FileParser`，以便更准确地解析 AST，特别是自定义命令的参数。

**`MacroHandler` 类可以作为库的高级 API 的一部分导出，允许用户深度自定义宏处理行为。**

## 2. 关键类与方法 (部分将导出供库使用)

*   **`MacroHandler` 类** (导出)
    *   **`private macroRecord: unifiedLatex.MacroInfoRecord`**: 用于内部存储所有已知宏定义的记录。
    *   **`constructor(options?: ParserOptions)` (构造函数)** (导出)
        *   **目的**: 使用可选的外部宏定义和加载默认宏的设置来初始化 `MacroHandler`。
        *   **API**: 接收一个可选的 `ParserOptions` 对象 (在 `types.ts` 中定义，复用其中的宏相关选项如 `macrosFile`, `loadDefaultMacros`, `customMacroRecord`)。
        *   **逻辑**:
            *   初始化 `macroRecord` 为一个空对象。
            *   如果 `options.loadDefaultMacros` 不为 `false`，则加载一组预定义的常用 LaTeX 宏参数规范。
            *   如果 `options.customMacroRecord` 提供，则将其深拷贝合并到 `macroRecord`。
            *   如果 `options.macrosFile` 提供，则读取此 JSON 文件，解析它，并将其定义合并到 `macroRecord` (合并策略：`customMacroRecord` > `macrosFile` > 默认宏)。
            *   处理在读取或 JSON 解析外部宏文件期间可能发生的错误。
    *   **`addMacros(newMacros: unifiedLatex.MacroInfoRecord): void` (添加宏)** (主要供内部 `ProjectParser` 使用，但也可导出)
        *   **目的**: 将新发现的宏定义合并到现有的 `macroRecord` 中。
        *   **API**: 接收一个包含新宏定义的 `MacroInfoRecord` 对象。
        *   **逻辑**: 遍历 `newMacros` 并将其添加/更新到内部的 `this.macroRecord`。
    *   **`getCurrentMacros(): unifiedLatex.MacroInfoRecord` (获取当前宏)** (主要供内部 `ProjectParser` 使用，但也可导出)
        *   **目的**: 提供当前所有已知宏定义的整合集合。
        *   **API**: 返回 `this.macroRecord` 的深拷贝副本，以防止外部修改。
    *   **`private loadDefaultMacros(): unifiedLatex.MacroInfoRecord` (加载默认宏 - 辅助函数)**
        *   **目的**: 返回一组预定义的常用 LaTeX 宏参数规范。
        *   **逻辑**: 包含一个硬编码的 `MacroInfoRecord` 对象。
        *   **灵感**: `LaTeX-Workshop/src/parse/parser/unified-defs.ts` 中的 `MACROS` 常量。
    *   **`private async loadExternalMacrosFromFile(filePath: string): Promise<unifiedLatex.MacroInfoRecord | null>` (从文件加载外部宏 - 辅助函数)**
        *   **目的**: 读取并解析包含宏定义的 JSON 文件。
        *   **逻辑**: 使用 `utils.readFileAsync` 和 `JSON.parse`。包含错误处理，失败时返回 `null` 或抛出特定错误。

## 3. API 与用法

**库用法示例:**

```typescript
import { MacroHandler, ParserOptions, ProjectAST, parseLatexProject } from 'latex-ast-parser';
import type * as unifiedLatex from '@unified-latex/unified-latex-types';

// 方式一：使用顶层 parseLatexProject 函数，并通过 ParserOptions 间接配置 MacroHandler
async function simpleUsage() {
    const options: ParserOptions = {
        entryPath: './main.tex',
        macrosFile: './my_macros.json'
    };
    const projectAst: ProjectAST = await parseLatexProject(options);
}

// 方式二：高级用法，直接实例化和操作 MacroHandler (如果库设计允许ProjectParser接受预配置的MacroHandler)
async function advancedUsage() {
    const customMacrosForLib: unifiedLatex.MacroInfoRecord = {
        'mycustomcmd': { signature: 'm m' }
    };
    const macroHandler = new MacroHandler({
        customMacroRecord: customMacrosForLib,
        loadDefaultMacros: false
    });

    // 假设 ProjectParser 可以接受一个 MacroHandler 实例
    // const projectParser = new ProjectParser(macroHandler);
    // const projectAst: ProjectAST = await projectParser.parse('./main.tex');
    
    // 或者，如果 parseLatexProject 也接受预配置的 handler
     const projectAst = await parseLatexProject({ entryPath: './main.tex' }, macroHandler);
}
```

## 4. 实现灵感来源

*   **`LaTeX-Workshop/src/parse/parser/unified-defs.ts`**
*   **`LaTeX-Workshop/src/parse/newcommandfinder.ts`**

## 5. 使用的库

*   **`@unified-latex/unified-latex-types`**: 用于 `MacroInfoRecord` 类型。
*   **Node.js `fs` 模块 (通过 `utils.ts`)**: 用于读取外部宏定义文件。

**`MacroHandler` 本身不直接使用其他主要的外部库，但它为 `FileParser` 中使用的 `@unified-latex/unified-latex-util-arguments` 等库生成数据。** 