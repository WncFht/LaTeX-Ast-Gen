# 项目重构建议 for LaTeX AST 生成器

本文档提出了对 LaTeX AST 生成器项目进行重构的建议，旨在提高其模块化、可维护性、可扩展性和可调试性。

## 1. 重新调整项目架构 (文件结构)

目标是实现更清晰的职责分离和模块化。

**当前结构:** `src/` 下大部分文件是扁平结构，除了 `environment-parser/`。

**建议的新结构:**

```
AST-Gen/
├── src/
│   ├── core/                     # 核心解析逻辑
│   │   ├── ProjectProcessor.ts   # 替代 ProjectParser，负责项目级协调和根文件确定
│   │   ├── FileContentParser.ts  # 替代 FileParser，负责单个文件内容的读取、解析、定义提取和AST处理
│   │   ├── DefinitionHandler.ts  # 统一管理宏和环境定义 (演进自 MacroHandler)，包括加载、存储、合并和提供定义
│   │   └── DefinitionExtractor.ts# 从AST中提取宏/环境定义的具体逻辑，包括已定义和推断的宏，以及环境规范
│   ├── ast/
│   │   ├── AstSerializer.ts      # AST序列化 (当前 astSerializer.ts)
│   │   └── ast-utils.ts          # (可选) AST节点相关的辅助函数 (如 printRaw 的封装或特定节点检查器)
│   ├── cli/
│   │   ├── main.ts               # CLI入口 (当前 main.ts)
│   │   └── cli-utils.ts          # (可选) CLI参数处理辅助、帮助信息生成、输出格式化等
│   ├── config/
│   │   ├── options.ts            # 定义解析器选项、CLI选项的类型 (如 ParserOptions, CliOptions, ResolvedConfig)
│   │   └── configManager.ts      # 负责加载、校验、合并配置，将文件路径等解析为可用数据结构
│   ├── latex-utils/              # 封装与底层LaTeX解析库及特定LaTeX结构处理的交互
│   │   ├── unifiedLatexBridge.ts # 封装 unified-latex 调用 (getParser, attachMacroArgs, processEnvironments等)
│   │   ├── astQuery.ts           # 封装 AST遍历(visit)和节点匹配(match)逻辑
│   │   ├── commandDefinitionUtils.ts # 包含从AST节点提取宏/环境定义的底层函数 (类似 listNewcommands, listNewEnvironments, environmentDefiningMacroToSpec)
│   │   └── projectFileUtils.ts   # TeX项目文件相关的工具 (如 findTexFiles, isTexFile, isRootFileContent, resolveTexPathWithExtension)
│   ├── types/
│   │   ├── index.ts              # 重新组织和导出所有公共及内部核心类型 (合并 types.ts, environment-parser/types.ts)
│   ├── utils/
│   │   ├── fileSystem.ts         # 核心文件系统操作 (readFileAsync, writeFileAsync, fileExistsAsync, getFileStats, mkdirAsync)
│   │   ├── pathUtils.ts          # 核心路径处理 (resolvePath, normalizePath, dirname, basename, extname)
│   │   └── logger.ts             # (新增) 轻量级日志系统模块
│   ├── index.ts                  # 库主入口 (当前 index.ts)
│   └── unified-latex.d.ts        # 合并和整理所有 .d.ts 声明 (当前 unified-latex-custom.d.ts, unified.d.ts)
├── samples/                      # 示例 LaTeX 项目
├── test/                         # 测试文件目录
│   ├── unit/                     # 单元测试
│   └── integration/              # 集成测试
├── package.json
├── tsconfig.json
└── README.md
└── refactor.md                   # 本文档
```

## 2. 整体业务逻辑梳理

目标是使数据流更清晰，各模块职责更明确。

**重构后逻辑 (高层次):**

1.  **初始化阶段:**
    *   CLI (`cli/main.ts`) / 库入口 (`index.ts`) 接收用户输入/选项。
    *   `config/configManager.ts` 加载、验证和合并配置，生成统一的内部 `ResolvedConfig` 对象。这包括处理宏/环境文件路径，并可能直接加载其内容为 `MacroInfoRecord` / `EnvInfoRecord`。
    *   `core/DefinitionHandler.ts` 初始化。根据 `ResolvedConfig`：
        *   加载CTAN标准环境定义 (当前通过 `ctanPackageEnvironmentInfo`)。
        *   加载默认宏定义。
        *   加载用户通过文件/对象提供的自定义宏和环境。

