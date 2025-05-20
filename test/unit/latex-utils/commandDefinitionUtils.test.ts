/**
 * commandDefinitionUtils.ts 单元测试
 */
import type { Ast, NewCommandSpec, NewEnvironmentSpec, EnvironmentParameter } from '../../../src/types/index';
import {
    extractNewCommands,
    listNewEnvironments,
    macroToEnvironmentSpec,
    STANDARD_ENVIRONMENT_DEFINERS,
    TCOLORBOX_ENVIRONMENT_DEFINERS,
    AMSTHM_THEOREM_DEFINERS,
    ALL_ENVIRONMENT_DEFINERS
} from '../../../src/latex-utils/commandDefinitionUtils';
// 导入 printRaw，以便在 beforeEach 中可以清除它的 mock
import { printRaw } from '../../../src/latex-utils/unifiedLatexBridge';

// 辅助函数：创建简化的 AST 节点用于测试
const createMockMacro = (name: string, args: Ast.Argument[] = [], position?: Ast.Position): Ast.Macro => ({
    type: 'macro',
    content: name,
    args,
    position: position || { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1 + name.length, offset: name.length } }
});

const createMockArgument = (contentNodes: Ast.Ast[], openMark: string = '{', closeMark: string = '}'): Ast.Argument => ({
    type: 'argument',
    content: contentNodes,
    openMark,
    closeMark,
    position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 2 + contentNodes.length, offset: 1 + contentNodes.length } } 
});

const createMockString = (content: string): Ast.String => ({
    type: 'string',
    content,
    position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1 + content.length, offset: content.length } }
});

const createMockRoot = (content: Ast.Ast[]): Ast.Root => ({
    type: 'root',
    content,
    position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } } 
});

// Mock @unified-latex/unified-latex-util-macros's listNewcommands
let mockUnifiedListNewcommandsResponse: UtilNewCommandSpec[] = [];
jest.mock('@unified-latex/unified-latex-util-macros', () => ({
    ...jest.requireActual('@unified-latex/unified-latex-util-macros'), 
    listNewcommands: jest.fn(() => mockUnifiedListNewcommandsResponse),
}));

// Mock printRaw from unifiedLatexBridge
jest.mock('../../../src/latex-utils/unifiedLatexBridge', () => {
    const actualBridge = jest.requireActual('../../../src/latex-utils/unifiedLatexBridge');
    const mockPrintRawImplementation = jest.fn((nodes: Ast.Ast | Ast.Ast[]): string => {
        if (Array.isArray(nodes)){
            return nodes.map(n => ((n as Ast.String)?.content || '')).join('');
        }
        return (nodes as Ast.String)?.content || '';
    });
    return {
        ...actualBridge,
        printRaw: mockPrintRawImplementation,
    };
});

// Mock astQuery.visit for listNewEnvironments
jest.mock('../../../src/latex-utils/astQuery', () => {
    const originalModule = jest.requireActual('../../../src/latex-utils/astQuery');
    return {
        ...originalModule,
        visit: jest.fn((tree: Ast.Ast, visitorOrTestOrOptions: any, visitorFnIfTest?: any) => {
            let testFn: (node: Ast.Ast, info: any) => boolean = () => true;
            let visitorFn: (node: Ast.Ast, info: any) => void;

            if (typeof visitorOrTestOrOptions === 'function' && visitorFnIfTest === undefined) {
                 visitorFn = visitorOrTestOrOptions;
            } else if (typeof visitorOrTestOrOptions === 'object' && typeof visitorFnIfTest === 'function'){
                visitorFn = visitorFnIfTest;
                if(visitorOrTestOrOptions && typeof visitorOrTestOrOptions.test === 'function') {
                    testFn = visitorOrTestOrOptions.test;
                }
            } else if (typeof visitorOrTestOrOptions === 'function' && typeof visitorFnIfTest === 'function'){
                testFn = visitorOrTestOrOptions;
                visitorFn = visitorFnIfTest;
            } else {
                return; 
            }
            
            function traverse(nodes: Ast.Ast[]) {
                if (!Array.isArray(nodes)) return;
                for (const node of nodes) {
                    // 在 mock 的 visit 中，确保 info 参数至少是一个对象，即使是空的
                    const mockInfo = { parents: [], index: 0, key: undefined, containingArray: undefined, context: {} }; 
                    if (testFn(node, mockInfo)) { 
                        visitorFn(node, mockInfo);
                    }
                    if (node && (node as any).content && Array.isArray((node as any).content)) {
                        traverse((node as any).content);
                    }
                    if (node && (node as any).args && Array.isArray((node as any).args)) {
                        (node as any).args.forEach((arg: Ast.Argument) => {
                            if (Array.isArray(arg.content)) traverse(arg.content);
                        });
                    }
                }
            }
            if (tree && Array.isArray(tree.content)) {
                traverse(tree.content);
            }
        }),
    };
});

interface UtilNewCommandSpec {
    name: string;
    signature: string;
    body: Ast.Ast[];
    definition: Ast.Macro;
}

