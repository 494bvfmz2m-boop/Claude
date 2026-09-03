/* ---------------------------------------------------------------------
   Learning site engine: router, progress tracking, lesson rendering,
   quiz checking, and the HTML/CSS/JS + SQL playgrounds.
   Content itself lives in assets/js/content/*.js (window.COURSE.<topic>).
--------------------------------------------------------------------- */

const TOPIC_ORDER = ['html', 'css', 'javascript', 'json', 'sql', 'php', 'capstone'];
const PROGRESS_KEY = 'wds-progress-v1';

const DIFFICULTY_META = {
  basic: { label: 'Basic', dot: '#00b894' },
  medium: { label: 'Medium', dot: '#0984e3' },
  pro: { label: 'Pro', dot: '#6c5ce7' },
  hell: { label: 'Hell', dot: '#d63031' },
};
function difficultyMeta(tier) {
  return DIFFICULTY_META[tier] || null;
}
const TIER_DESCRIPTIONS = {
  basic: 'foundations — new concepts, gentle pace.',
  medium: 'builds on basics — you should be comfortable, not necessarily fast.',
  pro: 'real-world technique — the stuff that separates "knows the tags" from "can build things".',
  hell: 'genuinely hard, edge-case-heavy, or a big synthesis challenge. Expect to re-read.',
};

const app = document.getElementById('app');

/* -------------------------------- auth --------------------------------
   Client-side only "keep casual visitors out" gate — the password lives in
   this file, so it's not real security, just a soft lock on a personal site.
------------------------------------------------------------------------- */

const SITE_PASSWORD = 'Pippa2025!';
const UNLOCK_KEY = 'wds-unlocked';

function isUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === 'yes';
}

function showLockScreen() {
  document.querySelector('.layout').style.display = 'none';
  const lockScreen = document.getElementById('lock-screen');
  lockScreen.style.display = 'flex';

  const form = document.getElementById('lock-form');
  const input = document.getElementById('lock-password');
  const error = document.getElementById('lock-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value === SITE_PASSWORD) {
      localStorage.setItem(UNLOCK_KEY, 'yes');
      lockScreen.style.display = 'none';
      document.querySelector('.layout').style.display = '';
      initApp();
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  });
}

function lockSite() {
  localStorage.removeItem(UNLOCK_KEY);
  location.reload();
}

document.getElementById('lock-btn').addEventListener('click', lockSite);

/* ----------------------------- progress ------------------------------ */

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(p) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

function isComplete(lessonId) {
  return !!loadProgress()[lessonId];
}

function setComplete(lessonId, value) {
  const p = loadProgress();
  if (value) p[lessonId] = true;
  else delete p[lessonId];
  saveProgress(p);
}

function topicProgress(topicId) {
  const topic = window.COURSE[topicId];
  const p = loadProgress();
  const done = topic.lessons.filter((l) => p[l.id]).length;
  return { done, total: topic.lessons.length };
}

function overallProgress() {
  let done = 0, total = 0;
  TOPIC_ORDER.forEach((t) => {
    const { done: d, total: n } = topicProgress(t);
    done += d; total += n;
  });
  return { done, total };
}

/* ------------------------------ router -------------------------------- */

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash || hash === 'home') return { view: 'home' };
  const [topic, idxStr] = hash.split('/');
  if (!window.COURSE[topic]) return { view: 'home' };
  const idx = parseInt(idxStr, 10);
  if (Number.isNaN(idx) || idx < 0 || idx >= window.COURSE[topic].lessons.length) {
    return { view: 'lesson', topic, idx: 0 };
  }
  return { view: 'lesson', topic, idx };
}

window.addEventListener('hashchange', () => { if (isUnlocked()) render(); });
window.addEventListener('DOMContentLoaded', () => {
  if (isUnlocked()) {
    initApp();
  } else {
    showLockScreen();
  }
});

function navigate(hash) {
  location.hash = hash;
}

function initApp() {
  renderSidebar();
  render();
}

