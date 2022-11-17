import * as vscode from "vscode";
import * as uri from "vscode-uri";
import { Disposable } from "../util/dispose";
import { scrollEditorToLine, StartingScrollFragment, StartingScrollLine, StartingScrollLocation } from "./scrolling";
import { Renderer } from "./renderer";
import { getVisibleLine, LastScrollLocation, TopmostLineMonitor } from "./topmostLineMonitor";
import { isLanguageFile } from "../util/file";

interface WebviewMessage {
  readonly source: string;
}

interface RevealLineMessage extends WebviewMessage {
  readonly type: "revealLine";
  readonly body: {
    readonly line: number;
  };
}

interface DidClickMessage extends WebviewMessage {
  readonly type: "didClick";
  readonly body: {
    readonly line: number;
  };
}

export class PreviewDocumentVersion {
  public readonly resource: vscode.Uri;
  private readonly _version: number;

  public constructor(document: vscode.TextDocument) {
    this.resource = document.uri;
    this._version = document.version;
  }

  public equals(other: PreviewDocumentVersion): boolean {
    return this.resource.fsPath === other.resource.fsPath && this._version === other._version;
  }
}

interface PreviewDelegate {
  getTitle?(resource: vscode.Uri): string;
  getAdditionalState(): {};
  openPreviewLinkToFile(link: vscode.Uri, fragment: string): void;
}

class Preview extends Disposable {
  private _disposed = false;
  private readonly _delay = 300;
  private _throttleTimer: any;

  private readonly _webviewPanel: vscode.WebviewPanel;
  private readonly _resource: vscode.Uri;

  private _line: number | undefined;
  private _scrollToFragment: string | undefined;
  private _firstUpdate = true;
  private _currentVersion?: PreviewDocumentVersion;
  private _isScrolling = false;

  private readonly _onScrollEmitter = this._register(new vscode.EventEmitter<LastScrollLocation>());
  public readonly onScroll = this._onScrollEmitter.event;

