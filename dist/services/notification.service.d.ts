export declare function listNotifications(userId: string, page: number, perPage: number): Promise<{
    data: {
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        readAt: Date | null;
        titleAr: string;
        bodyAr: string;
    }[];
    meta: import("../utils/pagination").PaginationMeta;
}>;
export declare function getUnreadCount(userId: string): Promise<{
    unreadCount: number;
}>;
export declare function markAsRead(userId: string, id: string): Promise<{
    type: import("@prisma/client").$Enums.NotificationType;
    id: string;
    createdAt: Date;
    userId: string;
    readAt: Date | null;
    titleAr: string;
    bodyAr: string;
} | null>;
export declare function markAllAsRead(userId: string): Promise<{
    markedCount: number;
}>;
export declare function deleteNotification(userId: string, id: string): Promise<null>;
export declare function getNotification(userId: string, id: string): Promise<{
    type: import("@prisma/client").$Enums.NotificationType;
    id: string;
    createdAt: Date;
    userId: string;
    readAt: Date | null;
    titleAr: string;
    bodyAr: string;
}>;
//# sourceMappingURL=notification.service.d.ts.map