/* ------------------------------ sidebar -------------------------------- */

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  const homeLink = document.createElement('a');
  homeLink.href = '#/home';
  homeLink.className = 'nav-home';
  homeLink.textContent = '🏠 Overview';
  nav.appendChild(homeLink);

  TOPIC_ORDER.forEach((topicId) => {
    const topic = window.COURSE[topicId];
    if (!topic) return;
    const { done, total } = topicProgress(topicId);

    const group = document.createElement('div');
    group.className = 'nav-group';

    const heading = document.createElement('div');
    heading.className = 'nav-group-title';
    heading.innerHTML = `<span>${topic.icon} ${escapeHtml(topic.title)}</span><span class="nav-count">${done}/${total}</span>`;
    group.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'nav-lessons';
    let lastTier = null;
    topic.lessons.forEach((lesson, i) => {
      if (lesson.difficulty && lesson.difficulty !== lastTier) {
        lastTier = lesson.difficulty;
        const meta = difficultyMeta(lastTier);
        const tierHeader = document.createElement('div');
        tierHeader.className = 'nav-tier';
        tierHeader.innerHTML = `<span class="tier-dot" style="background:${meta.dot}"></span>${meta.label}`;
        list.appendChild(tierHeader);
      }
      const a = document.createElement('a');
      a.href = `#/${topicId}/${i}`;
      a.className = 'nav-lesson';
      a.dataset.topic = topicId;
      a.dataset.idx = i;
      a.innerHTML = `<span class="tick">${isComplete(lesson.id) ? '✅' : '⬜'}</span> ${escapeHtml(lesson.title)}`;
      list.appendChild(a);
    });
    group.appendChild(list);
    nav.appendChild(group);
  });
}

function markActiveNav(topic, idx) {
  document.querySelectorAll('.nav-lesson, .nav-home').forEach((el) => el.classList.remove('active'));
  if (!topic) {
    document.querySelector('.nav-home').classList.add('active');
    return;
  }
  const el = document.querySelector(`.nav-lesson[data-topic="${topic}"][data-idx="${idx}"]`);
  if (el) el.classList.add('active');
}

/* -------------------------------- render -------------------------------- */

function render() {
  const route = parseHash();
  if (route.view === 'home') {
    renderHome();
    markActiveNav(null);
  } else {
    renderLesson(route.topic, route.idx);
    markActiveNav(route.topic, route.idx);
  }
  window.scrollTo(0, 0);
}

function renderHome() {
  const { done, total } = overallProgress();
  const pct = total ? Math.round((done / total) * 100) : 0;

  const cards = TOPIC_ORDER.map((topicId) => {
    const topic = window.COURSE[topicId];
    if (!topic) return '';
    const { done, total } = topicProgress(topicId);
    const p = total ? Math.round((done / total) * 100) : 0;
    const firstIdx = 0;
    return `
      <a class="topic-card" href="#/${topicId}/${firstIdx}">
        <div class="topic-card-icon">${topic.icon}</div>
        <h3>${escapeHtml(topic.title)}</h3>
        <p>${escapeHtml(topic.description)}</p>
        <div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div>
        <div class="topic-card-meta">${done}/${total} lessons · ${p}%</div>
      </a>`;
  }).join('');

  app.innerHTML = `
    <div class="home">
      <h1>Learn to Build a Website 🚀</h1>
      <p class="lede">
        A hands-on course covering the six things that power almost every website:
        <strong>HTML</strong>, <strong>CSS</strong>, <strong>JavaScript</strong>, <strong>JSON</strong>,
        <strong>SQL</strong>, and <strong>PHP</strong>. Every lesson has a short explanation, a real
        example, and something for you to try &mdash; right in the browser.
      </p>

      <div class="overall-progress">
        <div class="overall-progress-text">Overall progress: ${done}/${total} lessons (${pct}%)</div>
        <div class="progress-bar large"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>

      <div class="tier-legend">
        ${Object.entries(DIFFICULTY_META).map(([key, meta]) => `
          <div class="tier-legend-item">
            <span class="tier-dot" style="background:${meta.dot}"></span>
            <strong>${meta.label}</strong> — ${TIER_DESCRIPTIONS[key]}
          </div>`).join('')}
      </div>

      <div class="topic-grid">${cards}</div>

      <div class="home-footer-note">
        <h3>How the pieces fit together</h3>
        <p>
          <strong>HTML</strong> gives a page structure, <strong>CSS</strong> makes it look good, and
          <strong>JavaScript</strong> makes it interactive &mdash; that's the "front end", running in the
          visitor's browser. <strong>PHP</strong> runs on the server to generate pages, handle form
          submissions, and talk to a <strong>SQL</strong> database where the site's data lives.
          <strong>JSON</strong> is the common language all of these use to pass data back and forth.
          The final "How It All Fits Together" lesson ties it into one example.
        </p>
      </div>
    </div>`;
}

