import { applyGameUiTokens } from './game-ui-tokens';
import { PanelDialog } from './panel-dialog';

/** Inventory shell and modal lifecycle. Item data and filtering arrive in later tasks. */
export class InventoryPanel {
  private readonly trigger: HTMLButtonElement;
  private readonly root: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly dialog: PanelDialog;

  constructor(doc: Document) {
    this.trigger = required<HTMLButtonElement>(doc, '#hud-inventory');
    this.root = required(doc, '#inventory-panel');
    this.closeButton = required<HTMLButtonElement>(doc, '#inventory-close');
    applyGameUiTokens(this.root);
    this.dialog = new PanelDialog(this.root);

    this.trigger.addEventListener('click', () => this.open());
    this.closeButton.addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(): void {
    this.dialog.open();
  }

  close(): void {
    this.dialog.close();
  }
}

function required<T extends HTMLElement = HTMLElement>(doc: Document, selector: string): T {
  const element = doc.querySelector<T>(selector);
  if (!element) throw new Error(`找不到背包介面元素：${selector}`);
  return element;
}
