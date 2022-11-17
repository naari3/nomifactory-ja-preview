/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from "../commandManager";
import { Engine } from "../preview/engine";
import { PreviewManager } from "../preview/previewManager";

export class RefreshPreviewCommand implements Command {
  public readonly id = "nomifactory-ja-preview.preview.refresh";

  public constructor(private readonly _webviewManager: PreviewManager, private readonly _engine: Engine) {}

  public execute() {
    // this._engine.cleanCache();
    this._webviewManager.refresh();
  }
}