function renderLesson(topicId, idx) {
  const topic = window.COURSE[topicId];
  const lesson = topic.lessons[idx];
  const total = topic.lessons.length;
  const complete = isComplete(lesson.id);

  const wrapper = document.createElement('div');
  wrapper.className = 'lesson';

  const tierMeta = difficultyMeta(lesson.difficulty);
  const badge = tierMeta ? `<span class="badge" style="background:${tierMeta.dot}22;color:${tierMeta.dot};border-color:${tierMeta.dot}55">${tierMeta.label}</span>` : '';

  wrapper.innerHTML = `
    <div class="lesson-header">
      <div class="crumb">${topic.icon} ${escapeHtml(topic.title)} &nbsp;/&nbsp; Lesson ${idx + 1} of ${total} ${badge}</div>
      <h1>${escapeHtml(lesson.title)}</h1>
    </div>
    <div class="lesson-body" id="lesson-body"></div>
    <div class="quiz-section" id="quiz-section"></div>
    <div class="lesson-footer">
      <button class="btn ${complete ? 'btn-secondary' : 'btn-primary'}" id="complete-btn">
        ${complete ? '✅ Completed — click to unmark' : 'Mark lesson complete'}
      </button>
      <div class="lesson-nav">
        ${idx > 0 ? `<a class="btn btn-secondary" href="#/${topicId}/${idx - 1}">&larr; Previous</a>` : '<span></span>'}
        ${idx < total - 1
          ? `<a class="btn btn-primary" href="#/${topicId}/${idx + 1}">Next &rarr;</a>`
          : nextTopicLink(topicId)}
      </div>
    </div>`;

  app.innerHTML = '';
  app.appendChild(wrapper);

  const body = document.getElementById('lesson-body');
  lesson.blocks.forEach((block) => body.appendChild(renderBlock(block, lesson.id)));

  if (lesson.quiz && lesson.quiz.length) {
    document.getElementById('quiz-section').appendChild(renderQuiz(lesson));
  }

  document.getElementById('complete-btn').addEventListener('click', () => {
    setComplete(lesson.id, !isComplete(lesson.id));
    renderSidebar();
    renderLesson(topicId, idx);
    markActiveNav(topicId, idx);
  });
}

function nextTopicLink(topicId) {
  const pos = TOPIC_ORDER.indexOf(topicId);
  const nextTopic = TOPIC_ORDER.slice(pos + 1).find((t) => window.COURSE[t]);
  if (nextTopic) {
    return `<a class="btn btn-primary" href="#/${nextTopic}/0">Next: ${window.COURSE[nextTopic].title} &rarr;</a>`;
  }
  return `<a class="btn btn-primary" href="#/home">🎉 Back to overview</a>`;
}

/* ------------------------------ blocks -------------------------------- */

let blockCounter = 0;
function uid(prefix) {
  blockCounter += 1;
  return `${prefix}-${blockCounter}`;
}

function renderBlock(block, lessonId) {
  switch (block.type) {
    case 'text': return renderText(block);
    case 'note': return renderNote(block);
    case 'code': return renderCode(block);
    case 'web': return renderWebPlayground(block);
    case 'sql': return renderSqlPlayground(block, lessonId);
    case 'predict': return renderPredict(block);
    case 'jsontool': return renderJsonTool(block);
    default: {
      const div = document.createElement('div');
      div.textContent = `Unknown block type: ${block.type}`;
      return div;
    }
  }
}

function renderText(block) {
  const div = document.createElement('div');
  div.className = 'block block-text';
  div.innerHTML = block.html;
  return div;
}

