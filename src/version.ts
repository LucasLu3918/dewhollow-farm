import pkg from '../package.json';

/**
 * 遊戲版本號，來源是 package.json 的 version（改版時只改那一處，並在 content/changelog.json 加一筆）。
 * 組裝點把它交給存檔（每份存檔都記錄版本號）與說明頁顯示。
 */
export const GAME_VERSION: string = pkg.version;
