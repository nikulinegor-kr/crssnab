import { useEffect, useCallback, useRef } from "react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

const DRAFT_KEY_PREFIX = "request_draft_";
const DRAFT_EXPIRY_HOURS = 24;

interface DraftData {
  data: Record<string, unknown>;
  savedAt: number;
}

export const useRequestDraft = <T extends Record<string, unknown>>(
  formValues: T,
  setFormValues: (values: Partial<T>) => void,
  isDialogOpen: boolean
) => {
  const { currentOrgId } = useCurrentOrganization();
  const draftKey = `${DRAFT_KEY_PREFIX}${currentOrgId || "default"}`;
  const isInitialLoad = useRef(true);
  const lastSavedValues = useRef<string>("");

  // Load draft on mount
  useEffect(() => {
    if (!isDialogOpen || !isInitialLoad.current) return;

    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const draft: DraftData = JSON.parse(stored);
        const hoursSinceSave = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
        
        if (hoursSinceSave < DRAFT_EXPIRY_HOURS && Object.keys(draft.data).length > 0) {
          // Check if draft has meaningful content (not just default values)
          const hasContent = draft.data.description && 
            typeof draft.data.description === "string" && 
            draft.data.description.trim().length > 0;
          
          if (hasContent) {
            setFormValues(draft.data as Partial<T>);
          }
        } else {
          // Draft expired, remove it
          localStorage.removeItem(draftKey);
        }
      }
    } catch (error) {
      console.error("Error loading draft:", error);
    }
    
    isInitialLoad.current = false;
  }, [draftKey, isDialogOpen, setFormValues]);

  // Save draft on change (debounced)
  const saveDraft = useCallback(() => {
    const serialized = JSON.stringify(formValues);
    
    // Prevent saving if nothing changed
    if (serialized === lastSavedValues.current) return;
    
    // Only save if there's meaningful content
    const hasContent = formValues.description && 
      typeof formValues.description === "string" && 
      formValues.description.trim().length > 0;
    
    if (!hasContent) return;

    try {
      const draft: DraftData = {
        data: formValues,
        savedAt: Date.now(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      lastSavedValues.current = serialized;
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  }, [draftKey, formValues]);

  // Auto-save every 2 seconds when dialog is open
  useEffect(() => {
    if (!isDialogOpen) return;

    const interval = setInterval(saveDraft, 2000);
    return () => clearInterval(interval);
  }, [isDialogOpen, saveDraft]);

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
    lastSavedValues.current = "";
  }, [draftKey]);

  // Check if draft exists
  const hasDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return false;
      
      const draft: DraftData = JSON.parse(stored);
      const hoursSinceSave = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
      
      return hoursSinceSave < DRAFT_EXPIRY_HOURS && 
        draft.data.description && 
        typeof draft.data.description === "string" && 
        draft.data.description.trim().length > 0;
    } catch {
      return false;
    }
  }, [draftKey]);

  return { clearDraft, hasDraft, saveDraft };
};
