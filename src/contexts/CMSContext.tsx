import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { api } from '@/lib/api';

export interface CMSContent {
  id: string;
  page_name: string;
  section_key: string;
  title?: string;
  description?: string;
  image_url?: string;
  content?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CMSContextType {
  content: Map<string, CMSContent>;
  loading: boolean;
  error: string | null;
  fetchPageContent: (pageName: string) => Promise<void>;
  getSectionContent: (pageName: string, sectionKey: string) => CMSContent | undefined;
  updateContent: (content: CMSContent) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  createContent: (content: Omit<CMSContent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

const CMSContext = createContext<CMSContextType | undefined>(undefined);

export function CMSProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Map<string, CMSContent>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPageContent = useCallback(async (pageName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getCMSPageContent(pageName);
      if (response.success && response.data && Array.isArray(response.data)) {
        const contentMap = new Map<string, CMSContent>();
        (response.data as CMSContent[]).forEach((item: CMSContent) => {
          contentMap.set(`${item.page_name}:${item.section_key}`, item);
        });
        setContent(contentMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch CMS content');
    } finally {
      setLoading(false);
    }
  }, []);

  const getSectionContent = useCallback((pageName: string, sectionKey: string) => {
    return content.get(`${pageName}:${sectionKey}`);
  }, [content]);

  const updateContent = useCallback(async (updatedContent: CMSContent) => {
    setLoading(true);
    setError(null);
    try {
      await api.updateCMSContent(updatedContent.id, updatedContent);
      const newContent = new Map(content);
      newContent.set(`${updatedContent.page_name}:${updatedContent.section_key}`, updatedContent);
      setContent(newContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update CMS content');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [content]);

  const deleteContent = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteCMSContent(id);
      const newContent = new Map(content);
      newContent.forEach((value, key) => {
        if (value.id === id) newContent.delete(key);
      });
      setContent(newContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete CMS content');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [content]);

  const createContent = useCallback(async (newContent: Omit<CMSContent, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.createCMSContent(newContent);
      if (response.success && response.data) {
        const contentMap = new Map(content);
        contentMap.set(`${response.data.page_name}:${response.data.section_key}`, response.data);
        setContent(contentMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create CMS content');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [content]);

  return (
    <CMSContext.Provider value={{ content, loading, error, fetchPageContent, getSectionContent, updateContent, deleteContent, createContent }}>
      {children}
    </CMSContext.Provider>
  );
}

export function useCMS() {
  const ctx = useContext(CMSContext);
  if (!ctx) throw new Error('useCMS must be used within CMSProvider');
  return ctx;
}
