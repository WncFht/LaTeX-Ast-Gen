/**
 * 宏处理器模块
 * 负责在整个项目解析生命周期中管理LaTeX宏定义
 */
import { ParserOptions } from './types';
/**
 * 宏处理器类
 * 管理项目中的LaTeX宏定义
 */
export declare class MacroHandler {
    /**
     * 存储所有已知宏定义的记录
     */
    private macroRecord;
    /**
     * 创建一个新的MacroHandler实例
     * @param options 解析器选项
     */
    constructor(options?: ParserOptions);
    /**
     * 添加新的宏定义到现有记录
     * @param newMacros 新的宏定义记录
     */
    addMacros(newMacros: Record<string, {
        signature: string;
    }>): void;
    /**
     * 获取当前所有宏定义的副本
     * @returns 宏定义记录的深拷贝
     */
    getCurrentMacros(): Record<string, {
        signature: string;
    }>;
    /**
     * 加载预定义的常用LaTeX宏
     * @returns 预定义宏的记录
     * @private
     */
    private loadDefaultMacros;
    /**
     * 从文件加载外部宏定义
     * @param filePath 宏定义文件路径
     * @returns 宏定义记录，如果加载失败则为null
     * @private
     */
    private loadExternalMacrosFromFile;
}
