export declare function calculateQibla(latitude: number, longitude: number): {
    bearingDegrees: number;
    userLatitude: number;
    userLongitude: number;
    kaabaLatitude: number;
    kaabaLongitude: number;
    angleDegrees: number;
    directionAr: string;
    directionEn: string;
    bearingRadians: number;
};
export declare function getMyQibla(userId: string): Promise<{
    bearingDegrees: number;
    userLatitude: number;
    userLongitude: number;
    kaabaLatitude: number;
    kaabaLongitude: number;
    angleDegrees: number;
    directionAr: string;
    directionEn: string;
    bearingRadians: number;
}>;
//# sourceMappingURL=qibla.service.d.ts.map