export declare function mintCommand(recipient: string, amountStr: string, opts: any): Promise<void>;
export declare function burnCommand(amountStr: string, opts: any): Promise<void>;
export declare function freezeCommand(address: string, opts: any): Promise<void>;
export declare function thawCommand(address: string, opts: any): Promise<void>;
export declare function pauseCommand(opts: any): Promise<void>;
export declare function unpauseCommand(opts: any): Promise<void>;
