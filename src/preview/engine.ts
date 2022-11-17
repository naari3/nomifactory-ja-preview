import * as vscode from "vscode";
import { ITextDocument } from "../types/textDocument";
import { nomifactoryJaParse } from "./nomifactoryJaParse";
import { ContentOutput } from "./renderer";

export class Engine {
  public constructor() {}

  public async render(input: ITextDocument | string): Promise<ContentOutput> {
    const text = typeof input === "string" ? input : input.getText();
    const results = await nomifactoryJaParse(text);

    const body = `${Array.from(results)
      .map(
        (line) =>
          `<h2 class="code-line" data-line="${line.index}" dir="auto" id="${line.key}">${line.key}</h2><p class="code-line" data-line="${line.index}" dir="auto">${line.value}</p>`
      )
      .join("")}`;
    return { html: body };
  }
}
