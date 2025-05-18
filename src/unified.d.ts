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