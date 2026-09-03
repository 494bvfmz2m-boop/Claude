window.COURSE = window.COURSE || {};

window.COURSE.json = {
  id: 'json',
  title: 'JSON',
  icon: '🧩',
  description: 'A simple, language-independent text format for structured data — used everywhere data moves.',
  lessons: [
    {
      id: 'json-1',
      title: 'What is JSON?',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><strong>JSON</strong> (JavaScript Object Notation) is a text format for representing
          structured data. Despite the name, it's used by nearly every programming language — it's
          the standard way a JavaScript front end, a PHP back end, and a SQL-backed API exchange data.</p>
          <p>The rules are strict and simple:</p>
          <ul>
            <li>Objects are <code>{ "key": value, ... }</code> — keys are always double-quoted strings.</li>
            <li>Arrays are <code>[ value, value, ... ]</code>.</li>
            <li>Values can be strings ("text"), numbers, <code>true</code>/<code>false</code>,
                <code>null</code>, or nested objects/arrays.</li>
            <li>No trailing commas. No comments. No single quotes.</li>
          </ul>
        `},
        { type: 'code', lang: 'json', code:
`{
  "name": "Ada",
  "age": 30,
  "isLearning": true,
  "hobbies": ["reading", "chess"],
  "address": null
}` },
        { type: 'note', kind: 'warning', html: 'A trailing comma after the last item, or single quotes instead of double quotes, are the two most common reasons JSON fails to parse.' },
      ],
      quiz: [
        { q: 'Which of these is valid JSON?', choices: [`{ name: "Ada" }`, `{ "name": "Ada" }`, `{ "name": 'Ada', }`], answer: 1, explain: 'JSON keys must be double-quoted strings, and there must be no trailing comma.' },
        { q: 'Which languages can read/write JSON?', choices: ['Only JavaScript', 'Only PHP', 'Practically any modern language — it\'s language-independent'], answer: 2, explain: 'JSON is a plain text format understood by virtually every programming language.' },
      ],
    },

    {
      id: 'json-2',
      title: 'Objects, Arrays & Nesting',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Real data is rarely flat. JSON lets you nest objects inside arrays inside objects, as
          deeply as you need — this is how an API might return a list of books, each with a nested
          author object.</p>
        `},
        { type: 'code', lang: 'json', code:
`{
  "books": [
    {
      "title": "Kindred",
      "author": { "name": "Octavia Butler", "country": "USA" },
      "genres": ["Sci-Fi", "Historical"]
    },
    {
      "title": "Americanah",
      "author": { "name": "Chimamanda Ngozi Adichie", "country": "Nigeria" },
      "genres": ["Fiction"]
    }
  ]
}` },
        { type: 'note', kind: 'tip', html: 'To read a nested value in code you chain accessors, e.g. in JavaScript: <code>data.books[0].author.name</code>.' },
      ],
      quiz: [
        { q: 'In the example above, how would you access the first book\'s author name in JavaScript?', choices: ['data.books.author.name', 'data.books[0].author.name', 'data[0].books.author.name'], answer: 1, explain: 'books is an array, so [0] gets the first book; then .author.name reaches the nested value.' },
      ],
    },

    {
      id: 'json-3',
      title: 'JSON Across Languages',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Every language has its own functions to convert between JSON text and native data:</p>
        `},
        { type: 'code', lang: 'text', caption: 'JavaScript', code:
`const data = JSON.parse(jsonText);
const jsonText2 = JSON.stringify(data);` },
        { type: 'code', lang: 'text', caption: 'PHP', code:
`$data = json_decode($jsonText, true);
$jsonText2 = json_encode($data);` },
        { type: 'text', html: `
          <p>Because the format is identical everywhere, JSON is the glue that lets a JavaScript
          front end and a PHP back end (which queries a SQL database) understand each other perfectly,
          even though they're completely different languages. You'll see this exact pattern again in
          the PHP and capstone lessons.</p>
        `},
      ],
      quiz: [
        { q: 'What is the PHP equivalent of JavaScript\'s JSON.parse()?', choices: ['json_encode()', 'json_decode()', 'php_parse()'], answer: 1, explain: 'json_decode() turns a JSON string into a PHP value; json_encode() does the reverse.' },
      ],
    },

    {
      id: 'json-4',
      title: 'Validating JSON',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>A single misplaced comma or quote breaks an entire JSON document. Being able to spot
          (and fix) invalid JSON is a genuinely useful everyday skill. Try the tool below — it's
          intentionally broken.</p>
        `},
        { type: 'jsontool', task: 'Find and fix the JSON error(s), then click Validate. Hint: check the last item in the array, and the quote style on one of the keys.', starter:
`{
  "site": "Learn to Code",
  'topics': ["HTML", "CSS", "JavaScript",],
  "launched": 2026
}` },
        { type: 'note', kind: 'tip', html: 'Once it validates, try breaking it again on purpose (remove a closing brace, add a trailing comma) to see how the error message changes — that\'s the fastest way to learn to recognize these mistakes.' },
      ],
      quiz: [
        { q: 'Which of these commonly breaks JSON?', choices: ['A trailing comma after the last array item', 'A number value', 'A nested object'], answer: 0, explain: 'Trailing commas are not allowed in JSON, unlike in JavaScript object/array literals.' },
      ],
    },

    {
      id: 'json-5',
      title: 'Real-World API Shapes',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>Textbook JSON examples are tidy. Real APIs are messier — wrapped in envelope objects,
          paginated, and full of fields you don't need. Being able to read an unfamiliar, nested
          real-world shape and pick out exactly the value you want is the actual skill.</p>
        `},
        { type: 'code', lang: 'json', caption: 'A realistic paginated API response', code:
`{
  "status": "ok",
  "page": 2,
  "per_page": 2,
  "total_results": 9,
  "data": [
    {
      "id": 101,
      "title": "Kindred",
      "author": { "name": "Octavia Butler" },
      "tags": ["sci-fi", "historical"],
      "in_stock": true
    },
    {
      "id": 104,
      "title": "Americanah",
      "author": { "name": "Chimamanda Ngozi Adichie" },
      "tags": ["fiction"],
      "in_stock": false
    }
  ],
  "errors": null
}` },
        { type: 'text', html: `
          <p>To get the first book's author name here in JavaScript:
          <code>response.data[0].author.name</code> — notice you have to go <em>through</em> the
          envelope (<code>status</code>, <code>page</code>, <code>data</code>) to reach the actual
          content. Real code almost always checks <code>status</code> or <code>errors</code> first,
          before trusting <code>data</code>.</p>
        `},
        { type: 'predict', lang: 'javascript', question: 'Given the JSON above, what does this expression evaluate to?', code:
`response.data[1].tags[0]`, options: ['"sci-fi"', '"fiction"', 'undefined'], answer: 1, explain: 'data[1] is the Americanah object; its tags array\'s first (only) item is "fiction".' },
        { type: 'note', kind: 'warning', html: 'Never assume a field exists just because it did in your last test. A missing or null field (like errors above) is exactly why real code checks before accessing deeply nested values — accessing .name on something that turned out to be null throws an error and can crash your page.' },
      ],
      quiz: [
        { q: 'Why do real APIs often wrap the actual data in an envelope object (status, page, data, ...)?', choices: ['It\'s a mistake API designers make', 'To carry metadata (pagination, success/error state) alongside the actual content', 'JSON requires an envelope by specification'], answer: 1, explain: 'The envelope carries information about the response itself — how many results, what page, whether it succeeded — separate from the actual content in "data".' },
        { q: 'Before trusting and using response.data, what should real code check first?', choices: ['Nothing, data is always safe to use', 'That the request actually succeeded (e.g. status/errors fields)', 'The current date'], answer: 1, explain: 'Checking for success/errors first avoids crashing on missing or malformed data from a failed request.' },
      ],
    },
  ],
};
