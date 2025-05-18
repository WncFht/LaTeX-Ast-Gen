# Plan: LaTeX 项目 AST 解析器 (总体规划)

## 1. 简介

### 1.1. 项目目标
本项目的目标是创建一个独立的命令行工具（CLI）以及一个可作为库导入的 TypeScript/JavaScript 模块。两者均用于解析一个完整的 LaTeX 项目（可能包含多个 `.tex` 文件，通过 `\\input` 或 `\\include` 关联），并输出该项目的抽象语法树 (AST)。输出的 AST 优选为 JSON 格式（对于CLI）或结构化对象（对于库），以便于后续的程序化分析或处理。

### 1.2. 灵感来源
本程序的设计和实现将主要借鉴 `vscode-LaTeX-Workshop` 扩展中 `src/parse/` 模块的逻辑，特别是其对 `unified-latex` 工具链的使用、宏定义处理以及多文件项目解析的思路。

## 2. 核心需求

*   **输入 (CLI 和库)**:
    *   单个根 `.tex` 文件的路径，或包含 LaTeX 项目的目录路径。
    *   可选的宏定义配置。
*   **输出**:
    *   **CLI**: JSON 格式的项目 AST 结构到文件或标准输出。
    *   **库**: `ProjectAST` 对象 (在 `types.ts` 中定义)。
*   **多文件处理**: 能够跟踪并解析由 `\input` 和 `\include` 命令引用的其他 `.tex` 文件。
*   **自定义命令处理**: 能够识别项目中通过 `\newcommand`, `\renewcommand`, `\DeclareMathOperator` 等定义的自定义宏，并利用这些定义来更准确地解析宏参数。
*   **错误处理**: 对文件读写错误、解析错误等提供清晰的错误报告（在 `ProjectAST` 对象中，或 CLI 输出）。
*   **可作为库使用**: 提供清晰的、类型化的 API 供其他 TypeScript/JavaScript 项目导入和使用。

## 3. 程序结构与组件

程序将采用模块化设计，主要包含以下组件。每个组件的详细规划参见对应的 `.plan.md` 文件：

*   **`index.ts`**: 作为库的统一导出入口。 ([`index.plan.md`](./index.plan.md))
*   **`main.ts`**: CLI 工具的入口点，调用库的API。 ([`main.plan.md`](./main.plan.md))
*   **`ProjectParser.ts`**: 管理整个 LaTeX 项目的解析过程，是库API的核心。 ([`projectParser.plan.md`](./projectParser.plan.md))
*   **`FileParser.ts`**: 负责解析单个 LaTeX (`.tex`) 文件，内部使用。 ([`fileParser.plan.md`](./fileParser.plan.md))
*   **`MacroHandler.ts`**: 管理和提供宏定义 (argspecs)，可作为高级库API的一部分。 ([`macroHandler.plan.md`](./macroHandler.plan.md))
*   **`AstSerializer.ts`**: 将 AST 数据结构序列化为 JSON 格式，可作为库的辅助API。 ([`astSerializer.plan.md`](./astSerializer.plan.md))
*   **`utils.ts`**: 提供通用的辅助函数，部分可作为库的辅助API。 ([`utils.plan.md`](./utils.plan.md))
*   **`types.ts`**: 定义项目中使用的 TypeScript 类型，是库API的一部分。 ([`types.plan.md`](./types.plan.md))

## 4. 文件清单 (建议)

```
latex-ast-parser/
├── doc/                      # 规划文档目录
│   ├── plan.md               # 本总体规划文档
│   ├── index.plan.md         # index.ts (库入口) 的规划
│   ├── main.plan.md          # main.ts (CLI入口) 的规划
│   ├── projectParser.plan.md # projectParser.ts 的规划
│   ├── fileParser.plan.md    # fileParser.ts 的规划
│   ├── macroHandler.plan.md  # macroHandler.ts 的规划
│   ├── astSerializer.plan.md # astSerializer.ts 的规划
│   ├── utils.plan.md         # utils.ts 的规划
│   └── types.plan.md         # types.ts 的规划
├── package.json            # 项目依赖和脚本
├── tsconfig.json           # TypeScript 配置
├── src/                    # 源代码目录
│   ├── index.ts            # 库的导出入口
│   ├── main.ts             # CLI 程序入口
│   ├── projectParser.ts    # 项目级解析器
│   ├── fileParser.ts       # 文件级解析器
│   ├── macroHandler.ts     # 宏定义处理器
│   ├── astSerializer.ts    # AST 序列化器
│   ├── types.ts            # TypeScript 类型定义
│   └── utils.ts            # 通用工具函数
├── samples/                # 示例 LaTeX 项目，用于测试
│   └── sample_project/
│       ├── main.tex
│       ├── chapter1.tex
│       └── custom_macros.tex
└── README.md               # 程序和库的说明文档
```