2.  **项目解析阶段 (`core/ProjectProcessor.ts`):**
    *   使用 `latex-utils/projectFileUtils.ts` 和 `utils/pathUtils.ts` 确定根文件。
    *   维护一个文件处理队列和已处理文件集合 (`Set<string>`)。
    *   对于队列中的每个文件：
        *   `core/FileContentParser.ts` 负责该文件的完整解析周期，与 `DefinitionHandler` 紧密协作：
            1.  **读取与原始解析**: 使用 `utils/fileSystem.ts` 读取文件内容。通过 `latex-utils/unifiedLatexBridge.ts::getParser()` 获取原始AST。
            2.  **提取文档内定义的宏**: `core/DefinitionExtractor.ts` (调用 `latex-utils/commandDefinitionUtils.ts::listNewcommands`) 从AST提取 `\newcommand` 等定义的宏。`DefinitionHandler.ts` 将这些新宏添加到"文档内定义"类别。
            3.  **初次参数附加 (宏)**: `FileContentParser` 从 `DefinitionHandler` 获取当前合并后的宏记录 (包含默认、用户及刚提取的文档内宏)。`latex-utils/unifiedLatexBridge.ts::attachMacroArgs()` 应用于AST。
            4.  **提取文档内定义的环境**: `DefinitionExtractor.ts` (调用 `latex-utils/commandDefinitionUtils.ts::listNewEnvironments` 及相关辅助函数) 从(可能已部分处理参数的)AST提取 `\newenvironment` 等定义的环境。`DefinitionHandler.ts` 将这些新环境添加到"文档内定义"类别。
            5.  **二次参数附加 (宏, 确保环境定义宏参数被处理)**: `FileContentParser` 再次从 `DefinitionHandler` 获取最新的宏记录。再次调用 `latex-utils/unifiedLatexBridge.ts::attachMacroArgs()`。这一步确保由宏定义的复杂环境(如`tcolorbox`)其定义宏的参数被正确解析，从而使环境定义能够被正确提取。
            6.  **环境处理**: `FileContentParser` 从 `DefinitionHandler` 获取当前合并后的环境记录。`latex-utils/unifiedLatexBridge.ts::processEnvironments()` 应用于AST，为环境附加参数及处理其内容。
            7.  **提取推断的宏**: `DefinitionExtractor.ts` 扫描AST，推断使用了但未明确定义的宏的参数签名。`DefinitionHandler.ts` 将这些宏添加到"推断使用"类别 (如果未与更高优先级的定义冲突)。
            8.  **最终参数附加 (宏)**: `FileContentParser` 从 `DefinitionHandler` 获取最终合并的宏记录 (包含推断宏)。最后一次调用 `latex-utils/unifiedLatexBridge.ts::attachMacroArgs()`。
            9.  **提取文件依赖**: `DefinitionExtractor.ts` 或 `FileContentParser` 的一部分，从最终处理的AST中提取 `\input`, `\include` 等引用的文件路径，并使用 `latex-utils/projectFileUtils.ts` 和 `utils/pathUtils.ts` 解析它们。
        *   `ProjectProcessor` 存储当前文件的解析结果 (AST、错误信息)，并将新发现的、未处理的依赖文件加入处理队列。

3.  **结果聚合与序列化阶段:**
    *   `ProjectProcessor` 收集所有成功解析的文件的AST和错误信息，形成 `ProjectFileAst[]`。
    *   从 `DefinitionHandler` 获取所有分类的宏和环境信息 (`_detailedMacros`, `_detailedEnvironments`) 以及最终生效的宏/环境记录。
    *   `ast/AstSerializer.ts` 将聚合的 `ProjectAST` 数据结构序列化为JSON字符串。

4.  **输出阶段:**
    *   `cli/main.ts` (或库的调用方) 将JSON输出到控制台/文件，并可以打印处理摘要(宏、环境统计等)。

## 3. 配置管理

目标是集中化、类型安全且灵活的配置处理。

