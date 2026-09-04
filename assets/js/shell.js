/* ---------------------------------------------------------------------
   A small, real (not scripted/canned) shell simulator: an in-memory
   filesystem plus genuine implementations of common commands, real
   tokenizing (quotes), variable expansion, pipes, redirects, and
   ;/&&/|| sequencing. This is a teaching sandbox, not a POSIX-complete
   shell — but every command's output is actually computed from the
   current state, not pre-written.

   Exposed as window.ShellSim so it can be used from the browser UI
   (engine.js) and unit-tested directly in Node with no DOM involved.
--------------------------------------------------------------------- */

(function (global) {
  'use strict';

  function makeDir() { return { type: 'dir', children: {} }; }
  function makeFile(content) { return { type: 'file', content: content || '' }; }

  function defaultFS() {
    const fs = makeDir();
    fs.children.home = makeDir();
    fs.children.home.children.user = makeDir();
    const user = fs.children.home.children.user;
    user.children['notes.txt'] = makeFile('Buy milk\nCall Sam\nFinish the report\n');
    user.children['todo.txt'] = makeFile('Write tests\nShip it\n');
    user.children.projects = makeDir();
    return fs;
  }

  function newState(fsOverride) {
    return { fs: fsOverride || defaultFS(), cwd: ['home', 'user'], vars: {} };
  }

  /* ------------------------------ path helpers ------------------------------ */

  function normalize(parts) {
    const out = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') { if (out.length) out.pop(); continue; }
      out.push(p);
    }
    return out;
  }

  function resolvePath(state, pathStr) {
    if (!pathStr || pathStr === '~') return ['home', 'user'];
    let parts;
    if (pathStr.startsWith('/')) parts = pathStr.split('/');
    else if (pathStr.startsWith('~/')) parts = ['home', 'user', ...pathStr.slice(2).split('/')];
    else parts = [...state.cwd, ...pathStr.split('/')];
    return normalize(parts);
  }

  function getNode(state, parts) {
    let node = state.fs;
    for (const p of parts) {
      if (!node || node.type !== 'dir' || !node.children[p]) return null;
      node = node.children[p];
    }
    return node;
  }

  function getParentAndName(state, pathStr) {
    const parts = resolvePath(state, pathStr);
    const name = parts[parts.length - 1];
    const parent = getNode(state, parts.slice(0, -1));
    return { parent, name, parts };
  }

  function pathString(parts) {
    return '/' + parts.join('/');
  }

  /* ------------------------------ tokenizing ------------------------------ */

  // Splits a line into tokens, respecting single/double quotes. Records
  // whether each token was single-quoted (no var expansion applies to it).
  function tokenize(line) {
    const tokens = [];
    let cur = '';
    let curQuoted = null; // null | 'single' | 'double'
    let inSingle = false, inDouble = false;
    let started = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inSingle) {
        if (c === "'") { inSingle = false; } else { cur += c; }
        continue;
      }
      if (inDouble) {
        if (c === '"') { inDouble = false; } else { cur += c; }
        continue;
      }
      if (c === "'") { inSingle = true; curQuoted = curQuoted || 'single'; started = true; continue; }
      if (c === '"') { inDouble = true; curQuoted = curQuoted === 'single' ? 'single' : 'double'; started = true; continue; }
      if (c === ' ' || c === '\t') {
        if (started) { tokens.push({ text: cur, quoted: curQuoted }); cur = ''; curQuoted = null; started = false; }
        continue;
      }
      cur += c;
      started = true;
    }
    if (started) tokens.push({ text: cur, quoted: curQuoted });
    return tokens;
  }

  function expandVars(text, vars) {
    return text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, a, b) => {
      const name = a || b;
      return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : '';
    });
  }

  /* ------------------------------ splitting a line ------------------------------ */

  // Splits on top-level ; && || (not inside quotes), preserving the operator
  // that precedes each segment so we can apply short-circuit logic.
  function splitSequence(line) {
    const parts = [];
    let cur = '';
    let inSingle = false, inDouble = false;
    let op = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const c2 = line[i + 1];
      if (inSingle) { cur += c; if (c === "'") inSingle = false; continue; }
      if (inDouble) { cur += c; if (c === '"') inDouble = false; continue; }
      if (c === "'") { inSingle = true; cur += c; continue; }
      if (c === '"') { inDouble = true; cur += c; continue; }
      if (c === '&' && c2 === '&') { parts.push({ op, text: cur }); op = '&&'; cur = ''; i++; continue; }
      if (c === '|' && c2 === '|') { parts.push({ op, text: cur }); op = '||'; cur = ''; i++; continue; }
      if (c === ';') { parts.push({ op, text: cur }); op = ';'; cur = ''; continue; }
      cur += c;
    }
    parts.push({ op, text: cur });
    return parts.filter((p) => p.text.trim() !== '');
  }

  // Splits a single segment on top-level pipes (not inside quotes).
  function splitPipes(text) {
    const parts = [];
    let cur = '';
    let inSingle = false, inDouble = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inSingle) { cur += c; if (c === "'") inSingle = false; continue; }
      if (inDouble) { cur += c; if (c === '"') inDouble = false; continue; }
      if (c === "'") { inSingle = true; cur += c; continue; }
      if (c === '"') { inDouble = true; cur += c; continue; }
      if (c === '|') { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts.map((s) => s.trim()).filter(Boolean);
  }

  /* ------------------------------ commands ------------------------------ */

  function fmtLs(node, showAll) {
    const names = Object.keys(node.children).sort();
    return names
      .filter((n) => showAll || !n.startsWith('.'))
      .map((n) => (node.children[n].type === 'dir' ? n + '/' : n))
      .join('  ');
  }

  const COMMANDS = {
    pwd(args, stdin, state) {
      return { stdout: pathString(state.cwd) + '\n', exitCode: 0 };
    },
    cd(args, stdin, state) {
      const target = args[0] || '~';
      const parts = resolvePath(state, target);
      const node = parts.length === 0 ? state.fs : getNode(state, parts);
      if (!node || node.type !== 'dir') return { stderr: `cd: ${target}: No such directory\n`, exitCode: 1 };
      state.cwd = parts;
      return { stdout: '', exitCode: 0 };
    },
    ls(args, stdin, state) {
      const showAll = args.includes('-a');
      const pathArgs = args.filter((a) => !a.startsWith('-'));
      const parts = pathArgs.length ? resolvePath(state, pathArgs[0]) : state.cwd;
      const node = parts.length === 0 ? state.fs : getNode(state, parts);
      if (!node) return { stderr: `ls: cannot access '${pathArgs[0]}': No such file or directory\n`, exitCode: 1 };
      if (node.type === 'file') return { stdout: pathArgs[0] + '\n', exitCode: 0 };
      const listing = fmtLs(node, showAll);
      return { stdout: listing ? listing + '\n' : '', exitCode: 0 };
    },
    mkdir(args, stdin, state) {
      const recursive = args.includes('-p');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (!targets.length) return { stderr: 'mkdir: missing operand\n', exitCode: 1 };
      let stderr = '';
      for (const t of targets) {
        const parts = resolvePath(state, t);
        if (recursive) {
          let node = state.fs;
          for (const p of parts) {
            if (!node.children[p]) node.children[p] = makeDir();
            if (node.children[p].type !== 'dir') { stderr += `mkdir: '${t}': not a directory\n`; node = null; break; }
            node = node.children[p];
          }
        } else {
          const { parent, name } = getParentAndName(state, t);
          if (!parent || parent.type !== 'dir') { stderr += `mkdir: cannot create directory '${t}': No such file or directory\n`; continue; }
          if (parent.children[name]) { stderr += `mkdir: cannot create directory '${t}': File exists\n`; continue; }
          parent.children[name] = makeDir();
        }
      }
      return { stderr, exitCode: stderr ? 1 : 0 };
    },
    touch(args, stdin, state) {
      if (!args.length) return { stderr: 'touch: missing operand\n', exitCode: 1 };
      let stderr = '';
      for (const t of args) {
        const { parent, name } = getParentAndName(state, t);
        if (!parent || parent.type !== 'dir') { stderr += `touch: cannot touch '${t}': No such file or directory\n`; continue; }
        if (!parent.children[name]) parent.children[name] = makeFile('');
      }
      return { stderr, exitCode: stderr ? 1 : 0 };
    },
    cat(args, stdin, state) {
      if (!args.length) return { stdout: stdin || '', exitCode: 0 };
      let out = '', stderr = '';
      for (const a of args) {
        const parts = resolvePath(state, a);
        const node = getNode(state, parts);
        if (!node) { stderr += `cat: ${a}: No such file or directory\n`; continue; }
        if (node.type === 'dir') { stderr += `cat: ${a}: Is a directory\n`; continue; }
        out += node.content;
      }
      return { stdout: out, stderr, exitCode: stderr ? 1 : 0 };
    },
    echo(args, stdin, state) {
      let noNewline = false;
      const parts = args.filter((a) => {
        if (a === '-n') { noNewline = true; return false; }
        return true;
      });
      return { stdout: parts.join(' ') + (noNewline ? '' : '\n'), exitCode: 0 };
    },
    rm(args, stdin, state) {
      const recursive = args.includes('-r');
      const force = args.includes('-f');
      const targets = args.filter((a) => !a.startsWith('-'));
      let stderr = '';
      for (const t of targets) {
        const { parent, name } = getParentAndName(state, t);
        if (!parent || !parent.children[name]) { if (!force) stderr += `rm: cannot remove '${t}': No such file or directory\n`; continue; }
        if (parent.children[name].type === 'dir' && !recursive) { stderr += `rm: cannot remove '${t}': Is a directory\n`; continue; }
        delete parent.children[name];
      }
      return { stderr, exitCode: stderr ? 1 : 0 };
    },
    cp(args, stdin, state) {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length < 2) return { stderr: 'cp: missing destination file operand\n', exitCode: 1 };
      const [src, dest] = targets;
      const srcNode = getNode(state, resolvePath(state, src));
      if (!srcNode) return { stderr: `cp: cannot stat '${src}': No such file or directory\n`, exitCode: 1 };
      const { parent, name } = getParentAndName(state, dest);
      if (!parent) return { stderr: `cp: cannot create '${dest}'\n`, exitCode: 1 };
      const destExistingDir = parent.children[name] && parent.children[name].type === 'dir';
      const targetParent = destExistingDir ? parent.children[name] : parent;
      const targetName = destExistingDir ? src.split('/').pop() : name;
      targetParent.children[targetName] = JSON.parse(JSON.stringify(srcNode));
      return { stdout: '', exitCode: 0 };
    },
    mv(args, stdin, state) {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length < 2) return { stderr: 'mv: missing destination file operand\n', exitCode: 1 };
      const [src, dest] = targets;
      const { parent: srcParent, name: srcName } = getParentAndName(state, src);
      if (!srcParent || !srcParent.children[srcName]) return { stderr: `mv: cannot stat '${src}': No such file or directory\n`, exitCode: 1 };
      const { parent, name } = getParentAndName(state, dest);
      if (!parent) return { stderr: `mv: cannot move to '${dest}'\n`, exitCode: 1 };
      const destExistingDir = parent.children[name] && parent.children[name].type === 'dir';
      const targetParent = destExistingDir ? parent.children[name] : parent;
      const targetName = destExistingDir ? srcName : name;
      targetParent.children[targetName] = srcParent.children[srcName];
      delete srcParent.children[srcName];
      return { stdout: '', exitCode: 0 };
    },
    grep(args, stdin, state) {
      const ignoreCase = args.includes('-i');
      const showLineNo = args.includes('-n');
      const rest = args.filter((a) => !a.startsWith('-'));
      const pattern = rest[0];
      if (pattern === undefined) return { stderr: 'grep: missing pattern\n', exitCode: 2 };
      let text;
      if (rest[1]) {
        const node = getNode(state, resolvePath(state, rest[1]));
        if (!node || node.type !== 'file') return { stderr: `grep: ${rest[1]}: No such file or directory\n`, exitCode: 2 };
        text = node.content;
      } else {
        text = stdin || '';
      }
      const lines = text.split('\n');
      if (lines.length && lines[lines.length - 1] === '') lines.pop();
      const needle = ignoreCase ? pattern.toLowerCase() : pattern;
      const matches = [];
      lines.forEach((line, i) => {
        const hay = ignoreCase ? line.toLowerCase() : line;
        if (hay.includes(needle)) matches.push(showLineNo ? `${i + 1}:${line}` : line);
      });
      return { stdout: matches.length ? matches.join('\n') + '\n' : '', exitCode: matches.length ? 0 : 1 };
    },
    wc(args, stdin, state) {
      const rest = args.filter((a) => !a.startsWith('-'));
      let text;
      if (rest[0]) {
        const node = getNode(state, resolvePath(state, rest[0]));
        if (!node || node.type !== 'file') return { stderr: `wc: ${rest[0]}: No such file or directory\n`, exitCode: 1 };
        text = node.content;
      } else {
        text = stdin || '';
      }
      const lines = text === '' ? 0 : text.split('\n').filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === '')).length;
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      const chars = text.length;
      if (args.includes('-l')) return { stdout: `${lines}\n`, exitCode: 0 };
      if (args.includes('-w')) return { stdout: `${words}\n`, exitCode: 0 };
      if (args.includes('-c')) return { stdout: `${chars}\n`, exitCode: 0 };
      return { stdout: `${lines} ${words} ${chars}\n`, exitCode: 0 };
    },
    head(args, stdin, state) {
      return headTail(args, stdin, state, true);
    },
    tail(args, stdin, state) {
      return headTail(args, stdin, state, false);
    },
    true() { return { exitCode: 0 }; },
    false() { return { exitCode: 1 }; },
    export(args, stdin, state) {
      return assignVar(args.join(' '), state);
    },
  };

  function headTail(args, stdin, state, isHead) {
    let n = 10;
    const nIdx = args.indexOf('-n');
    if (nIdx !== -1 && args[nIdx + 1]) n = parseInt(args[nIdx + 1], 10);
    const rest = args.filter((a, i) => a !== '-n' && i !== nIdx + 1 && !a.startsWith('-'));
    let text;
    if (rest[0]) {
      const node = getNode(state, resolvePath(state, rest[0]));
      if (!node || node.type !== 'file') return { stderr: `${isHead ? 'head' : 'tail'}: ${rest[0]}: No such file or directory\n`, exitCode: 1 };
      text = node.content;
    } else {
      text = stdin || '';
    }
    let lines = text.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines = isHead ? lines.slice(0, n) : lines.slice(-n);
    return { stdout: lines.length ? lines.join('\n') + '\n' : '', exitCode: 0 };
  }

  function assignVar(text, state) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(text);
    if (!m) return null;
    state.vars[m[1]] = expandVars(stripQuotesForAssign(m[2]), state.vars);
    return { stdout: '', exitCode: 0 };
  }

  function stripQuotesForAssign(v) {
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }

  /* ------------------------------ execution ------------------------------ */

  function runSingleCommand(text, stdin, state) {
    const trimmed = text.trim();
    if (trimmed === '') return { stdout: '', exitCode: 0 };

    const assignment = assignVar(trimmed, state);
    if (assignment && !trimmed.includes(' ')) return assignment;

    const tokens = tokenize(trimmed);
    const expanded = tokens
      .map((t) => (t.quoted === 'single' ? t.text : expandVars(t.text, state.vars)))
      .flatMap((tok) => (/^-[A-Za-z]{2,}$/.test(tok) ? tok.slice(1).split('').map((c) => '-' + c) : [tok]));
    const [cmd, ...args] = expanded;
    if (!cmd) return { stdout: '', exitCode: 0 };
    const fn = COMMANDS[cmd];
    if (!fn) return { stderr: `${cmd}: command not found\n`, exitCode: 127 };
    try {
      const res = fn(args, stdin, state);
      return { stdout: res.stdout || '', stderr: res.stderr || '', exitCode: res.exitCode === undefined ? 0 : res.exitCode };
    } catch (e) {
      return { stderr: `${cmd}: ${e.message}\n`, exitCode: 1 };
    }
  }

  // Runs one pipeline (commands joined by |), handling redirects on the last stage.
  function runPipeline(segment, state) {
    const stages = splitPipes(segment);
    let stdin = '';
    let result = { stdout: '', stderr: '', exitCode: 0 };
    for (let i = 0; i < stages.length; i++) {
      let stage = stages[i];
      let redirect = null;
      const appendMatch = stage.match(/^(.*?)>>\s*(\S+)\s*$/);
      const overwriteMatch = !appendMatch && stage.match(/^(.*?)>\s*(\S+)\s*$/);
      if (appendMatch) { stage = appendMatch[1]; redirect = { file: appendMatch[2], append: true }; }
      else if (overwriteMatch) { stage = overwriteMatch[1]; redirect = { file: overwriteMatch[2], append: false }; }

      result = runSingleCommand(stage, stdin, state);
      stdin = result.stdout;

      if (redirect) {
        const { parent, name } = getParentAndName(state, redirect.file);
        if (parent && parent.type === 'dir') {
          const existing = parent.children[name];
          const prior = redirect.append && existing && existing.type === 'file' ? existing.content : '';
          parent.children[name] = makeFile(prior + result.stdout);
        }
        result = { stdout: '', stderr: result.stderr, exitCode: result.exitCode };
        stdin = '';
      }
    }
    return result;
  }

  // Runs a full line (possibly with ; && ||), returning combined stdout/stderr/exitCode.
  function runLine(line, state) {
    const segments = splitSequence(line);
    let stdout = '', stderr = '', exitCode = 0;
    for (const seg of segments) {
      if (seg.op === '&&' && exitCode !== 0) continue;
      if (seg.op === '||' && exitCode === 0) continue;
      const res = runPipeline(seg.text, state);
      stdout += res.stdout || '';
      stderr += res.stderr || '';
      exitCode = res.exitCode;
    }
    return { stdout, stderr, exitCode };
  }

  // Runs a multi-line script against state, returning a transcript array:
  // [{ command, stdout, stderr, exitCode }, ...] — one entry per non-empty line.
  function runScript(script, state) {
    const lines = script.split('\n');
    const transcript = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) continue;
      const res = runLine(line, state);
      transcript.push({ command: line, stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode });
    }
    return transcript;
  }

  global.ShellSim = { newState, defaultFS, runScript, runLine, pathString, resolvePath, getNode };
})(typeof window !== 'undefined' ? window : globalThis);
