import React, { useState, useEffect } from 'react';
import { useCMSPageContent, useUpdateCMSContent, useCreateCMSContent, useDeleteCMSContent } from '@/hooks/useCMS';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import { Plus, Edit2, Trash2, Save, X, RotateCcw } from 'lucide-react';
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

const AVAILABLE_PAGES = [
  'home',
  'products',
  'about',
  'contact',
  'faq',
  'terms',
  'privacy',
  'shipping',
  'returns',
];

export default function CMSPage() {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const [selectedPage, setSelectedPage] = useState('home');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', content: '', image_url: '' });

  const { data: pageContent = [], isLoading } = useCMSPageContent(selectedPage);
  const updateMutation = useUpdateCMSContent();
  const createMutation = useCreateCMSContent();
  const deleteMutation = useDeleteCMSContent();

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title || '',
      description: item.description || '',
      content: item.content || '',
      image_url: item.image_url || '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      await updateMutation.mutateAsync({
        id: editingId,
        data: {
          ...editForm,
          page_name: selectedPage,
          section_key: editForm.title.toLowerCase().replace(/\s+/g, '_'),
        },
      });
      showSuccessToast('Content updated successfully');
      setEditingId(null);
    } catch (error) {
      showErrorToast('Failed to update content');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_content"), variant: "danger" });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(id);
      showSuccessToast('Content deleted successfully');
    } catch (error) {
      showErrorToast('Failed to delete content');
    }
  };

  const handleResetToDefaults = async () => {
    const ok = await confirmAction({ title: t("confirm.title"), message: t("confirm.reset_defaults"), variant: "warning" });
    if (!ok) return;
    try {
      // Delete all content for this page
      const itemsToDelete = pageContent || [];
      for (const item of itemsToDelete) {
        await deleteMutation.mutateAsync(item.id);
      }
      showSuccessToast('Page reset to defaults successfully');
    } catch (error) {
      showErrorToast('Failed to reset page to defaults');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CMS Management</h1>
        <p className="text-gray-600">Edit page content, headers, footers, and images</p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {AVAILABLE_PAGES.map((page) => (
            <button
              key={page}
              onClick={() => setSelectedPage(page)}
              className={`px-4 py-2 rounded-sm font-medium transition-colors ${
                selectedPage === page
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {page.charAt(0).toUpperCase() + page.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={handleResetToDefaults}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-sm font-medium hover:bg-orange-600"
        >
          <RotateCcw className="h-4 w-4" />
          Reset &quot;{selectedPage}&quot; to Defaults
        </button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-gray-600">Loading content...</p>
        ) : pageContent.length === 0 ? (
          <p className="text-gray-600">No content for this page yet</p>
        ) : (
          pageContent.map((item: any) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-3">
              {editingId === item.id ? (
                <>
                  <input
                    type="text"
                    placeholder="Title"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-sm focus:outline-none focus:border-primary"
                  />
                  <textarea
                    placeholder="Content"
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-sm focus:outline-none focus:border-primary min-h-24"
                  />
                  <input
                    type="text"
                    placeholder="Image URL"
                    value={editForm.image_url}
                    onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-sm focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-2 bg-gray-300 text-gray-800 px-4 py-2 rounded-sm font-medium hover:bg-gray-400"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    {item.description && <p className="text-gray-600">{item.description}</p>}
                    {item.image_url && (
                      <img src={item.image_url} alt={item.title} className="h-32 object-cover rounded mt-2" />
                    )}
                    {item.content && <p className="text-gray-700 mt-2 whitespace-pre-wrap">{item.content}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-sm font-medium hover:bg-blue-600"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-sm font-medium hover:bg-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
