import katex from "katex";
import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";

export function mathPreserve(md: MarkdownIt): void {
  md.block.ruler.before(
    "fence",
    "math_block",
    (state: StateBlock, startLine, endLine, silent) => {
      const firstStart = state.bMarks[startLine] + state.tShift[startLine];
      const firstEnd = state.eMarks[startLine];
      const firstLine = state.src.slice(firstStart, firstEnd);
      if (!firstLine.startsWith("$$")) return false;

      const afterOpen = firstLine.slice(2);
      if (afterOpen.trimEnd().endsWith("$$")) {
        if (silent) return true;
        const content = afterOpen.replace(/\$\$\s*$/, "").trim();
        emitBlock(state, content, startLine, startLine + 1);
        return true;
      }

      let line = startLine + 1;
      for (; line < endLine; line++) {
        const s = state.bMarks[line] + state.tShift[line];
        const e = state.eMarks[line];
        if (state.src.slice(s, e).trimEnd().endsWith("$$")) break;
      }
      if (line >= endLine) return false;
      if (silent) return true;

      const bodyStart = state.bMarks[startLine + 1];
      const bodyEnd = state.bMarks[line] + state.tShift[line];
      const lastLine = state.src.slice(bodyEnd, state.eMarks[line]);
      const firstTail = afterOpen;
      const content = (firstTail + "\n" +
        state.src.slice(bodyStart, state.bMarks[line]) +
        lastLine.replace(/\$\$\s*$/, ""))
        .replace(/^\n+|\n+$/g, "");
      emitBlock(state, content, startLine, line + 1);
      return true;
    },
  );

  md.inline.ruler.after(
    "escape",
    "math_inline",
    (state: StateInline, silent) => {
      if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
      if (state.src.charCodeAt(state.pos + 1) === 0x24) return false;
      if (state.pos > 0 && state.src.charCodeAt(state.pos - 1) === 0x5c /* \ */) {
        return false;
      }

      let end = state.pos + 1;
      while (end < state.src.length) {
        const ch = state.src.charCodeAt(end);
        if (ch === 0x5c /* \ */) {
          end += 2;
          continue;
        }
        if (ch === 0x24 /* $ */) break;
        if (ch === 0x0a /* \n */) return false;
        end++;
      }
      if (end >= state.src.length) return false;
      if (end === state.pos + 1) return false;

      const content = state.src.slice(state.pos + 1, end);
      if (!silent) {
        const token = state.push("math_inline", "span", 0);
        token.markup = "$";
        token.content = content;
      }
      state.pos = end + 1;
      return true;
    },
  );

  md.renderer.rules.math_block = (tokens, idx) => {
    const code = tokens[idx].content;
    try {
      const html = katex.renderToString(code, {
        displayMode: true,
        throwOnError: false,
        output: "htmlAndMathml",
        strict: "ignore",
      });
      return `<div class="math-block">${html}</div>\n`;
    } catch (e) {
      return `<div class="math-block math-error" title="${md.utils.escapeHtml(
        String(e),
      )}">${md.utils.escapeHtml(code)}</div>\n`;
    }
  };

  md.renderer.rules.math_inline = (tokens, idx) => {
    const code = tokens[idx].content;
    try {
      const html = katex.renderToString(code, {
        displayMode: false,
        throwOnError: false,
        output: "htmlAndMathml",
        strict: "ignore",
      });
      return `<span class="math-inline">${html}</span>`;
    } catch (e) {
      return `<span class="math-inline math-error" title="${md.utils.escapeHtml(
        String(e),
      )}">${md.utils.escapeHtml(code)}</span>`;
    }
  };
}

function emitBlock(state: StateBlock, content: string, start: number, lineAfter: number) {
  const token = state.push("math_block", "div", 0);
  token.block = true;
  token.markup = "$$";
  token.content = content;
  token.map = [start, lineAfter];
  state.line = lineAfter;
}
