import type { GameState } from '../domain/game-state';
import { levelOf, SKILL_IDS, SKILL_NAMES, type SkillId } from '../domain/skills';
import type { TalentDef, TalentSet } from '../domain/talents';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { PanelDialog } from './panel-dialog';

/**
 * 技能與天賦面板（DOM）：列出五項技能的等級，到了解鎖等級的技能列出兩個天賦讓玩家選。
 * 面板只呈現狀態與送出指令；能不能選、有沒有選過，都由應用層判斷（見 chooseTalent）。
 */

export type SkillStatus = 'locked' | 'choose' | 'chosen';

export interface SkillRow {
  skill: SkillId;
  name: string;
  level: number;
  status: SkillStatus;
  /** 還可以選的天賦（只有 choose 時才有）。 */
  options: TalentDef[];
  /** 已選的天賦（只有 chosen 時才有）。 */
  chosen: TalentDef | null;
  /** 還差多少經驗才到解鎖等級（已達到或已選過時為 0）。 */
  xpToUnlock: number;
}

/**
 * 每項技能的天賦狀態：純資料，不含任何畫面。
 * locked＝未到解鎖等級；choose＝可以從兩個天賦裡選；chosen＝已經選過。
 */
export function skillRows(
  state: Pick<GameState, 'skills' | 'talents'>,
  thresholds: readonly number[],
  talents: TalentSet,
): SkillRow[] {
  return SKILL_IDS.map((skill): SkillRow => {
    const level = levelOf(state.skills[skill], thresholds);
    const defs = talents.defs.filter((t) => t.skill === skill);
    const chosenId = state.talents[skill];
    const chosen = chosenId === undefined ? null : (defs.find((t) => t.id === chosenId) ?? null);
    let status: SkillStatus = 'locked';
    if (chosen) status = 'chosen';
    else if (level >= talents.unlockLevel) status = 'choose';
    const unlockXp = thresholds[talents.unlockLevel] ?? Number.POSITIVE_INFINITY;
    return {
      skill,
      name: SKILL_NAMES[skill],
      level,
      status,
      options: status === 'choose' ? defs : [],
      chosen,
      xpToUnlock: status === 'locked' ? Math.max(0, unlockXp - state.skills[skill]) : 0,
    };
  });
}

/** 還在等玩家選天賦的技能（用於狀態列的提示）。 */
export function pendingTalentSkills(state: Pick<GameState, 'skills' | 'talents'>, thresholds: readonly number[], talents: TalentSet): SkillId[] {
  return skillRows(state, thresholds, talents)
    .filter((row) => row.status === 'choose')
    .map((row) => row.skill);
}

export class SkillPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private readonly dialog: PanelDialog;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#skill-panel');
    this.dialog = new PanelDialog(this.root);
    this.summary = required(doc, '#skill-summary');
    this.list = required(doc, '#skill-list');
    required(doc, '#skill-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(state: GameState): void {
    this.render(state);
    this.dialog.open();
  }

  toggle(state: GameState): void {
    if (this.dialog.isOpen()) this.close();
    else this.open(state);
  }

  refresh(state: GameState): void {
    if (this.dialog.isOpen()) this.render(state);
  }

  close(): void {
    this.dialog.close();
  }

  private render(state: GameState): void {
    const { unlockLevel } = this.index.talents;
    this.summary.textContent = `技能到 ${unlockLevel} 級就能從兩個天賦裡選一個，每項技能只能選一次；天賦不會改變體力消耗。`;
    this.list.replaceChildren();
    for (const row of skillRows(state, this.index.tuning.skills.thresholds, this.index.talents)) {
      const item = this.doc.createElement('li');
      const label = this.doc.createElement('span');
      label.textContent = `${row.name} ${row.level} 級`;
      item.append(label);
      if (row.status === 'locked') {
        this.note(item, `還差 ${row.xpToUnlock} 點經驗，到 ${unlockLevel} 級就能選天賦`);
      } else if (row.status === 'chosen' && row.chosen) {
        this.note(item, `已選：${row.chosen.name}（${row.chosen.description}）`);
      } else {
        for (const option of row.options) {
          const button = this.doc.createElement('button');
          button.type = 'button';
          button.textContent = `選「${option.name}」：${option.description}`;
          button.addEventListener('click', () => this.onCommand({ type: 'chooseTalent', talentId: option.id }));
          item.append(button);
        }
      }
      this.list.append(item);
    }
  }

  private note(item: HTMLElement, text: string): void {
    const span = this.doc.createElement('span');
    span.className = 'note';
    span.textContent = text;
    item.append(span);
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
