export type AuthTokens = {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
};
export type AuthUserProfile = {
    id: string;
    username: string;
    email: string;
    role: string;
    provider: string;
    createdAt: Date;
};
export type AuthResult = {
    user: AuthUserProfile;
    tokens: AuthTokens;
};
export declare function signUp(input: {
    username: string;
    email: string;
    password: string;
}): Promise<AuthResult>;
export declare function login(input: {
    email: string;
    password: string;
}): Promise<AuthResult>;
export declare function refreshToken(input: {
    refreshToken: string;
}): Promise<AuthResult>;
export declare function logout(input: {
    refreshToken: string;
}): Promise<void>;
export declare function getCurrentUser(userId: string): Promise<AuthUserProfile>;
export declare function forgotPassword(email: string): Promise<{
    message: string;
}>;
export declare function resetPassword(token: string, password: string): Promise<void>;
export declare function getGoogleAuthUrl(): {
    url: string;
    message: string;
};
export declare function googleSignIn(idToken: string): Promise<AuthResult>;
//# sourceMappingURL=auth.service.d.ts.map