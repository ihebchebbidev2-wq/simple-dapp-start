import React, { useState, useRef } from "react";
import { Plus, Search, Edit, Trash2, Check, X, Mail, Shield, Clock, Loader2, AlertCircle, Upload } from "lucide-react";
import { useUsers, useApiMutation } from "@/hooks/useApi";
import { api, unwrapApiList, unwrapPagination, User } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";

type UserRole = "admin" | "manager" | "user" | "super_admin";
type UserStatus = "active" | "inactive" | "suspended";

const roleColors: Record<UserRole, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  user: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  super_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const statusStyles: Record<string, string> = {
  active: "badge-success",
  inactive: "badge-warning",
  suspended: "badge-destructive",
};

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    full_name: "", 
    email: "", 
    password: "", 
    role: "admin" as UserRole 
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  // Fetch users from API
  const { data: usersResponse, isLoading, isError, error } = useUsers(page, 50);

  // Mutations
  const createUserMutation = useApiMutation(
    (data: any) => api.createUser(data),
    {
      onSuccess: () => {
        showSuccessToast("Users", "User created successfully");
        queryClient.invalidateQueries({ queryKey: ['users'] });
        setShowForm(false);
        setFormData({ full_name: "", email: "", password: "", role: "admin" });
      },
      onError: (e: unknown) => {
        showErrorToast("Users", e instanceof Error ? e.message : "Failed to create user");
      },
    }
  );

  const updateUserMutation = useApiMutation(
    ({ id, data }: { id: string; data: any }) => api.updateUser(id, data),
    {
      onSuccess: () => {
        showSuccessToast("Users", "User updated successfully");
        queryClient.invalidateQueries({ queryKey: ['users'] });
        setShowForm(false);
        setEditingId(null);
        setFormData({ full_name: "", email: "", password: "", role: "admin" });
      },
      onError: (e: unknown) => {
        showErrorToast("Users", e instanceof Error ? e.message : "Failed to update user");
      },
    }
  );

  const deleteUserMutation = useApiMutation(
    (id: string) => api.deleteUser(id),
    {
      onSuccess: () => {
        showSuccessToast("Users", "User deleted");
        queryClient.invalidateQueries({ queryKey: ['users'] });
        setSelectedUser(null);
      },
      onError: (e: unknown) => {
        showErrorToast("Users", e instanceof Error ? e.message : "Delete failed");
      },
    }
  );

  const importUsersMutation = useApiMutation((file: File) => api.importUsersFile(file), {
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const d = res.data as { imported?: number; errors?: string[] } | undefined;
      const n = d?.imported ?? 0;
      const errs = d?.errors?.length ?? 0;
      showSuccessToast("Users", res.message || `Imported ${n} user(s).`);
      if (errs > 0) {
        showErrorToast("Users", `${errs} row(s) skipped (duplicate email or validation).`);
        if (d?.errors?.length) console.warn('User import row errors:', d.errors);
      }
    },
    onError: (e: unknown) => {
      showErrorToast("Users", e instanceof Error ? e.message : 'Import failed');
    },
  });

  const users = unwrapApiList<User>(usersResponse, []);
  const pagination = unwrapPagination(usersResponse);

  // Filter users locally (in case server-side filtering isn't available)
  const filtered = users.filter((u: User) => {
    // Hide general 'user' role from Admin Users management (they are customers managed in CRM)
    if (u.role === 'user') return false;

    const matchesSearch = !search || 
      u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = () => {
    if (!formData.full_name || !formData.email) return;

    if (editingId) {
      updateUserMutation.mutate({
        id: editingId,
        data: {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
        }
      });
    } else {
      createUserMutation.mutate({
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
    }
  };

  const handleEditUser = (user: User) => {
    setFormData({ 
      full_name: user.full_name || "", 
      email: user.email, 
      password: "", 
      role: user.role 
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleToggleStatus = (user: User) => {
    const newStatus: UserStatus = user.status === "active" ? "inactive" : "active";
    updateUserMutation.mutate({
      id: user.id,
      data: { status: newStatus }
    });
  };

  const handleImportUsersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    importUsersMutation.mutate(file);
  };

  // Loading state
  if (isLoading) {
    return <AdminPageLoading message="Loading users" />;
  }

  // Error state
  if (isError) {
    return (
      <AdminPageError
        message={error instanceof Error ? error.message : "An error occurred while fetching users."}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <AdminPageHeader
            title="Admin Users"
            subtitle={`Manage administrators, managers & staff who operate this admin panel${pagination ? ` — ${pagination.total} total` : ""}.`}
          />
          <p className="text-xs text-muted-foreground mt-2 max-w-xl">
            Bulk import: CSV or JSON (max 5MB). JSON file: array of rows, or POST body shape with a{" "}
            <code className="text-[10px] bg-secondary px-1 rounded">users</code> array (email, full_name, optional role, phone).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            className="hidden"
            onChange={handleImportUsersChange}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importUsersMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {importUsersMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>Import file</span>
          </button>
          <button
            onClick={() => { 
              setFormData({ full_name: "", email: "", password: "", role: "admin" }); 
              setEditingId(null); 
              setShowForm(!showForm); 
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Admin User</span>
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="dashboard-card border-accent/50">
          <h3 className="font-display font-bold mb-4">{editingId ? "Edit User" : "Create New User"}</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {!editingId && (
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            )}
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(createUserMutation.isPending || updateUserMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingId ? "Update User" : "Create User"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={roleFilter || ""}
          onChange={(e) => setRoleFilter((e.target.value || "") as UserRole | "")}
          className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent text-sm"
        >
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
        </select>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length > 0 ? (
          filtered.map((user: User) => (
            <div
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className="dashboard-card cursor-pointer hover:border-accent transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-sm truncate">{user.full_name || "No name"}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${roleColors[user.role]} font-medium flex items-center gap-1`}>
                  <Shield className="h-3 w-3" />
                  {user.role}
                </span>
              </div>

              <div className="space-y-2 py-3 border-y border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span className={statusStyles[user.status]}>{user.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(user.created_at).toLocaleDateString()}</span>
                </div>
                {user.last_login && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last Login
                    </span>
                    <span>{new Date(user.last_login).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditUser(user);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-border rounded hover:bg-secondary transition-colors"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(user);
                  }}
                  disabled={updateUserMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-border rounded hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {user.status === "active" ? (
                    <>
                      <X className="h-3 w-3" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      Enable
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteUser(user.id);
                  }}
                  disabled={deleteUserMutation.isPending}
                  className="px-2 py-1.5 text-xs border border-destructive text-destructive rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No users found.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Selected User Detail */}
      {selectedUser && (
        <div className="fixed inset-0 bg-foreground/20 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div
            className="bg-card rounded-lg shadow-lg max-w-md w-full p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-display font-bold mb-4">{selectedUser.full_name || "User Details"}</h2>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{selectedUser.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Role</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${roleColors[selectedUser.role]}`}>{selectedUser.role}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={statusStyles[selectedUser.status]}>{selectedUser.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(selectedUser.created_at).toLocaleDateString()}</span>
              </div>
              {selectedUser.last_login && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Login</span>
                  <span>{new Date(selectedUser.last_login).toLocaleDateString()}</span>
                </div>
              )}
              {selectedUser.phone && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{selectedUser.phone}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handleEditUser(selectedUser);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
