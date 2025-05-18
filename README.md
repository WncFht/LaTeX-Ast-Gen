# LaTeX AST 生成器

一个用于解析 LaTeX 项目并输出抽象语法树 (AST) 的命令行工具与库。

## 功能特点

- 解析单个 LaTeX 文件或整个 LaTeX 项目（包含多文件）
- 支持跟踪 `\input`、`\include` 和 `\subfile` 等命令引用的文件
- 识别并处理自定义宏定义，提高解析准确性
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

- `-o, --output <文件路径>`: 输出 JSON 文件的路径（默认: 标准输出）
- `-m, --macros <文件路径>`: 包含自定义宏定义的 JSON 文件路径
- `--pretty`: 格式化 JSON 输出（带缩进）
- `--no-default-macros`: 不加载默认宏定义
- `-h, --help`: 显示帮助信息

### 示例

```bash
# 解析单个文件并将结果写入 ast.json
latex-ast-parser ./document.tex -o ast.json --pretty

# 解析项目目录，使用自定义宏定义文件
latex-ast-parser ./project_dir -m ./custom_macros.json

# 显示帮助信息
latex-ast-parser --help
```

## 作为库使用

```typescript
import { parseLatexProject, serializeProjectAstToJson } from 'latex-ast-parser';

async function main() {
  try {
    // 解析项目
    const projectAst = await parseLatexProject({
      entryPath: './main.tex',
      macrosFile: './custom_macros.json',
      loadDefaultMacros: true
    });

    // 序列化为 JSON
    const jsonOutput = serializeProjectAstToJson(projectAst, true);
    console.log(jsonOutput);

    // 或者直接处理 AST
    for (const file of projectAst.files) {
      console.log(`文件: ${file.filePath}`);
      // 处理 file.ast...
    }
  } catch (error) {
    console.error('解析失败:', error);
  }
}
```

## 输出格式

输出的 JSON 包含以下结构：

```json
{
  "_metadata": {
    "rootFilePath": "/path/to/root.tex",
    "projectGlobalErrors": ["错误1", "错误2"],
    "macros": { "命令名": { "signature": "参数签名" } }
  },
  "/path/to/file1.tex": {
    "ast": { /* 文件1的AST */ },
    "parsingError": "可选的解析错误"
  },
  "/path/to/file2.tex": {
    "ast": { /* 文件2的AST */ }
  }
}
```

## 项目结构

```
AST-Gen/
├── dist/            # 编译后的 JavaScript 文件
├── resources/       # 资源文件
├── samples/         # 示例 LaTeX 项目
├── src/             # 源代码
│   ├── astSerializer.ts  # AST 序列化器
│   ├── fileParser.ts     # 文件解析器
│   ├── index.ts          # 库入口
│   ├── macroHandler.ts   # 宏处理器
│   ├── main.ts           # CLI 入口
│   ├── projectParser.ts  # 项目解析器
│   ├── types.ts          # 类型定义
│   └── utils.ts          # 工具函数
├── package.json     # 项目配置
├── tsconfig.json    # TypeScript 配置
└── README.md        # 说明文档
```

## 实现细节

- 使用与 VS Code 扩展 LaTeX-Workshop 相同的解析引擎
- 支持递归解析项目文件依赖
- 通过启发式方法自动识别项目根文件
- 处理自定义宏定义，提高参数解析准确性
- 详细的错误报告，提供文件级和项目级错误信息

## 依赖项

- [unified](https://unifiedjs.com/): 统一文本处理工具链
- [latex-utensils](https://www.npmjs.com/package/latex-utensils): LaTeX 解析工具
- [yargs](https://yargs.js.org/): 命令行参数解析

## 致谢

本项目的设计和实现受到 [LaTeX-Workshop](https://github.com/James-Yu/LaTeX-Workshop) VS Code 扩展中的 `parse` 模块的启发。

## 协议

MIT 