  constructor(
    webview: vscode.WebviewPanel,
    resource: vscode.Uri,
    startingScroll: StartingScrollLocation | undefined,
    private readonly _delegate: PreviewDelegate,
    private readonly _contentProvider: Renderer
  ) {
    super();
    this._webviewPanel = webview;
    this._resource = resource;

    switch (startingScroll?.type) {
      case "line":
        if (!isNaN(startingScroll.line!)) {
          this._line = startingScroll.line;
        }
        break;

      case "fragment":
        this._scrollToFragment = startingScroll.fragment;
        break;
    }

    this._register(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.isPreviewOf(event.document.uri)) {
          this.refresh();
        }
      })
    );

    this._register(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (this.isPreviewOf(document.uri)) {
          this.refresh();
        }
      })
    );

    const watcher = this._register(vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(resource, "*")));
    this._register(
      watcher.onDidChange((uri) => {
        console.log("onDidChange", uri);
        if (this.isPreviewOf(uri)) {
          // Only use the file system event when VS Code does not already know about the file
          if (!vscode.workspace.textDocuments.some((doc) => doc.uri.toString() === uri.toString())) {
            this.refresh();
          }
        }
      })
    );

    this._register(
      this._webviewPanel.webview.onDidReceiveMessage((e: RevealLineMessage | DidClickMessage) => {
        if (e.source !== this._resource.toString()) {
          return;
        }

        switch (e.type) {
          case "revealLine":
            this._onDidScrollPreview(e.body.line);
            break;

          case "didClick":
            this._onDidClickPreview(e.body.line);
            break;
        }
      })
    );

    this.refresh();
  }

  override dispose() {
    super.dispose();

    this._disposed = true;

    clearTimeout(this._throttleTimer);
  }

  public get resource(): vscode.Uri {
    return this._resource;
  }

  public get state() {
    return {
      resource: this._resource.toString(),
      line: this._line,
      fragment: this._scrollToFragment,
      ...this._delegate.getAdditionalState(),
    };
  }

  public isPreviewOf(resource: vscode.Uri): boolean {
    return this._resource.fsPath === resource.fsPath;
  }

  public postMessage(msg: any) {
    if (!this._disposed) {
      this._webviewPanel.webview.postMessage(msg);
    }
  }

  public scrollTo(topLine: number) {
    if (this._disposed) {
      return;
    }

    if (this._isScrolling) {
      this._isScrolling = false;
      return;
    }

    // this._logger.verbose("Preview", "updateForView", {
    //   markdownFile: this._resource,
    // });
    this._line = topLine;
    this.postMessage({
      type: "updateView",
      line: topLine,
      source: this._resource.toString(),
    });
  }

  /**
   * The first call immediately refreshes the preview,
   * calls happening shortly thereafter are debounced.
   */
  public refresh(forceUpdate: boolean = false) {
    // Schedule update if none is pending
    if (!this._throttleTimer) {
      if (this._firstUpdate) {
        this._updatePreview(true);
      } else {
        this._throttleTimer = setTimeout(() => this._updatePreview(forceUpdate), this._delay);
      }
    }

    this._firstUpdate = false;
  }

  private async _updatePreview(forceUpdate?: boolean): Promise<void> {
    console.log("updatePreview", forceUpdate);
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;

    if (this._disposed) {
      return;
    }

    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(this._resource);
    } catch {
      if (!this._disposed) {
        // await this._showFileNotFoundError();
        console.error("File not found");
      }
      return;
    }

    if (this._disposed) {
      return;
    }

    const pendingVersion = new PreviewDocumentVersion(document);
    if (!forceUpdate && this._currentVersion?.equals(pendingVersion)) {
      if (this._line) {
        this.scrollTo(this._line);
      }
      return;
    }

    const shouldReloadPage = forceUpdate || !this._currentVersion || this._currentVersion.resource.toString() !== pendingVersion.resource.toString() || !this._webviewPanel.visible;
    this._currentVersion = pendingVersion;

    let selectedLine: number | undefined = undefined;
    for (const editor of vscode.window.visibleTextEditors) {
      if (this.isPreviewOf(editor.document.uri)) {
        selectedLine = editor.selection.active.line;
        break;
      }
    }

    const content = await this._contentProvider.renderDocument(document, this._webviewPanel);

    this._updateWebviewContent(content.html, shouldReloadPage);
  }

  private _updateWebviewContent(html: string, reloadPage: boolean): void {
    if (this._disposed) {
      return;
    }

    if (this._delegate.getTitle) {
      this._webviewPanel.title = this._delegate.getTitle(this._resource);
    }
    // this._webviewPanel.webview.options = this._getWebviewOptions();

    if (reloadPage) {
      this._webviewPanel.webview.html = html;
    } else {
      this._webviewPanel.webview.postMessage({
        type: "updateContent",
        content: html,
        source: this._resource.toString(),
      });
    }
  }

  private _onDidScrollPreview(line: number) {
    this._line = line;
    this._onScrollEmitter.fire({ line: this._line, uri: this._resource });
    // const config = this._previewConfigurations.loadAndCacheConfiguration(
    //   this._resource
    // );
    // if (!config.scrollEditorWithPreview) {
    //   return;
    // }

    for (const editor of vscode.window.visibleTextEditors) {
      if (!this.isPreviewOf(editor.document.uri)) {
        continue;
      }

      this._isScrolling = true;
      scrollEditorToLine(line, editor);
    }
  }

  private async _onDidClickPreview(line: number): Promise<void> {
    // fix #82457, find currently opened but unfocused source tab
    await vscode.commands.executeCommand("nomifactory-ja-preview.showSource");

    const revealLineInEditor = (editor: vscode.TextEditor) => {
      const position = new vscode.Position(line, 0);
      const newSelection = new vscode.Selection(position, position);
      editor.selection = newSelection;
      editor.revealRange(newSelection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    };

    for (const visibleEditor of vscode.window.visibleTextEditors) {
      if (this.isPreviewOf(visibleEditor.document.uri)) {
        const editor = await vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn);
        revealLineInEditor(editor);
        return;
      }
    }

    await vscode.workspace
      .openTextDocument(this._resource)
      .then(vscode.window.showTextDocument)
      .then(
        (editor) => {
          revealLineInEditor(editor);
        },
        () => {
          vscode.window.showErrorMessage(vscode.l10n.t("Could not open {0}", this._resource.toString()));
        }
      );
  }
}

export interface IManagedPreview {
  readonly resource: vscode.Uri;
  readonly resourceColumn: vscode.ViewColumn;

  readonly onDispose: vscode.Event<void>;
  readonly onDidChangeViewState: vscode.Event<vscode.WebviewPanelOnDidChangeViewStateEvent>;

  dispose(): void;

  refresh(): void;
  // updateConfiguration(): void;

  matchesResource(otherResource: vscode.Uri, otherPosition: vscode.ViewColumn | undefined, otherLocked: boolean): boolean;
}

export class StaticPreview extends Disposable implements IManagedPreview {
  public static readonly customEditorViewType = "nomifactory-ja-preview.editor";

  public static revive(
    resource: vscode.Uri,
    webview: vscode.WebviewPanel,
    contentProvider: Renderer,
    topmostLineMonitor: TopmostLineMonitor,
    // logger: ILogger,
    // contributionProvider: MarkdownContributionProvider,
    scrollLine?: number
  ): StaticPreview {
    return new StaticPreview(webview, resource, contentProvider, topmostLineMonitor, scrollLine);
  }

  private readonly _preview: Preview;

