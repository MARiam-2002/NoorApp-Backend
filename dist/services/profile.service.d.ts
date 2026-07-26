export type UserProfile = {
    id: string;
    username: string;
    email: string;
    points: number;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
};
export declare function getProfile(userId: string): Promise<UserProfile>;
export declare function updateProfile(userId: string, data: {
    username: string;
    email?: string;
}): Promise<UserProfile>;
export declare function changePassword(userId: string, data: {
    currentPassword: string;
    newPassword: string;
}): Promise<boolean>;
export declare function updateLocation(userId: string, data: {
    latitude: number;
    longitude: number;
    timezone?: string;
}): Promise<UserProfile>;
//# sourceMappingURL=profile.service.d.ts.map