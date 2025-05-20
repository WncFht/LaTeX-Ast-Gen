# LaTeX AST 生成器

一个用于解析 LaTeX 项目并输出抽象语法树 (AST) 的命令行工具与库。

## 功能特点

- 解析单个 LaTeX 文件或整个 LaTeX 项目（包含多文件）
- 支持跟踪 `\\input`、`\\include` 和 `\\subfile` 等命令引用的文件
- 识别并处理自定义宏定义，提高解析准确性
- 识别并处理自定义环境定义（例如由 `\\newenvironment`, `\\newtheorem`, `\\newtcolorbox` 定义的环境），提取其名称和参数签名
- 自动识别项目根文件
- 输出结构化的 JSON 格式 AST，便于后续分析和处理
- 可作为命令行工具或 Node.js 库使用

## 安装

### 源码安装

```bash
# 克隆仓库
git clone <仓库地址>
cd AST-Gen

# 安装依赖
npm install

# 构建
npm run build

# 全局安装（可选）
npm link
```

## 命令行用法

```bash
latex-ast-parser <入口路径> [选项]
```

### 参数

- `<入口路径>`: 根 `.tex` 文件或项目目录的路径（必需）

### 选项

- `-o, --output <文件路径>`: 输出 JSON 文件的路径（默认: `ast.json`）
- `-c, --custom-macros <文件路径>`: 包含自定义宏定义的 JSON 文件路径。也会作为 `--macros-file` 的别名。
- `-e, --custom-environments <文件路径>`: 包含自定义环境定义的 JSON 文件路径。也会作为 `--environments-file` 的别名。
- `--macros-file <文件路径>`: (不推荐使用 `--custom-macros` 代替) 包含自定义宏定义的JSON文件路径。
- `--environments-file <文件路径>`: (不推荐使用 `--custom-environments` 代替) 包含自定义环境定义的JSON文件路径。
- `--pretty`: 格式化 JSON 输出（带缩进，默认: true）
- `--no-default-macros`: 不加载默认宏定义
- `--save-individual-ast`: 将每个文件的AST保存为单独的JSON文件（默认: false）
- `--individual-ast-dir <目录路径>`: 存储单独AST文件的目录（默认: `individual_asts`）
- `-h, --help`: 显示帮助信息

### 示例

```bash
# 解析单个文件并将结果写入 ast.json
latex-ast-parser ./document.tex -o ast.json --pretty

# 解析项目目录，使用自定义宏和环境定义文件
latex-ast-parser ./project_dir -c ./my_macros.json -e ./my_envs.json

# 显示帮助信息
latex-ast-parser --help
```

## 作为库使用

```typescript
import { parseLatexProject, serializeProjectAstToJson, ParserOptions, ProjectAST } from 'latex-ast-parser'; // 假设导出这些
// 或者根据实际的 index.ts:
// import { parseLatexProject, serializeProjectAstToJson } from './index';
// import type { ParserOptions, ProjectAST } from './types';


async function main() {
  try {
    const options: ParserOptions = {
      entryPath: './main.tex',
      macrosFile: './custom_macros.json', // 或者使用 customMacroRecord 直接传入对象
      environmentsFile: './custom_envs.json', // 或者使用 customEnvironmentRecord 直接传入对象
      loadDefaultMacros: true
    };

    // 解析项目
    const projectAst: ProjectAST = await parseLatexProject(options);

    // 序列化为 JSON
    const jsonOutput = serializeProjectAstToJson(projectAst, true);
    console.log(jsonOutput);

    // 或者直接处理 AST 和宏/环境信息
    console.log('Root file:', projectAst.rootFilePath);
    for (const file of projectAst.files) {
      console.log(`文件: ${file.filePath}`);
      // 处理 file.ast...
    }
    if (projectAst._detailedMacros) {
      console.log('Final effective macros:', Object.keys(projectAst._detailedMacros.finalEffectiveMacros));
    }
    if (projectAst._detailedEnvironments) {
      console.log('Final effective environments:', Object.keys(projectAst._detailedEnvironments.finalEffectiveEnvironments));
    }

  } catch (error) {
    console.error('解析失败:', error);
  }
}

main();
```