  private constructor(
    private readonly _webviewPanel: vscode.WebviewPanel,
    resource: vscode.Uri,
    contentProvider: Renderer,
    // private readonly _previewConfigurations: PreviewConfigurationManager,
    topmostLineMonitor: TopmostLineMonitor,
    // logger: ILogger,
    // contributionProvider: MarkdownContributionProvider,
    // opener: MdLinkOpener,
    scrollLine?: number
  ) {
    super();
    const topScrollLocation = scrollLine ? new StartingScrollLine(scrollLine) : undefined;
    this._preview = this._register(
      new Preview(
        this._webviewPanel,
        resource,
        topScrollLocation,
        {
          getAdditionalState: () => {
            return {};
          },
          openPreviewLinkToFile: (link, fragment) => {
            return vscode.commands.executeCommand(
              "vscode.openWith",
              link.with({
                fragment,
              }),
              StaticPreview.customEditorViewType,
              this._webviewPanel.viewColumn
            );
          },
        },
        contentProvider
      )
    );

    this._register(
      this._webviewPanel.onDidDispose(() => {
        this.dispose();
      })
    );

    this._register(
      this._webviewPanel.onDidChangeViewState((e) => {
        this._onDidChangeViewState.fire(e);
      })
    );

    this._register(
      this._preview.onScroll((scrollInfo) => {
        topmostLineMonitor.setPreviousStaticEditorLine(scrollInfo);
      })
    );

    this._register(
      topmostLineMonitor.onDidChanged((event) => {
        if (this._preview.isPreviewOf(event.resource)) {
          this._preview.scrollTo(event.line);
        }
      })
    );
  }

  private readonly _onDispose = this._register(new vscode.EventEmitter<void>());
  public readonly onDispose = this._onDispose.event;

  private readonly _onDidChangeViewState = this._register(new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>());
  public readonly onDidChangeViewState = this._onDidChangeViewState.event;

  override dispose() {
    this._onDispose.fire();
    super.dispose();
  }

  public matchesResource(_otherResource: vscode.Uri, _otherPosition: vscode.ViewColumn | undefined, _otherLocked: boolean): boolean {
    return false;
  }

  public refresh() {
    this._preview.refresh(true);
  }

  // public updateConfiguration() {
  //   if (this._previewConfigurations.hasConfigurationChanged(this._preview.resource)) {
  //     this.refresh();
  //   }
  // }

  public get resource() {
    return this._preview.resource;
  }

  public get resourceColumn() {
    return this._webviewPanel.viewColumn || vscode.ViewColumn.One;
  }
}

interface DynamicPreviewInput {
  readonly resource: vscode.Uri;
  readonly resourceColumn: vscode.ViewColumn;
  readonly locked: boolean;
  readonly line?: number;
}

export class DynamicPreview extends Disposable implements IManagedPreview {
  public static readonly viewType = "nomifactory-ja-preview.preview";

  private readonly _resourceColumn: vscode.ViewColumn;
  private _locked: boolean;

  private readonly _webviewPanel: vscode.WebviewPanel;
  private _preview: Preview;

  public static revive(
    input: DynamicPreviewInput,
    webview: vscode.WebviewPanel,
    contentProvider: Renderer,
    // previewConfigurations: PreviewConfigurationManager,
    // logger: ILogger,
    topmostLineMonitor: TopmostLineMonitor
    // contributionProvider: MarkdownContributionProvider,
    // opener: MdLinkOpener
  ): DynamicPreview {
    // webview.iconPath = contentProvider.iconPath;

    return new DynamicPreview(webview, input, contentProvider, topmostLineMonitor);
  }

  public static create(
    input: DynamicPreviewInput,
    previewColumn: vscode.ViewColumn,
    contentProvider: Renderer,
    // previewConfigurations: PreviewConfigurationManager,
    // logger: ILogger,
    topmostLineMonitor: TopmostLineMonitor
    // contributionProvider: MarkdownContributionProvider,
    // opener: MdLinkOpener
  ): DynamicPreview {
    const webview = vscode.window.createWebviewPanel(DynamicPreview.viewType, DynamicPreview._getPreviewTitle(input.resource, input.locked), previewColumn, {
      enableFindWidget: true,
    });

    // webview.iconPath = contentProvider.iconPath;

    return new DynamicPreview(webview, input, contentProvider, topmostLineMonitor);
  }

