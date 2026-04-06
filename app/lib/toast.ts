type ToastType = 'error' | 'warning' | 'success' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: Set<(toasts: Toast[]) => void> = new Set();
let toasts: Toast[] = [];

function notify() {
  listeners.forEach(fn => fn([...toasts]));
}

export function toast(message: string, type: ToastType = 'info') {
  const id = ++toastId;
  toasts.push({ id, message, type });
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, 4000);
}

export function subscribe(fn: (toasts: Toast[]) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export type { Toast, ToastType };
