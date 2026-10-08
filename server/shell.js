/* shell.js - a small, safe, read-only "virtual terminal" for Round 2.
   Nothing here touches the real file system: every command works on a plain
   { '/absolute/path': 'file content' } object that belongs to the challenge. */
'use strict';
const P = require('path').posix;

const SUPPORTED = 'pwd ls cd cat head tail grep find sort uniq wc cut awk echo whoami id uname hostname date clear help';

/* ---------- parsing ---------- */
function tokenize(s) {
  const out = []; let cur = '', quote = null, has = false, quoted = false;
  for (const ch of s) {
    if (quote) { if (ch === quote) quote = null; else cur += ch; }
    else if (ch === '"' || ch === "'") { quote = ch; has = true; quoted = true; }
    else if (/\s/.test(ch)) { if (cur !== '' || has) { out.push({ v: cur, q: quoted }); cur = ''; has = false; quoted = false; } }
    else cur += ch;
  }
  if (cur !== '' || has) out.push({ v: cur, q: quoted });
  return out;
}
function splitPipes(s) {
  const parts = []; let cur = '', quote = null;
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === '|') { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  return parts.map(x => x.trim());
}

/* ---------- file-system helpers ---------- */
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const norm = p => (P.normalize(p).replace(/\/+$/, '') || '/');
const resolve = (cwd, p) => norm(p === '~' || p === '' ? '/' : p.startsWith('~/') ? p.slice(1) : p.startsWith('/') ? p : P.join(cwd, p));
const isFile = (f, p) => has(f, p);
const isDir = (f, p) => p === '/' || Object.keys(f).some(k => k.startsWith(p + '/'));
function allDirs(f) {
  const d = new Set(['/']);
  for (const k of Object.keys(f)) { let cur = P.dirname(k); while (cur !== '/' && !d.has(cur)) { d.add(cur); cur = P.dirname(cur); } }
  return d;
}
function children(f, dir) {
  const base = dir === '/' ? '/' : dir + '/'; const set = new Map();
  for (const k of Object.keys(f)) {
    if (!k.startsWith(base) || k === dir) continue;
    const rest = k.slice(base.length); if (!rest) continue;
    const name = rest.split('/')[0]; set.set(name, rest.includes('/') ? 'd' : 'f');
  }
  return set;
}
const walkFiles = (f, dir) => Object.keys(f).filter(k => dir === '/' ? true : k.startsWith(dir + '/')).sort();
function shown(startArg, startAbs, abs) {
  if (startArg === '/') return abs;
  const rel = abs === startAbs ? '' : abs.slice(startAbs === '/' ? 1 : startAbs.length + 1);
  const base = startArg.replace(/\/+$/, '');
  return rel ? (base ? base + '/' + rel : rel) : (base || '.');
}
function globToRe(g, ci) {
  const re = '^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(re, ci ? 'i' : '');
}
/* expand unquoted * and ? in file arguments */
function expandArgs(env, toks) {
  const res = [];
  for (const t of toks) {
    if (!t.q && /[*?]/.test(t.v) && !t.v.startsWith('-')) {
      const dir = t.v.includes('/') ? t.v.slice(0, t.v.lastIndexOf('/')) || '/' : '.';
      const pat = t.v.slice(t.v.lastIndexOf('/') + 1);
      const dAbs = resolve(env.cwd, dir);
      const re = globToRe(pat);
      const hits = [...children(env.files, dAbs).keys()].filter(n => re.test(n) && (pat.startsWith('.') || !n.startsWith('.'))).sort();
      if (hits.length) { for (const h of hits) res.push(t.v.includes('/') ? (dir === '/' ? '/' : dir + '/') + h : h); continue; }
    }
    res.push(t.v);
  }
  return res;
}
function splitOpts(args, valued = []) {
  const flags = new Set(), vals = {}, rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (a.length > 1 && a[0] === '-' && !/^-\d+$/.test(a)) {
      let consumed = false;
      for (let j = 1; j < a.length; j++) {
        const c = a[j];
        if (valued.includes(c)) { const inline = a.slice(j + 1); vals[c] = inline !== '' ? inline : args[++i]; consumed = true; break; }
        flags.add(c);
      }
      if (consumed) continue;
    } else rest.push(a);
  }
  return { flags, vals, rest };
}
const lines = s => (s === '' || s == null) ? [] : String(s).split('\n');
const num = s => { const m = String(s).trim().match(/^[-+]?\d*\.?\d+/); return m ? parseFloat(m[0]) : 0; };

/* ---------- commands ---------- */
const C = {};