*   **`config/options.ts`**: 定义所有可配置选项的TypeScript接口，例如 `ParserOptions` (库API用), `CliOptions` (CLI原始参数), 以及合并解析后的内部配置 `ResolvedParserConfig`。
*   **`config/configManager.ts`**: 
    *   提供函数 `resolveConfig(cliOptions: CliOptions, baseDir: string): Promise<ResolvedParserConfig>`。
    *   负责：
        *   合并来自CLI参数、默认值、以及通过路径(如 `macrosFile`, `environmentsFile`)加载的外部JSON文件内容。
        *   异步读取外部JSON文件，并将其内容解析为 `Ast.MacroInfoRecord` 或 `Ast.EnvInfoRecord`。
        *   应用默认配置值 (e.g., `loadDefaultMacros: true`)。
        *   进行基本的配置验证 (e.g., 文件路径是否存在，如果指定)。
        *   最终生成一个包含所有解析后配置的 `ResolvedParserConfig` 对象，供项目其他部分使用。
*   `core/DefinitionHandler.ts` 和 `core/ProjectProcessor.ts` 在初始化时接收 `ResolvedParserConfig` 对象。

## 4. 封装策略

目标是高内聚、低耦合的模块设计。

*   **`core/DefinitionHandler.ts`**: 
    *   封装所有关于宏和环境定义的生命周期管理：
        *   **加载**: 默认宏、CTAN环境、用户通过选项/文件提供的宏/环境。
        *   **存储**: 按类别存储 (默认/用户宏, 文档内定义宏, 推断使用宏; CTAN环境, 用户提供环境, 文档内定义环境)。
        *   **更新**: 提供接口给 `DefinitionExtractor` 或 `FileContentParser` 来添加新发现的定义 (文档内、推断)。
        *   **合并与提供**: 根据定义的优先级(例如：文档内 > 用户 > 默认/CTAN > 推断)合并各类定义，并提供给 `FileContentParser` 用于参数附加和环境处理的 `Ast.MacroInfoRecord` 和 `Ast.EnvInfoRecord`。
        *   提供获取所有分类定义的接口给 `ProjectProcessor` 用于最终输出。
*   **`core/FileContentParser.ts`**: 
    *   专注于单个LaTeX文件的完整解析流程，如"整体业务逻辑梳理"部分所述。编排定义提取、参数附加、环境处理的序列。它不直接操作宏/环境记录，而是通过 `DefinitionHandler` 获取和请求更新。
*   **`core/ProjectProcessor.ts`**: 
    *   负责项目级别的宏观协调：使用 `configManager` 获取配置，初始化 `DefinitionHandler`，根文件发现，文件处理队列管理，调用 `FileContentParser` 处理各文件，聚合结果，错误收集与管理。
*   **`core/DefinitionExtractor.ts`**: 
    *   负责从AST中"提取"定义和使用信息。
        *   调用 `latex-utils/commandDefinitionUtils.ts` 的函数 (如 `listNewcommands`, `listNewEnvironments`, `environmentDefiningMacroToSpec`) 来获取原始的宏/环境规范。
        *   实现推断未知宏参数签名的逻辑 (当前 `MacroHandler::extractUsedCustomMacros`)。
        *   将提取的原始规范转换为 `DefinitionHandler` 所需的格式 (如 `Ast.MacroInfoRecord`，或在内部处理 `NewEnvironmentSpec` 并转换为 `EnvInfoRecord`)。
        *   提取文件包含指令 (`\input`, `\include`) 的目标路径。
*   **`latex-utils/unifiedLatexBridge.ts`**: 
    *   作为与 `unified-latex` 库核心功能交互的抽象层。封装 `getParser()`, `attachMacroArgs()`, `processEnvironments()` 等函数的调用。隐藏 `unified-latex` 的直接依赖，便于未来升级或替换底层库。
*   **`latex-utils/astQuery.ts`**: 
    *   封装来自 `@unified-latex/unified-latex-util-visit` 的 `visit` 和来自 `@unified-latex/unified-latex-util-match` 的 `match` 功能，提供更专注于本项目需求的查询接口或预设的匹配器。
