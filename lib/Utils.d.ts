export declare function registerGracefulShutdown(callback: any): void;
export declare class Deferred {
    promise: Promise<any>;
    reject: Function;
    resolve: Function;
    constructor();
    then(func: (value: any) => any): Promise<any>;
    catch(func: (value: any) => any): Promise<any>;
}
export declare function spliceOne(arr: any[], index: number): boolean;
export declare function parseQueryString(query: string): any;
export declare function merge(a: any, ...objs: any[]): any;
export declare function logError(err: Error): void;