window.COURSE = window.COURSE || {};

window.COURSE.html = {
  id: 'html',
  title: 'HTML',
  icon: '📄',
  description: 'The skeleton of every web page — structure, text, links, images, forms, and the gotchas that trip up beginners.',
  lessons: [
    {
      id: 'html-roadmap',
      title: 'Your 2-Week Plan',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>This HTML track is built to take you from "never written a tag" to
          <strong>confidently building a complete, well-structured page</strong> in about two weeks,
          at a relaxed pace of roughly one lesson a day. Every lesson is tagged with a difficulty:</p>
          <ul>
            <li><strong>🟢 Basic</strong> — a new concept, explained gently.</li>
            <li><strong>🔵 Medium</strong> — builds directly on the basics.</li>
            <li><strong>🟣 Pro</strong> — the habits and techniques that separate "knows the tags" from
                "can actually build things".</li>
            <li><strong>🔴 Hell</strong> — genuinely tricky edge cases, or a big synthesis challenge.
                Expect to re-read, and that's fine.</li>
          </ul>
        `},
        { type: 'code', lang: 'text', caption: 'Suggested day-by-day schedule', code:
`Day 1  — What is HTML?
Day 2  — Text, Headings & Lists
Day 3  — Links, Images & Attributes
Day 4  — Div, Span & the Structure of a Page
Day 5  — Forms & Inputs
Day 6  — Tables
Day 7  — Semantic HTML
Day 8  — Media: Images, Audio, Video & Embeds
Day 9  — The <head>: Meta Tags & Linking Files
Day 10 — Accessible & Well-Validated Forms      (Pro)
Day 11 — Data Attributes                        (Pro)
Day 12 — Responsive Images & Loading Performance (Pro)
Day 13 — Quirks, Gotchas & Common Mistakes       (Hell)
Day 14 — Capstone: Build a Complete Page         (Hell)` },
        { type: 'note', kind: 'tip', html: `
          <strong>The single best thing you can do:</strong> keep one running project on your own
          computer (a simple "About Me" page is perfect) and add to it after every lesson — a new
          section, a new tag, a new technique. By Day 14's capstone you won't be starting from
          scratch, you'll be polishing something you've been building for two weeks. The playgrounds
          in each lesson are for practicing a concept in isolation; your own project is where it
          actually sticks.
        `},
        { type: 'note', kind: 'info', html: 'Don\'t rush the "Hell" tier lessons. They exist because these are exactly the things that confuse real beginners for weeks if nobody points them out early — a little pain now saves a lot of debugging later.' },
      ],
      quiz: [
        { q: 'What does the "Hell" tier generally mean in this course?', choices: ['Content that is broken or unfinished', 'Genuinely tricky edge cases or a big synthesis challenge, worth extra time', 'Optional content you can skip'], answer: 1, explain: 'Hell-tier lessons are the trickiest material — expect to spend more time and re-read, not skip them.' },
        { q: 'According to this plan, what should you do alongside the lessons?', choices: ['Nothing else is needed', 'Keep one running personal project you add to after every lesson', 'Memorize every tag before writing any code'], answer: 1, explain: 'Applying each lesson to one ongoing project is how the concepts actually stick.' },
      ],
    },

    {
      id: 'html-1',
      title: 'What is HTML?',
      difficulty: 'basic',
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
        { q: 'Which part of a document holds the visible content?', choices: ['head', 'body', 'title'], answer: 1, explain: 'The body contains everything the visitor actually sees.' },
        { q: 'What does a self-closing tag like img NOT need?', choices: ['Attributes', 'A closing tag', 'A name'], answer: 1, explain: 'img, br, input, and hr don\'t wrap other content, so they have no closing tag.' },
      ],
    },

    {
      id: 'html-2',
      title: 'Text, Headings & Lists',
      difficulty: 'basic',
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
        { q: 'Which heading tag is the largest / most important?', choices: ['h6', 'h1', 'head'], answer: 1, explain: 'h1 is the top-level heading; h6 is the smallest.' },
        { q: 'Which tag creates a numbered list?', choices: ['ul', 'ol', 'li'], answer: 1, explain: 'ol = ordered list (numbered). ul = unordered (bulleted). li is a single item inside either.' },
      ],
    },

    {
      id: 'html-3',
      title: 'Links, Images & Attributes',
      difficulty: 'basic',
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
        { q: 'Which attribute sets the destination of a link?', choices: ['src', 'href', 'link'], answer: 1, explain: 'a href="..."' },
        { q: 'Why does img need an alt attribute?', choices: ['It sets the image size', 'It provides text for accessibility and fallback', 'It is required by the browser to render colors'], answer: 1, explain: 'alt text helps screen readers and shows if the image can\'t load.' },
      ],
    },

    {
      id: 'html-4',
      title: 'Div, Span & the Structure of a Page',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>Elements come in two display flavors. <strong>Block-level</strong> elements
          (<code>&lt;p&gt;</code>, <code>&lt;div&gt;</code>, <code>&lt;h1&gt;</code>) start on a new
          line and take up the full width available. <strong>Inline</strong> elements
          (<code>&lt;span&gt;</code>, <code>&lt;a&gt;</code>, <code>&lt;strong&gt;</code>) flow within
          a line of text, only as wide as their content.</p>
          <p><code>&lt;div&gt;</code> and <code>&lt;span&gt;</code> are the generic, meaningless
          versions of each: a <code>&lt;div&gt;</code> groups a block of related content (you'll style
          it or hook it up with JavaScript), and a <code>&lt;span&gt;</code> wraps a small piece of
          text inline so you can target just that piece.</p>
        `},
        { type: 'code', lang: 'html', caption: 'Grouping content with div and span', code:
`<div class="card">
  <h3>Ada Lovelace</h3>
  <p>Considered the first computer <span class="highlight">programmer</span>.</p>
</div>

<!-- This is a comment — it never shows on the page, useful for notes -->
<div class="card">
  <h3>Grace Hopper</h3>
  <p>Pioneered the idea of machine-independent programming languages.</p>
</div>` },
        { type: 'note', kind: 'tip', html: 'Consistent indentation (2 or 4 spaces per nesting level) makes it dramatically easier to see which tags are inside which — get in the habit now, before your pages get complicated.' },
        { type: 'note', kind: 'warning', html: 'Reaching for a &lt;div&gt; or &lt;span&gt; for everything is called "div soup". Before using one, check the Semantic HTML lesson later this week — often a more specific tag already exists.' },
        { type: 'web', task: 'Wrap one word in the paragraph with a &lt;span class="highlight"&gt; and give it a background color in CSS. Then wrap the whole thing in a &lt;div&gt; with some padding and a border.', starter: {
          html: `<div class="card">\n  <h3>Ada Lovelace</h3>\n  <p>Considered the first computer programmer.</p>\n</div>`,
          css: `.card { }\n.highlight { }`,
        }},
      ],
      quiz: [
        { q: 'What is the key visual difference between block and inline elements?', choices: ['Block elements start on a new line and fill the available width; inline elements flow within text', 'Inline elements are always colored blue', 'There is no difference'], answer: 0, explain: 'Block elements stack vertically and take full width by default; inline elements sit within a line of text.' },
        { q: 'Why use a span instead of just styling the whole paragraph?', choices: ['You can\'t style a whole paragraph', 'To target and style just one small piece of text within it', 'span is required by HTML5'], answer: 1, explain: 'span lets you wrap and target a specific inline chunk of text without affecting the rest.' },
        { q: 'How do you write an HTML comment?', choices: ['// comment', '<!-- comment -->', '# comment'], answer: 1, explain: 'HTML comments use <!-- ... --> and are invisible on the rendered page.' },
      ],
    },

    {
      id: 'html-5',
      title: 'Forms & Inputs',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Forms collect input from users. A <code>&lt;form&gt;</code> wraps input controls; each
          control needs a <code>name</code> attribute so its value can be identified when submitted.
          The <code>type</code> attribute on <code>&lt;input&gt;</code> changes both its behavior and
          the keyboard/UI a phone shows: <code>text</code>, <code>email</code>, <code>password</code>,
          <code>number</code>, <code>date</code>, <code>checkbox</code>, <code>radio</code>,
          <code>file</code>, and more.</p>
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

  <label><input type="checkbox" name="subscribe"> Subscribe to updates</label>

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
        { q: 'What does <input type="email"> give you over type="text"?', choices: ['Nothing, they are identical', 'Basic format validation and an email-friendly keyboard on mobile', 'It automatically sends an email'], answer: 1, explain: 'Specific input types unlock built-in validation and better mobile keyboards.' },
      ],
    },

    {
      id: 'html-6',
      title: 'Tables',
      difficulty: 'medium',
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
        { type: 'note', kind: 'warning', html: 'Tables are for tabular data, not page layout. Using tables to lay out a whole page (a common old trick) makes it hard to maintain and inaccessible — that job belongs to CSS (Flexbox/Grid, coming up in the CSS track).' },
        { type: 'web', task: 'Add a third row to the table body.', starter: {
          html: `<table>\n  <thead>\n    <tr><th>Book</th><th>Author</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Kindred</td><td>Octavia Butler</td></tr>\n  </tbody>\n</table>`,
          css: `table { border-collapse: collapse; }\ntd, th { border: 1px solid #999; padding: 6px 10px; }`,
        }},
      ],
      quiz: [
        { q: 'Which tag defines a table row?', choices: ['td', 'tr', 'th'], answer: 1, explain: 'tr = table row. td/th are cells within a row.' },
        { q: 'What should tables be used for today?', choices: ['Laying out entire pages', 'Tabular data — things that genuinely belong in rows and columns', 'Navigation menus'], answer: 1, explain: 'Modern layout uses CSS; tables are reserved for actual tabular data.' },
      ],
    },

    {
      id: 'html-7',
      title: 'Semantic HTML',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p><code>&lt;div&gt;</code> and <code>&lt;span&gt;</code> are generic containers with no
          meaning of their own. Modern HTML prefers <strong>semantic</strong> tags that describe the
          role of the content: <code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>,
          <code>&lt;main&gt;</code>, <code>&lt;article&gt;</code>, <code>&lt;section&gt;</code>,
          <code>&lt;aside&gt;</code>, <code>&lt;footer&gt;</code>. This helps accessibility tools,
          search engines, and other developers understand the page's structure at a glance.</p>
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
  <aside>Related: 3 more posts like this.</aside>
</main>
<footer>&copy; 2026 My Site</footer>` },
        { type: 'web', task: 'Rebuild this using &lt;div class="..."&gt; instead of semantic tags, then switch back — notice the HTML reads the same to a browser but semantic tags communicate more to humans and tools.', starter: {
          html: `<header>\n  <h1>My Site</h1>\n  <nav><a href="#">Home</a> <a href="#">About</a></nav>\n</header>\n<main>\n  <article>\n    <h2>My First Post</h2>\n    <p>Semantic tags make structure obvious.</p>\n  </article>\n</main>\n<footer>&copy; 2026 My Site</footer>`,
        }},
      ],
      quiz: [
        { q: 'What is the main advantage of semantic tags over div for everything?', choices: ['They render faster', 'They convey meaning to browsers, assistive tech, and other developers', 'They allow more CSS colors'], answer: 1, explain: 'Semantic HTML improves accessibility and clarity without changing what\'s visually rendered.' },
        { q: 'Which tag is meant for the primary navigation links?', choices: ['main', 'nav', 'section'], answer: 1, explain: 'nav wraps a block of navigation links.' },
      ],
    },

    {
      id: 'html-8',
      title: 'Media: Images, Audio, Video & Embeds',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Beyond <code>&lt;img&gt;</code>, HTML has native tags for other media:
          <code>&lt;audio controls&gt;</code>, <code>&lt;video controls&gt;</code>, and
          <code>&lt;iframe&gt;</code> for embedding another page (a map, a YouTube video) inside yours.
          <code>&lt;figure&gt;</code> and <code>&lt;figcaption&gt;</code> pair an image with a caption
          as one semantic unit.</p>
        `},
        { type: 'code', lang: 'html', code:
`<figure>
  <img src="chart.png" alt="Bar chart of quarterly sales">
  <figcaption>Fig. 1 — Sales grew steadily each quarter.</figcaption>
</figure>

<audio controls src="song.mp3"></audio>

<video controls width="400" src="clip.mp4"></video>

<iframe src="https://example.com" width="400" height="200" title="Embedded page"></iframe>` },
        { type: 'note', kind: 'warning', html: 'Never autoplay audio or video with sound — it\'s one of the most reliable ways to make a visitor immediately close your page. If you autoplay at all, mute it: <code>&lt;video autoplay muted loop&gt;</code>.' },
        { type: 'web', task: 'Wrap the image in a &lt;figure&gt; with a &lt;figcaption&gt;, and add controls to the audio and video tags so a play button actually shows up (the files won\'t load in this sandbox, but the player UI will appear).', starter: {
          html: `<img src="https://picsum.photos/300/180" alt="A random placeholder photo">\n\n<audio src="song.mp3"></audio>\n\n<video width="300" src="clip.mp4"></video>`,
        }},
      ],
      quiz: [
        { q: 'What does the figcaption element do?', choices: ['Nothing, it\'s decorative only', 'Provides a caption tied to the media inside its parent figure', 'Replaces the alt attribute'], answer: 1, explain: 'figcaption gives a semantic caption for the figure it lives inside — it doesn\'t replace alt.' },
        { q: 'What is the safest way to autoplay a video?', choices: ['autoplay alone', 'autoplay muted (with loop as needed)', 'You should never add autoplay under any circumstance'], answer: 1, explain: 'Most browsers block autoplay with sound anyway; muting it is the accepted, non-intrusive approach.' },
        { q: 'What is an iframe used for?', choices: ['Making text italic', 'Embedding another web page inside the current one', 'Creating a form'], answer: 1, explain: 'iframe embeds external content, like a map or a video player, inline in your page.' },
      ],
    },

    {
      id: 'html-9',
      title: 'The <head>: Meta Tags & Linking Files',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Real projects split code across files: an <code>.html</code> file, a <code>.css</code>
          file, and a <code>.js</code> file, all linked together from the <code>&lt;head&gt;</code>.
          The head also carries metadata that never appears on the page itself but matters a lot —
          to browsers, search engines, and social previews.</p>
        `},
        { type: 'code', lang: 'html', caption: 'A realistic <head>', code:
`<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Ada's portfolio — projects and contact info.">
  <title>Ada's Portfolio</title>
  <link rel="icon" href="favicon.ico">
  <link rel="stylesheet" href="styles.css">
  <script src="app.js" defer></script>
</head>` },
        { type: 'text', html: `
          <ul>
            <li><code>meta charset="UTF-8"</code> — tells the browser how to interpret text encoding.
                Always include it, first, in the head.</li>
            <li><code>meta name="viewport" ...</code> — without this, mobile browsers render your page
                as a zoomed-out desktop layout. Essentially required on every modern page.</li>
            <li><code>meta name="description" ...</code> — the snippet search engines often show under
                your page's title in results.</li>
            <li><code>link rel="stylesheet"</code> — loads an external CSS file.</li>
            <li><code>script src="..." defer</code> — loads your JavaScript file without blocking the
                page from rendering while it downloads, and guarantees it runs only after the HTML is
                parsed. This is why <code>defer</code> is generally preferred over a plain
                <code>&lt;script src="..."&gt;</code> with no attribute.</li>
          </ul>
        `},
        { type: 'note', kind: 'tip', html: 'Because these tags aren\'t visible on the page, this lesson skips the live preview — but typing this exact head block into your own project file is one of the most useful five minutes you\'ll spend this week.' },
      ],
      quiz: [
        { q: 'What happens if you omit the viewport meta tag on a page you view on a phone?', choices: ['Nothing changes', 'The browser renders it as a zoomed-out desktop layout', 'The page fails to load'], answer: 1, explain: 'Without a viewport meta tag, mobile browsers assume a desktop-width layout and shrink it to fit, which looks tiny and zoomed out.' },
        { q: 'Why prefer script src="app.js" defer over a plain script tag with no attributes?', choices: ['defer is required syntax in HTML5', 'It downloads without blocking page rendering and runs only after the HTML is parsed', 'It makes the script run faster to execute'], answer: 1, explain: 'defer avoids blocking rendering during download and preserves execution order relative to parsing.' },
        { q: 'Where do external CSS and JS files typically get linked from?', choices: ['The body, at the very end only', 'The head, using link and script tags', 'They can\'t be linked; they must be inline'], answer: 1, explain: 'link rel="stylesheet" and script src (often with defer) both commonly live in the head.' },
      ],
    },

    {
      id: 'html-10',
      title: 'Accessible & Well-Validated Forms',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>A form beginners "get working" and a form that's actually solid look different.
          A few habits close that gap:</p>
          <ul>
            <li><strong>Always pair a real <code>&lt;label&gt;</code></strong> with each input (via
                <code>for</code>/<code>id</code>) — a <code>placeholder</code> disappears the moment
                someone starts typing and isn't reliably read by screen readers as a label.</li>
            <li><strong>Group related choices</strong> with <code>&lt;fieldset&gt;</code> and
                <code>&lt;legend&gt;</code>, especially radio buttons.</li>
            <li><strong>Use built-in validation attributes</strong>: <code>required</code>,
                <code>minlength</code>/<code>maxlength</code>, <code>min</code>/<code>max</code> for
                numbers, and <code>pattern</code> for a custom regular expression.</li>
            <li><strong><code>aria-describedby</code></strong> links an input to helper text elsewhere
                on the page, which screen readers will announce.</li>
          </ul>
        `},
        { type: 'code', lang: 'html', code:
`<fieldset>
  <legend>Preferred contact method</legend>
  <label><input type="radio" name="contact" value="email"> Email</label>
  <label><input type="radio" name="contact" value="phone"> Phone</label>
</fieldset>

<label for="phone">Phone number:</label>
<input type="tel" id="phone" name="phone"
       pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
       aria-describedby="phone-hint" required>
<small id="phone-hint">Format: 555-123-4567</small>` },
        { type: 'note', kind: 'warning', html: 'A placeholder is not a label. It vanishes on focus, has poor color contrast by default, and many screen readers don\'t treat it as the field\'s name. Use it only for a short format hint alongside a real &lt;label&gt;, never instead of one.' },
        { type: 'web', task: 'Add the required attribute and a minlength of 3 to the name input, and wrap the two radio buttons in a fieldset with a legend of "Preferred size".', starter: {
          html: `<label for="name">Name:</label>\n<input type="text" id="name" name="name">\n\n<label><input type="radio" name="size" value="s"> Small</label>\n<label><input type="radio" name="size" value="l"> Large</label>`,
        }},
      ],
      quiz: [
        { q: 'Why is a placeholder a poor substitute for a label?', choices: ['Placeholders are not allowed in HTML5', 'It disappears once typing starts and isn\'t reliably announced as the field\'s name', 'Placeholders can only be used on buttons'], answer: 1, explain: 'A real label stays visible and is consistently exposed to assistive tech; a placeholder is not a dependable replacement.' },
        { q: 'What is fieldset + legend used for?', choices: ['Styling a border around any div', 'Grouping related form controls (like a set of radio buttons) under one labeled group', 'Validating email addresses'], answer: 1, explain: 'fieldset groups related controls, and legend gives that group an accessible name.' },
        { q: 'What does the pattern attribute do on an input?', choices: ['Sets a background image pattern', 'Requires the value to match a given regular expression before the form submits', 'Repeats the input three times'], answer: 1, explain: 'pattern enforces a custom format using a regular expression, with built-in browser validation.' },
      ],
    },

    {
      id: 'html-11',
      title: 'Data Attributes',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>You can attach your own custom data to any element with a <code>data-*</code> attribute —
          it does nothing on its own, but JavaScript can read it through the element's
          <code>dataset</code> property. A kebab-case attribute like <code>data-user-id</code> becomes
          camelCase in JavaScript: <code>element.dataset.userId</code>.</p>
        `},
        { type: 'code', lang: 'html', code:
`<button data-count="0" id="counter">Clicks: 0</button>` },
        { type: 'code', lang: 'javascript', caption: 'Reading and updating it in JavaScript', code:
`const btn = document.getElementById('counter');

btn.addEventListener('click', () => {
  let count = Number(btn.dataset.count);
  count += 1;
  btn.dataset.count = count;
  btn.textContent = 'Clicks: ' + count;
});` },
        { type: 'note', kind: 'tip', html: 'data attributes are perfect for stashing information HTML needs to carry but doesn\'t need to display directly — an item\'s database id, a category for filtering, a state flag a script can check.' },
        { type: 'web', task: 'Build the click-counter above: a button with data-count="0" that increments and displays its own count when clicked.', starter: {
          html: `<button data-count="0" id="counter">Clicks: 0</button>`,
          js: `const btn = document.getElementById('counter');\n\nbtn.addEventListener('click', () => {\n  let count = Number(btn.dataset.count);\n  count += 1;\n  btn.dataset.count = count;\n  btn.textContent = 'Clicks: ' + count;\n});`,
        }},
      ],
      quiz: [
        { q: 'How would you read data-user-id in JavaScript?', choices: ['element.data.user.id', 'element.dataset.userId', 'element.getAttribute.userId'], answer: 1, explain: 'Kebab-case data-* attributes become camelCase properties on .dataset.' },
        { q: 'What is a good use for a data attribute?', choices: ['Styling text bold', 'Attaching extra information (like a database id) that scripts need but nothing should visually display', 'Replacing the class attribute entirely'], answer: 1, explain: 'data-* attributes carry information for scripts to use, separate from styling (class) or content.' },
      ],
    },

    {
      id: 'html-12',
      title: 'Responsive Images & Loading Performance',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>Two small attributes make a real difference to how fast a page feels:</p>
          <ul>
            <li><code>loading="lazy"</code> on an <code>&lt;img&gt;</code> tells the browser not to
                download that image until it's about to scroll into view — huge for pages with lots
                of images below the fold.</li>
            <li><code>srcset</code>/<code>sizes</code> let the browser pick the best-fitting image
                resolution for the visitor's screen, instead of always downloading one huge file.</li>
          </ul>
        `},
        { type: 'code', lang: 'html', code:
`<img
  src="photo-1024.jpg"
  srcset="photo-480.jpg 480w, photo-1024.jpg 1024w"
  sizes="(max-width: 600px) 480px, 1024px"
  alt="A mountain landscape"
  loading="lazy">` },
        { type: 'note', kind: 'info', html: '<code>srcset</code> lists candidate images with their real width in pixels (480w means 480 pixels wide); <code>sizes</code> tells the browser how wide the image will actually display at different screen widths, so it can pick the smallest one that\'s still sharp enough.' },
        { type: 'web', task: 'Add loading="lazy" to the second image, and add a srcset with two resolutions to the first one (any URLs work — try https://picsum.photos/480 and https://picsum.photos/1024).', starter: {
          html: `<img src="https://picsum.photos/id/10/1024" alt="Placeholder photo one">\n\n<img src="https://picsum.photos/id/20/1024" alt="Placeholder photo two">`,
        }},
      ],
      quiz: [
        { q: 'What does loading="lazy" do on an image?', choices: ['Makes the image load blurry on purpose', 'Delays downloading the image until it\'s about to scroll into view', 'Compresses the image automatically'], answer: 1, explain: 'Lazy loading defers offscreen images, saving bandwidth and speeding up initial page load.' },
        { q: 'What does the "w" unit in a srcset value describe?', choices: ['The image\'s file weight in kilobytes', 'The image\'s actual intrinsic width in pixels', 'The number of times to repeat the image'], answer: 1, explain: '480w means that candidate image is 480 pixels wide — the browser uses this with sizes to choose the best match.' },
      ],
    },

    {
      id: 'html-13',
      title: 'Quirks, Gotchas & Common Mistakes',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>This lesson is a rundown of the things that quietly confuse almost every beginner at some
          point. Knowing them now will save you real debugging time later.</p>
          <ul>
            <li><strong>Void elements</strong> (<code>br</code>, <code>img</code>, <code>hr</code>,
                <code>input</code>, <code>meta</code>, <code>link</code>) never take a closing tag and
                never wrap content — <code>&lt;img&gt;&lt;/img&gt;</code> is invalid.</li>
            <li><strong>Improper nesting gets "fixed" by the browser</strong>, not always how you'd
                expect. A <code>&lt;p&gt;</code> can never contain another <code>&lt;p&gt;</code> — the
                browser silently closes the first one for you.</li>
            <li><strong>Whitespace collapses.</strong> Multiple spaces, tabs, and newlines in your HTML
                source all render as a single space. Use CSS (<code>white-space</code>) or
                <code>&amp;nbsp;</code> if you genuinely need more.</li>
            <li><strong>Deprecated tags exist but shouldn't be used</strong>: <code>&lt;center&gt;</code>,
                <code>&lt;font&gt;</code>, and <code>&lt;marquee&gt;</code> all still technically work in
                most browsers, but CSS replaced all of them decades ago — using them today is a red flag
                in real code.</li>
            <li><strong>Always include <code>&lt;!doctype html&gt;</code>.</strong> Without it, browsers
                fall back to "quirks mode," which changes box-sizing and other layout math in ways that
                are genuinely hard to debug.</li>
            <li>You can check your work against the real spec with the free
                <a href="https://validator.w3.org/" target="_blank" rel="noopener">W3C Markup Validator</a>.</li>
          </ul>
        `},
        { type: 'predict', lang: 'html', question: 'What does the browser actually do with this HTML?', code:
`<p>Hello <p>World</p></p>`, options: ['One paragraph containing "Hello World"', 'Two separate, sibling paragraphs: "Hello" and "World"', 'The page fails to render'], answer: 1, explain: 'Browsers auto-close the first <p> as soon as they hit the second opening <p> tag (paragraphs can\'t nest), producing two sibling paragraphs instead of one nested inside the other.' },
        { type: 'predict', lang: 'html', question: 'How many visible spaces appear between "Hello" and "World" when this renders?', code:
`<p>Hello          World</p>`, options: ['10 spaces, exactly as typed', '1 space', 'No space at all'], answer: 1, explain: 'HTML collapses any run of whitespace (spaces, tabs, newlines) down to a single space when rendering.' },
        { type: 'note', kind: 'warning', html: 'Always quote attribute values (<code>class="card"</code>, not <code>class=card</code>). Unquoted values happen to work for simple single words, but break the instant a value contains a space, and are considered bad practice everywhere.' },
      ],
      quiz: [
        { q: 'Which of these is a void element that never gets a closing tag?', choices: ['div', 'br', 'span'], answer: 1, explain: 'br (and img, hr, input, meta, link, ...) are void elements — they never wrap content.' },
        { q: 'Why avoid tags like center and font today?', choices: ['They were removed from all browsers and no longer work', 'They\'re deprecated presentational tags — CSS is now the correct tool for styling', 'They only work in Internet Explorer'], answer: 1, explain: 'They still technically render in most browsers, but mixing presentation into your markup like this is outdated practice; CSS handles styling now.' },
        { q: 'What does omitting <!doctype html> cause?', choices: ['Nothing, it\'s purely optional decoration', 'The browser renders in "quirks mode," changing layout behavior in surprising ways', 'The page won\'t load at all'], answer: 1, explain: 'No doctype triggers quirks mode, an old compatibility mode with different (and confusing) layout rules.' },
      ],
    },

    {
      id: 'html-14',
      title: 'Capstone: Build a Complete Page',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>Time to put two weeks of HTML together into one real page. Build a simple personal
          "About Me" / portfolio page. Use the checklist below as your requirements — check each one
          off in your head (or for real, in your own project) as you go:</p>
        `},
        { type: 'note', kind: 'tip', html: `
          <strong>Checklist:</strong>
          <ul>
            <li>☐ A <code>&lt;header&gt;</code> with your name/title and a <code>&lt;nav&gt;</code> with
                a few links.</li>
            <li>☐ A short intro/"hero" section with a heading and one paragraph about you.</li>
            <li>☐ An "About" or "Skills" section using a list (<code>&lt;ul&gt;</code>) or a
                <code>&lt;table&gt;</code>.</li>
            <li>☐ At least one media element: an <code>&lt;img&gt;</code> with real <code>alt</code>
                text, ideally inside a <code>&lt;figure&gt;</code>.</li>
            <li>☐ A contact <code>&lt;form&gt;</code> with at least 3 different input types, each with
                a proper <code>&lt;label&gt;</code>.</li>
            <li>☐ A <code>&lt;footer&gt;</code> with a copyright line.</li>
            <li>☐ Semantic structure throughout — no "div soup" where a real tag would fit better.</li>
            <li>☐ HTML comments marking the start of each major section.</li>
          </ul>
        `},
        { type: 'web', task: 'Build your capstone page here (or better, in your own project file). The starter below has section comments to guide you — replace each with real content.', starter: {
          html:
`<!-- Header + nav -->


<!-- Hero / intro section -->


<!-- About / Skills section -->


<!-- A figure with an image -->


<!-- Contact form -->


<!-- Footer -->
`,
          css:
`body { font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; line-height: 1.6; }
header { display: flex; justify-content: space-between; align-items: center; }
nav a { margin-left: 12px; }
footer { margin-top: 40px; color: #777; font-size: 0.85rem; }`,
        }},
        { type: 'note', kind: 'info', html: 'When you\'re happy with your real project file, paste it into the <a href="https://validator.w3.org/#validate_by_input" target="_blank" rel="noopener">W3C validator</a> and fix anything it flags — that\'s the closest thing to an objective "is my HTML actually correct" check.' },
      ],
      quiz: [
        { q: 'A page has a photo gallery with no captions and every section wrapped in a bare <div>. What\'s the single highest-value fix from this course?', choices: ['Add a video background', 'Swap generic divs for semantic tags where they fit, and wrap images needing captions in figure/figcaption', 'Nothing, it already works visually'], answer: 1, explain: 'Semantic structure and proper media markup are exactly what separates "looks fine" from "built correctly" — the two weeks of this course.' },
        { q: 'You need a group of 4 related checkboxes with a shared, announced label. What\'s the right structure?', choices: ['Four separate forms', 'A fieldset with a legend wrapping the four checkbox inputs', 'A single input with 4 values separated by commas'], answer: 1, explain: 'fieldset + legend is exactly the tool for grouping and labeling a set of related controls.' },
        { q: 'Your page looks fine on desktop but broken on phones and has no <!doctype html>. What are your two first fixes from this course?', choices: ['Add more images', 'Add the doctype, and add a viewport meta tag', 'Switch everything to a table layout'], answer: 1, explain: 'A missing doctype triggers quirks mode; a missing viewport meta tag causes the zoomed-out mobile layout — both are covered in this course and both are extremely common real bugs.' },
      ],
    },
  ],
};
