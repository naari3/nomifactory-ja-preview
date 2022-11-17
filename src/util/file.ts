import * as vscode from "vscode";

export function isLanguageFile(document: vscode.TextDocument) {
  return document.languageId === "minecraft-lang";
}
