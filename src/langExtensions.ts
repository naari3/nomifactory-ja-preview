/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as arrays from "./util/arrays";
import { Disposable } from "./util/dispose";

function resolveExtensionResource(extension: vscode.Extension<any>, resourcePath: string): vscode.Uri {
  return vscode.Uri.joinPath(extension.extensionUri, resourcePath);
}

function* resolveExtensionResources(extension: vscode.Extension<any>, resourcePaths: unknown): Iterable<vscode.Uri> {
  if (Array.isArray(resourcePaths)) {
    for (const resource of resourcePaths) {
      try {
        yield resolveExtensionResource(extension, resource);
      } catch {
        // noop
      }
    }
  }
}

export interface LangContributions {
  readonly previewScripts: readonly vscode.Uri[];
  readonly previewStyles: readonly vscode.Uri[];
  readonly previewResourceRoots: readonly vscode.Uri[];
}

export namespace LangContributions {
  export const Empty: LangContributions = {
    previewScripts: [],
    previewStyles: [],
    previewResourceRoots: [],
  };

  export function merge(a: LangContributions, b: LangContributions): LangContributions {
    return {
      previewScripts: [...a.previewScripts, ...b.previewScripts],
      previewStyles: [...a.previewStyles, ...b.previewStyles],
      previewResourceRoots: [...a.previewResourceRoots, ...b.previewResourceRoots],
    };
  }

  function uriEqual(a: vscode.Uri, b: vscode.Uri): boolean {
    return a.toString() === b.toString();
  }

  export function equal(a: LangContributions, b: LangContributions): boolean {
    return (
      arrays.equals(a.previewScripts, b.previewScripts, uriEqual) &&
      arrays.equals(a.previewStyles, b.previewStyles, uriEqual) &&
      arrays.equals(a.previewResourceRoots, b.previewResourceRoots, uriEqual)
    );
  }

  export function fromExtension(extension: vscode.Extension<any>): LangContributions {
    const contributions = extension.packageJSON?.contributes;
    if (!contributions) {
      return LangContributions.Empty;
    }

    const previewStyles = Array.from(getContributedStyles(contributions, extension));
    const previewScripts = Array.from(getContributedScripts(contributions, extension));
    const previewResourceRoots = previewStyles.length || previewScripts.length ? [extension.extensionUri] : [];

    return {
      previewScripts,
      previewStyles,
      previewResourceRoots,
    };
  }

  function getContributedLangItPlugins(contributes: any, extension: vscode.Extension<any>): Map<string, Thenable<(md: any) => any>> {
    const map = new Map<string, Thenable<(md: any) => any>>();
    if (contributes["Lang.LangItPlugins"]) {
      map.set(
        extension.id,
        extension.activate().then(() => {
          if (extension.exports && extension.exports.extendLangIt) {
            return (md: any) => extension.exports.extendLangIt(md);
          }
          return (md: any) => md;
        })
      );
    }
    return map;
  }

  function getContributedScripts(contributes: any, extension: vscode.Extension<any>) {
    return resolveExtensionResources(extension, contributes["nomifactory-ja-preview.previewScripts"]);
  }

  function getContributedStyles(contributes: any, extension: vscode.Extension<any>) {
    return resolveExtensionResources(extension, contributes["nomifactory-ja-preview.previewStyles"]);
  }
}

export interface LangContributionProvider {
  readonly extensionUri: vscode.Uri;

  readonly contributions: LangContributions;
  readonly onContributionsChanged: vscode.Event<this>;

  dispose(): void;
}

class VSCodeExtensionLangContributionProvider extends Disposable implements LangContributionProvider {
  private _contributions?: LangContributions;

  public constructor(private readonly _extensionContext: vscode.ExtensionContext) {
    super();

    this._register(
      vscode.extensions.onDidChange(() => {
        const currentContributions = this._getCurrentContributions();
        const existingContributions = this._contributions || LangContributions.Empty;
        if (!LangContributions.equal(existingContributions, currentContributions)) {
          this._contributions = currentContributions;
          this._onContributionsChanged.fire(this);
        }
      })
    );
  }

  public get extensionUri() {
    return this._extensionContext.extensionUri;
  }

  private readonly _onContributionsChanged = this._register(new vscode.EventEmitter<this>());
  public readonly onContributionsChanged = this._onContributionsChanged.event;

  public get contributions(): LangContributions {
    this._contributions ??= this._getCurrentContributions();
    return this._contributions;
  }

  private _getCurrentContributions(): LangContributions {
    return vscode.extensions.all.map(LangContributions.fromExtension).reduce(LangContributions.merge, LangContributions.Empty);
  }
}

export function getLangExtensionContributions(context: vscode.ExtensionContext): LangContributionProvider {
  return new VSCodeExtensionLangContributionProvider(context);
}
