import * as vscode from "vscode";
import { CommandManager } from "../commandManager";
import { Engine } from "../preview/engine";
import { PreviewManager } from "../preview/previewManager";

import { RefreshPreviewCommand } from "./refreshPreview";
import { ReloadPlugins } from "./reloadPlugins";
import { RenderDocument } from "./renderDocument";
import { ShowLockedPreviewToSideCommand, ShowPreviewCommand, ShowPreviewToSideCommand } from "./showPreview";
import { ShowSourceCommand } from "./showSource";
import { ToggleLockCommand } from "./toggleLock";

export function registerCommands(
  commandManager: CommandManager,
  previewManager: PreviewManager,
  // telemetryReporter: TelemetryReporter,
  // cspArbiter: ContentSecurityPolicyArbiter,
  engine: Engine
): vscode.Disposable {
  commandManager.register(new ShowPreviewCommand(previewManager));
  commandManager.register(new ShowPreviewToSideCommand(previewManager));
  commandManager.register(new ShowLockedPreviewToSideCommand(previewManager));
  commandManager.register(new ShowSourceCommand(previewManager));
  commandManager.register(new RefreshPreviewCommand(previewManager, engine));
  commandManager.register(new ToggleLockCommand(previewManager));
  commandManager.register(new RenderDocument(engine));
  commandManager.register(new ReloadPlugins(previewManager, engine));

  return commandManager;
}
