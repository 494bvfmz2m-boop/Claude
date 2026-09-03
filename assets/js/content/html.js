window.COURSE = window.COURSE || {};

window.COURSE.html = {
  id: 'html',
  title: 'HTML',
  icon: '📄',
  description: 'The skeleton of every web page — structure, text, links, images, and forms.',
  lessons: [
    {
      id: 'html-1',
      title: 'What is HTML?',
      blocks: [
        { type: 'text', html: `
          <p><strong>HTML</strong> (HyperText Markup Language) describes the structure of a web page
          using <strong>elements</strong>. Most elements have an opening tag, some content, and a
          closing tag: <code>&lt;p&gt;Hello&lt;/p&gt;</code>.</p>
          <p>A full page starts with a <code>&lt;!doctype html&gt;</code> declaration and a
          <code>&lt;html&gt;</code> element containing a <code>&lt;head&gt;</code> (metadata, page title)
          and a <code>&lt;body&gt;</code> (everything visible).</p>
        `},
        { type: 'code', lang: 'html', caption: 'A minimal HTML document', code:
`<!doctype html>
<html>
  <head>
    <title>My First Page</title>
  </head>
  <body>
    <h1>Hello, world!</h1>
    <p>This is a paragraph.</p>
  </body>
</html>` },
        { type: 'note', kind: 'tip', html: 'Tags are case-insensitive but the convention is lowercase. Most tags need a closing tag; a few, like <code>&lt;img&gt;</code> and <code>&lt;br&gt;</code>, are "self-closing" and don\'t wrap content.' },
        { type: 'web', task: 'Change the heading text and add a second paragraph below the first one.', starter: {
          html: `<h1>Hello, world!</h1>\n<p>This is a paragraph.</p>`,
        }},
      ],
      quiz: [
        { q: 'What does HTML stand for?', choices: ['HyperText Markup Language', 'High Text Machine Language', 'Home Tool Markup Language'], answer: 0, explain: 'HTML = HyperText Markup Language.' },
        { q: 'Which part of a document holds the visible content?', choices: ['<head>', '<body>', '<title>'], answer: 1, explain: 'The <body> contains everything the visitor actually sees.' },
        { q: 'What does a self-closing tag like <img> NOT need?', choices: ['Attributes', 'A closing tag', 'A name'], answer: 1, explain: '<img>, <br>, <input>, and <hr> don\'t wrap other content, so they have no closing tag.' },
      ],
    },

    {
      id: 'html-2',
      title: 'Text, Headings & Lists',
      blocks: [
        { type: 'text', html: `
          <p>Headings <code>&lt;h1&gt;</code> through <code>&lt;h6&gt;</code> create a hierarchy — one
          <code>&lt;h1&gt;</code> per page is typical, for the main title. Text-level tags like
          <code>&lt;strong&gt;</code> (important) and <code>&lt;em&gt;</code> (emphasis) add meaning,
          not just style.</p>
          <p>Lists come in two flavors: <code>&lt;ul&gt;</code> (unordered/bulleted) and
          <code>&lt;ol&gt;</code> (ordered/numbered), each containing <code>&lt;li&gt;</code> items.</p>
        `},
        { type: 'code', lang: 'html', code:
`<h1>My Recipe Blog</h1>
<h2>Pancakes</h2>
<p>My <strong>favorite</strong> weekend breakfast.</p>
<ul>
  <li>Flour</li>
  <li>Eggs</li>
  <li>Milk</li>
</ul>
<ol>
  <li>Mix ingredients</li>
  <li>Heat the pan</li>
  <li>Cook until golden</li>
</ol>` },
        { type: 'web', task: 'Add a third list item to the &lt;ul&gt;, and try changing &lt;ul&gt; to &lt;ol&gt; to see the difference.', starter: {
          html: `<h1>My Recipe Blog</h1>\n<h2>Pancakes</h2>\n<p>My <strong>favorite</strong> weekend breakfast.</p>\n<ul>\n  <li>Flour</li>\n  <li>Eggs</li>\n</ul>`,
        }},
      ],
      quiz: [
        { q: 'Which heading tag is the largest / most important?', choices: ['<h6>', '<h1>', '<head>'], answer: 1, explain: '<h1> is the top-level heading; <h6> is the smallest.' },
        { q: 'Which tag creates a numbered list?', choices: ['<ul>', '<ol>', '<li>'], answer: 1, explain: '<ol> = ordered list (numbered). <ul> = unordered (bulleted). <li> is a single item inside either.' },
      ],
    },

    {
      id: 'html-3',
      title: 'Links, Images & Attributes',
      blocks: [
        { type: 'text', html: `
          <p><strong>Attributes</strong> live inside the opening tag and give extra information, like
          <code>href</code> on a link or <code>src</code>/<code>alt</code> on an image.</p>
        `},
        { type: 'code', lang: 'html', code:
`<a href="https://example.com">Visit Example</a>
<img src="cat.jpg" alt="A sleeping orange cat" width="300">` },
        { type: 'note', kind: 'warning', html: 'Always include a meaningful <code>alt</code> attribute on images — it\'s read aloud by screen readers and shown if the image fails to load.' },
        { type: 'web', task: 'Add an image (any URL works, e.g. https://picsum.photos/300) with an alt attribute, and a link that opens in a new tab using target="_blank".', starter: {
          html: `<a href="https://example.com">Visit Example</a>`,
        }},
      ],
      quiz: [
        { q: 'Which attribute sets the destination of a link?', choices: ['src', 'href', 'link'], answer: 1, explain: '<a href="...">' },
        { q: 'Why does <img> need an alt attribute?', choices: ['It sets the image size', 'It provides text for accessibility and fallback', 'It is required by the browser to render colors'], answer: 1, explain: 'alt text helps screen readers and shows if the image can\'t load.' },
      ],
    },

    {
      id: 'html-4',
      title: 'Forms & Inputs',
      blocks: [
        { type: 'text', html: `
          <p>Forms collect input from users. A <code>&lt;form&gt;</code> wraps input controls; each
          control needs a <code>name</code> attribute so its value can be identified when submitted.
          Later, in the PHP and SQL lessons, you'll see how a server reads these values and stores them.</p>
        `},
        { type: 'code', lang: 'html', code:
`<form action="/submit" method="POST">
  <label for="name">Name:</label>
  <input type="text" id="name" name="name" required>

  <label for="email">Email:</label>
  <input type="email" id="email" name="email">

  <label for="topic">Favorite topic:</label>
  <select id="topic" name="topic">
    <option value="html">HTML</option>
    <option value="css">CSS</option>
    <option value="js">JavaScript</option>
  </select>

  <button type="submit">Send</button>
</form>` },
        { type: 'note', kind: 'info', html: '<code>method="POST"</code> sends form data in the request body (used for creating/changing things); <code>method="GET"</code> sends it in the URL (used for searches/filters). You\'ll meet both again in the PHP lesson on forms.' },
        { type: 'web', task: 'Add a checkbox input and a textarea to the form.', starter: {
          html: `<form>\n  <label for="name">Name:</label>\n  <input type="text" id="name" name="name">\n  <button type="submit">Send</button>\n</form>`,
        }},
      ],
      quiz: [
        { q: 'What attribute identifies an input\'s value when a form is submitted?', choices: ['id', 'name', 'label'], answer: 1, explain: 'The name attribute becomes the key for that field\'s value.' },
        { q: 'Which form method puts data in the URL?', choices: ['GET', 'POST', 'PUT'], answer: 0, explain: 'GET appends data as a query string; POST sends it in the request body.' },
      ],
    },

    {
      id: 'html-5',
      title: 'Tables',
      blocks: [
        { type: 'text', html: `
          <p>Tables display grid-like data: <code>&lt;table&gt;</code> contains <code>&lt;tr&gt;</code>
          (rows), which contain <code>&lt;th&gt;</code> (header cells) or <code>&lt;td&gt;</code>
          (data cells). This maps neatly onto rows and columns in a SQL table, which you'll query later.</p>
        `},
        { type: 'code', lang: 'html', code:
`<table>
  <thead>
    <tr><th>Book</th><th>Author</th><th>Year</th></tr>
  </thead>
  <tbody>
    <tr><td>Kindred</td><td>Octavia Butler</td><td>1979</td></tr>
    <tr><td>Norwegian Wood</td><td>Haruki Murakami</td><td>1987</td></tr>
  </tbody>
</table>` },
        { type: 'web', task: 'Add a third row to the table body.', starter: {
          html: `<table>\n  <thead>\n    <tr><th>Book</th><th>Author</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Kindred</td><td>Octavia Butler</td></tr>\n  </tbody>\n</table>`,
          css: `table { border-collapse: collapse; }\ntd, th { border: 1px solid #999; padding: 6px 10px; }`,
        }},
      ],
      quiz: [
        { q: 'Which tag defines a table row?', choices: ['<td>', '<tr>', '<th>'], answer: 1, explain: '<tr> = table row. <td>/<th> are cells within a row.' },
      ],
    },

    {
      id: 'html-6',
      title: 'Semantic HTML',
      blocks: [
        { type: 'text', html: `
          <p><code>&lt;div&gt;</code> and <code>&lt;span&gt;</code> are generic containers with no
          meaning of their own. Modern HTML prefers <strong>semantic</strong> tags that describe the
          role of the content: <code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>,
          <code>&lt;main&gt;</code>, <code>&lt;article&gt;</code>, <code>&lt;section&gt;</code>,
          <code>&lt;footer&gt;</code>. This helps accessibility tools, search engines, and other
          developers understand the page's structure at a glance.</p>
        `},
        { type: 'code', lang: 'html', code:
`<header>
  <h1>My Site</h1>
  <nav><a href="#">Home</a> <a href="#">About</a></nav>
</header>
<main>
  <article>
    <h2>My First Post</h2>
    <p>Semantic tags make structure obvious.</p>
  </article>
</main>
<footer>&copy; 2026 My Site</footer>` },
        { type: 'web', task: 'Rebuild this using &lt;div class="..."&gt; instead of semantic tags, then switch back — notice the HTML reads the same to a browser but semantic tags communicate more to humans and tools.', starter: {
          html: `<header>\n  <h1>My Site</h1>\n  <nav><a href="#">Home</a> <a href="#">About</a></nav>\n</header>\n<main>\n  <article>\n    <h2>My First Post</h2>\n    <p>Semantic tags make structure obvious.</p>\n  </article>\n</main>\n<footer>&copy; 2026 My Site</footer>`,
        }},
      ],
      quiz: [
        { q: 'What is the main advantage of semantic tags over <div> for everything?', choices: ['They render faster', 'They convey meaning to browsers, assistive tech, and other developers', 'They allow more CSS colors'], answer: 1, explain: 'Semantic HTML improves accessibility and clarity without changing what\'s visually rendered.' },
        { q: 'Which tag is meant for the primary navigation links?', choices: ['<main>', '<nav>', '<section>'], answer: 1, explain: '<nav> wraps a block of navigation links.' },
      ],
    },
  ],
};
