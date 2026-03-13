interface InitOptions {
    preset?: string;
    custom?: string;
    name?: string;
    symbol?: string;
    decimals?: string;
    uri?: string;
    keypair?: string;
    url?: string;
}
export declare function initCommand(opts: InitOptions): Promise<void>;
export {};
