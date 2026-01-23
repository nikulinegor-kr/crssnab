import { useEffect, useCallback, useRef } from "react";

const EDIT_DRAFT_KEY_PREFIX = "edit_request_draft_";
const DRAFT_EXPIRY_HOURS = 24;

interface DraftData {
  data: Record<string, unknown>;
  savedAt: number;
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

  // Load draft on mount
  useEffect(() => {
    if (!isDialogOpen || !requestId || !isInitialLoad.current) return;

    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const draft: DraftData = JSON.parse(stored);
        const hoursSinceSave = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
        
        if (hoursSinceSave < DRAFT_EXPIRY_HOURS && Object.keys(draft.data).length > 0) {
          setFormValues(draft.data as Partial<T>);
        } else {
          // Draft expired, remove it
          localStorage.removeItem(draftKey);
        }
      }
    } catch (error) {
      console.error("Error loading edit draft:", error);
    }
    
    isInitialLoad.current = false;
  }, [draftKey, isDialogOpen, requestId, setFormValues]);

  // Reset initial load flag when dialog opens with new request
  useEffect(() => {
    if (!isDialogOpen) {
      isInitialLoad.current = true;
    }
  }, [isDialogOpen]);

  // Save draft on change (debounced)
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
      return;
    }

    try {
      const draft: DraftData = {
        data: formValues,
        savedAt: Date.now(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      lastSavedValues.current = serialized;
    } catch (error) {
      console.error("Error saving edit draft:", error);
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
    }
  }, [draftKey, requestId]);

  // Check if draft exists
  const hasDraft = useCallback(() => {
    if (!requestId) return false;
    
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return false;
      
      const draft: DraftData = JSON.parse(stored);
      const hoursSinceSave = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
      
      return hoursSinceSave < DRAFT_EXPIRY_HOURS;
    } catch {
      return false;
    }
  }, [draftKey, requestId]);

  return { clearDraft, hasDraft, saveDraft };
};