C.pwd = env => env.cwd;
C.whoami = () => 'student';
C.id = () => 'uid=1000(student) gid=1000(student) groups=1000(student)';
C.uname = () => 'Linux';
C.hostname = () => 'terminal-quiz';
C.date = () => new Date().toString();
C.clear = () => '__CLEAR__';
C.help = () => 'Available commands:\n  ' + SUPPORTED.split(' ').join('  ') + '\nTip: you can chain commands with a pipe  |  and use * wildcards.';
C.echo = (env, args) => args.join(' ');

C.cd = (env, args) => {
  const t = args[0];
  if (t === undefined || t === '~') { env.cwd = '/'; return ''; }
  const abs = resolve(env.cwd, t);
  if (isFile(env.files, abs)) return `bash: cd: ${t}: Not a directory`;
  if (!isDir(env.files, abs)) return `bash: cd: ${t}: No such file or directory`;
  env.cwd = abs; return '';
};

C.ls = (env, args) => {
  const { flags, rest } = splitOpts(args);
  const showAll = flags.has('a') || flags.has('A'), long = flags.has('l');
  const targets = rest.length ? rest : ['.'];
  const out = [];
  const fmt = (name, kind, size) => long ? `${kind === 'd' ? 'drwxr-xr-x' : '-rw-r--r--'} 1 student student ${String(kind === 'd' ? 4096 : size).padStart(5)} Jan  1 09:00 ${name}` : name;
  for (const t of targets) {
    const abs = resolve(env.cwd, t);
    if (isFile(env.files, abs)) { out.push(fmt(t, 'f', String(env.files[abs]).length)); continue; }
    if (!isDir(env.files, abs)) { out.push(`ls: cannot access '${t}': No such file or directory`); continue; }
    if (targets.length > 1) out.push(`${t}:`);
    let names = [...children(env.files, abs).entries()].filter(([n]) => showAll || !n.startsWith('.'));
    names.sort((a, b) => a[0].replace(/^\./, '').toLowerCase().localeCompare(b[0].replace(/^\./, '').toLowerCase()));
    const items = [];
    if (flags.has('a')) { items.push(['.', 'd', 0], ['..', 'd', 0]); }
    for (const [n, k] of names) items.push([n, k, k === 'f' ? String(env.files[(abs === '/' ? '' : abs) + '/' + n]).length : 0]);
    if (long) out.push(...items.map(i => fmt(i[0], i[1], i[2])));
    else out.push(items.map(i => i[0]).join(env.pipeOut ? '\n' : '  '));
  }
  return out.join('\n');
};

function readTargets(env, names, input, cmd) {
  if (!names.length) return input == null ? [] : [{ name: null, text: input }];
  const res = [];
  for (const n of names) {
    const abs = resolve(env.cwd, n);
    if (isFile(env.files, abs)) res.push({ name: n, text: String(env.files[abs]) });
    else if (isDir(env.files, abs)) res.push({ name: n, err: `${cmd}: ${n}: Is a directory` });
    else res.push({ name: n, err: `${cmd}: ${n}: No such file or directory` });
  }
  return res;
}

C.cat = (env, args, input) => {
  const { rest } = splitOpts(args);
  if (!rest.length && input == null) return '';
  return readTargets(env, rest, input, 'cat').map(r => r.err || r.text).join('\n');
};

function headTail(which) {
  return (env, args, input) => {
    let n = 10; const names = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-n') n = parseInt(args[++i], 10) || 10;
      else if (/^-n\d+$/.test(a)) n = parseInt(a.slice(2), 10);
      else if (/^-\d+$/.test(a)) n = parseInt(a.slice(1), 10);
      else names.push(a);
    }
    return readTargets(env, names, input, which).map(r => {
      if (r.err) return r.err;
      const l = lines(r.text); const part = which === 'head' ? l.slice(0, n) : l.slice(Math.max(0, l.length - n));
      return (names.length > 1 ? `==> ${r.name} <==\n` : '') + part.join('\n');
    }).join('\n');
  };
}
C.head = headTail('head'); C.tail = headTail('tail');

C.sort = (env, args, input) => {
  const { flags, rest } = splitOpts(args);
  const src = rest.length ? readTargets(env, rest, input, 'sort').flatMap(r => r.err ? [r.err] : lines(r.text)) : lines(input);
  const rev = flags.has('r'), numeric = flags.has('n');
  const sc = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  let out = src.slice().sort((a, b) => {
    let c = numeric ? num(a) - num(b) : sc(a.toLowerCase(), b.toLowerCase()) || sc(a, b);
    if (c === 0 && numeric) c = sc(a, b);
    return rev ? -c : c;
  });
  if (flags.has('u')) out = out.filter((x, i) => i === 0 || x !== out[i - 1]);
  return out.join('\n');
};