function renderNote(block) {
  const div = document.createElement('div');
  div.className = `block note note-${block.kind || 'tip'}`;
  const label = { tip: '💡 Tip', warning: '⚠️ Watch out', info: 'ℹ️ Note' }[block.kind || 'tip'];
  div.innerHTML = `<div class="note-label">${label}</div><div>${block.html}</div>`;
  return div;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function renderCode(block) {
  const div = document.createElement('div');
  div.className = 'block block-code';
  div.innerHTML = `${block.caption ? `<div class="code-caption">${escapeHtml(block.caption)}</div>` : ''}
    <pre class="code-block"><code class="lang-${block.lang}">${escapeHtml(block.code)}</code></pre>`;
  return div;
}

/* -------------------------- web playground ----------------------------- */

function renderWebPlayground(block) {
  const id = uid('web');
  const tabs = ['html', 'css', 'js'].filter((t) => block.starter[t] !== undefined);

  const div = document.createElement('div');
  div.className = 'block playground';
  div.innerHTML = `
    ${block.task ? `<div class="playground-task"><strong>Try it:</strong> ${block.task}</div>` : ''}
    <div class="playground-editor" id="${id}">
      <div class="tabs">
        ${tabs.map((t, i) => `<button type="button" class="tab-btn ${i === 0 ? 'active' : ''}" data-tab="${t}">${t.toUpperCase()}</button>`).join('')}
      </div>
      <div class="tab-panels">
        ${tabs.map((t, i) => `<textarea class="tab-panel code-input ${i === 0 ? 'active' : ''}" data-tab="${t}" spellcheck="false">${escapeHtml(block.starter[t] || '')}</textarea>`).join('')}
      </div>
      <div class="playground-actions">
        <button type="button" class="btn btn-primary run-btn">▶ Run</button>
        <button type="button" class="btn btn-secondary reset-btn">↺ Reset</button>
      </div>
      <iframe class="playground-preview" sandbox="allow-scripts allow-forms" title="preview"></iframe>
    </div>`;

  const root = div.querySelector(`#${id}`);
  const tabBtns = root.querySelectorAll('.tab-btn');
  const panels = root.querySelectorAll('.tab-panel');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      root.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`).classList.add('active');
    });
  });

  const iframe = root.querySelector('iframe');
  function run() {
    const get = (t) => {
      const el = root.querySelector(`.tab-panel[data-tab="${t}"]`);
      return el ? el.value : '';
    };
    const html = get('html');
    const css = get('css');
    const js = get('js');
    const srcdoc = `<!doctype html><html><head><style>${css}</style></head><body>${html}
      <script>
        window.onerror = function(msg){ document.body.insertAdjacentHTML('beforeend', '<pre style="color:#c0392b;background:#fdecea;padding:8px;border-radius:6px;margin-top:8px;">JS error: ' + msg + '</pre>'); };
        document.addEventListener('submit', function(ev){
          ev.preventDefault();
          var note = document.createElement('div');
          note.style.cssText = 'margin-top:8px;padding:8px 12px;background:#eef7ff;border-radius:6px;font-family:sans-serif;font-size:13px;color:#0984e3;';
          note.textContent = '✅ Form submitted! (Actually sending it is disabled in this playground — in a real app this would go to a server.)';
          ev.target.insertAdjacentElement('afterend', note);
        });
      <\/script>
      <script>${js}<\/script>
      </body></html>`;
    iframe.srcdoc = srcdoc;
  }
  root.querySelector('.run-btn').addEventListener('click', run);
  root.querySelector('.reset-btn').addEventListener('click', () => {
    tabs.forEach((t) => {
      root.querySelector(`.tab-panel[data-tab="${t}"]`).value = block.starter[t] || '';
    });
    run();
  });

  setTimeout(run, 0);
  return div;
}

/* --------------------------- sql playground ----------------------------- */

let sqlJsPromise = null;
function loadSqlJs() {
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/sql-wasm.js';
    script.onload = () => {
      window.initSqlJs({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/${file}`,
      }).then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error('Could not load sql.js from CDN. Check your internet connection.'));
    document.head.appendChild(script);
  });
  return sqlJsPromise;
}

