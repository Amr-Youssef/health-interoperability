export type TransformFn = (value: any, params?: Record<string, any>) => any;
export declare class TransformEngine {
    private transforms;
    constructor();
    private registerDefaultTransforms;
    transform(ruleName: string, value: any, params?: Record<string, any>): any;
    registerTransform(name: string, fn: TransformFn): void;
}