## 输出格式

输出的 JSON 包含以下结构：

```json
{
  "_metadata": {
    "rootFilePath": "/path/to/root.tex",
    "projectGlobalErrors": ["错误1", "错误2"],
    "macrosByCategory": {
      "defaultAndUser": { "...": { "signature": "..." } },
      "definedInDocument": { "...": { "signature": "..." } },
      "inferredUsed": { "...": { "signature": "..." } },
      "finalEffectiveMacros": { "命令名": { "signature": "参数签名" } }
    },
    "effectiveMacros": { "命令名": { "signature": "参数签名" } }, // 为了向后兼容或快速查看
    "environmentsByCategory": {
        "ctanEnvironments": { "...": { "signature": "..." } },
        "userProvidedEnvironments": { "...": { "signature": "..." } },
        "definedInDocumentEnvironments": { "...": { "signature": "..." } },
        "finalEffectiveEnvironments": { "环境名": { "signature": "参数签名" } }
    },
    "effectiveEnvironments": { "环境名": { "signature": "参数签名" } }, // 最终生效的环境
    "processInfo": {
        "timestamp": "...",
        "version": "..."
    }
  },
  "/path/to/file1.tex": {
    "ast": { /* 文件1的AST */ },
    "parsingError": "可选的解析错误"
  },
  "/path/to/file2.tex": {
    "ast": { /* 文件2的AST */ }
  }
  // ... 更多文件
}
```

## 项目结构

```
AST-Gen/
├── dist/            # 编译后的 JavaScript 文件
├── resources/       # 资源文件 (例如 unified.js 的本地副本，如果使用)
├── samples/         # 示例 LaTeX 项目
├── src/             # 源代码
│   ├── astSerializer.ts      # AST 序列化器
│   ├── fileParser.ts         # 单个文件解析器
│   ├── index.ts              # 库入口
│   ├── macroHandler.ts       # 宏和环境定义处理器
│   ├── main.ts               # CLI 入口和参数解析
│   ├── projectParser.ts      # LaTeX 项目整体解析器
│   ├── types.ts              # 核心类型定义
│   ├── utils.ts              # 通用工具函数
│   ├── environment-parser/   # 环境定义解析相关模块
│   │   ├── environment-commands.ts # 环境定义命令的识别与处理
│   │   ├── list-newenvironments.ts # 从AST中列出新定义的环境
│   │   └── types.ts                # 环境解析相关的特定类型
│   ├── unified-latex-custom.d.ts # unified-latex 包的自定义类型声明
│   └── unified.d.ts              # unified 本身及 @unified-latex/unified-latex-types 的类型声明
├── package.json     # 项目配置
├── tsconfig.json    # TypeScript 配置
└── README.md        # 说明文档
```

## 实现细节

- 使用 `unified-latex` 系列包进行底层 LaTeX 解析、宏参数附加和环境处理。
- 递归解析项目文件依赖（`\input`, `\include`, `\subfile`）。
- 通过启发式方法自动识别项目根文件。
- 处理自定义宏定义和环境定义，提高参数解析准确性。
- 支持从外部文件加载宏和环境定义，也支持通过代码直接提供。
- 对使用的但未显式定义的宏进行参数签名推断。
- 详细的错误报告，提供文件级和项目级错误信息。
- 输出中包含分类的宏和环境信息，便于调试和分析。

## 依赖项

- [unified](https://unifiedjs.com/): 文本处理工具链的核心。
- `@unified-latex/*`: 用于 LaTeX 解析、AST 操作、宏处理、环境处理等的系列包。
- [yargs](https://yargs.js.org/): 命令行参数解析。

## 致谢

本项目的设计和实现受到 [LaTeX-Workshop](https://github.com/James-Yu/LaTeX-Workshop) VS Code 扩展中的 `parse` 模块的启发，并使用了 `unified-latex` 生态系统提供的强大工具。

## 协议

MIT 