// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { nomifactoryJaParse } from "./nomifactoryJaParse";

function getWebviewContent(parsedMap: Map<string, string>) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
		${Array.from(parsedMap)
      .map(([key, value]) => `<h2>${key}</h2><p>${value}</p>`)
      .join("")}
</body>
</html>`;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "nomifactory-ja-preview" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "nomifactory-ja-preview.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage(
        "Hello World from nomifactory-ja-preview!"
      );
      const panel = vscode.window.createWebviewPanel(
        "nomifactory-ja-preview",
        "nomifactory-ja-preview",
        vscode.ViewColumn.One,
        {}
      );
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const selection = editor.selection;
        const text = document.getText(selection);
        console.log(vscode.window.activeTextEditor?.document.uri.fsPath);
        if (
          vscode.window.activeTextEditor?.document.uri.fsPath.endsWith(".lang")
        ) {
          nomifactoryJaParse(
            vscode.window.activeTextEditor?.document.uri.fsPath
          ).then((results) => {
            console.log(results);
            panel.webview.html = getWebviewContent(results);
          });
        } else {
          panel.webview.html = "";
        }
        console.log(vscode.window.activeTextEditor?.document.uri.toString());
        console.log({ document, selection, text });
      }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