C.uniq = (env, args, input) => {
  const { flags, rest } = splitOpts(args);
  const src = rest.length ? readTargets(env, rest, input, 'uniq').flatMap(r => r.err ? [r.err] : lines(r.text)) : lines(input);
  const groups = [];
  for (const l of src) { const g = groups[groups.length - 1]; if (g && g.l === l) g.n++; else groups.push({ l, n: 1 }); }
  return groups.map(g => flags.has('c') ? `${String(g.n).padStart(7)} ${g.l}` : g.l).join('\n');
};

C.wc = (env, args, input) => {
  const { flags, rest } = splitOpts(args);
  const rows = readTargets(env, rest, input, 'wc').map(r => {
    if (r.err) return r.err;
    const t = r.text, nl = lines(t).length, w = t.split(/\s+/).filter(Boolean).length, c = t.length + 1;
    const cols = [];
    if (flags.has('l')) cols.push(nl); if (flags.has('w')) cols.push(w); if (flags.has('c')) cols.push(c);
    if (!cols.length) cols.push(nl, w, c);
    const body = r.name == null && cols.length === 1 ? String(cols[0]) : cols.map(x => String(x).padStart(cols.length > 1 ? 3 : 0)).join(' ');
    return r.name == null ? body : `${body} ${r.name}`;
  });
  return rows.join('\n');
};

C.cut = (env, args, input) => {
  const { vals, rest } = splitOpts(args, ['d', 'f']);
  const d = vals.d != null ? vals.d : '\t', f = String(vals.f || '1').split(',').map(x => parseInt(x, 10) - 1);
  const src = rest.length ? readTargets(env, rest, input, 'cut').flatMap(r => r.err ? [r.err] : lines(r.text)) : lines(input);
  return src.map(l => { const p = l.split(d); return f.map(i => p[i]).filter(x => x !== undefined).join(d); }).join('\n');
};

C.awk = (env, args, input) => {
  const { vals, rest } = splitOpts(args, ['F']);
  const prog = rest[0] || '', names = rest.slice(1);
  const m = prog.match(/\{\s*print\s*(\$\d+(?:\s*,\s*\$\d+)*)?\s*\}/);
  if (!m) return 'awk: only { print $N } programs are supported in this terminal';
  const cols = (m[1] || '$0').split(',').map(x => parseInt(x.trim().slice(1), 10));
  const src = names.length ? readTargets(env, names, input, 'awk').flatMap(r => r.err ? [r.err] : lines(r.text)) : lines(input);
  const sep = vals.F != null ? vals.F : null;
  return src.map(l => { const p = sep == null ? l.trim().split(/\s+/) : l.split(sep); return cols.map(i => i === 0 ? l : (p[i - 1] || '')).join(' '); }).join('\n');
};

C.grep = (env, args, input) => {
  const { flags, vals, rest } = splitOpts(args, ['e']);
  let pat = vals.e != null ? vals.e : rest.shift();
  if (pat == null) return 'Usage: grep [OPTION]... PATTERN [FILE]...';
  const recursive = flags.has('r') || flags.has('R');
  let src = pat;
  if (flags.has('F')) src = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  else if (!flags.has('E')) src = src.replace(/[+?(){}|]/g, '\\$&');
  if (flags.has('w')) src = `\\b(?:${src})\\b`;
  let re; try { re = new RegExp(src, flags.has('i') ? 'i' : ''); } catch { return `grep: invalid pattern: ${pat}`; }
  const invert = flags.has('v'), count = flags.has('c'), listOnly = flags.has('l'), lineNo = flags.has('n'), onlyMatch = flags.has('o'), noName = flags.has('h');
  /* gather (displayName, text) pairs */
  const units = []; const err = [];
  if (!rest.length) {
    if (recursive) for (const f of walkFiles(env.files, env.cwd)) units.push({ name: shown('', env.cwd, f), text: String(env.files[f]) });
    else if (input != null) units.push({ name: null, text: input });
    else return '';
  } else {
    for (const t of rest) {
      const abs = resolve(env.cwd, t);
      if (isFile(env.files, abs)) units.push({ name: t, text: String(env.files[abs]) });
      else if (isDir(env.files, abs)) {
        if (!recursive) { err.push(`grep: ${t}: Is a directory`); continue; }
        for (const f of walkFiles(env.files, abs)) units.push({ name: shown(t, abs, f), text: String(env.files[f]) });
      } else err.push(`grep: ${t}: No such file or directory`);
    }
  }
  const prefix = !noName && (recursive || units.length > 1);
  const out = [];
  for (const u of units) {
    const hits = [];
    lines(u.text).forEach((l, i) => { if (re.test(l) !== invert) hits.push([i + 1, l]); });
    if (count) { out.push((prefix && u.name ? u.name + ':' : '') + hits.length); continue; }
    if (listOnly) { if (hits.length) out.push(u.name == null ? '(standard input)' : u.name); continue; }
    for (const [n, l] of hits) {
      const bodies = onlyMatch && !invert ? [...l.matchAll(new RegExp(re.source, re.flags + 'g'))].map(m => m[0]).filter(Boolean) : [l];
      for (const b of bodies) out.push((prefix && u.name ? u.name + ':' : '') + (lineNo ? n + ':' : '') + b);
    }
  }
  return [...err, ...out].join('\n');
};

