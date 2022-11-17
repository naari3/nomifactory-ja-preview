/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from "../commandManager";
import { PreviewManager } from "../preview/previewManager";

export class ToggleLockCommand implements Command {
  public readonly id = "nomifactory-ja-preview.preview.toggleLock";

  public constructor(private readonly _previewManager: PreviewManager) {}

  public execute() {
    this._previewManager.toggleLock();
  }
}