## 5. API 设计

### 5.1. 库 API (通过 `index.ts` 导出)

*   主要函数: `parseLatexProject(options: ParserOptions): Promise<ProjectAST>`
*   主要类型: `ParserOptions`, `ProjectAST`, `ProjectFileAst`, `MacroInfoRecord` 等。
*   可选高级类: `ProjectParser`, `MacroHandler`。
*   可选辅助函数: `serializeProjectAstToJson`, `normalizePath`, `isTexFile`。

(详细设计见各组件的 `.plan.md` 及 [`index.plan.md`](./index.plan.md))

### 5.2. 命令行接口 (CLI) (通过 `main.ts` 实现)

```bash
latex-ast-parser <entryPath> [options]
```

*   `<entryPath>`: 必需，根 `.tex` 文件或项目目录。
*   选项: `--output`, `--macros`, `--pretty`, `--help` 等。

(详细设计见 [`main.plan.md`](./main.plan.md) 和 [`types.plan.md`](./types.plan.md) 中的 `CliSpecificOptions`)

### 5.3. 输出 AST 格式 (CLI 和 `serializeProjectAstToJson`)

如前所述，顶层键为文件路径，值为 `unified-latex` AST。可选 `_metadata` 键包含项目级信息。

(详细设计见 [`astSerializer.plan.md`](./astSerializer.plan.md) 和 [`types.plan.md`](./types.plan.md))

## 6. 核心业务逻辑 (工作流程 - 总体概述)

1.  **库核心 (`ProjectParser`)**: 
    *   接收 `ParserOptions` (包括入口路径和宏配置)。
    *   初始化/配置 `MacroHandler`。
    *   确定根文件。
    *   使用 `FileParser` 迭代解析文件队列：读取文件 -> 解析AST -> 提取新宏和包含文件 -> 更新宏记录 -> 将新文件入队。
    *   聚合结果为 `ProjectAST` 对象。
2.  **CLI (`main.ts`)**: 
    *   解析命令行参数为 `ParserOptions` 和 `CliSpecificOptions`。
    *   调用库的 `parseLatexProject(parserOptions)`。
    *   获取 `ProjectAST` 结果。
    *   调用 `serializeProjectAstToJson` (如果需要) 将结果转为 JSON。
    *   输出 JSON 到文件或 stdout。

(各步骤的详细逻辑见对应组件的 `.plan.md` 文件)

## 7. 依赖项 (初步)

*   **Node.js 环境** (如果使用 TypeScript/JavaScript)
*   **`unified`**
*   **`@unified-latex/unified-latex-from-string`**: 用于从字符串解析 LaTeX。
*   **`@unified-latex/unified-latex-types`**: LaTeX AST 的类型定义。
*   **`@unified-latex/unified-latex-util-arguments`**: 用于附加宏参数。
*   **`@unified-latex/unified-latex-util-macros`**: 可能用于处理宏（如提取定义）。
*   **`@unified-latex/unified-latex-util-visit`**: (推荐) 用于遍历 AST。
*   **`yargs`** (或类似的 CLI 参数解析库)
*   **Node.js 内置 `fs` (promises API) 和 `path` 模块**

## 8. 未来可能的扩展

*   更复杂的根文件识别策略 (例如，支持 `%!TEX TS-program` 或其他魔术注释变体)。
*   支持 `.fls` 文件来确定项目文件依赖（作为 `\input` 解析的补充或替代方案）。
*   提供更细致的 AST 节点过滤或查询API（如果将此工具作为库使用）。
*   支持插件系统来扩展AST的转换或分析能力。
*   集成可选的 Worker Threads 以优化大型项目的解析性能 (类似 `LaTeX-Workshop` 的 `parser.ts` 与 `unified.ts` 的关系)。

此计划文档为开发兼具 CLI 和库功能的 LaTeX 项目 AST 解析器提供了更新的框架和路线图。 