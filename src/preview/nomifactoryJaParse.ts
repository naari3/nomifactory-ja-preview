import * as fs from "fs/promises";
import { parse, toHTML } from "minecraft-motd-util";

export interface LineInfo {
  index: number;
  text: string;
}

export interface RenderedToken {
  index: number;
  key: string;
  value: string;
}

export async function nomifactoryJaParse(data: string) {
  const lines = data
    .split("\n")
    .map((text, index): LineInfo => {
      return {
        text,
        index,
      };
    })
    .filter((line) => !line.text.startsWith("#"))
    .filter((line) => line.text !== "");
  const results: RenderedToken[] = lines.map((line) => {
    const [key, value] = line.text.split("=");
    return {
      index: line.index,
      key,
      value: parseMotd(value),
    };
  });
  return results;
}

function parseMotd(motd: string) {
  const converted = motd.replace(/<nl>/g, "%n").replace(/<(.)\1>/g, "§$1");
  const result = parse(converted);
  return toHTML(result).replaceAll("%n", "<br>");
}
