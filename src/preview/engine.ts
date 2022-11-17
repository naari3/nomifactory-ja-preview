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
      .map(([key, value]) => `<h2 id="${key}">${key}</h2><p>${value}</p>`)
      .join("")}`;
    return { html: body };
  }
}