const SQL_SEED = `
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS authors;
DROP TABLE IF EXISTS members;

CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT
);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author_id INTEGER,
  genre TEXT,
  price REAL,
  published_year INTEGER,
  FOREIGN KEY (author_id) REFERENCES authors(id)
);

CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  joined_year INTEGER
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY,
  book_id INTEGER,
  member_id INTEGER,
  loan_date TEXT,
  return_date TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

INSERT INTO authors (id, name, country) VALUES
 (1, 'Octavia Butler', 'USA'),
 (2, 'Haruki Murakami', 'Japan'),
 (3, 'Chimamanda Ngozi Adichie', 'Nigeria'),
 (4, 'Andrzej Sapkowski', 'Poland'),
 (5, 'Ursula K. Le Guin', 'USA');

INSERT INTO books (id, title, author_id, genre, price, published_year) VALUES
 (1, 'Kindred', 1, 'Sci-Fi', 12.99, 1979),
 (2, 'Parable of the Sower', 1, 'Sci-Fi', 14.50, 1993),
 (3, 'Norwegian Wood', 2, 'Fiction', 11.00, 1987),
 (4, 'Kafka on the Shore', 2, 'Fiction', 13.25, 2002),
 (5, 'Half of a Yellow Sun', 3, 'Historical', 10.75, 2006),
 (6, 'Americanah', 3, 'Fiction', 15.00, 2013),
 (7, 'The Last Wish', 4, 'Fantasy', 9.99, 1993),
 (8, 'The Left Hand of Darkness', 5, 'Sci-Fi', 12.00, 1969),
 (9, 'A Wizard of Earthsea', 5, 'Fantasy', 8.50, 1968);

INSERT INTO members (id, name, email, joined_year) VALUES
 (1, 'Ada', 'ada@example.com', 2020),
 (2, 'Grace', 'grace@example.com', 2021),
 (3, 'Alan', 'alan@example.com', 2019),
 (4, 'Margaret', 'margaret@example.com', 2022);

INSERT INTO loans (id, book_id, member_id, loan_date, return_date) VALUES
 (1, 1, 1, '2024-01-05', '2024-01-19'),
 (2, 3, 2, '2024-02-10', NULL),
 (3, 7, 1, '2024-02-15', '2024-03-01'),
 (4, 8, 3, '2024-03-02', NULL),
 (5, 5, 4, '2024-03-20', '2024-04-01'),
 (6, 9, 2, '2024-04-02', NULL);
`;

let dbPromise = null;
function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = loadSqlJs().then((SQL) => {
    const db = new SQL.Database();
    db.run(SQL_SEED);
    return db;
  });
  return dbPromise;
}

function resetDb() {
  return getDb().then((db) => {
    db.run(SQL_SEED);
    return db;
  });
}

