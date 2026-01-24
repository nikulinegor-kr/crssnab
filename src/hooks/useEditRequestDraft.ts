import { useEffect, useCallback, useRef, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const EDIT_DRAFT_KEY_PREFIX = "edit_request_draft_";
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

export const useEditRequestDraft = <T extends Record<string, unknown>>(
  requestId: string | undefined,
  formValues: T,
  setFormValues: (values: Partial<T>) => void,
  isDialogOpen: boolean,
  originalValues: T | null
) => {
  const draftKey = `${EDIT_DRAFT_KEY_PREFIX}${requestId || "unknown"}`;
  const isInitialLoad = useRef(true);
  const lastSavedValues = useRef<string>("");
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftInfo, setDraftInfo] = useState<DraftInfo>({ exists: false, savedAt: null, formattedDate: null });

  // Check for existing draft on mount
  const checkDraftExists = useCallback(() => {
    if (!requestId) return { exists: false, savedAt: null, formattedDate: null };
    
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return { exists: false, savedAt: null, formattedDate: null };
      
      const draft: DraftData = JSON.parse(stored);
      const hoursSinceSave = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
      
      if (hoursSinceSave < DRAFT_EXPIRY_HOURS && Object.keys(draft.data).length > 0) {
        const savedDate = new Date(draft.savedAt);
        return {
          exists: true,
          savedAt: savedDate,
          formattedDate: format(savedDate, "dd.MM.yyyy, HH:mm", { locale: ru }),
        };
      }
      
      // Draft expired, remove it
      localStorage.removeItem(draftKey);
      return { exists: false, savedAt: null, formattedDate: null };
    } catch {
      return { exists: false, savedAt: null, formattedDate: null };
    }
  }, [draftKey, requestId]);

  // Load draft on mount - but don't auto-apply, let user decide
  useEffect(() => {
    if (!isDialogOpen || !requestId) return;
    
    const info = checkDraftExists();
    setDraftInfo(info);
    isInitialLoad.current = true;
  }, [isDialogOpen, requestId, checkDraftExists]);

  // Reset initial load flag when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      isInitialLoad.current = true;
      setDraftSaveState('idle');
    }
  }, [isDialogOpen]);

  // Restore draft data
  const restoreDraft = useCallback(() => {
    if (!requestId) return false;
    
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return false;
      
      const draft: DraftData = JSON.parse(stored);
      const hoursSinceSave = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
      
      if (hoursSinceSave < DRAFT_EXPIRY_HOURS && Object.keys(draft.data).length > 0) {
        setFormValues(draft.data as Partial<T>);
        setDraftInfo({ exists: false, savedAt: null, formattedDate: null }); // Hide banner after restore
        return true;
      }
    } catch (error) {
      console.error("Error restoring draft:", error);
    }
    return false;
  }, [draftKey, requestId, setFormValues]);

  // Save draft on change
  const saveDraft = useCallback(() => {
    if (!requestId || !originalValues) return;
    
    const serialized = JSON.stringify(formValues);
    
    // Prevent saving if nothing changed
    if (serialized === lastSavedValues.current) return;
    
    // Check if form has changes from original
    const originalSerialized = JSON.stringify(originalValues);
    if (serialized === originalSerialized) {
      // No changes from original, remove draft if exists
      localStorage.removeItem(draftKey);
      setDraftSaveState('idle');
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
  }, [draftKey, formValues, originalValues, requestId]);

  // Auto-save every 2 seconds when dialog is open
  useEffect(() => {
    if (!isDialogOpen || !requestId) return;

    const interval = setInterval(saveDraft, 2000);
    return () => clearInterval(interval);
  }, [isDialogOpen, requestId, saveDraft]);

  // Clear draft
  const clearDraft = useCallback(() => {
    if (requestId) {
      localStorage.removeItem(draftKey);
      lastSavedValues.current = "";
      setDraftInfo({ exists: false, savedAt: null, formattedDate: null });
      setDraftSaveState('idle');
    }
  }, [draftKey, requestId]);

  // Check if form has unsaved changes compared to original
  const hasUnsavedChanges = useCallback(() => {
    if (!originalValues) return false;
    const originalSerialized = JSON.stringify(originalValues);
    const currentSerialized = JSON.stringify(formValues);
    return originalSerialized !== currentSerialized;
  }, [formValues, originalValues]);

  // Dismiss draft banner without applying
  const dismissDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  return { 
    clearDraft, 
    saveDraft, 
    restoreDraft,
    dismissDraft,
    draftSaveState,
    draftInfo,
    hasUnsavedChanges,
  };
};
