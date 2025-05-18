/**
 * 类型定义模块
 * 定义LaTeX AST解析器使用的所有TypeScript类型和接口
 */
/**
 * 项目文件AST
 * 表示单个LaTeX文件的AST及相关元数据
 */
export interface ProjectFileAst {
    /** 指向LaTeX源文件的绝对或规范化路径 */
    filePath: string;
    /** 文件的AST，由unified-latex生成 */
    ast: any;
    /** 可选的错误信息，如果解析此特定文件失败 */
    error?: string;
}
/**
 * 项目AST
 * 表示整个LaTeX项目的AST及相关元数据
 */
export interface ProjectAST {
    /** 指向项目中已识别的根.tex文件的绝对路径。如果无法确定根文件，则为null */
    rootFilePath: string | null;
    /** 项目中每个已解析文件的AST和元数据 */
    files: ProjectFileAst[];
    /** 用于解析项目的最终聚合宏定义 */
    macros: Record<string, {
        signature: string;
    }>;
    /** 项目解析期间遇到的全局错误消息 */
    errors?: string[];
}
/**
 * 解析器选项
 * 配置解析器行为的选项
 */
export interface ParserOptions {
    /** 指向根.tex文件或项目目录的路径 */
    entryPath: string;
    /** 指向包含自定义宏定义的JSON文件的路径 */
    macrosFile?: string;
    /** 是否加载一组预定义的常用LaTeX宏 */
    loadDefaultMacros?: boolean;
    /** 直接传入的MacroInfoRecord对象，优先于macrosFile */
    customMacroRecord?: Record<string, {
        signature: string;
    }>;
}
/**
 * CLI特定选项
 * 仅在命令行接口中使用的选项
 */
export interface CliSpecificOptions {
    /** 输出JSON文件路径 */
    output?: string;
    /** 是否以易读格式（带缩进）输出JSON */
    pretty?: boolean;
    /** 显示帮助信息的标志 */
    help?: boolean;
}
/**
 * 内部文件解析结果
 * FileParser返回的结果，包含AST、新宏和包含的文件
 */
export interface InternalFileParseResult {
    /** 文件的已解析AST，如果发生致命解析错误则为null */
    ast: any | null;
    /** 此文件中定义的宏 */
    newMacros: Record<string, {
        signature: string;
    }>;
    /** 从此文件包含/输入的文件列表 */
    includedFiles: {
        /** 规范化的文件路径 */
        path: string;
        /** 使用的命令（例如input、include） */
        command: string;
        /** 命令中的原始路径字符串 */
        rawPath: string;
    }[];
    /** 如果解析此文件遇到问题，则为错误信息 */
    error?: string;
}
