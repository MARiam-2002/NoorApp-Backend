export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
export interface JwtPayload {
    userId: string;
    email: string;
}
export declare function generateAccessToken(payload: JwtPayload): string;
export declare function generateRefreshToken(payload: JwtPayload): string;
export declare function verifyAccessToken(token: string): JwtPayload;
export declare function verifyRefreshToken(token: string): JwtPayload;
//# sourceMappingURL=auth.d.ts.map