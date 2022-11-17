import * as vscode from "vscode";

export interface ITextDocument {
  readonly uri: vscode.Uri;
  readonly version: number;

  getText(): string;
}