  private constructor(
    webview: vscode.WebviewPanel,
    input: DynamicPreviewInput,
    private readonly _contentProvider: Renderer,
    // private readonly _previewConfigurations: PreviewConfigurationManager,
    // private readonly _logger: ILogger,
    private readonly _topmostLineMonitor: TopmostLineMonitor // private readonly _contributionProvider: MarkdownContributionProvider, // private readonly _opener: MdLinkOpener
  ) {
    super();

    this._webviewPanel = webview;

    this._resourceColumn = input.resourceColumn;
    this._locked = input.locked;

    this._preview = this._createPreview(input.resource, typeof input.line === "number" ? new StartingScrollLine(input.line) : undefined);

    this._register(
      webview.onDidDispose(() => {
        this.dispose();
      })
    );

    this._register(
      this._webviewPanel.onDidChangeViewState((e) => {
        this._onDidChangeViewStateEmitter.fire(e);
      })
    );

    this._register(
      this._topmostLineMonitor.onDidChanged((event) => {
        if (this._preview.isPreviewOf(event.resource)) {
          this._preview.scrollTo(event.line);
        }
      })
    );

    this._register(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (this._preview.isPreviewOf(event.textEditor.document.uri)) {
          this._preview.postMessage({
            type: "onDidChangeTextEditorSelection",
            line: event.selections[0].active.line,
            source: this._preview.resource.toString(),
          });
        }
      })
    );

    this._register(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        // Only allow previewing normal text editors which have a viewColumn: See #101514
        if (typeof editor?.viewColumn === "undefined") {
          return;
        }

        if (isLanguageFile(editor.document) && !this._locked && !this._preview.isPreviewOf(editor.document.uri)) {
          const line = getVisibleLine(editor);
          this.update(editor.document.uri, line ? new StartingScrollLine(line) : undefined);
        }
      })
    );
  }

  private readonly _onDisposeEmitter = this._register(new vscode.EventEmitter<void>());
  public readonly onDispose = this._onDisposeEmitter.event;

  private readonly _onDidChangeViewStateEmitter = this._register(new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>());
  public readonly onDidChangeViewState = this._onDidChangeViewStateEmitter.event;

  override dispose() {
    this._preview.dispose();
    this._webviewPanel.dispose();

    this._onDisposeEmitter.fire();
    this._onDisposeEmitter.dispose();
    super.dispose();
  }

  public get resource() {
    return this._preview.resource;
  }

  public get resourceColumn() {
    return this._resourceColumn;
  }

  public reveal(viewColumn: vscode.ViewColumn) {
    this._webviewPanel.reveal(viewColumn);
  }

  public refresh() {
    this._preview.refresh(true);
  }

  // public updateConfiguration() {
  //   if (this._previewConfigurations.hasConfigurationChanged(this._preview.resource)) {
  //     this.refresh();
  //   }
  // }

  public update(newResource: vscode.Uri, scrollLocation?: StartingScrollLocation) {
    if (this._preview.isPreviewOf(newResource)) {
      switch (scrollLocation?.type) {
        case "line":
          this._preview.scrollTo(scrollLocation.line);
          return;

        case "fragment":
          // Workaround. For fragments, just reload the entire preview
          break;

        default:
          return;
      }
    } else if (!scrollLocation) {
      scrollLocation = new StartingScrollLine(0);
    }

    this._preview.dispose();
    this._preview = this._createPreview(newResource, scrollLocation);
  }

  public toggleLock() {
    this._locked = !this._locked;
    this._webviewPanel.title = DynamicPreview._getPreviewTitle(this._preview.resource, this._locked);
  }

  private static _getPreviewTitle(resource: vscode.Uri, locked: boolean): string {
    const resourceLabel = uri.Utils.basename(resource);
    return locked ? vscode.l10n.t("[Preview] {0}", resourceLabel) : vscode.l10n.t("Preview {0}", resourceLabel);
  }

  public get position(): vscode.ViewColumn | undefined {
    return this._webviewPanel.viewColumn;
  }

  public matchesResource(otherResource: vscode.Uri, otherPosition: vscode.ViewColumn | undefined, otherLocked: boolean): boolean {
    if (this.position !== otherPosition) {
      return false;
    }

    if (this._locked) {
      return otherLocked && this._preview.isPreviewOf(otherResource);
    } else {
      return !otherLocked;
    }
  }

  public matches(otherPreview: DynamicPreview): boolean {
    return this.matchesResource(otherPreview._preview.resource, otherPreview.position, otherPreview._locked);
  }

  private _createPreview(resource: vscode.Uri, startingScroll?: StartingScrollLocation): Preview {
    return new Preview(
      this._webviewPanel,
      resource,
      startingScroll,
      {
        getTitle: (resource) => DynamicPreview._getPreviewTitle(resource, this._locked),
        getAdditionalState: () => {
          return {
            resourceColumn: this.resourceColumn,
            locked: this._locked,
          };
        },
        openPreviewLinkToFile: (link: vscode.Uri, fragment?: string) => {
          this.update(link, fragment ? new StartingScrollFragment(fragment) : undefined);
        },
      },
      this._contentProvider
      // this._previewConfigurations,
      // this._logger,
      // this._contributionProvider,
      // this._opener
    );
  }
}
