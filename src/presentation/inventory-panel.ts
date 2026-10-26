import { applyGameUiTokens } from './game-ui-tokens';

/** Structural inventory shell only. Item data, filtering and modal input handling arrive in later tasks. */
export class InventoryPanel {
  private readonly trigger: HTMLButtonElement;
  private readonly root: HTMLElement;
  private readonly closeButton: HTMLButtonElement;

  constructor(doc: Document) {
    this.trigger = required<HTMLButtonElement>(doc, '#hud-inventory');
    this.root = required(doc, '#inventory-panel');
    this.closeButton = required<HTMLButtonElement>(doc, '#inventory-close');
    applyGameUiTokens(this.root);

    this.trigger.addEventListener('click', () => this.open());
    this.closeButton.addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    if (this.isOpen()) return;
    this.root.hidden = false;
    this.closeButton.focus();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.root.hidden = true;
    this.trigger.focus();
  }
}

function required<T extends HTMLElement = HTMLElement>(doc: Document, selector: string): T {
  const element = doc.querySelector<T>(selector);
  if (!element) throw new Error(`找不到背包介面元素：${selector}`);
  return element;
}
