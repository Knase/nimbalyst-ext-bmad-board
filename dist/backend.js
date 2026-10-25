import { dirname, join, basename, isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
import { statSync, readFileSync, mkdirSync, writeFileSync, renameSync, readdirSync, openSync, writeSync, closeSync } from "node:fs";
function getLineColFromPtr(string, ptr) {
  let lines = string.slice(0, ptr).split(/\r?\n/);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string, line, column) {
  let lines = string.split(/\r?\n/);
  let codeblock = "";
  let numberLen = (Math.log10(line + 1) | 0) + 1;
  for (let i = line - 1; i <= line + 1; i++) {
    let l = lines[i - 1];
    if (!l)
      continue;
    codeblock += i.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i === line) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
class TomlError extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line;
    this.column = column;
    this.codeblock = codeblock;
  }
  /** @internal */
  static x(message, ctx, ptr) {
    throw new TomlError(message, { toml: ctx.s, ptr: ptr ?? ctx.p });
  }
}
function parseString(ctx) {
  let startPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p++);
  let first = c;
  let isLiteral = c === 39;
  let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
  if (isMultiline) {
    if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 10)
      ctx.p++;
    else if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)
      ctx.p += 2;
  }
  let parsed = "";
  let sliceStart = ctx.p;
  let state = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state = state && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in strings", ctx);
    } else if ((!state || state === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state) {
        let s = ctx.s.slice(sliceStart, ctx.p);
        parsed = parsed ? parsed + s : s;
      }
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state = 1;
      }
    } else if (state === 1) {
      if (c === 120 || c === 117 || c === 85) {
        let errPtr = ctx.p++ - 1;
        let value = 0;
        let len = c === 120 ? 2 : c === 117 ? 4 : 8;
        for (let j = 0; j < len; j++, ctx.p++) {
          let hex = ctx.s.charCodeAt(ctx.p);
          let digit = (
            /* 0-9 */
            hex >= 48 && hex <= 57 ? hex - 48 : (
              /* A-F */
              hex >= 65 && hex <= 70 ? hex - 65 + 10 : (
                /* a-f */
                hex >= 97 && hex <= 102 ? hex - 97 + 10 : -1
              )
            )
          );
          if (digit < 0)
            TomlError.x("invalid non-hex character in unicode escape", ctx);
          value = value << 4 | digit;
        }
        if (value < 0 || value > 1114111 || value >= 55296 && value <= 57343) {
          TomlError.x("invalid unicode escape", ctx, errPtr);
        }
        parsed += String.fromCodePoint(value);
        sliceStart = ctx.p--;
        state = 0;
      } else if (isMultiline && (c === 32 || c === 9)) {
        state = 2;
      } else {
        if (c === 98)
          parsed += "\b";
        else if (c === 116)
          parsed += "	";
        else if (c === 110)
          parsed += "\n";
        else if (c === 102)
          parsed += "\f";
        else if (c === 114)
          parsed += "\r";
        else if (c === 101)
          parsed += "\x1B";
        else if (c === 34)
          parsed += '"';
        else if (c === 92)
          parsed += "\\";
        else
          TomlError.x("unrecognised escape sequence", ctx);
        sliceStart = ctx.p + 1;
        state = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state === 2)
        TomlError.x("invalid escape: only line-ending whitespace may be escaped", ctx, sliceStart);
      state = !isLiteral && c === 92 ? 1 : 0;
      sliceStart = ctx.p;
    }
  }
  TomlError.x("unfinished string", ctx, startPtr);
}
let DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[Tt ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|z|[-+]\d{2}:\d{2})?$/i;
class TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date, fasttype, unsafeDelim) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    let c;
    if (typeof date === "string") {
      if (fasttype)
        prep: {
          if (fasttype < 3) {
            if (+date.slice(11, 13) > 23) {
              date = "";
              break prep;
            }
            if (fasttype === 2) {
              offset = null;
              date += "Z";
            } else if ((c = date.charCodeAt(date.length - 1)) !== 90 && c !== 122) {
              offset = date.slice(date.length - 6);
            }
            if (unsafeDelim)
              date = date.slice(0, 10) + "T" + date.slice(11);
          } else if (fasttype === 4) {
            date = +date.slice(0, 2) > 23 ? "" : `0000-01-01T${date}Z`;
          }
          hasDate = fasttype !== 4;
          hasTime = fasttype !== 3;
        }
      else {
        let match = date.match(DATE_TIME_RE);
        if (match) {
          if (!match[1]) {
            hasDate = false;
            date = `0000-01-01T${date}`;
          }
          hasTime = !!match[2];
          hasTime && date[10] === " " && (date = date.replace(" ", "T"));
          if (match[2] && +match[2] > 23) {
            date = "";
          } else {
            offset = match[3] || null;
            if (!offset && hasTime)
              date += "Z";
          }
        } else {
          date = "";
        }
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso = super.toISOString();
    if (this.isDate())
      return iso.slice(0, 10);
    if (this.isTime())
      return iso.slice(11, 23);
    if (this.#offset === null)
      return iso.slice(0, -1);
    if (this.#offset === "Z" || this.#offset === "z")
      return iso;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
}
function isDigit(char, base = 10) {
  return base === 16 ? char > 47 && char < 58 || char > 64 && char < 71 || char > 96 && char < 103 : char > 47 && char < 48 + base;
}
function isEndOfValue(char, delim) {
  return char === 32 || char === 9 || char === 10 || char === 13 || // Structure end or next value delimiter
  delim && (char === delim || char === 44) || // Comment
  char === 35;
}
function extractValue(ctx, end) {
  let errPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p);
  if (c === 91 || c === 123) {
    ctx.d-- || TomlError.x("document contains excessively nested structures. aborting.", ctx);
    let value = c === 91 ? parseArray(ctx) : parseInlineTable(ctx);
    ctx.d++;
    return value;
  }
  if (c === 34 || c === 39) {
    return parseString(ctx);
  }
  if (c === 116) {
    if (ctx.s.charCodeAt(++ctx.p) !== 114 || ctx.s.charCodeAt(++ctx.p) !== 117 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, true;
  }
  if (c === 102) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 108 || ctx.s.charCodeAt(++ctx.p) !== 115 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, false;
  }
  if (c === 43 || c === 45) {
    return parseNumber(ctx, ctx.p, ctx.s.charCodeAt(++ctx.p), 44 - c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 4) === 45 && ctx.s.charCodeAt(ctx.p + 7) === 45) {
    return parseDate(ctx, c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 2) === 58) {
    return parseTime(ctx, c, end);
  }
  return parseNumber(ctx, ctx.p, c, 0, end);
}
function parseNumber(ctx, startPtr, startChr, sign, endChr) {
  let c = startChr;
  let state = 0;
  let hasUnderscores = false;
  if (c === 105) {
    if (ctx.s.charCodeAt(++ctx.p) !== 110 || ctx.s.charCodeAt(++ctx.p) !== 102)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, (sign || 1) / 0;
  }
  if (c === 110) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 110)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, NaN;
  }
  if (c === 48) {
    if (++ctx.p >= ctx.s.length || isEndOfValue(c = ctx.s.charCodeAt(ctx.p), endChr))
      return ctx.bi === true ? 0n : 0;
    if (!sign) {
      if (c === 120)
        return parseIntegerBaseN(ctx, startPtr, 16, endChr);
      else if (c === 98)
        return parseIntegerBaseN(ctx, startPtr, 2, endChr);
      else if (c === 111)
        return parseIntegerBaseN(ctx, startPtr, 8, endChr);
    }
    if (c === 46)
      state = 2;
    else if (c === 101 || c === 69)
      state = 4;
    else
      TomlError.x("illegal leading zero", ctx, startPtr);
  } else if (!isDigit(c))
    TomlError.x("invalid value", ctx, startPtr);
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (!state)
      state = 1;
    if (c === 95) {
      if (!(state & 1))
        TomlError.x("illegal underscore", ctx);
      state += 11;
      hasUnderscores = true;
    } else if (state === 1 && c === 46)
      state = 2;
    else if ((state === 1 || state === 3) && (c === 101 || c === 69))
      state = 4;
    else if (state === 4 && (c === 43 || c === 45)) {
      state = 6;
    } else if (!isDigit(c))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (state > 9)
      state -= 11;
    else if (!(state & 1))
      state++;
  }
  if (!state) {
    let val = (startChr - 48) * (sign || 1);
    return ctx.bi === true ? BigInt(val) : val;
  }
  if (!(state & 1))
    TomlError.x("unfinished numeric value", ctx, startPtr);
  let str = ctx.s.slice(startPtr, ctx.p);
  if (hasUnderscores)
    str = str.replaceAll("_", "");
  return state > 1 ? parseFloat(str) : parseInteger(ctx, str, 10, startPtr);
}
function parseIntegerBaseN(ctx, startPtr, base, endChr) {
  let c, underscore = 1;
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (c === 95) {
      if (underscore & 1)
        TomlError.x("illegal underscore", ctx);
      underscore = 3;
    } else if (!isDigit(c, base))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (underscore & 1)
      underscore--;
  }
  if (underscore & 1)
    TomlError.x("unfinished numeric value", ctx);
  let str = ctx.s.slice(startPtr + 2, ctx.p);
  if (underscore)
    str = str.replaceAll("_", "");
  return parseInteger(ctx, str, base, startPtr);
}
function parseInteger(ctx, str, base, startPtr) {
  if (ctx.bi !== true)
    int: {
      let val = parseInt(str, base);
      if (!Number.isSafeInteger(val)) {
        if (ctx.bi)
          break int;
        TomlError.x("integer value cannot be represented losslessly", ctx, startPtr);
      }
      return val;
    }
  return base === 10 ? BigInt(str) : BigInt((base === 2 ? "0b" : base === 8 ? "0o" : "0x") + str);
}
function parseDate(ctx, c, endChr) {
  let startPtr = ctx.p++, unsafeSeparator;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++))) {
    return parseNumber(ctx, ctx.p = startPtr, c, 0, endChr);
  }
  ctx.p += 5;
  if (!isDigit(ctx.s.charCodeAt(ctx.p++)))
    TomlError.x("invalid date-time: date part is malformed", ctx, startPtr);
  if (ctx.p >= ctx.s.length || ((c = ctx.s.charCodeAt(ctx.p)) !== 32 || (unsafeSeparator = true, !isDigit(ctx.s.charCodeAt(ctx.p + 1)))) && c !== 84 && c !== 116) {
    let t2 = ctx.s.slice(startPtr, ctx.p);
    return readDate(ctx, t2, 3, false, startPtr);
  }
  if (ctx.s.charCodeAt(ctx.p += 3) !== 58)
    TomlError.x("invalid date-time: time part is malformed", ctx, startPtr);
  if (ctx.s.charCodeAt(ctx.p += 3) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  if (c = ctx.s.charCodeAt(ctx.p)) {
    if (c === 90 || c === 122) {
      let t2 = ctx.s.slice(startPtr, ++ctx.p);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, "[+00:00]");
    }
    if (c === 43 || c === 45) {
      let t2 = ctx.s.slice(startPtr, ctx.p += 6);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, !ctx.ld && "[" + ctx.s.slice(ctx.p - 6, ctx.p) + "]");
    }
  }
  let t = ctx.s.slice(startPtr, ctx.p);
  return readDate(ctx, t, 2, unsafeSeparator, startPtr);
}
function parseTime(ctx, c, endChr) {
  let start = ctx.p;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(++ctx.p))) {
    return parseNumber(ctx, --ctx.p, c, 0, endChr);
  }
  if (ctx.s.charCodeAt(ctx.p += 4) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  let t = ctx.s.slice(start, ctx.p);
  return readDate(ctx, t, 4, false, start);
}
function readDate(ctx, str, type, unsafeDelim, errPtr, temporalSuffix) {
  if (ctx.ld) {
    let date = new TomlDate(str, type, unsafeDelim);
    if (!date.isValid())
      TomlError.x("invalid date", ctx, errPtr);
    return date;
  }
  try {
    if (temporalSuffix)
      str += temporalSuffix;
    switch (type) {
      case 1:
        return Temporal.ZonedDateTime.from(str);
      case 2:
        return Temporal.PlainDateTime.from(str);
      case 3:
        return Temporal.PlainDate.from(str);
      case 4:
        return Temporal.PlainTime.from(str);
    }
  } catch (e) {
    TomlError.x(e instanceof Error ? e.message : "" + e, ctx, errPtr);
  }
}
function skipComment(ctx) {
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 10)
      break;
    if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10) {
      ctx.p++;
      break;
    }
    if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in comments", ctx);
    }
  }
}
function skipVoid(ctx, banNewLines, banComments) {
  let c;
  while (ctx.p < ctx.s.length) {
    while (ctx.p < ctx.s.length && ((c = ctx.s.charCodeAt(ctx.p)) === 32 || c === 9 || !banNewLines && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)))
      ctx.p++;
    if (banComments || c !== 35)
      break;
    skipComment(ctx);
  }
}
function parseKey(ctx, end = 61) {
  let startPtr;
  let state = 0;
  let parsed = [];
  let sliceStart;
  let c = ctx.s.charCodeAt(startPtr = ctx.p);
  do {
    if (c === end) {
      if (!state)
        TomlError.x("unexpected end of key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      return ctx.p++, parsed;
    } else if (c === 46) {
      if (!state)
        TomlError.x("illegal empty bare key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      state = 0;
    } else if (!state && (c === 34 || c === 39)) {
      if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
        TomlError.x("illegal quoted key: multiline strings are not allowed", ctx);
      parsed.push(parseString(ctx));
      state = 2;
      ctx.p--;
    } else if (c === 32 || c === 9) {
      if (state === 1) {
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
        state = 2;
      }
    } else if (state === 2 || c < 48 && c !== 45 || c > 57 && c < 65 || c > 90 && c < 97 && c !== 95 || c > 122) {
      TomlError.x("illegal character in key", ctx);
    } else if (!state) {
      state = 1;
      sliceStart = ctx.p;
    }
  } while (c = ctx.s.charCodeAt(++ctx.p));
  TomlError.x("incomplete key-value: cannot find end of key", ctx, startPtr);
}
function parseInlineTable(ctx) {
  let startPtr = ctx.p++;
  let res = /* @__PURE__ */ Object.create(null);
  let seen = /* @__PURE__ */ new Set();
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 125) {
      ctx.p++;
      return res;
    }
    let k;
    let t = res;
    let hasOwn = false;
    let errPtr = ctx.p;
    let key = parseKey(ctx);
    for (let i = 0; i < key.length; i++) {
      if (i)
        t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      k = key[i];
      if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
        TomlError.x("trying to redefine an already defined value", ctx, errPtr);
      }
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor")) {
        t = ctx.uk !== 1 && TomlError.x("document contains an unsafe property", ctx, errPtr);
        break;
      }
      if (!hasOwn && unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
      }
    }
    if (hasOwn) {
      TomlError.x("trying to redefine an already defined value", ctx, errPtr);
    }
    skipVoid(ctx, true, true);
    let value = extractValue(
      ctx,
      125
      /* } */
    );
    if (t && typeof (t[k] = value) === "object")
      seen.add(value);
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 125) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished table", ctx, startPtr);
}
function parseArray(ctx) {
  let startPtr = ctx.p++;
  let res = [];
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 93) {
      ctx.p++;
      return res;
    }
    res.push(extractValue(
      ctx,
      93
      /* ] */
    ));
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 93) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished array", ctx, startPtr);
}
function peekTable(ctx, key, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key[i];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor"))
        return false;
      if (unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i < key.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: /* @__PURE__ */ Object.create(null)
      };
    }
  }
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = /* @__PURE__ */ Object.create(null));
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: /* @__PURE__ */ Object.create(null) };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
}
function validateTablePeek(ctx, peek, ptr) {
  if (peek === null || ctx.uk === 2)
    TomlError.x(peek === null ? "trying to redefine an already defined table or value" : "document contains an unsafe property", ctx, ptr);
}
function parse(toml, options = {}) {
  let ctx = {
    s: toml,
    p: 0,
    d: options.maxDepth ?? 1e3,
    bi: options.integersAsBigInt ?? false,
    ld: options.useLegacyDate ?? true,
    uk: options.unsafeKeyBehaviour === "throw" ? 2 : options.unsafeKeyBehaviour === "drop" ? 1 : 0
  };
  let res = /* @__PURE__ */ Object.create(null);
  let meta = /* @__PURE__ */ Object.create(null);
  let tmp;
  let skipping = false;
  let tbl = res;
  let m = meta;
  if (toml.charCodeAt(0) === 65279)
    ctx.p++;
  skipVoid(ctx);
  while (ctx.p < toml.length) {
    if (toml.charCodeAt(ctx.p) === 91) {
      let isTableArray = toml.charCodeAt(++ctx.p) === 91;
      tmp = ctx.p += +isTableArray;
      skipping = false;
      let k = parseKey(
        ctx,
        93
        /* ] */
      );
      if (isTableArray) {
        if (toml.charCodeAt(ctx.p) !== 93) {
          TomlError.x("expected end of table array declaration", ctx);
        }
        ctx.p++;
      }
      let p = peekTable(
        ctx,
        k,
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        validateTablePeek(ctx, p, tmp);
        skipping = true;
      } else {
        m = p[2];
        tbl = p[1];
      }
    } else {
      tmp = ctx.p;
      let k = parseKey(ctx);
      let p = peekTable(
        ctx,
        k,
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p && !skipping)
        validateTablePeek(ctx, p, tmp);
      skipVoid(ctx, true, true);
      let v = extractValue(ctx, void 0);
      if (p && !skipping)
        p[1][p[0]] = v;
    }
    skipVoid(ctx, true);
    if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 10 && (tmp !== 13 || toml.charCodeAt(ctx.p + 1) !== 10)) {
      TomlError.x("each key-value declaration must be followed by an end-of-line", ctx);
    }
    skipVoid(ctx);
  }
  return res;
}
function readText(path) {
  const text2 = readFileSync(path, "utf8");
  return text2.charCodeAt(0) === 65279 ? text2.slice(1) : text2;
}
function tryReadText(path) {
  try {
    return readText(path);
  } catch {
    return null;
  }
}
function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function listDir(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}
function writeFileAtomic(path, text2) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  writeFileSync(tmp, text2, "utf8");
  renameSync(tmp, path);
}
const SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "vendor",
  "dist",
  "build",
  "var",
  "generated",
  "pub",
  "static",
  ".next",
  ".cache",
  "coverage",
  "__pycache__",
  ".venv",
  "target",
  "Pods",
  ".idea"
]);
function walkFind(root, opts) {
  const out = [];
  const limit = opts.limit ?? 50;
  const visit = (dir, depth) => {
    if (out.length >= limit) return;
    for (const name of listDir(dir).sort()) {
      if (out.length >= limit) return;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (depth < opts.maxDepth && !SKIP_DIRS.has(name)) visit(full, depth + 1);
      } else if (opts.match(name, full)) {
        out.push(full);
      }
    }
  };
  if (isDir(root)) visit(root, 0);
  return out;
}
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
function scalar(raw) {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    return inner === "" ? [] : inner.split(",").map((p) => scalar(p));
  }
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    if (v[0] === '"') {
      try {
        return String(JSON.parse(v));
      } catch {
      }
    }
    return v.slice(1, -1).replace(/''/g, "'");
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}
function stripComment(value) {
  const v = value.trim();
  const quoted2 = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s+#.*$/.exec(v);
  if (quoted2) return quoted2[1];
  if (v.startsWith('"') || v.startsWith("'")) return v;
  const i = v.search(/\s#/);
  return i >= 0 ? v.slice(0, i).trim() : v;
}
function parseFrontmatter(text2) {
  const m = FRONTMATTER_RE.exec(text2);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s/.test(line) || line.startsWith("- ")) continue;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    out[line.slice(0, idx).trim()] = scalar(stripComment(line.slice(idx + 1)));
  }
  return out;
}
function fmString(v) {
  return v === void 0 || Array.isArray(v) ? "" : String(v);
}
function stripFrontmatter(text2) {
  const m = FRONTMATTER_RE.exec(text2);
  return m ? text2.slice(m[0].length) : text2;
}
const quoted = (s) => JSON.stringify(s);
function editFrontmatter(text2, values) {
  const eol = text2.includes("\r\n") ? "\r\n" : "\n";
  const m = FRONTMATTER_RE.exec(text2);
  const lines = m ? m[1].split(/\r?\n/) : [];
  const rest = m ? text2.slice(m[0].length) : text2;
  for (const [key, value] of Object.entries(values)) {
    const idx = lines.findIndex((l) => new RegExp(`^${escapeRe(key)}\\s*:`).test(l));
    if (value === null) {
      if (idx >= 0) lines.splice(idx, 1);
      continue;
    }
    if (idx >= 0) {
      const comment = /\s+#.*$/.exec(lines[idx].slice(lines[idx].indexOf(":") + 1));
      const hadQuoted = /^\s*["']/.test(lines[idx].slice(lines[idx].indexOf(":") + 1));
      lines[idx] = `${key}: ${value}${comment && !hadQuoted ? comment[0] : ""}`;
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return `---${eol}${lines.join(eol)}${eol}---${eol}${rest}`;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function editYamlLine(text2, key, value) {
  const re = new RegExp(`^(\\s*${escapeRe(key)}\\s*:\\s*)([^\\s#][^#]*?)(\\s*(?:#.*)?)$`, "m");
  const m = re.exec(text2);
  if (!m) return { text: text2, found: false, changed: false };
  const previous = m[2].trim();
  if (previous === value) return { text: text2, found: true, changed: false, previous };
  const next = text2.slice(0, m.index) + `${m[1]}${value}${m[3]}` + text2.slice(m.index + m[0].length);
  return { text: next, found: true, changed: true, previous };
}
const DEFAULT_OUTPUT = "_bmad-output";
function substitute(value, projectRoot) {
  const v = value.replace(/\{project-root\}/g, projectRoot);
  return isAbsolute(v) ? v : resolve(projectRoot, v);
}
function readTomlCore(path) {
  const text2 = tryReadText(path);
  if (text2 === null) return {};
  try {
    const doc = parse(text2);
    const core = doc.core;
    return core && typeof core === "object" ? core : {};
  } catch {
    return {};
  }
}
function readYamlFlat(path) {
  const text2 = tryReadText(path);
  const out = {};
  if (text2 === null) return out;
  for (const line of text2.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+):\s*(.+?)\s*(?:#.*)?$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
function loadConfig(projectRoot) {
  const bmad = join(projectRoot, "_bmad");
  const tomlFiles = [
    join(bmad, "config.toml"),
    join(bmad, "method", "config.toml"),
    join(bmad, "custom", "config.toml"),
    join(bmad, "custom", "config.user.toml")
  ];
  const yamlFiles = [join(bmad, "core", "config.yaml"), join(bmad, "bmm", "config.yaml")];
  let core = {};
  let hasConfig = false;
  for (const f of tomlFiles) {
    if (isFile(f)) hasConfig = true;
    core = { ...core, ...readTomlCore(f) };
  }
  let yaml = {};
  for (const f of yamlFiles) {
    if (isFile(f)) hasConfig = true;
    yaml = { ...yaml, ...readYamlFlat(f) };
  }
  const str = (v) => typeof v === "string" && v.trim() ? v.trim() : null;
  const outputRaw = str(core.output_folder) ?? str(yaml.output_folder) ?? DEFAULT_OUTPUT;
  const implRaw = str(yaml.implementation_artifacts) ?? str(core.implementation_artifacts);
  const planRaw = str(yaml.planning_artifacts) ?? str(core.planning_artifacts);
  return {
    projectRoot,
    outputFolder: substitute(outputRaw, projectRoot),
    activeInitiative: str(core.active_initiative),
    implementationArtifacts: implRaw ? substitute(implRaw, projectRoot) : null,
    planningArtifacts: planRaw ? substitute(planRaw, projectRoot) : null,
    hasConfig
  };
}
function findSprintFile(config) {
  const direct = [
    config.implementationArtifacts ? join(config.implementationArtifacts, "sprint-status.yaml") : null,
    join(config.outputFolder, "implementation-artifacts", "sprint-status.yaml"),
    join(config.projectRoot, DEFAULT_OUTPUT, "implementation-artifacts", "sprint-status.yaml")
  ];
  for (const p of direct) if (p && isFile(p)) return p;
  const inOutput = walkFind(config.outputFolder, { maxDepth: 4, match: (n) => n === "sprint-status.yaml", limit: 1 });
  if (inOutput[0]) return inOutput[0];
  const inRoot = walkFind(config.projectRoot, { maxDepth: 3, match: (n) => n === "sprint-status.yaml", limit: 1 });
  return inRoot[0] ?? null;
}
function findInitiatives(outputFolder) {
  return listDir(outputFolder).filter((name) => /^initiative-/.test(name) && isFile(join(outputFolder, name, "tickets", "tickets.toml"))).sort();
}
function detect(projectRoot) {
  const config = loadConfig(projectRoot);
  const sprintFile = findSprintFile(config);
  const initiatives = isDir(config.outputFolder) ? findInitiatives(config.outputFolder) : [];
  const isV7 = config.activeInitiative !== null || initiatives.length > 0;
  const version = isV7 ? "v7" : sprintFile ? "v6" : "none";
  return { version, config, sprintFile, initiatives, legacySprintAlongsideV7: isV7 && sprintFile !== null };
}
function findEpicsText(config, sprintFile) {
  const candidates = [];
  if (config.planningArtifacts) candidates.push(config.planningArtifacts);
  candidates.push(join(config.outputFolder, "planning-artifacts"));
  if (sprintFile) candidates.push(join(sprintFile, "..", "..", "planning-artifacts"));
  for (const dir of candidates) {
    const file = join(dir, "epics.md");
    if (isFile(file)) return readText(file);
    const sharded = join(dir, "epics");
    if (isDir(sharded)) {
      const parts = listDir(sharded).filter((n) => n.endsWith(".md")).sort((a, b) => a.localeCompare(b, void 0, { numeric: true })).map((n) => tryReadText(join(sharded, n)) ?? "");
      if (parts.some((p) => p.trim())) return parts.join("\n\n");
    }
  }
  const found = walkFind(config.outputFolder, { maxDepth: 4, match: (n) => n === "epics.md", limit: 1 });
  return found[0] ? tryReadText(found[0]) ?? "" : "";
}
const SUMMARY_TITLES = /^(story|description|intent|summary|user story)$/i;
const AC_TITLE = /acceptance criteria/i;
const TASKS_TITLE = /^tasks?(\s*[/&]\s*subtasks?)?$|^tasks?\s*&\s*acceptance$/i;
function splitSections(markdown) {
  const out = [];
  let cur = null;
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h = !inFence ? /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (h) {
      if (cur) out.push(cur);
      cur = { level: h[1].length, title: h[2].trim(), body: "" };
    } else if (cur) {
      cur.body += (cur.body ? "\n" : "") + line;
    }
  }
  if (cur) out.push(cur);
  return out.map((s) => ({ ...s, body: s.body.trim() }));
}
const clean = (s) => s.replace(/<!--[\s\S]*?-->/g, "").trim();
function listItems(body) {
  const items = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*(?:\d+[.)]|[-*])\s+(?!\[[ xX]\]\s)(.*\S)\s*$/.exec(line);
    if (m) items.push(m[1]);
    else if (items.length && /^\s{2,}\S/.test(line) && !/^\s*(?:\d+[.)]|[-*])\s/.test(line)) {
      items[items.length - 1] += " " + line.trim();
    }
  }
  return items;
}
function checklist(body) {
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^(\s*)[-*]\s+\[([ xX])\]\s+(.*\S)\s*$/.exec(line);
    if (m) out.push({ checked: m[2].toLowerCase() === "x", text: m[3], depth: Math.floor(m[1].replace(/\t/g, "  ").length / 2) });
  }
  return out;
}
function afterLabel$1(body, label) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => label.test(l));
  if (start < 0) return "";
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\*\*[^*]+:\*\*/.test(line.trim())) break;
    out.push(line);
  }
  return out.join("\n");
}
function buildDetail(story, files) {
  let summary = "";
  const acceptance = [];
  const tasks = [];
  const sections = [];
  for (const f of files) {
    const text2 = tryReadText(f.path);
    if (text2 === null) continue;
    const secs = splitSections(clean(stripFrontmatter(text2)));
    for (const s of secs) {
      if (!summary && SUMMARY_TITLES.test(s.title) && s.body) summary = s.body;
      if (AC_TITLE.test(s.title)) {
        if (!acceptance.length) acceptance.push(...listItems(s.body));
        continue;
      }
      if (TASKS_TITLE.test(s.title)) {
        if (!tasks.length) tasks.push(...checklist(s.body));
        const labelled = afterLabel$1(s.body, /^\*\*Acceptance Criteria:?\*\*/i);
        if (labelled && !acceptance.length) acceptance.push(...listItems(labelled));
        continue;
      }
      if (SUMMARY_TITLES.test(s.title) || !s.body) continue;
      if (/^(dev agent record|file list|change log|plan change log|review triage log)$/i.test(s.title)) continue;
      sections.push({ title: s.title, body: s.body.length > 1800 ? s.body.slice(0, 1800) + "\n…" : s.body });
    }
  }
  return { storyId: story.id, file: story.file, summary, acceptance, tasks, sections: sections.slice(0, 12), files };
}
const V6_STORY_STATUSES = ["backlog", "ready-for-dev", "in-progress", "review", "done"];
const V6_LEGACY_READY = /* @__PURE__ */ new Set(["drafted", "contexted"]);
function v6Column(status) {
  switch (status) {
    case "backlog":
      return { column: "backlog", known: true };
    case "ready-for-dev":
      return { column: "ready", known: true };
    case "in-progress":
      return { column: "in-progress", known: true };
    case "review":
      return { column: "review", known: true };
    case "done":
      return { column: "done", known: true };
    default:
      return V6_LEGACY_READY.has(status) ? { column: "ready", known: true } : { column: "backlog", known: false };
  }
}
function parseSprintStatus(text2) {
  const out = { epics: /* @__PURE__ */ new Map(), retros: /* @__PURE__ */ new Map(), stories: [] };
  let inDev = false;
  for (const line of text2.split(/\r?\n/)) {
    if (/^development_status\s*:/.test(line)) {
      inDev = true;
      continue;
    }
    if (inDev && /^\S/.test(line) && !line.startsWith("#")) inDev = false;
    if (!inDev) continue;
    const m = /^\s+([A-Za-z0-9_.-]+)\s*:\s*([A-Za-z0-9_-]+)\s*(?:#.*)?$/.exec(line);
    if (!m) continue;
    const [, key, status] = m;
    let k;
    if (k = /^epic-(\d+)$/.exec(key)) out.epics.set(Number(k[1]), status);
    else if (k = /^epic-(\d+)-retrospective$/.exec(key)) out.retros.set(Number(k[1]), status);
    else if (k = /^(\d+)-(\d+)(?:-(.+))?$/.exec(key)) {
      out.stories.push({ key, epic: Number(k[1]), num: Number(k[2]), slug: k[3] ?? "", status });
    }
  }
  return out;
}
function parseEpicsMd(text2) {
  const doc = { epics: /* @__PURE__ */ new Map(), stories: /* @__PURE__ */ new Map() };
  for (const line of text2.split(/\r?\n/)) {
    let m;
    if (m = /^##\s+Epic\s+(\d+)\s*[:\-–—.]\s*(.+?)\s*$/i.exec(line)) {
      doc.epics.set(Number(m[1]), { title: m[2] });
    } else if (m = /^###\s+Story\s+(\d+)\.(\d+)\s*[:\-–—.]\s*(.+?)\s*$/i.exec(line)) {
      doc.stories.set(`${m[1]}.${m[2]}`, { epic: Number(m[1]), num: Number(m[2]), title: m[3] });
    }
  }
  return doc;
}
const humanize = (slug) => {
  const s = slug.replace(/-+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};
const slugify = (title) => title.toLowerCase().normalize("NFKD").replace(/[^\x00-\x7f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
function loadV6(sprintFile, epicsText) {
  const sprint = parseSprintStatus(readText(sprintFile));
  const doc = parseEpicsMd(epicsText);
  const storyDir = dirname(sprintFile);
  const stories = [];
  const seen = /* @__PURE__ */ new Set();
  for (const s of sprint.stories) {
    const fromDoc = doc.stories.get(`${s.epic}.${s.num}`);
    const column = v6Column(s.status);
    const file = join(storyDir, `${s.key}.md`);
    stories.push({
      id: s.key,
      ref: s.key,
      epicId: `epic-${s.epic}`,
      title: fromDoc?.title ?? (humanize(s.slug) || `Story ${s.epic}.${s.num}`),
      status: s.status,
      column: column.column,
      blocked: false,
      dropped: false,
      after: [],
      file: isFile(file) ? file : void 0,
      hasPlan: false,
      movable: true,
      unknownStatus: !column.known
    });
    seen.add(`${s.epic}.${s.num}`);
  }
  for (const [k, d] of doc.stories) {
    if (seen.has(k)) continue;
    stories.push({
      id: `${d.epic}-${d.num}-${slugify(d.title)}`,
      ref: k,
      epicId: `epic-${d.epic}`,
      title: d.title,
      status: "",
      column: "backlog",
      blocked: false,
      dropped: false,
      after: [],
      hasPlan: false,
      movable: false,
      lockedReason: "Not in sprint-status.yaml yet. Run sprint planning to add it, then it can be moved.",
      unknownStatus: false
    });
  }
  stories.sort((a, b) => {
    const [ae, an] = numbers(a);
    const [be, bn] = numbers(b);
    return ae - be || an - bn;
  });
  const epicNums = /* @__PURE__ */ new Set([...sprint.epics.keys(), ...doc.epics.keys(), ...stories.map((s) => numbers(s)[0])]);
  const epics = [...epicNums].sort((a, b) => a - b).map((n) => {
    const id = `epic-${n}`;
    const mine = stories.filter((s) => s.epicId === id);
    const done = mine.filter((s) => s.column === "done").length;
    const recorded = sprint.epics.get(n);
    const derived = !mine.length || mine.every((s) => s.column === "backlog") ? "backlog" : done === mine.length ? "done" : "in-progress";
    return {
      id,
      num: String(n),
      title: doc.epics.get(n)?.title ?? `Epic ${n}`,
      status: recorded ?? derived,
      statusDerived: recorded === void 0,
      storyIds: mine.map((s) => s.id),
      done,
      total: mine.length,
      retrospective: sprint.retros.get(n),
      after: []
    };
  });
  return { epics, stories };
}
function numbers(s) {
  const m = /^(\d+)[-.](\d+)/.exec(s.id) ?? /^(\d+)[-.](\d+)/.exec(s.ref);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}
function setStatusV6(sprintFile, storyKey, status) {
  const text2 = readText(sprintFile);
  const edit = editYamlLine(text2, storyKey, status);
  if (!edit.found) throw new Error(`"${storyKey}" is not in ${sprintFile}. Run sprint planning first.`);
  let next = edit.text;
  const result = {};
  if (status === "in-progress") {
    const m = /^(\d+)-/.exec(storyKey);
    if (m) {
      const epicEdit = editYamlLine(next, `epic-${m[1]}`, "in-progress");
      if (epicEdit.found && epicEdit.changed && epicEdit.previous === "backlog") {
        next = epicEdit.text;
        result.epicBumped = "in-progress";
      }
    }
  }
  if (next !== text2) writeFileAtomic(sprintFile, next);
  return result;
}
const V7_STATUSES = ["draft", "ready-for-dev", "in-progress", "in-review", "built", "done", "blocked", "dropped"];
const LEAF_NAME_RE = /^(story|spike|bug)-.+\.md$/;
function v7Column(status) {
  const base = { blocked: false, dropped: false };
  switch (status) {
    case "":
    case "draft":
      return { column: "backlog", known: true, ...base };
    case "ready-for-dev":
      return { column: "ready", known: true, ...base };
    case "in-progress":
      return { column: "in-progress", known: true, ...base };
    case "blocked":
      return { column: "in-progress", known: true, blocked: true, dropped: false };
    case "in-review":
      return { column: "review", known: true, ...base };
    case "built":
      return { column: "built", known: true, ...base };
    case "done":
      return { column: "done", known: true, ...base };
    case "dropped":
      return { column: "done", known: true, blocked: false, dropped: true };
    default:
      return { column: "backlog", known: false, ...base };
  }
}
function titleSlug(title) {
  const ascii = title.normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
  const slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return slug || "untitled";
}
function readToml(path) {
  const text2 = tryReadText(path);
  if (text2 === null) return null;
  try {
    return parse(text2);
  } catch {
    return null;
  }
}
const tables = (doc, name) => {
  const v = doc?.[name];
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
};
const idString = (v) => v === void 0 || v === null ? "" : String(v).trim();
function afterLabel(item) {
  if (typeof item === "number" || typeof item === "string") return String(item);
  if (item && typeof item === "object") {
    const o = item;
    const target = o.epic !== void 0 ? `epic ${o.epic}` : o.initiative !== void 0 ? `initiative ${o.initiative}` : "";
    return o.needs ? `${target}: ${String(o.needs)}` : target;
  }
  return "";
}
function describeEpics(initDir, initName, doc) {
  const base = join(initDir, "tickets");
  const listed = tables(doc, "epic");
  const entries = tables(doc, "entry");
  if (!listed.length && entries.length) {
    return {
      flat: true,
      epics: [{
        slug: initName,
        num: initName,
        title: initName,
        after: [],
        folder: initDir,
        epicFile: join(initDir, `${initName}.md`),
        ticketsDir: base
      }]
    };
  }
  const out = listed.map((e) => {
    const slug = idString(e.slug);
    const folder = join(base, slug);
    return {
      slug,
      num: idString(e.id) || slug,
      title: typeof e.title === "string" ? e.title : slug,
      after: Array.isArray(e.after) ? e.after : [],
      folder,
      epicFile: join(folder, `${slug}.md`),
      ticketsDir: join(folder, "tickets")
    };
  }).filter((e) => e.slug);
  const known = new Set(out.map((e) => e.slug));
  for (const name of listDir(base).sort()) {
    if (known.has(name) || !/^epic-/.test(name) || !isDir(join(base, name))) continue;
    out.push({
      slug: name,
      num: name,
      title: name,
      after: [],
      folder: join(base, name),
      epicFile: join(base, name, `${name}.md`),
      ticketsDir: join(base, name, "tickets")
    });
  }
  return { epics: out, flat: false };
}
function loadV7(outputFolder, initiative) {
  const initDir = join(outputFolder, initiative);
  const rootDoc = readToml(join(initDir, "tickets", "tickets.toml"));
  const result = { epics: [], stories: [], parentInitiative: false, writeInfo: /* @__PURE__ */ new Map() };
  if (tables(rootDoc, "initiative").length && !tables(rootDoc, "epic").length && !tables(rootDoc, "entry").length) {
    result.parentInitiative = true;
    return result;
  }
  const { epics: descs, flat } = describeEpics(initDir, initiative, rootDoc);
  for (const desc of descs) {
    const doc = flat ? rootDoc : readToml(join(desc.ticketsDir, "tickets.toml"));
    const entries = tables(doc, "entry");
    const leaves = /* @__PURE__ */ new Map();
    const plans = /* @__PURE__ */ new Map();
    for (const name of listDir(desc.ticketsDir).sort()) {
      if (!LEAF_NAME_RE.test(name)) continue;
      const file = join(desc.ticketsDir, name);
      const text2 = tryReadText(file);
      if (text2 === null) continue;
      const fm = parseFrontmatter(text2);
      if ("ticket" in fm) plans.set(idString(fm.ticket), { file, fm });
      else if ("id" in fm) leaves.set(idString(fm.id), { file, fm });
    }
    const taken = new Set([...leaves.values()].map((l) => l.file.split(/[\\/]/).pop().replace(/\.md$/, "")));
    const earlierNoFile = [];
    const storyIds = [];
    for (const entry of entries) {
      const id = idString(entry.id);
      if (!id) continue;
      const type = typeof entry.type === "string" ? entry.type : "story";
      const title = typeof entry.title === "string" ? entry.title : `Entry ${id}`;
      const leaf = leaves.get(id);
      const plan = plans.get(id);
      let stem;
      if (leaf) {
        stem = leaf.file.split(/[\\/]/).pop().replace(/\.md$/, "");
      } else {
        stem = `${type}-${titleSlug(title)}`;
        const clash = taken.has(stem) || earlierNoFile.includes(stem);
        if (clash) stem = `${stem}-${id}`;
        earlierNoFile.push(`${type}-${titleSlug(title)}`);
      }
      const planFile = plan?.file ?? join(desc.ticketsDir, `${stem}-plan.md`);
      const status = fmString(plan?.fm.status) || fmString(leaf?.fm.status);
      const col = v7Column(status);
      const afterRaw = leaf && Array.isArray(leaf.fm.after) ? leaf.fm.after : Array.isArray(entry.after) ? entry.after : [];
      const storyId = `${desc.slug}:${id}`;
      result.stories.push({
        id: storyId,
        ref: flat ? id : `${desc.num}.${id}`,
        epicId: desc.slug,
        title,
        status,
        column: col.column,
        blocked: col.blocked,
        blockedReason: col.blocked ? fmString(plan?.fm.blocked_reason) || void 0 : void 0,
        dropped: col.dropped,
        after: afterRaw.map(afterLabel).filter(Boolean),
        type,
        risk: typeof entry.risk === "string" ? entry.risk : void 0,
        file: leaf?.file ?? (plan ? plan.file : void 0),
        planFile,
        hasPlan: Boolean(plan),
        movable: true,
        unknownStatus: !col.known
      });
      result.writeInfo.set(storyId, { planFile, ticket: id, title, leafFile: leaf?.file });
      storyIds.push(storyId);
    }
    const mine = result.stories.filter((s) => storyIds.includes(s.id));
    const live = mine.filter((s) => !s.dropped);
    const done = live.filter((s) => s.column === "done").length;
    const epicFm = isFile(desc.epicFile) ? parseFrontmatter(readText(desc.epicFile)) : {};
    const recorded = fmString(epicFm.status);
    const derived = !live.length || live.every((s) => s.column === "backlog") ? "backlog" : done === live.length ? "done" : "in-progress";
    result.epics.push({
      id: desc.slug,
      num: desc.num,
      title: desc.title,
      status: recorded || derived,
      statusDerived: !recorded,
      storyIds,
      done,
      total: live.length,
      retrospective: isFile(join(desc.folder, `${desc.slug}-retrospective.md`)) ? "done" : void 0,
      file: isFile(desc.epicFile) ? desc.epicFile : void 0,
      refined: epicFm.refined === false ? false : true,
      after: desc.after.map(afterLabel).filter(Boolean)
    });
  }
  return result;
}
function setStatusV7(input) {
  if (!V7_STATUSES.includes(input.status)) {
    throw new Error(`"${input.status}" is not a v7 status (${V7_STATUSES.join(", ")})`);
  }
  if (isFile(input.planFile)) {
    const text2 = readText(input.planFile);
    const values = { status: input.status };
    if (input.status !== "blocked") {
      values.blocked_at = null;
      values.blocked_reason = null;
    }
    const next = editFrontmatter(text2, values);
    if (next !== text2) writeFileAtomic(input.planFile, next);
    return { created: false };
  }
  const ticket = /^\d+$/.test(input.ticket) ? input.ticket : quoted(input.ticket);
  const body = `---
title: ${quoted(input.title)}
ticket: ${ticket}
status: ${input.status}
---
`;
  const fd = openSync(input.planFile, "wx");
  try {
    writeSync(fd, body);
  } finally {
    closeSync(fd);
  }
  return { created: true };
}
function loadBoard(projectRoot, requestedInitiative) {
  const detection = detect(projectRoot);
  const { config } = detection;
  const banners = [];
  let epics = [];
  let stories = [];
  let v7;
  let initiative = null;
  const initiatives = [...detection.initiatives];
  if (config.activeInitiative && !initiatives.includes(config.activeInitiative) && isDir(join(config.outputFolder, config.activeInitiative))) {
    initiatives.push(config.activeInitiative);
  }
  if (detection.version === "v7") {
    initiative = requestedInitiative && initiatives.includes(requestedInitiative) ? requestedInitiative : config.activeInitiative ?? initiatives[0] ?? null;
    if (detection.legacySprintAlongsideV7) {
      banners.push({
        id: "legacy-sprint",
        kind: "warning",
        message: "An old v6 sprint-status.yaml sits next to the v7 ticket tree. The board shows v7 and ignores it.",
        action: { label: "Run bmad migrate method", promptSetting: "migrate" }
      });
    }
    if (!initiative || !isFile(join(config.outputFolder, initiative, "tickets", "tickets.toml"))) {
      banners.push({
        id: "no-initiative",
        kind: "warning",
        message: initiative ? `Initiative "${initiative}" has no tickets/tickets.toml yet, so there is nothing to show.` : "v7 detected but no initiative is active. Set `active_initiative` under [core] in _bmad/custom/config.user.toml."
      });
    } else {
      v7 = loadV7(config.outputFolder, initiative);
      epics = v7.epics;
      stories = v7.stories;
      if (v7.parentInitiative) {
        banners.push({
          id: "parent-initiative",
          kind: "warning",
          message: `"${initiative}" is a parent initiative (its tickets.toml lists child initiatives). Pick a child in the Initiative filter.`
        });
      }
    }
  } else if (detection.version === "v6" && detection.sprintFile) {
    const loaded = loadV6(detection.sprintFile, findEpicsText(config, detection.sprintFile));
    epics = loaded.epics;
    stories = loaded.stories;
    const unknown = stories.filter((s) => s.unknownStatus).length;
    if (unknown) {
      banners.push({
        id: "unknown-status",
        kind: "info",
        message: `${unknown} ${unknown === 1 ? "story has" : "stories have"} a status outside ${V6_STORY_STATUSES.join(" / ")}. Shown in Backlog until fixed in sprint-status.yaml.`
      });
    }
  } else {
    banners.push({
      id: "none",
      kind: "info",
      message: "No BMAD sprint-status.yaml or v7 ticket tree found in this project.",
      action: { label: "Start planning", promptSetting: "plan" }
    });
  }
  return {
    detection,
    v7,
    initiative,
    model: {
      version: detection.version,
      projectRoot,
      outputRoot: isDir(config.outputFolder) ? config.outputFolder : null,
      initiatives,
      activeInitiative: initiative,
      banners,
      epics,
      stories
    }
  };
}
function findStory(loaded, storyId) {
  const story = loaded.model.stories.find((s) => s.id === storyId);
  if (!story) throw new Error(`Story "${storyId}" is no longer in the project files. Refresh the board.`);
  return story;
}
function revOf(value) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
function storyDetail(loaded, storyId) {
  const story = findStory(loaded, storyId);
  const files = [];
  if (loaded.model.version === "v6") {
    if (story.file) files.push({ label: "Story file", path: story.file });
  } else if (loaded.v7) {
    const info = loaded.v7.writeInfo.get(storyId);
    if (info?.leafFile) files.push({ label: "Story", path: info.leafFile });
    if (story.hasPlan && info) files.push({ label: "Plan", path: info.planFile });
    const epic = loaded.model.epics.find((e) => e.id === story.epicId);
    if (epic?.file) files.push({ label: "Epic", path: epic.file });
  }
  return buildDetail(story, files);
}
function allowedStatuses(version) {
  return version === "v6" ? [...V6_STORY_STATUSES] : ["draft", "ready-for-dev", "in-progress", "in-review", "built", "done", "blocked", "dropped"];
}
function applyStatus(loaded, storyId, status) {
  const story = findStory(loaded, storyId);
  const version = loaded.model.version;
  if (!allowedStatuses(version).includes(status)) {
    throw new Error(`"${status}" is not a ${version} status.`);
  }
  if (!story.movable) throw new Error(story.lockedReason ?? "This story cannot be moved.");
  if (version === "v6") {
    const sprintFile = loaded.detection.sprintFile;
    if (!sprintFile) throw new Error("sprint-status.yaml disappeared. Refresh the board.");
    const res = setStatusV6(sprintFile, story.id, status);
    return { ok: true, ...res.epicBumped ? { epicBumped: res.epicBumped } : {} };
  }
  if (version === "v7" && loaded.v7) {
    const info = loaded.v7.writeInfo.get(storyId);
    if (!info) throw new Error(`No plan location known for ${storyId}.`);
    setStatusV7({ planFile: info.planFile, ticket: info.ticket, title: info.title, status });
    return { ok: true };
  }
  throw new Error("Nothing to write to: no BMAD files detected.");
}
const PANEL_ID = "board";
const PANEL_TOOLS = {
  load: "panel_load",
  detail: "panel_detail",
  setStatus: "panel_set_status",
  run: "panel_run"
};
const obj = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false
});
const PANEL_TOOL_DEFS = [
  {
    name: PANEL_TOOLS.load,
    description: "BMAD Board panel: load the board model for the workspace.",
    inputSchema: obj({ initiative: { type: "string" }, since: { type: "string" } })
  },
  {
    name: PANEL_TOOLS.detail,
    description: "BMAD Board panel: load one story's description, acceptance criteria and tasks.",
    inputSchema: obj({ storyId: { type: "string" }, initiative: { type: "string" } }, ["storyId"])
  },
  {
    name: PANEL_TOOLS.setStatus,
    description: "BMAD Board panel: write one story status into the BMAD files.",
    inputSchema: obj({ storyId: { type: "string" }, status: { type: "string" }, initiative: { type: "string" } }, ["storyId", "status"])
  },
  {
    name: PANEL_TOOLS.run,
    description: "BMAD Board panel: start a new agent session owned by the board.",
    inputSchema: obj(
      {
        ownerKey: { type: "string" },
        name: { type: "string" },
        prompt: { type: "string" },
        model: { type: "string" },
        provider: { type: "string" },
        effortLevel: { type: "string" }
      },
      ["ownerKey", "name", "prompt", "model"]
    )
  }
].map((t) => ({ ...t, scope: "global", panelOnly: true }));
function splitModel(model, provider) {
  if (provider) return { provider, model };
  const i = model.indexOf(":");
  return i > 0 ? { provider: model.slice(0, i), model: model.slice(i + 1) } : { provider: "claude-code", model };
}
const text = (v, name) => {
  if (typeof v !== "string" || !v.trim()) throw new Error(`"${name}" is required`);
  return v;
};
const optText = (v) => typeof v === "string" && v ? v : void 0;
function toSessionInfo(s) {
  return {
    sessionId: s.sessionId,
    storyId: s.key,
    title: s.title,
    status: s.status,
    hasPendingPrompt: s.hasPendingPrompt,
    updatedAt: s.updatedAt
  };
}
async function listSessions(sessions) {
  if (!sessions) return [];
  try {
    return (await sessions.listOwned()).filter((s) => s.sessionType === "session" || !s.sessionType).map(toSessionInfo);
  } catch {
    return [];
  }
}
function badgeFor(list) {
  const waiting = list.filter((s) => s.status === "waiting_for_input" || s.hasPendingPrompt).length;
  if (waiting > 0) return { value: waiting, tone: "warning" };
  const running = list.filter((s) => s.status === "running").length;
  return running > 0 ? { value: 0, tone: "default" } : { value: null, tone: "default" };
}
function createHandlers(workspacePath, sessions) {
  return {
    [PANEL_TOOLS.load]: async (p) => {
      const req = p;
      const loaded = loadBoard(workspacePath, optText(req.initiative));
      const model = { ...loaded.model, sessions: await listSessions(sessions), rev: "" };
      model.rev = revOf({ ...model, rev: void 0 });
      if (req.since && req.since === model.rev) return { unchanged: true, rev: model.rev };
      return { unchanged: false, model };
    },
    [PANEL_TOOLS.detail]: async (p) => {
      const req = p;
      return storyDetail(loadBoard(workspacePath, optText(req.initiative)), text(req.storyId, "storyId"));
    },
    [PANEL_TOOLS.setStatus]: async (p) => {
      const req = p;
      return applyStatus(loadBoard(workspacePath, optText(req.initiative)), text(req.storyId, "storyId"), text(req.status, "status"));
    },
    [PANEL_TOOLS.run]: async (p) => {
      if (!sessions) throw new Error("The ai-sessions permission was not granted, so the board cannot start sessions.");
      const req = p;
      const { provider, model } = splitModel(text(req.model, "model"), optText(req.provider));
      const res = await sessions.create({
        ownerKey: text(req.ownerKey, "ownerKey"),
        name: text(req.name, "name"),
        provider,
        model,
        prompt: text(req.prompt, "prompt"),
        ...optText(req.effortLevel) ? { effortLevel: req.effortLevel } : {}
      });
      return { sessionId: res.sessionId };
    }
  };
}
const RECHECK_MS = 15e3;
async function activate(ctx) {
  const { workspacePath, log, registerMcpTools, sessions, panels } = ctx.services;
  await registerMcpTools(PANEL_TOOL_DEFS);
  const handlers = createHandlers(workspacePath, sessions);
  let last = "";
  let timer = null;
  const publish = async () => {
    if (!panels || !sessions) return;
    try {
      const b = badgeFor(await listSessions(sessions));
      const key = `${b.value}|${b.tone}`;
      if (key === last) return;
      await panels.setGutterBadge(PANEL_ID, b.value, { tone: b.tone });
      last = key;
    } catch (error) {
      log("warn", "[bmad-board] gutter badge update failed", { error: String(error) });
    }
  };
  const request = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void publish();
    }, 500);
  };
  const off = sessions?.onSettled(() => request());
  const interval = panels && sessions ? setInterval(request, RECHECK_MS) : null;
  void publish();
  const methods = {};
  for (const [name, handler] of Object.entries(handlers)) {
    methods[name] = async (params, methodCtx) => {
      const caller = methodCtx?.call?.caller;
      if (caller === "agent") throw new Error(`${name} is only available to the BMAD Board panel`);
      const result = await handler(params && typeof params === "object" ? params : {});
      if (name.endsWith("run") || name.endsWith("set_status")) request();
      return result;
    };
  }
  return {
    methods,
    deactivate: () => {
      off?.();
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    }
  };
}
export {
  activate
};
//# sourceMappingURL=backend.js.map
