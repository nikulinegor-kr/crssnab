import { useEffect, useCallback, useRef, useState } from "react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

const NEW_REQUEST_DRAFT_KEY_PREFIX = "draft:new-request:";
const DRAFT_EXPIRY_HOURS = 24;

interface DraftData {
  data: Record<string, unknown>;
  savedAt: number;
}

interface DraftInfo {
  exists: boolean;
  savedAt: Date | null;
  formattedDate: string | null;
}

export const useRequestDraft = <T extends Record<string, unknown>>(
  formValues: T,
  setFormValues: (values: Partial<T>) => void,
  isDialogOpen: boolean
) => {
  const { currentOrgId } = useCurrentOrganization();
  // Explicit key for NEW requests - never confused with edit drafts
  const draftKey = `${NEW_REQUEST_DRAFT_KEY_PREFIX}${currentOrgId || "default"}`;
  const isInitialLoad = useRef(true);
  const lastSavedValues = useRef<string>("");
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftInfo, setDraftInfo] = useState<DraftInfo>({ exists: false, savedAt: null, formattedDate: null });

  // Check for existing draft
  const checkDraftExists = useCallback(() => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return { exists: false, savedAt: null, formattedDate: null };
      
      const draft: DraftData = JSON.parse(stored);
      const hoursSinceSave = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
      
      if (hoursSinceSave < DRAFT_EXPIRY_HOURS && Object.keys(draft.data).length > 0) {
        // Check if draft has meaningful content
        const hasContent = draft.data.description && 
          typeof draft.data.description === "string" && 
          draft.data.description.trim().length > 0;
        
        if (hasContent) {
          const savedDate = new Date(draft.savedAt);
          return {
            exists: true,
            savedAt: savedDate,
            formattedDate: savedDate.toLocaleString("ru-RU"),
          };
        }
      }
      
      // Draft expired or empty
      localStorage.removeItem(draftKey);
      return { exists: false, savedAt: null, formattedDate: null };
    } catch {
      return { exists: false, savedAt: null, formattedDate: null };
    }
  }, [draftKey]);

  // Load draft on mount
  useEffect(() => {
    if (!isDialogOpen) {
      isInitialLoad.current = true;
      setDraftSaveState('idle');
      return;
    }
    
    if (!isInitialLoad.current) return;

    const info = checkDraftExists();
    setDraftInfo(info);

    if (info.exists) {
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) {
          const draft: DraftData = JSON.parse(stored);
          setFormValues(draft.data as Partial<T>);
        }
      } catch (error) {
        console.error("Error loading draft:", error);
      }
    }
    
    isInitialLoad.current = false;
  }, [draftKey, isDialogOpen, setFormValues, checkDraftExists]);

  // Save draft on change (only to localStorage, NO server calls)
  const saveDraft = useCallback(() => {
    const serialized = JSON.stringify(formValues);
    
    // Prevent saving if nothing changed
    if (serialized === lastSavedValues.current) return;
    
    // Only save if there's meaningful content (description has text)
    const hasContent = formValues.description && 
      typeof formValues.description === "string" && 
      formValues.description.trim().length > 0;
    
    if (!hasContent) {
      // No meaningful content, don't save draft
      return;
    }

    setDraftSaveState('saving');

    try {
      const draft: DraftData = {
        data: formValues,
        savedAt: Date.now(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      lastSavedValues.current = serialized;
      
      setTimeout(() => {
        setDraftSaveState('saved');
      }, 300);
    } catch (error) {
      console.error("Error saving draft:", error);
      setDraftSaveState('idle');
    }
  }, [draftKey, formValues]);

  // Auto-save every 2 seconds when dialog is open (localStorage only!)
  useEffect(() => {
    if (!isDialogOpen) return;

    const interval = setInterval(saveDraft, 2000);
    return () => clearInterval(interval);
  }, [isDialogOpen, saveDraft]);

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
    lastSavedValues.current = "";
    setDraftInfo({ exists: false, savedAt: null, formattedDate: null });
    setDraftSaveState('idle');
  }, [draftKey]);

  // Check if draft exists
  const hasDraft = useCallback(() => {
    return checkDraftExists().exists;
  }, [checkDraftExists]);

  // Check if form has unsaved changes (for Safe Exit warning)
  const hasUnsavedChanges = useCallback(() => {
    const hasContent = formValues.description && 
      typeof formValues.description === "string" && 
      formValues.description.trim().length > 0;
    return !!hasContent;
  }, [formValues]);

  // Dismiss draft
  const dismissDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  return { 
    clearDraft, 
    hasDraft, 
    saveDraft,
    dismissDraft,
    draftSaveState,
    draftInfo,
    hasUnsavedChanges,
  };
};