C.find = (env, args) => {
  const starts = []; let i = 0;
  while (i < args.length && !args[i].startsWith('-')) starts.push(args[i++]);
  if (!starts.length) starts.push('.');
  let name = null, ci = false, type = null, maxd = Infinity;
  for (; i < args.length; i++) {
    const a = args[i];
    if (a === '-name' || a === '-iname') { name = args[++i]; ci = a === '-iname'; }
    else if (a === '-type') type = args[++i];
    else if (a === '-maxdepth') maxd = parseInt(args[++i], 10);
    else if (a === '-print') { /* default */ }
    else return `find: unknown predicate '${a}' (this terminal supports -name, -iname, -type, -maxdepth)`;
  }
  const re = name != null ? globToRe(name, ci) : null;
  const dirs = allDirs(env.files); const out = [];
  for (const s of starts) {
    const abs = resolve(env.cwd, s);
    if (!isFile(env.files, abs) && !isDir(env.files, abs)) { out.push(`find: '${s}': No such file or directory`); continue; }
    const entries = [];
    if (isFile(env.files, abs)) entries.push([abs, 'f']);
    else {
      entries.push([abs, 'd']);
      for (const d of dirs) if (d !== abs && (abs === '/' || d.startsWith(abs + '/'))) entries.push([d, 'd']);
      for (const f of Object.keys(env.files)) if (abs === '/' || f.startsWith(abs + '/')) entries.push([f, 'f']);
    }
    const base = abs === '/' ? 0 : abs.split('/').length - 1;
    entries.sort((a, b) => (shown(s, abs, a[0]) < shown(s, abs, b[0]) ? -1 : 1));
    for (const [p, k] of entries) {
      if (type && type !== k) continue;
      if (p.split('/').length - 1 - base > maxd) continue;
      const bn = p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1);
      const label = p === abs ? (s === '.' || s === './' ? '.' : s) : null;
      if (re && !re.test(p === abs && s === '.' ? '.' : bn)) continue;
      out.push(shown(s, abs, p));
    }
  }
  return out.join('\n');
};

const BLOCKED = new Set(['rm', 'mv', 'cp', 'mkdir', 'rmdir', 'touch', 'chmod', 'chown', 'sudo', 'nano', 'vi', 'vim', 'curl', 'wget', 'ssh', 'kill']);

/* ---------- entry point ---------- */
function run(files, cwd, line) {
  const env = { files, cwd: cwd || '/' };
  const cmdLine = String(line || '').trim();
  if (!cmdLine) return { out: '', cwd: env.cwd };
  if (/[;&`]|\$\(|>|</.test(cmdLine.replace(/'[^']*'|"[^"]*"/g, ''))) return { out: 'bash: this event terminal only allows single commands and pipes ( | )', cwd: env.cwd };
  let input = null;
  const stages = splitPipes(cmdLine);
  const piped = stages.length > 1;
  for (let si = 0; si < stages.length; si++) {
    const st = stages[si]; env.pipeOut = si < stages.length - 1;
    const toks = tokenize(st);
    if (!toks.length) return { out: 'bash: syntax error near unexpected token `|\'', cwd: env.cwd };
    const name = toks[0].v, args = expandArgs(env, toks.slice(1));
    let res;
    if (BLOCKED.has(name)) res = `bash: ${name}: permission denied (read-only investigation terminal)`;
    else if (!has(C, name)) res = `bash: ${name}: command not found`;
    else {
      try { res = C[name](env, args, input); } catch (e) { res = `${name}: error`; }
    }
    if (res === '__CLEAR__') return { out: '__CLEAR__', cwd: env.cwd };
    input = res == null ? '' : String(res);
    if (piped && name === 'cd') input = '';
  }
  return { out: input, cwd: env.cwd };
}

module.exports = { run, SUPPORTED };