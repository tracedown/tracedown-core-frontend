/**
 * CodeMirror 6 language support for Lace, built from @lacelang/validator.
 *
 * Provides:
 * - Syntax highlighting via the Lace tokenizer (maps token types to CM highlight tags)
 * - Lint diagnostics via parse() + validate()
 */
import {
  StreamLanguage,
  type StringStream,
  type StreamParser,
} from '@codemirror/language';
import { linter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { keymap, type EditorView } from '@codemirror/view';
import { tokenize, parse, validate } from '@lacelang/validator';
import { downloadText } from '@/lib/fileDownload';

type TokenType = 'STRING' | 'INT' | 'FLOAT' | 'BOOL' | 'IDENT' | 'RUN_VAR' | 'SCRIPT_VAR' | 'KEYWORD' | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'LBRACK' | 'RBRACK' | 'COMMA' | 'COLON' | 'DOT' | 'SEMI' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'EOF';

/** Maps Lace token types to CodeMirror highlight tag names. */
const TOKEN_STYLES: Record<TokenType, string> = {
  KEYWORD: 'keyword',
  STRING: 'string',
  INT: 'number',
  FLOAT: 'number',
  BOOL: 'atom',
  IDENT: 'variableName',
  RUN_VAR: 'variableName.special',
  SCRIPT_VAR: 'variableName.special',
  LPAREN: 'paren',
  RPAREN: 'paren',
  LBRACE: 'brace',
  RBRACE: 'brace',
  LBRACK: 'squareBracket',
  RBRACK: 'squareBracket',
  COMMA: 'separator',
  COLON: 'punctuation',
  DOT: 'punctuation',
  SEMI: 'punctuation',
  PLUS: 'operator',
  MINUS: 'operator',
  STAR: 'operator',
  SLASH: 'operator',
  PERCENT: 'operator',
  EOF: '',
};

/**
 * Core functions that lex as IDENT rather than lexer keywords, so they need
 * explicit highlighting to read as builtins. `json`/`form`/`schema` are already
 * KEYWORD tokens; `count` and `includes` (assert-only, spec §8.1) are plain
 * identifiers — style them the same way here.
 */
const BUILTIN_FUNCS = new Set<string>(['count', 'includes']);

/**
 * Stream parser for Lace that pre-tokenizes the full document
 * and feeds tokens to CodeMirror line by line.
 */
function createLaceStreamParser(): StreamParser<{ tokens: Array<{ type: TokenType; value: string; col: number }>; idx: number }> {
  return {
    name: 'lace',

    startState() {
      return { tokens: [], idx: 0 };
    },

    token(stream: StringStream, state) {
      // At start of line, re-tokenize the full line
      if (stream.sol()) {
        const lineText = stream.string;
        try {
          // Tokenize just this line for highlighting
          const lineTokens = tokenize(lineText);
          state.tokens = lineTokens.filter(t => t.type !== 'EOF');
          state.idx = 0;
        } catch {
          // Lex error — consume the rest of the line as error
          stream.skipToEnd();
          return 'error';
        }
      }

      if (state.idx >= state.tokens.length) {
        stream.skipToEnd();
        return null;
      }

      const tok = state.tokens[state.idx];
      const streamCol = stream.pos;

      // Skip whitespace/comments between tokens
      if (streamCol < tok.col - 1) {
        // Advance to the token position
        while (stream.pos < tok.col - 1 && !stream.eol()) {
          const ch = stream.peek();
          if (ch === '/' && stream.string[stream.pos + 1] === '/') {
            stream.skipToEnd();
            return 'comment';
          }
          stream.next();
        }
        return null;
      }

      // Consume the token characters
      for (let i = 0; i < tok.value.length && !stream.eol(); i++) {
        stream.next();
      }
      state.idx++;

      if (tok.type === 'IDENT' && BUILTIN_FUNCS.has(tok.value)) {
        return 'keyword';
      }
      return TOKEN_STYLES[tok.type] || null;
    },
  };
}

/** CodeMirror language extension for Lace syntax highlighting. */
export function laceLanguage() {
  return StreamLanguage.define(createLaceStreamParser());
}

/**
 * CodeMirror linter extension that runs Lace parse + validate
 * and returns diagnostics as inline markers.
 */
export function laceLinter(onValidate?: (errorCount: number) => void) {
  return linter((view: EditorView): CmDiagnostic[] => {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    const diagnostics: CmDiagnostic[] = [];

    try {
      const ast = parse(doc);
      const sink = validate(ast);

      for (const diag of sink.errors) {
        const line = diag.line ?? 1;
        const lineObj = view.state.doc.line(Math.min(line, view.state.doc.lines));
        diagnostics.push({
          from: lineObj.from,
          to: lineObj.to,
          severity: 'error',
          message: `${diag.code}${diag.detail ? ': ' + diag.detail : ''}`,
        });
      }

      for (const diag of sink.warnings) {
        const line = diag.line ?? 1;
        const lineObj = view.state.doc.line(Math.min(line, view.state.doc.lines));
        diagnostics.push({
          from: lineObj.from,
          to: lineObj.to,
          severity: 'warning',
          message: `${diag.code}${diag.detail ? ': ' + diag.detail : ''}`,
        });
      }
    } catch (err: unknown) {
      // Parse error — mark the error line
      const parseErr = err as { line?: number; message?: string };
      const line = parseErr.line ?? 1;
      const lineObj = view.state.doc.line(Math.min(line, view.state.doc.lines));
      diagnostics.push({
        from: lineObj.from,
        to: lineObj.to,
        severity: 'error',
        message: parseErr.message ?? 'Parse error',
      });
    }

    const errorCount = diagnostics.filter(d => d.severity === 'error').length;
    onValidate?.(errorCount);
    return diagnostics;
  }, { delay: 500 });
}

/**
 * CodeMirror keymap: Ctrl/Cmd+S downloads the current script as a `.lace` file
 * (`<snake_cased_service_name>.lace`) instead of triggering the browser's
 * save-page. `getName` supplies the current service name at keypress time so a
 * live-edited name is reflected.
 */
export function laceSaveKeymap(getName: () => string | undefined) {
  return keymap.of([{
    key: 'Mod-s',
    preventDefault: true,
    run: (view: EditorView) => {
      saveLaceFile(view.state.doc.toString(), getName());
      return true;
    },
  }]);
}

/** Downloads `content` as `<snake_cased_service_name>.lace` (falls back to `script.lace`). */
export function saveLaceFile(content: string, serviceName?: string): void {
  downloadText(content, laceFilename(serviceName));
}

/** Builds `<snake_case>.lace` from a service name, falling back to `script.lace`. */
function laceFilename(name: string | undefined): string {
  const base = (name ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'script'}.lace`;
}