function runQueryOnDb(db, sql) {
  try {
    const res = db.exec(sql);
    return { ok: true, result: res };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function resultsToHtml(res) {
  if (!res || res.length === 0) {
    return '<div class="sql-empty">Query ran successfully — no rows returned.</div>';
  }
  return res.map((table) => {
    const head = table.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
    const rows = table.values.map((row) =>
      `<tr>${row.map((v) => `<td>${v === null ? '<em>NULL</em>' : escapeHtml(String(v))}</td>`).join('')}</tr>`
    ).join('');
    return `<table class="sql-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
}

function canonicalRows(db, sql) {
  const res = db.exec(sql);
  if (!res.length) return [];
  return res[0].values.map((row) => JSON.stringify(row));
}

/** Compares a user query's result rows (value tuples, order-independent) against a canonical query. */
function rowsMatch(execResult, db, canonicalSql) {
  if (!execResult.ok) return false;
  const expected = canonicalRows(db, canonicalSql);
  const userRows = execResult.result.length ? execResult.result[0].values.map((row) => JSON.stringify(row)) : [];
  if (userRows.length !== expected.length) return false;
  const a = [...userRows].sort();
  const b = [...expected].sort();
  return a.every((r, i) => r === b[i]);
}
window.rowsMatch = rowsMatch;

function renderSqlPlayground(block, lessonId) {
  const id = uid('sql');
  const div = document.createElement('div');
  div.className = 'block playground sql-playground';
  div.innerHTML = `
    ${block.task ? `<div class="playground-task"><strong>Try it:</strong> ${block.task}</div>` : ''}
    <div id="${id}">
      <textarea class="code-input sql-input" spellcheck="false">${escapeHtml(block.starter || '')}</textarea>
      <div class="playground-actions">
        <button type="button" class="btn btn-primary run-btn">▶ Run Query</button>
        ${block.verify ? '<button type="button" class="btn btn-primary verify-btn">✔ Check My Work</button>' : ''}
        <button type="button" class="btn btn-secondary reset-db-btn">↺ Reset Sample Database</button>
        <span class="sql-status">Loading database engine…</span>
      </div>
      <div class="sql-result"></div>
      <div class="sql-verify-result"></div>
    </div>`;

  const root = div.querySelector(`#${id}`);
  const status = root.querySelector('.sql-status');
  const resultEl = root.querySelector('.sql-result');
  const verifyEl = root.querySelector('.sql-verify-result');
  const input = root.querySelector('.sql-input');

  getDb().then(() => { status.textContent = 'Ready'; status.classList.add('ready'); })
    .catch((e) => { status.textContent = 'Failed to load: ' + e.message; });

  root.querySelector('.run-btn').addEventListener('click', () => {
    resultEl.innerHTML = '<div class="sql-loading">Running…</div>';
    getDb().then((db) => {
      const { ok, result, error } = runQueryOnDb(db, input.value);
      resultEl.innerHTML = ok ? resultsToHtml(result) : `<div class="sql-error">Error: ${escapeHtml(error)}</div>`;
    });
  });

  root.querySelector('.reset-db-btn').addEventListener('click', () => {
    resultEl.innerHTML = '<div class="sql-loading">Resetting…</div>';
    verifyEl.innerHTML = '';
    resetDb().then(() => { resultEl.innerHTML = '<div class="sql-empty">Database reset to its original sample data.</div>'; });
  });

  if (block.verify) {
    root.querySelector('.verify-btn').addEventListener('click', () => {
      getDb().then((db) => {
        const execResult = runQueryOnDb(db, input.value);
        resultEl.innerHTML = execResult.ok ? resultsToHtml(execResult.result) : `<div class="sql-error">Error: ${escapeHtml(execResult.error)}</div>`;
        const outcome = block.verify(db, execResult);
        verifyEl.innerHTML = `<div class="verify-outcome ${outcome.pass ? 'pass' : 'fail'}">
          ${outcome.pass ? '✅' : '❌'} ${outcome.message}
        </div>`;
        if (outcome.pass) setComplete(lessonId, true);
      });
    });
  }

  return div;
}

/* ------------------------------ predict --------------------------------- */

function renderPredict(block) {
  const id = uid('predict');
  const div = document.createElement('div');
  div.className = 'block predict';
  div.innerHTML = `
    <div class="predict-question"><strong>${block.question ? escapeHtml(block.question) : 'What will this code output?'}</strong></div>
    <pre class="code-block"><code class="lang-${block.lang}">${escapeHtml(block.code)}</code></pre>
    <div class="predict-options" id="${id}">
      ${block.options.map((opt, i) => `
        <label class="predict-option">
          <input type="radio" name="${id}" value="${i}">
          <code>${escapeHtml(opt)}</code>
        </label>`).join('')}
    </div>
    <button type="button" class="btn btn-primary predict-check">Check answer</button>
    <div class="predict-result"></div>`;

  const root = div.querySelector(`#${id}`);
  div.querySelector('.predict-check').addEventListener('click', () => {
    const chosen = root.querySelector('input:checked');
    const resultEl = div.querySelector('.predict-result');
    if (!chosen) {
      resultEl.innerHTML = '<div class="verify-outcome fail">Pick an option first.</div>';
      return;
    }
    const correct = parseInt(chosen.value, 10) === block.answer;
    resultEl.innerHTML = `<div class="verify-outcome ${correct ? 'pass' : 'fail'}">
      ${correct ? '✅ Correct!' : `❌ Not quite. The correct output is: <code>${escapeHtml(block.options[block.answer])}</code>`}
      <div class="explain">${escapeHtml(block.explain)}</div>
    </div>`;
  });

  return div;
}

/* ------------------------------ json tool -------------------------------- */

function renderJsonTool(block) {
  const id = uid('json');
  const div = document.createElement('div');
  div.className = 'block playground json-tool';
  div.innerHTML = `
    ${block.task ? `<div class="playground-task"><strong>Try it:</strong> ${block.task}</div>` : ''}
    <div id="${id}">
      <textarea class="code-input json-input" spellcheck="false">${escapeHtml(block.starter || '')}</textarea>
      <div class="playground-actions">
        <button type="button" class="btn btn-primary validate-btn">✔ Validate &amp; Format</button>
        <button type="button" class="btn btn-secondary reset-json-btn">↺ Reset</button>
      </div>
      <div class="json-result"></div>
    </div>`;

  const root = div.querySelector(`#${id}`);
  const input = root.querySelector('.json-input');
  const resultEl = root.querySelector('.json-result');

  function validate() {
    try {
      const parsed = JSON.parse(input.value);
      resultEl.innerHTML = `<div class="verify-outcome pass">✅ Valid JSON!</div>
        <pre class="code-block"><code class="lang-json">${escapeHtml(JSON.stringify(parsed, null, 2))}</code></pre>`;
    } catch (e) {
      resultEl.innerHTML = `<div class="verify-outcome fail">❌ Invalid JSON: ${escapeHtml(e.message)}</div>`;
    }
  }

  root.querySelector('.validate-btn').addEventListener('click', validate);
  root.querySelector('.reset-json-btn').addEventListener('click', () => {
    input.value = block.starter || '';
    resultEl.innerHTML = '';
  });

  return div;
}

/* -------------------------------- quiz ---------------------------------- */

function renderQuiz(lesson) {
  const section = document.createElement('div');
  section.className = 'quiz';
  section.innerHTML = `<h2>Quick Quiz</h2>`;

  lesson.quiz.forEach((q, qi) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'quiz-question';
    qDiv.innerHTML = `
      <div class="quiz-q-text">${qi + 1}. ${escapeHtml(q.q)}</div>
      <div class="quiz-choices">
        ${q.choices.map((c, ci) => `
          <label class="quiz-choice">
            <input type="radio" name="q-${lesson.id}-${qi}" value="${ci}">
            <span>${escapeHtml(c)}</span>
          </label>`).join('')}
      </div>
      <div class="quiz-explain" hidden></div>`;
    section.appendChild(qDiv);
  });

  const checkBtn = document.createElement('button');
  checkBtn.type = 'button';
  checkBtn.className = 'btn btn-primary';
  checkBtn.textContent = 'Check answers';
  const scoreEl = document.createElement('div');
  scoreEl.className = 'quiz-score';
  section.appendChild(checkBtn);
  section.appendChild(scoreEl);

  checkBtn.addEventListener('click', () => {
    let correct = 0;
    const questionDivs = section.querySelectorAll('.quiz-question');
    lesson.quiz.forEach((q, qi) => {
      const qDiv = questionDivs[qi];
      const chosen = qDiv.querySelector('input:checked');
      const explainEl = qDiv.querySelector('.quiz-explain');
      qDiv.querySelectorAll('.quiz-choice').forEach((label, ci) => {
        label.classList.remove('correct', 'incorrect');
        if (ci === q.answer) label.classList.add('correct');
        else if (chosen && parseInt(chosen.value, 10) === ci) label.classList.add('incorrect');
      });
      const isCorrect = chosen && parseInt(chosen.value, 10) === q.answer;
      if (isCorrect) correct += 1;
      explainEl.hidden = false;
      explainEl.innerHTML = `${isCorrect ? '✅' : (chosen ? '❌' : '⚠️ No answer selected.')} ${escapeHtml(q.explain)}`;
    });
    const pct = Math.round((correct / lesson.quiz.length) * 100);
    scoreEl.innerHTML = `Score: ${correct}/${lesson.quiz.length} (${pct}%)`;
    if (pct >= 70 && !isComplete(lesson.id)) {
      setComplete(lesson.id, true);
      renderSidebar();
      const { topic, idx } = parseHash();
      markActiveNav(topic, idx);
      const completeBtn = document.getElementById('complete-btn');
      if (completeBtn) {
        completeBtn.textContent = '✅ Completed — click to unmark';
        completeBtn.classList.remove('btn-primary');
        completeBtn.classList.add('btn-secondary');
      }
    }
  });

  return section;
}
