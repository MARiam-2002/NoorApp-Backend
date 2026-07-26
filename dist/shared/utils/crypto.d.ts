export declare function generateRandomToken(bytes?: number): string;
export declare function hashValue(value: string, salt?: string): {
    hash: string;
    salt: string;
};
export declare function verifyHash(value: string, hash: string, salt: string): boolean;
export declare function sha256(value: string): string;
//# sourceMappingURL=crypto.d.ts.map