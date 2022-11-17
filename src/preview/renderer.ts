import * as vscode from "vscode";
import { Engine } from "./engine";
import { nomifactoryJaParse } from "./nomifactoryJaParse";

export interface ContentOutput {
  html: string;
}

export class Renderer {
  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _engine: Engine
  ) {}

  public async renderDocument(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): Promise<ContentOutput> {
    const sourceUri = document.uri;
    const body = await this.renderBody(document);
    const html = `<!DOCTYPE html>
      <html lang="ja">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
          ${body.html}
      </body>
      </html>`;
    return {
      html,
    };
  }

  public async renderBody(
    document: vscode.TextDocument
  ): Promise<ContentOutput> {
    const result = await this._engine.render(document);
    return result;
  }
}
