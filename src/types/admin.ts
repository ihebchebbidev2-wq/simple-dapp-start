// User and Access Management Types

export type UserRole = "admin" | "manager" | "user";
export type AccessLevel = "none" | "view" | "edit" | "delete";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
  created: string;
  lastLogin?: string;
  permissions?: PageAccess[];
}

export interface PageAccess {
  pageId: string;
  pageName: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  assigned: string;
}

export interface AdminPage {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  isPublic: boolean;
}

export interface AccessRecord {
  userId: string;
  pageId: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  assigned: string;
  assignedBy?: string;
}

export interface BulkAccessRequest {
  userIds: string[];
  pageIds: string[];
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}
