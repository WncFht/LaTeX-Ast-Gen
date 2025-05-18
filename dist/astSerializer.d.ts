/**
 * AST序列化器模块
 * 负责将解析得到的项目级AST数据结构转换为JSON字符串
 */
import { ProjectAST } from './types';
/**
 * 将项目AST序列化为JSON字符串
 *
 * @param projectAST 项目AST对象
 * @param prettyPrint 是否格式化输出的JSON字符串
 * @returns 表示项目AST的JSON字符串
 */
export declare function serializeProjectAstToJson(projectAST: ProjectAST, prettyPrint?: boolean): string;
