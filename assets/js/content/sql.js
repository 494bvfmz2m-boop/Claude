window.COURSE = window.COURSE || {};

/* All SQL lessons share one in-browser SQLite database (via sql.js), seeded with a small
   "bookstore" schema: authors, books, members, loans. See engine.js SQL_SEED for the data.
   Changes you make (INSERT/UPDATE/DELETE/CREATE TABLE) persist across lessons until you hit
   "Reset Sample Database". */

window.COURSE.sql = {
  id: 'sql',
  title: 'SQL',
  icon: '🗄️',
  description: 'The language for storing, querying, and managing data in a relational database — run real queries below.',
  lessons: [
    {
      id: 'sql-1',
      title: 'SELECT Basics',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><strong>SQL</strong> (Structured Query Language) talks to a relational database — data
          organized into tables of rows and columns, just like the HTML tables you saw earlier. The
          sample database below has four tables: <code>authors</code>, <code>books</code>,
          <code>members</code>, and <code>loans</code>.</p>
          <p>The most basic query is <code>SELECT columns FROM table;</code>. Use <code>*</code> to
          select every column.</p>
        `},
        { type: 'code', lang: 'sql', code: `SELECT * FROM books;\nSELECT title, price FROM books;` },
        { type: 'sql', task: 'Write a query that selects just the title and price columns from the books table (in that order).', starter: 'SELECT * FROM books;', verify: (db, execResult) => {
          const pass = window.rowsMatch(execResult, db, 'SELECT title, price FROM books;');
          return pass
            ? { pass: true, message: 'Correct — that returns every book\'s title and price.' }
            : { pass: false, message: 'Not quite. Try: SELECT title, price FROM books;' };
        }},
      ],
      quiz: [
        { q: 'What does SELECT * FROM books; return?', choices: ['Only the first row', 'Every column of every row in books', 'Just the table name'], answer: 1, explain: '* means "all columns". Without a WHERE clause, you get every row too.' },
      ],
    },

    {
      id: 'sql-2',
      title: 'Filtering & Sorting',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><code>WHERE</code> filters rows by a condition; <code>ORDER BY</code> sorts the results
          (add <code>DESC</code> for descending, the default is ascending).</p>
        `},
        { type: 'code', lang: 'sql', code:
`SELECT title, price FROM books
WHERE genre = 'Sci-Fi'
ORDER BY price DESC;` },
        { type: 'sql', task: 'Find every book in the "Fantasy" genre, showing title and published_year, ordered from oldest to newest.', starter: "SELECT title, published_year FROM books WHERE genre = 'Fantasy';", verify: (db, execResult) => {
          const pass = window.rowsMatch(execResult, db, "SELECT title, published_year FROM books WHERE genre = 'Fantasy' ORDER BY published_year ASC;");
          return pass
            ? { pass: true, message: 'Correct — two Fantasy books, oldest first.' }
            : { pass: false, message: 'Check your genre spelling/case and add ORDER BY published_year.' };
        }},
      ],
      quiz: [
        { q: 'Which clause sorts results?', choices: ['SORT BY', 'ORDER BY', 'GROUP BY'], answer: 1, explain: 'ORDER BY col [ASC|DESC] controls result order.' },
        { q: 'Which clause filters rows before they\'re returned?', choices: ['WHERE', 'FILTER', 'HAVING'], answer: 0, explain: 'WHERE filters individual rows based on a condition.' },
      ],
    },

    {
      id: 'sql-3',
      title: 'INSERT, UPDATE & DELETE',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>These three statements change data instead of just reading it. They're what a real
          website's "add item", "edit profile", or "delete comment" buttons ultimately run (usually
          triggered from PHP code handling a form submission).</p>
        `},
        { type: 'code', lang: 'sql', code:
`INSERT INTO authors (id, name, country) VALUES (6, 'N. K. Jemisin', 'USA');
UPDATE books SET price = 9.50 WHERE id = 1;
DELETE FROM loans WHERE id = 6;` },
        { type: 'note', kind: 'warning', html: 'Always use a WHERE clause with UPDATE and DELETE unless you really mean "every row" — an UPDATE or DELETE with no WHERE affects the whole table!' },

        { type: 'text', html: '<p><strong>Step 1 — INSERT:</strong> add yourself as a new author (use id 6).</p>' },
        { type: 'sql', task: "Insert a new row into authors with id 6, your name, and your country.", starter: "INSERT INTO authors (id, name, country) VALUES (6, 'Your Name', 'Your Country');", verify: (db) => {
          const res = db.exec('SELECT COUNT(*) FROM authors;');
          const count = res[0].values[0][0];
          return count >= 6
            ? { pass: true, message: `authors now has ${count} rows — insert successful.` }
            : { pass: false, message: `authors still only has ${count} rows. Did the INSERT run without an error?` };
        }},

        { type: 'text', html: '<p><strong>Step 2 — UPDATE:</strong> "The Last Wish" (book id 7) is on sale.</p>' },
        { type: 'sql', task: 'Update the book with id 7 to set its price to 7.99.', starter: 'UPDATE books SET price = 7.99 WHERE id = 7;', verify: (db) => {
          const res = db.exec('SELECT price FROM books WHERE id = 7;');
          const price = res.length ? res[0].values[0][0] : null;
          return price === 7.99
            ? { pass: true, message: 'Price updated to $7.99.' }
            : { pass: false, message: `Book 7's price is currently ${price} — expected 7.99.` };
        }},

        { type: 'text', html: '<p><strong>Step 3 — DELETE:</strong> loan id 3 was a data-entry mistake.</p>' },
        { type: 'sql', task: 'Delete the loan with id 3.', starter: 'DELETE FROM loans WHERE id = 3;', verify: (db) => {
          const res = db.exec('SELECT COUNT(*) FROM loans WHERE id = 3;');
          const count = res[0].values[0][0];
          return count === 0
            ? { pass: true, message: 'Loan 3 is gone.' }
            : { pass: false, message: 'Loan 3 still exists — check your WHERE clause.' };
        }},
      ],
      quiz: [
        { q: 'What happens if you run UPDATE books SET price = 0; with no WHERE clause?', choices: ['Nothing, it\'s ignored', 'Every book\'s price is set to 0', 'It only affects the first row'], answer: 1, explain: 'Without WHERE, UPDATE and DELETE apply to every row in the table — a common costly mistake.' },
      ],
    },

    {
      id: 'sql-4',
      title: 'JOINs',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Data is often split across tables to avoid repetition — <code>books</code> only stores an
          <code>author_id</code>, not the author's full details. A <code>JOIN</code> combines rows from
          two tables based on a matching column.</p>
        `},
        { type: 'code', lang: 'sql', code:
`SELECT books.title, authors.name
FROM books
JOIN authors ON books.author_id = authors.id;` },
        { type: 'sql', task: 'List every loan as the member\'s name and the book title they borrowed, by joining loans → members and loans → books.', starter:
`SELECT members.name, books.title
FROM loans
JOIN members ON loans.member_id = members.id
JOIN books ON loans.book_id = books.id;`, verify: (db, execResult) => {
          const pass = window.rowsMatch(execResult, db,
            `SELECT members.name, books.title FROM loans JOIN members ON loans.member_id = members.id JOIN books ON loans.book_id = books.id;`);
          return pass
            ? { pass: true, message: 'Correct — every loan matched to a member and a book title.' }
            : { pass: false, message: 'Compare your JOIN conditions to the ones shown in the starter query above.' };
        }},
      ],
      quiz: [
        { q: 'Why does the books table store author_id instead of the author\'s full name?', choices: ['It\'s faster to type', 'To avoid repeating author details in every row, and to let a JOIN fetch them when needed', 'SQL requires numeric-only columns'], answer: 1, explain: 'This is "normalization" — one place for author data, referenced by id everywhere else.' },
      ],
    },

    {
      id: 'sql-5',
      title: 'Aggregates & GROUP BY',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>Aggregate functions summarize many rows into one value: <code>COUNT()</code>,
          <code>SUM()</code>, <code>AVG()</code>, <code>MIN()</code>, <code>MAX()</code>.
          <code>GROUP BY</code> runs the aggregate separately for each distinct value of a column.</p>
        `},
        { type: 'code', lang: 'sql', code:
`SELECT genre, COUNT(*) AS how_many, AVG(price) AS avg_price
FROM books
GROUP BY genre;` },
        { type: 'sql', task: 'Find how many books each author (by author_id) has written — select author_id and the count, grouped by author_id.', starter: 'SELECT author_id, COUNT(*) FROM books GROUP BY author_id;', verify: (db, execResult) => {
          const pass = window.rowsMatch(execResult, db, 'SELECT author_id, COUNT(*) FROM books GROUP BY author_id;');
          return pass
            ? { pass: true, message: 'Correct — each author\'s book count.' }
            : { pass: false, message: 'Make sure you GROUP BY author_id and COUNT(*).' };
        }},
      ],
      quiz: [
        { q: 'What does COUNT(*) do?', choices: ['Counts distinct column names', 'Counts the number of rows', 'Adds up numeric values'], answer: 1, explain: 'COUNT(*) counts rows (SUM() is what adds up values).' },
        { q: 'What does GROUP BY genre do to a query with COUNT(*)?', choices: ['Filters out one genre', 'Runs COUNT(*) separately for each distinct genre', 'Sorts by genre alphabetically'], answer: 1, explain: 'GROUP BY buckets rows by the grouped column, then the aggregate runs per bucket.' },
      ],
    },

    {
      id: 'sql-6',
      title: 'Creating Tables',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p><code>CREATE TABLE</code> defines a new table's structure: column names, their data types
          (<code>INTEGER</code>, <code>TEXT</code>, <code>REAL</code>...), and constraints like
          <code>PRIMARY KEY</code> (a unique row identifier) or <code>NOT NULL</code>.</p>
        `},
        { type: 'code', lang: 'sql', code:
`CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  book_id INTEGER,
  rating INTEGER,
  comment TEXT
);` },
        { type: 'sql', task: 'Create a "reviews" table with columns: id (INTEGER PRIMARY KEY), book_id (INTEGER), rating (INTEGER), comment (TEXT).', starter:
`CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  book_id INTEGER,
  rating INTEGER,
  comment TEXT
);`, verify: (db) => {
          try {
            const res = db.exec("PRAGMA table_info(reviews);");
            if (!res.length) return { pass: false, message: 'Table "reviews" was not found — did the CREATE TABLE statement run without error?' };
            const cols = res[0].values.map((r) => String(r[1]).toLowerCase());
            const required = ['id', 'book_id', 'rating', 'comment'];
            const missing = required.filter((c) => !cols.includes(c));
            return missing.length
              ? { pass: false, message: `Missing column(s): ${missing.join(', ')}` }
              : { pass: true, message: 'Table "reviews" created with the right columns!' };
          } catch (e) {
            return { pass: false, message: 'Error checking table: ' + e.message };
          }
        }},
        { type: 'note', kind: 'tip', html: 'Try inserting a review or two into your new table, then SELECT from it, using what you learned in earlier lessons.' },
      ],
      quiz: [
        { q: 'What does PRIMARY KEY do for a column?', choices: ['Makes it required to be text', 'Uniquely identifies each row in the table', 'Automatically sorts the table'], answer: 1, explain: 'A primary key uniquely identifies each row — no two rows can share the same value.' },
      ],
    },

    {
      id: 'sql-7',
      title: 'Subqueries & Multi-Step Challenges',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>A <strong>subquery</strong> is a query nested inside another one — it runs first, and its
          result gets used by the outer query. This is how you answer questions that depend on a
          computed value ("above average") or on absence ("books nobody has ever borrowed"), which a
          single flat <code>WHERE</code> condition can't express.</p>
        `},
        { type: 'code', lang: 'sql', caption: 'A subquery in WHERE', code:
`SELECT title, price
FROM books
WHERE price > (SELECT AVG(price) FROM books);` },
        { type: 'note', kind: 'tip', html: 'The inner query runs once, produces a single value (the average price), and the outer query compares every row against it — as if that value had been typed in by hand.' },
        { type: 'sql', task: 'Find every book priced above the average price of all books (title and price).', starter: 'SELECT title, price FROM books;', verify: (db, execResult) => {
          const pass = window.rowsMatch(execResult, db, 'SELECT title, price FROM books WHERE price > (SELECT AVG(price) FROM books);');
          return pass
            ? { pass: true, message: 'Correct — every book priced above the current average.' }
            : { pass: false, message: 'Use WHERE price > (SELECT AVG(price) FROM books).' };
        }},

        { type: 'text', html: `
          <p>A subquery can also check <strong>membership</strong> with <code>IN</code> or
          <code>NOT IN</code> — useful for finding rows that have <em>no</em> matching row in another
          table, something a JOIN alone can't cleanly express.</p>
        `},
        { type: 'code', lang: 'sql', code:
`SELECT title FROM books
WHERE id NOT IN (SELECT book_id FROM loans);` },
        { type: 'sql', task: 'Find the titles of every book that has never appeared in the loans table.', starter: 'SELECT title FROM books;', verify: (db, execResult) => {
          const pass = window.rowsMatch(execResult, db, 'SELECT title FROM books WHERE id NOT IN (SELECT book_id FROM loans);');
          return pass
            ? { pass: true, message: 'Correct — these books have never been borrowed (based on the loans table\'s current state).' }
            : { pass: false, message: 'Use WHERE id NOT IN (SELECT book_id FROM loans).' };
        }},
        { type: 'note', kind: 'info', html: 'Because this database persists your earlier edits, if you\'ve inserted, updated, or deleted rows in previous lessons, both answers above are checked against the database\'s current state — not the original seed data. That\'s intentional: it\'s exactly how a real database behaves.' },
      ],
      quiz: [
        { q: 'What runs first: the outer query or the subquery inside it?', choices: ['The outer query', 'The subquery — its result feeds into the outer query', 'They run at the exact same time, always'], answer: 1, explain: 'The subquery is evaluated first (conceptually), and its result is used by the query around it.' },
        { q: 'Why is NOT IN (SELECT ...) useful for "books never loaned"?', choices: ['It\'s the only way to filter text in SQL', 'It lets you exclude rows whose id appears anywhere in another table\'s results — expressing absence, which a plain JOIN struggles with', 'NOT IN only works with numbers'], answer: 1, explain: 'NOT IN with a subquery is a direct way to express "has no matching row elsewhere" — a common real-world question.' },
      ],
    },
  ],
};
