# Plan: `astSerializer.ts` (AST 序列化器)

## 1. 文件目的

`astSerializer.ts` 模块负责将解析得到的项目级 AST 数据结构 (`ProjectAST`) 转换为 JSON 字符串，以便输出到文件或标准输出。它将处理 `unified-latex` AST 节点的序列化，并确保输出格式符合 `plan.md` 中定义的要求。

**此模块的 `serializeProjectAstToJson` 函数可以作为库的辅助 API 导出。**

## 2. 关键函数

*   **`serializeProjectAstToJson(projectAST: ProjectAST, prettyPrint: boolean = false): string` (序列化项目AST为JSON)** (导出)
    *   **目的**: 将整个项目的 AST 数据（包含多个文件的 AST）序列化为 JSON 字符串。
    *   **API**:
        *   `projectAST: ProjectAST`: 从 `ProjectParser` 获取的项目 AST 对象 (在 `types.ts` 中定义)。
        *   `prettyPrint: boolean`: (可选, 默认 `false`) 是否格式化输出的 JSON 字符串（例如，使用缩进）。
    *   **返回**: 表示项目 AST 的 JSON 字符串。
    *   **逻辑**:
        1.  创建一个新的对象 `outputData` 用于构建最终的JSON结构。其结构将直接映射 `ProjectAST` 的期望输出格式 (顶层键为文件路径，可能包含 `_metadata` 键)。
        2.  **添加元数据**: 如果 `projectAST.rootFilePath` 或 `projectAST.errors` (且不为空) 存在，则将它们添加到 `outputData._metadata` (如果决定使用 `_metadata` 键)。
            *   `outputData._metadata = {};`
            *   `if (projectAST.rootFilePath) outputData._metadata.rootFilePath = projectAST.rootFilePath;`
            *   `if (projectAST.errors && projectAST.errors.length > 0) outputData._metadata.projectGlobalErrors = projectAST.errors;`
            *   `if (projectAST.macros) outputData._metadata.macros = projectAST.macros;` (如果决定包含)
        3.  **处理文件 AST**: 遍历 `projectAST.files` 数组中的每个 `ProjectFileAst` 对象。
            *   对于每个 `fileAstEntry`:
                *   `outputData[fileAstEntry.filePath] = fileAstEntry.ast;`
                *   如果 `fileAstEntry.error` 存在，可以在 `outputData[fileAstEntry.filePath]` 对象旁边（或者作为其属性）添加错误信息，例如: 
                    `outputData[fileAstEntry.filePath + ":error"] = fileAstEntry.error;` 或者修改 `ProjectFileAst` 类型，使 `ast` 和 `error` 在同一个对象下。
                    一个更清晰的方式是让 `outputData[fileAstEntry.filePath]` 的值是一个包含 `ast` 和 `parsingError` (可选) 的对象。
                    例如: `outputData[fileAstEntry.filePath] = { ast: fileAstEntry.ast, parsingError: fileAstEntry.error };` (这需要 `ProjectAST` 定义的相应调整)。
                    根据主 `plan.md` 中的输出格式示例，似乎文件路径直接映射到其AST，错误信息可能在 `_metadata.projectGlobalErrors` 或文件特定的错误列表中（如果 `ProjectFileAst` 包含错误）。目前，我们主要将文件路径映射到 AST，全局错误在 `_metadata`。
        4.  **JSON 序列化**: 
            *   使用 `JSON.stringify()` 将 `outputData` 对象转换为 JSON 字符串。
            *   如果 `prettyPrint` 为 `true`，则 `JSON.stringify(outputData, null, 2)`。
        5.  返回生成的 JSON 字符串。

## 3. APIs 与用法

**库用法示例:**

```typescript
import { parseLatexProject, serializeProjectAstToJson, ParserOptions, ProjectAST } from 'latex-ast-parser';

async function main() {
    const options: ParserOptions = { entryPath: './main.tex' };
    const projectAst: ProjectAST = await parseLatexProject(options);
    
    const jsonString = serializeProjectAstToJson(projectAst, true);
    console.log(jsonString);
}
```

## 4. 实现灵感来源

*   **`JSON.stringify()`**
*   `plan.md` 中定义的"6.2. 输出 AST 格式"部分。

## 5. 使用的库

*   **`@unified-latex/unified-latex-types`**: (间接)
*   Node.js 内置 `JSON` 对象。 