import * as vscode from "vscode";
import { Command } from "../commandManager";
import { DynamicPreviewSettings, PreviewManager } from "../preview/previewManager";

interface ShowPreviewSettings {
  readonly sideBySide?: boolean;
  readonly locked?: boolean;
}

async function showPreview(webviewManager: PreviewManager, uri: vscode.Uri | undefined, previewSettings: ShowPreviewSettings): Promise<any> {
  let resource = uri;
  if (!(resource instanceof vscode.Uri)) {
    if (vscode.window.activeTextEditor) {
      // we are relaxed and don't check for lang files
      resource = vscode.window.activeTextEditor.document.uri;
    }
  }

  if (!(resource instanceof vscode.Uri)) {
    if (!vscode.window.activeTextEditor) {
      // this is most likely toggling the preview
      return vscode.commands.executeCommand("nomifactory-ja-preview.showSource");
    }
    // nothing found that could be shown or toggled
    return;
  }

  const resourceColumn = (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn) || vscode.ViewColumn.One;
  webviewManager.openDynamicPreview(resource, {
    resourceColumn: resourceColumn,
    previewColumn: previewSettings.sideBySide ? vscode.ViewColumn.Beside : resourceColumn,
    locked: !!previewSettings.locked,
  });
}

export class ShowPreviewCommand implements Command {
  public readonly id = "nomifactory-ja-preview.showPreview";

  public constructor(private readonly _webviewManager: PreviewManager) {}

  public execute(mainUri?: vscode.Uri, allUris?: vscode.Uri[], previewSettings?: DynamicPreviewSettings) {
    for (const uri of Array.isArray(allUris) ? allUris : [mainUri]) {
      showPreview(this._webviewManager, uri, {
        sideBySide: false,
        locked: previewSettings && previewSettings.locked,
      });
    }
  }
}

export class ShowPreviewToSideCommand implements Command {
  public readonly id = "nomifactory-ja-preview.showPreviewToSide";

  public constructor(private readonly _webviewManager: PreviewManager) {}

  public execute(uri?: vscode.Uri, previewSettings?: DynamicPreviewSettings) {
    showPreview(this._webviewManager, uri, {
      sideBySide: true,
      locked: previewSettings && previewSettings.locked,
    });
  }
}

export class ShowLockedPreviewToSideCommand implements Command {
  public readonly id = "nomifactory-ja-preview.showLockedPreviewToSide";

  public constructor(private readonly _webviewManager: PreviewManager) {}

  public execute(uri?: vscode.Uri) {
    showPreview(this._webviewManager, uri, {
      sideBySide: true,
      locked: true,
    });
  }
}