describe('commandDefinitionUtils - 命令定义提取工具测试', () => {
    beforeEach(() => {
        mockUnifiedListNewcommandsResponse = [];
        (require('@unified-latex/unified-latex-util-macros').listNewcommands as jest.Mock).mockClear();
        // 清除 printRaw mock (导入的 printRaw 已经是 mock 版本)
        (printRaw as jest.Mock).mockClear(); 
        (require('../../../src/latex-utils/astQuery').visit as jest.Mock).mockClear();
    });

    describe('extractNewCommands - 提取宏定义', () => {
        it('应能从 AST 中正确提取 \\newcommand 定义的宏', () => {
            mockUnifiedListNewcommandsResponse = [
                { name: '\\myMacroOne', signature: 'm', body: [createMockString('body1')], definition: createMockMacro('myMacroOne') },
                { name: 'myMacroTwo', signature: 'o m', body: [createMockString('body2')], definition: createMockMacro('myMacroTwo') },
            ];
            const mockAst = createMockRoot([]);
            const result = extractNewCommands(mockAst);
            expect(result.length).toBe(2);
            expect(result[0]).toEqual(expect.objectContaining({ name: 'myMacroOne', signature: 'm' }));
            expect(result[1]).toEqual(expect.objectContaining({ name: 'myMacroTwo', signature: 'o m' }));
        });
        it('当没有宏定义时，应返回空数组', () => {
            mockUnifiedListNewcommandsResponse = [];
            const mockAst = createMockRoot([]);
            const result = extractNewCommands(mockAst);
            expect(result).toEqual([]);
        });
    });

    describe('listNewEnvironments 和 macroToEnvironmentSpec - 提取环境定义', () => {
        it('应能正确解析简单的 \\newenvironment 定义', () => {
            const args: Ast.Argument[] = [
                createMockArgument([]), createMockArgument([]), 
                createMockArgument([createMockString('testenv')]),        
                createMockArgument([], '[', ']'), 
                createMockArgument([], '[', ']'), 
                createMockArgument([createMockString('BEGIN')]),          
                createMockArgument([createMockString('END')])            
            ];
            const macroNode = createMockMacro('newenvironment', args);
            const mockAst = createMockRoot([macroNode]);
            
            const result = listNewEnvironments(mockAst);
            expect(result.length).toBe(1);
            const spec = result[0];
            expect(spec.name).toBe('testenv');
            expect(spec.signature).toBe(''); 
            expect(spec.definingCommand).toBe('newenvironment');
            expect(printRaw(spec.beginCode || [])).toBe('BEGIN');
            expect(printRaw(spec.endCode || [])).toBe('END');
        });

        it('应能正确解析带参数的 \\newenvironment 定义', () => {
            const args: Ast.Argument[] = [
                createMockArgument([]), createMockArgument([]),
                createMockArgument([createMockString('paramenv')]),      
                createMockArgument([createMockString('1')], '[', ']'),      
                createMockArgument([], '[', ']'),                           
                createMockArgument([createMockString('Start-#1')]),    
                createMockArgument([createMockString('Finish')])       
            ];
            const macroNode = createMockMacro('newenvironment', args);
            const mockAst = createMockRoot([macroNode]);

            const result = listNewEnvironments(mockAst);
            expect(result.length).toBe(1);
            const spec = result[0];
            expect(spec.name).toBe('paramenv');
            expect(spec.signature).toBe('m');
            expect(spec.parameters?.length).toBe(1);
            expect(spec.parameters?.[0].type).toBe('mandatory');
        });

        it('应能正确解析带可选参数的 \\newenvironment 定义', () => {
            const args: Ast.Argument[] = [
                createMockArgument([]), createMockArgument([]),
                createMockArgument([createMockString('optenv')]),         
                createMockArgument([createMockString('2')], '[', ']'),       
                createMockArgument([createMockString('Default')], '[', ']'),  
                createMockArgument([createMockString('Opt: #1, Mand: #2')]), 
                createMockArgument([createMockString('EndOpt')])         
            ];
            const macroNode = createMockMacro('newenvironment', args);
            const mockAst = createMockRoot([macroNode]);
            
            const result = listNewEnvironments(mockAst);
            expect(result.length).toBe(1);
            const spec = result[0];
            expect(spec.name).toBe('optenv');
            expect(spec.signature).toBe('o m');
            expect(spec.parameters?.length).toBe(2);
            expect(spec.parameters?.[0].type).toBe('optional');
            expect(printRaw(spec.parameters?.[0].defaultValue || [])).toBe('Default');
            expect(spec.parameters?.[1].type).toBe('mandatory');
        });

        it('应能正确解析 \\newtheorem', () => {
            const args = [
                createMockArgument([createMockString('theorem')]),
                createMockArgument([createMockString('Theorem')])
            ];
            const macroNode = createMockMacro('newtheorem', args);
            const mockAst = createMockRoot([macroNode]);
            const result = listNewEnvironments(mockAst);
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('theorem');
            expect(result[0].signature).toBe('o'); 
            expect(result[0].theoremTitle).toBe('Theorem');
        });

        it('当没有环境定义时，应返回空数组', () => {
            const mockAst = createMockRoot([createMockString('no envs here')]);
            const result = listNewEnvironments(mockAst);
            expect(result).toEqual([]);
        });
    });
}); 