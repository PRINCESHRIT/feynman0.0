export interface ShortcutEntry {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

let registry: ShortcutEntry[] = [];
let installed = false;

export function registerShortcuts(shortcuts: ShortcutEntry[]): void {
  registry = shortcuts;

  if (!installed) {
    window.addEventListener('keydown', handleKeyDown);
    installed = true;
  }
}

export function unregisterShortcuts(): void {
  window.removeEventListener('keydown', handleKeyDown);
  registry = [];
  installed = false;
}

function handleKeyDown(e: KeyboardEvent) {
  // Don't handle shortcuts when typing in inputs
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
    return;
  }

  for (const entry of registry) {
    const keyMatch = e.key.toLowerCase() === entry.key.toLowerCase();
    const ctrlMatch = !!entry.ctrl === (e.ctrlKey || e.metaKey);
    const shiftMatch = !!entry.shift === e.shiftKey;

    if (keyMatch && ctrlMatch && shiftMatch) {
      e.preventDefault();
      entry.action();
      return;
    }
  }
}
