import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalFocus(isOpen: Ref<boolean>, closeModal: () => void) {
  const dialogRef = ref<HTMLElement | null>(null);
  let previousFocus: HTMLElement | null = null;

  function getFocusableElements() {
    return Array.from(dialogRef.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.value?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  watch(isOpen, async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null;
      await nextTick();
      const preferred = dialogRef.value?.querySelector<HTMLElement>('[data-autofocus]');
      if (preferred) {
        preferred.focus();
      } else {
        const first = getFocusableElements()[0];
        if (first) first.focus();
        else dialogRef.value?.focus();
      }
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.removeEventListener('keydown', handleKeydown);
      previousFocus?.focus();
      previousFocus = null;
    }
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown);
  });

  return { dialogRef };
}