*   **`latex-utils/commandDefinitionUtils.ts`**: 
    *   包含从AST节点提取宏/环境定义的底层函数，如 `listNewcommands` 的封装(如果需要调整其行为或返回值)，以及当前 `environment-parser/list-newenvironments.ts` 和 `environment-parser/environment-commands.ts` 中的核心逻辑 (如 `environmentDefiningMacroToSpec` 及其辅助函数)。它们处理AST节点并返回结构化的定义信息(如 `NewCommandSpec`, `NewEnvironmentSpec`)。
*   **`latex-utils/projectFileUtils.ts`**: 
    *   包含与LaTeX项目文件结构和特性相关的工具函数，如 `findTexFiles` (查找目录下所有TeX文件), `isTexFile` (检查文件扩展名), `isRootFileContent` (根据内容判断是否为根文件), `resolveTexPathWithExtension` (尝试添加`.tex`等扩展名并解析路径)。
*   **`utils/fileSystem.ts` & `utils/pathUtils.ts`**: 
    *   提供纯粹的、通用的文件系统和路径操作封装，不包含特定于LaTeX的逻辑。
*   **`ast/AstSerializer.ts`**: 
    *   保持其职责，专注于将最终的 `ProjectAST` 对象(及其内嵌的 `_metadata` 和文件AST)序列化为JSON字符串。

## 5. 可调试性增强

目标是提供更好的工具和机制来诊断和理解解析过程。

*   **结构化日志系统 (`utils/logger.ts`):**
    *   引入一个轻量级的日志库 (如 `debug` npm包，或自定义一个简单的基于`console.log/warn/error`的包装器)。
    *   使用命名空间/模块化的日志记录器 (e.g., `logger.debug('core:ProjectProcessor', 'message')`, `logger.info('core:FileParser:macro-handling', 'details')`)。
    *   允许通过环境变量 (e.g., `DEBUG_LEVEL=info DEBUG_SCOPE=core:*`) 或配置选项控制日志输出的模块和级别 (e.g., DEBUG, INFO, WARN, ERROR)。
    *   在关键代码路径记录带有上下文信息的日志(文件名、当前处理的宏/环境名、AST节点摘要等)。

*   **详细的错误报告与追踪:**
    *   错误对象应包含尽可能多的上下文信息：源文件路径、错误类型(解析错误、配置错误、文件系统错误等)、相关宏/环境名称、可能涉及的AST节点信息(如位置)。
    *   `ProjectAST` 中的 `errors` 数组应包含结构化的错误对象而非简单字符串。

*   **中间状态快照/导出:**
    *   通过CLI选项/API参数增强此功能：
        *   导出特定文件在特定解析阶段的AST(例如，原始AST、每次参数附加后、环境处理后)。
        *   导出 `DefinitionHandler` 在处理每个文件之前/之后的完整状态(所有类别的宏和环境记录)。
    *   这些快照对于调试复杂的宏交互、优先级问题或环境参数解析非常有用。

*   **"Dry Run" 或 "Analysis" 模式:**
    *   实现一种模式，专注于分析和报告潜在问题，而不必生成完整的AST。例如：
        *   列出所有未定义的宏/环境及其使用位置。
        *   报告宏/环境的重定义冲突。
        *   检查宏调用时的参数数量是否匹配签名。

*   **增强的测试覆盖 (`test/`):**
    *   **单元测试:** 为每个核心模块和服务模块 (`DefinitionHandler`, `FileContentParser`, `DefinitionExtractor`, `ConfigManager`, `UnifiedLatexBridge`, `commandDefinitionUtils`等) 编写全面的单元测试。Mock依赖项，测试各种输入和边界情况。
    *   **集成测试:** 创建多个小型但具有代表性的LaTeX项目 (`samples/` 或 `test/fixtures/`)，覆盖多文件依赖、复杂宏定义、各类环境定义(标准、`tcolorbox`、`newtheorem`)、宏/环境覆盖、推断宏等场景。编写集成测试验证整个解析流程的端到端正确性及输出的 `ProjectAST` 结构的准确性。

*   **开发者文档:**
    *   为所有公开的API、核心类和复杂函数编写清晰的JSDoc/TSDoc注释。
    *   维护或更新 `README.md` 及本 `refactor.md`，清晰描述项目架构、核心模块职责、数据流、配置选项以及如何进行调试和贡献。

通过实施这些重构建议，可以期望项目在可维护性、代码清晰度和未来功能扩展方面得到显著提升。 