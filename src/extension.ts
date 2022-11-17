// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { CommandManager } from "./commandManager";
import { registerCommands } from "./commands";
import { getLangExtensionContributions } from "./langExtensions";
import { Engine } from "./preview/engine";
import { PreviewManager } from "./preview/previewManager";
import { Renderer } from "./preview/renderer";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "nomifactory-ja-preview" is now active!');
  const contributions = getLangExtensionContributions(context);

  const commandManager = new CommandManager();

  const engine = new Engine();
  const contentProvider = new Renderer(context, engine, contributions);
  const previewManager = new PreviewManager(contentProvider, contributions);
  context.subscriptions.push(previewManager);

  context.subscriptions.push(registerCommands(commandManager, previewManager, engine));
}

// This method is called when your extension is deactivated
export function deactivate() {}
