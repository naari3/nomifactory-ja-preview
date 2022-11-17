import * as vscode from "vscode";
import { LangContributionProvider } from "../langExtensions";
import { ILogger } from "../logging";
import { escapeAttribute } from "../util/dom";
import { WebviewResourceProvider } from "../util/resources";
import { Engine } from "./engine";

export interface ContentOutput {
  html: string;
}

export class Renderer {
  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _engine: Engine,
    private readonly _contributionProvider: LangContributionProvider,
    private readonly _logger: ILogger
  ) {}

  public async renderDocument(
    document: vscode.TextDocument,
    resourceProvider: WebviewResourceProvider,

    initialLine: number | undefined,
    selectedLine: number | undefined,
    state: any | undefined
  ): Promise<ContentOutput> {
    const sourceUri = document.uri;
    const initialData = {
      source: sourceUri.toString(),
      fragment: state?.fragment || document.uri.fragment || undefined,
      line: initialLine,
      selectedLine,
      scrollPreviewWithEditor: true,
      scrollEditorWithPreview: true,
      doubleClickToSwitchToEditor: true,
      webviewResourceRoot: resourceProvider.asWebviewUri(document.uri).toString(),
    };

    this._logger.verbose("DocumentRenderer", `provideTextDocumentContent - ${document.uri}`, initialData);

    const body = await this.renderBody(document);
    const html = `<!DOCTYPE html>
      <html lang="ja">
      <head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta id="nomifactory-ja-preview-preview-data"
          data-settings="${escapeAttribute(JSON.stringify(initialData))}"
          data-state="${escapeAttribute(JSON.stringify(state || {}))}"
        <script src="${this._extensionResourcePath(resourceProvider, "pre.js")}"></script>
        <base href="${resourceProvider.asWebviewUri(document.uri)}">
      </head>
      <body>
          ${body.html}
          ${this._getScripts(resourceProvider)}
      </body>
      </html>`;
    return {
      html,
    };
  }

  public async renderBody(document: vscode.TextDocument): Promise<ContentOutput> {
    const result = await this._engine.render(document);
    return {
      html: `<div class="nomifactory-ja-preview-body" dir="auto">${result.html}<div class="code-line" data-line="${document.lineCount}"></div></div>`,
    };
  }

  private _extensionResourcePath(resourceProvider: WebviewResourceProvider, mediaFile: string): string {
    const webviewResource = resourceProvider.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", mediaFile));
    return webviewResource.toString();
  }

  private _getScripts(resourceProvider: WebviewResourceProvider): string {
    const out: string[] = [];
    for (const resource of this._contributionProvider.contributions.previewScripts) {
      out.push(`<script async
				src="${escapeAttribute(resourceProvider.asWebviewUri(resource))}"
				charset="UTF-8"></script>`);
    }
    return out.join("\n");
  }
}
