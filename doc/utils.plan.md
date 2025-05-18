# Plan: `utils.ts` (工具函数)

## 1. 文件目的

`utils.ts` 文件将提供一系列通用工具函数，以支持 `latex-ast-parser` 应用中的各种操作。这些函数将封装常见任务，如文件系统交互（读取文件、检查存在性）、路径操作（解析、规范化）。目标是促进代码复用，并保持其他模块的简洁性，使其专注于核心逻辑。

**此文件中部分精心挑选的、具有通用性的函数可以考虑作为库的辅助 API 导出。**

## 2. 关键函数

*   **`readFileAsync(filePath: string): Promise<string>` (异步读取文件)**
    *   **目的**: 异步读取文件内容。
    *   **API**: 接收文件路径字符串，返回一个 Promise，该 Promise 解析为文件内容的字符串，如果读取失败则拒绝并返回错误。
    *   **导出为库API**: 否 (通常是内部实现细节)。
    *   **灵感**: `fs.readFile` (Node.js 内置)。

*   **`fileExistsAsync(filePath: string): Promise<boolean>` (异步检查文件是否存在)**
    *   **目的**: 异步检查给定路径的文件或目录是否存在。
    *   **API**: 接收文件路径字符串，返回一个 Promise，如果存在则解析为 `true`，否则为 `false`。
    *   **导出为库API**: 否 (通常是内部实现细节)。
    *   **灵感**: `fs.stat` 或 `fs.access` (Node.js 内置)。

*   **`resolvePath(basePath: string, relativePath: string): string` (解析路径)**
    *   **目的**: 根据基础路径解析相对路径，得到绝对路径。
    *   **API**: 接收 `basePath` (目录) 和 `relativePath`，返回绝对路径字符串。
    *   **导出为库API**: 否 (标准 `path` 模块功能，库用户可自行使用)。
    *   **灵感**: `path.resolve` (Node.js 内置)。

*   **`normalizePath(filePath: string): string` (规范化路径)**
    *   **目的**: 规范化给定路径，解析 `.` 和 `..` 片段，并确保路径分隔符一致（例如，使用正斜杠）。
    *   **API**: 接收文件路径字符串，返回规范化后的路径字符串。
    *   **导出为库API**: 是 (对于确保库内部和外部路径一致性可能有用)。
    *   **灵感**: `path.normalize` (Node.js 内置)。

*   **`findTexFiles(directoryPath: string, extensions?: string[]): Promise<string[]>` (查找TeX文件)**
    *   **目的**: 在目录中递归查找所有具有指定 TeX 扩展名的文件。
    *   **API**: 接收目录路径和可选的扩展名数组 (默认为 `['.tex', '.ltx', '.latex']`)，返回一个 Promise，解析为找到的文件路径数组。
    *   **导出为库API**: 否 (特定于项目文件发现，是 `ProjectParser` 的内部逻辑)。
    *   **灵感**: 使用 `fs.readdir` 和 `fs.stat` 的通用目录遍历逻辑。

*   **`isTexFile(filePath: string, extensions?: string[]): boolean` (是否为TeX文件)**
    *   **目的**: 检查给定文件路径是否具有类似 TeX 的扩展名。
    *   **API**: 接收文件路径和可选的扩展名数组 (默认为 `['.tex', '.ltx', '.latex']`)，返回 `true` 或 `false`。
    *   **导出为库API**: 是 (作为简单的辅助函数可能有用)。
    *   **灵感**: `path.extname`。

*   **`isRootFileContent(content: string): boolean` (是否为根文件内容 - 基础版)**
    *   **目的**: 根据文件内容简化检查文件是否*可能*是 LaTeX 根文件（例如，包含 `\documentclass`）。
    *   **API**: 接收文件内容字符串。返回 `true` 如果看起来像根文件内容。
    *   **导出为库API**: 否 (太基础，且 `ProjectParser` 会有更完善的逻辑)。
    *   **灵感**: `LaTeX-Workshop/src/core/root.ts` (特别是 `getIndicator` 逻辑)。

*   **`writeFileAsync(filePath: string, content: string): Promise<void>` (异步写入文件)**
    *   **目的**: (新增) 异步写入内容到文件，主要供 CLI 使用。
    *   **API**: 接收文件路径和内容字符串，返回 Promise。
    *   **导出为库API**: 否。

## 3. API 与用法

```typescript
// 库的 index.ts 或 utils.ts 导出部分
export { normalizePath, isTexFile } from './utils';

// 库用户使用示例
import { normalizePath, isTexFile } from 'latex-ast-parser';

if (isTexFile('mydoc.tex')) {
    const cleanPath = normalizePath('./mydoc.tex');
    // ...
}
```

## 4. 实现灵感来源

*   **Node.js `fs` 模块 (特别是 `fs.promises` API)**
*   **Node.js `path` 模块**
*   **`LaTeX-Workshop/src/core/file.ts`** 和 **`LaTeX-Workshop/src/core/root.ts`**

## 5. 使用的库

*   **Node.js 内置 `fs` (特别是 `fs.promises`)**
*   **Node.js 内置 `path`**

**此模块本身并非严格需要外部库，但如果 `findTexFiles` 需要比简单递归更高级的功能，可以考虑使用 `glob` 等库来实现更复杂的文件搜索模式。** 