/**
 * 为resources/unified.js提供类型声明
 */

declare module '../resources/unified.js' {
  export interface Root {
    content: Node[];
    type: 'root';
  }

  export interface Node {
    type: string;
  }

  export interface Macro extends Node {
    type: 'macro';
    content: string;
    args?: Argument[];
  }

  export interface String extends Node {
    type: 'string';
    content: string;
  }

  export interface Argument extends Node {
    type: 'argument';
    content: (Node | string)[] | string;
  }

  export interface MacroInfoRecord {
    [key: string]: {
      signature: string;
    };
  }

  export interface EnvInfoRecord {
    [key: string]: {
      signature?: string;
    };
  }

  export function getParser(options?: any): { parse: (content: string) => Root };
  export function attachMacroArgs(ast: Root, macros: MacroInfoRecord): void;
  export function toString(ast: Node): string;
}

/**
 * @unified-latex/unified-latex-types 类型声明
 * 根据LaTeX-Workshop中的类型使用来声明AST类型
 */

declare module '@unified-latex/unified-latex-types' {
  /**
   * AST节点的基本接口
   */
  export interface Ast {
    type: string;
    position?: Position;
  }

  /**
   * 位置信息
   */
  export interface Position {
    start: Point;
    end: Point;
  }

  /**
   * 位置点
   */
  export interface Point {
    line: number;
    column: number;
    offset: number;
  }

  /**
   * 根节点
   */
  export interface Root extends Ast {
    type: 'root';
    content: Array<Ast>;
  }

  /**
   * 宏节点
   */
  export interface Macro extends Ast {
    type: 'macro';
    content: string;
    args?: Array<Argument>;
  }

  /**
   * 参数节点
   */
  export interface Argument extends Ast {
    type: 'argument';
    openMark?: string;
    closeMark?: string;
    content: string | Array<Ast>;
  }

  /**
   * 字符串节点
   */
  export interface String extends Ast {
    type: 'string';
    content: string;
  }

  /**
   * 宏信息记录类型
   * 用于存储宏和其参数规范
   */
  export interface MacroInfoRecord {
    [macroName: string]: { 
      signature: string;
      renderInfo?: any;
    };
  }

  /**
   * 环境信息记录类型
   * 用于存储环境和其参数规范
   */
  export interface EnvInfoRecord {
    [envName: string]: { 
      signature: string;
      renderInfo?: any;
    };
  }
  
  export interface EnvInfo {
    signature?: string;
    renderInfo?: any;
    processContent?: (ast: Ast[]) => Ast[];
  }
} 