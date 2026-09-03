window.COURSE = window.COURSE || {};

window.COURSE.javascript = {
  id: 'javascript',
  title: 'JavaScript',
  icon: '⚡',
  description: 'The language that makes pages interactive — logic, events, and dynamic content.',
  lessons: [
    {
      id: 'js-1',
      title: 'Variables & Data Types',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>JavaScript stores values in variables declared with <code>let</code> (can change),
          <code>const</code> (can't be reassigned), or the older <code>var</code> (avoid it).
          Core types: <strong>string</strong>, <strong>number</strong>, <strong>boolean</strong>,
          <strong>array</strong>, <strong>object</strong>, <code>null</code>, and <code>undefined</code>.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`let name = "Ada";
const age = 30;
let isLearning = true;
let hobbies = ["reading", "chess"];
let person = { name: "Ada", age: 30 };

console.log(typeof name, typeof age, typeof isLearning);` },
        { type: 'note', kind: 'tip', html: 'Use <code>console.log()</code> to inspect values while developing. Open your browser\'s DevTools console to see it (in these playgrounds, output also appears if you log to the page — try <code>document.body.innerHTML += ...</code>, or just trust the console).' },
        { type: 'web', task: 'Declare a const for your name and a let for a counter number, then display them on the page using document.write or by setting an element\'s textContent.', starter: {
          html: `<div id="output">Open the JS tab and edit the script, then hit Run.</div>`,
          js: `const myName = "Ada";\nlet counter = 0;\n\ndocument.getElementById('output').textContent = myName + ' — counter: ' + counter;`,
        }},
      ],
      quiz: [
        { q: 'Which keyword declares a variable that cannot be reassigned?', choices: ['let', 'const', 'var'], answer: 1, explain: 'const creates a binding that can\'t be reassigned (though objects/arrays it holds can still be mutated).' },
        { q: 'What does typeof [] return?', choices: ['"array"', '"object"', '"list"'], answer: 1, explain: 'Arrays are technically objects in JavaScript, so typeof [] is "object".' },
      ],
    },

    {
      id: 'js-2',
      title: 'Operators & Control Flow',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>Comparisons (<code>===</code>, <code>!==</code>, <code>&lt;</code>, <code>&gt;</code>) and
          logic (<code>&&</code>, <code>||</code>, <code>!</code>) drive <code>if/else</code> statements
          and loops. Always prefer <code>===</code> (strict equality) over <code>==</code>, which does
          confusing type conversions.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`let score = 72;

if (score >= 90) {
  console.log("A");
} else if (score >= 70) {
  console.log("B");
} else {
  console.log("Needs improvement");
}

for (let i = 0; i < 3; i++) {
  console.log("Loop iteration", i);
}` },
        { type: 'predict', lang: 'javascript', code: `console.log(5 === "5");\nconsole.log(5 == "5");`, options: ['true then true', 'false then true', 'true then false'], answer: 1, explain: '=== checks type and value (number vs string → false). == converts types first, so 5 == "5" is true. This is exactly why === is preferred.' },
        { type: 'web', task: 'Write an if/else chain that logs whether a "temperature" variable is "hot", "warm", or "cold", and show the result on the page.', starter: {
          html: `<div id="output"></div>`,
          js: `const temperature = 15;\nlet result;\n\nif (temperature > 25) {\n  result = "hot";\n} else if (temperature > 10) {\n  result = "warm";\n} else {\n  result = "cold";\n}\n\ndocument.getElementById('output').textContent = 'It is ' + result;`,
        }},
      ],
      quiz: [
        { q: 'What is the difference between == and ===?', choices: ['No difference', '=== also checks the type; == converts types first', '== is faster'], answer: 1, explain: '=== is "strict equality" (no type conversion); == will coerce types before comparing.' },
        { q: 'How many times does "for (let i = 0; i < 3; i++)" run its body?', choices: ['2', '3', '4'], answer: 1, explain: 'i starts at 0 and runs while i < 3, so i = 0, 1, 2 — three iterations.' },
      ],
    },

    {
      id: 'js-3',
      title: 'Functions',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>Functions package up reusable logic. You can declare them, or write them as
          <strong>arrow functions</strong> — very common in modern JavaScript.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`function add(a, b) {
  return a + b;
}

const multiply = (a, b) => a * b;

console.log(add(2, 3));      // 5
console.log(multiply(2, 3)); // 6` },
        { type: 'web', task: 'Write a function called greet(name) that returns a greeting string, then call it and display the result.', starter: {
          html: `<div id="output"></div>`,
          js: `function greet(name) {\n  return "Hello, " + name + "!";\n}\n\ndocument.getElementById('output').textContent = greet("world");`,
        }},
      ],
      quiz: [
        { q: 'What does a function that has no return statement return?', choices: ['0', 'undefined', 'An error is thrown'], answer: 1, explain: 'A function without an explicit return implicitly returns undefined.' },
        { q: 'Which is a valid arrow function that doubles a number?', choices: ['const double = (n) => n * 2;', 'const double = n -> n * 2;', 'function double => n * 2;'], answer: 0, explain: 'Arrow function syntax: (params) => expression.' },
      ],
    },

    {
      id: 'js-4',
      title: 'Arrays & Objects',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p><strong>Arrays</strong> are ordered lists; <strong>objects</strong> are key-value pairs.
          Array methods like <code>.map()</code>, <code>.filter()</code>, and <code>.forEach()</code>
          are extremely common for working with lists of data (including data that came from JSON!).</p>
        `},
        { type: 'code', lang: 'javascript', code:
`const books = [
  { title: "Kindred", year: 1979 },
  { title: "Americanah", year: 2013 },
];

const titles = books.map(b => b.title);
const recent = books.filter(b => b.year > 2000);

console.log(titles);   // ["Kindred", "Americanah"]
console.log(recent);   // [{ title: "Americanah", year: 2013 }]` },
        { type: 'web', task: 'Add a third book object to the array, then use .filter() to find books published before 2000, and display the titles joined with commas.', starter: {
          html: `<div id="output"></div>`,
          js: `const books = [\n  { title: "Kindred", year: 1979 },\n  { title: "Americanah", year: 2013 },\n];\n\nconst old = books.filter(b => b.year < 2000);\nconst titles = old.map(b => b.title);\n\ndocument.getElementById('output').textContent = titles.join(', ');`,
        }},
      ],
      quiz: [
        { q: 'What does array.map() return?', choices: ['A single value', 'A new array with each item transformed', 'The original array mutated'], answer: 1, explain: '.map() creates a brand-new array by applying a function to every element.' },
        { q: 'How do you access the "title" property of an object called book?', choices: ['book->title', 'book.title', 'book[title]'], answer: 1, explain: 'Dot notation (book.title) is the standard way; book["title"] also works.' },
      ],
    },

    {
      id: 'js-template-strings',
      title: 'Template Literals & String Methods',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p><strong>Template literals</strong> (backtick strings) let you embed expressions directly
          with <code>\${...}</code>, and span multiple lines without special escaping — much cleaner
          than <code>+</code> concatenation. Common string methods:
          <code>.includes()</code>, <code>.trim()</code>, <code>.split()</code>,
          <code>.padStart()</code>/<code>.padEnd()</code>, <code>.replace()</code>.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`const name = "Ada";
const score = 92;

// Old way:
console.log("Hi " + name + ", you scored " + score + "%.");

// Template literal:
console.log(\`Hi \${name}, you scored \${score}%.\`);

const multiline = \`Line one
Line two\`;

console.log("  hello  ".trim());          // "hello"
console.log("a,b,c".split(","));          // ["a", "b", "c"]
console.log("5".padStart(3, "0"));        // "005"
console.log("cat".includes("a"));         // true` },
        { type: 'web', task: 'Use a template literal to build a sentence from a name and age variable, and use .padStart() to zero-pad a number to 4 digits.', starter: {
          html: `<div id="output"></div>`,
          js: `const name = "Ada";\nconst age = 30;\n\nconst sentence = \`\${name} is \${age} years old.\`;\nconst padded = String(7).padStart(4, "0");\n\ndocument.getElementById('output').textContent = sentence + ' / ' + padded;`,
        }},
      ],
      quiz: [
        { q: 'How do you embed a variable inside a template literal?', choices: ['{variable}', '${variable}', '%variable%'], answer: 1, explain: 'Template literals use ${expression} inside backtick strings.' },
        { q: 'What does "  hi  ".trim() return?', choices: ['"  hi  "', '"hi"', 'undefined'], answer: 1, explain: 'trim() removes whitespace from both ends of a string.' },
      ],
    },

    {
      id: 'js-5',
      title: 'The DOM & Events',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>The <strong>DOM</strong> (Document Object Model) is the browser's live representation of
          your HTML. JavaScript can select elements (<code>document.querySelector</code>), change them,
          and react to <strong>events</strong> like clicks.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`const button = document.querySelector('#myButton');
const output = document.querySelector('#output');
let clicks = 0;

button.addEventListener('click', () => {
  clicks++;
  output.textContent = "Clicked " + clicks + " times";
});` },
        { type: 'web', task: 'Build a tiny counter: a button that increases a number shown on the page each time it\'s clicked. Try adding a second button that resets it to 0.', starter: {
          html: `<button id="myButton">Click me</button>\n<p id="output">Clicked 0 times</p>`,
          js: `const button = document.querySelector('#myButton');\nconst output = document.querySelector('#output');\nlet clicks = 0;\n\nbutton.addEventListener('click', () => {\n  clicks++;\n  output.textContent = "Clicked " + clicks + " times";\n});`,
        }},
      ],
      quiz: [
        { q: 'What does document.querySelector(\'#myButton\') do?', choices: ['Creates a new button', 'Finds the first element with id="myButton"', 'Deletes the button'], answer: 1, explain: 'querySelector finds the first matching element using a CSS-style selector.' },
        { q: 'What runs when addEventListener(\'click\', fn) fires?', choices: ['fn runs immediately once', 'fn runs every time the element is clicked', 'The page reloads'], answer: 1, explain: 'The listener function runs each time the specified event occurs on that element.' },
      ],
    },

    {
      id: 'js-6',
      title: 'JavaScript & JSON',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>JSON is text; JavaScript objects are live values. <code>JSON.parse()</code> converts a
          JSON string into a JavaScript value; <code>JSON.stringify()</code> does the reverse. This is
          exactly what happens when your browser fetches data from a server.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`const jsonText = '{"name":"Ada","skills":["HTML","CSS"]}';
const data = JSON.parse(jsonText);
console.log(data.name);      // "Ada"
console.log(data.skills[0]); // "HTML"

const backToText = JSON.stringify(data);
console.log(backToText);` },
        { type: 'note', kind: 'info', html: 'In a real app you\'d get JSON text over the network with <code>fetch(url).then(r => r.json())</code>, which parses it for you automatically.' },
        { type: 'web', task: 'Parse the JSON string, add a new skill to the array, then stringify it back and display the result.', starter: {
          html: `<div id="output"></div>`,
          js: `const jsonText = '{"name":"Ada","skills":["HTML","CSS"]}';\nconst data = JSON.parse(jsonText);\n\ndata.skills.push("JavaScript");\n\ndocument.getElementById('output').textContent = JSON.stringify(data);`,
        }},
      ],
      quiz: [
        { q: 'What does JSON.parse() do?', choices: ['Converts a JS object into a JSON string', 'Converts a JSON string into a JS value', 'Deletes invalid JSON'], answer: 1, explain: 'parse: text → JS value. stringify: JS value → text.' },
      ],
    },

    {
      id: 'js-try-catch',
      title: 'Error Handling: try/catch',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>When code might fail — parsing bad JSON, a network request, a bug in user input — wrap
          it in <code>try { ... } catch (error) { ... }</code>. Code in <code>try</code> runs
          normally; if it throws, execution jumps straight to <code>catch</code> instead of crashing
          the whole script. <code>finally</code> (optional) always runs afterward, success or not.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`function parseAge(input) {
  try {
    const data = JSON.parse(input);
    if (typeof data.age !== "number") {
      throw new Error("age must be a number");
    }
    return data.age;
  } catch (error) {
    console.log("Failed to parse:", error.message);
    return null;
  } finally {
    console.log("Done trying.");
  }
}

parseAge('{"age": 30}');   // 30
parseAge('not json');       // null, logs the JSON syntax error
parseAge('{"age": "old"}'); // null, logs "age must be a number"` },
        { type: 'note', kind: 'tip', html: '<code>throw new Error("message")</code> raises your own error — you\'re not limited to catching errors JavaScript generates itself. This is the same idea as PHP\'s exceptions or Lua\'s error()/pcall().' },
        { type: 'web', task: 'Write a safeParse(jsonText) function that returns the parsed value, or the string "invalid JSON" if JSON.parse throws. Test it with both valid and invalid JSON.', starter: {
          html: `<div id="output"></div>`,
          js: `function safeParse(jsonText) {\n  try {\n    return JSON.parse(jsonText);\n  } catch (error) {\n    return "invalid JSON";\n  }\n}\n\nconst a = safeParse('{"ok": true}');\nconst b = safeParse('not json');\n\ndocument.getElementById('output').textContent = JSON.stringify(a) + ' / ' + b;`,
        }},
      ],
      quiz: [
        { q: 'What happens to code after a throw inside a try block?', choices: ['It keeps running normally', 'Execution jumps immediately to the catch block', 'The page reloads'], answer: 1, explain: 'Throwing immediately stops the try block and hands control to catch.' },
        { q: 'When does a finally block run?', choices: ['Only if there was no error', 'Only if there was an error', 'Always, whether or not an error occurred'], answer: 2, explain: 'finally runs regardless of the outcome — commonly used for cleanup.' },
      ],
    },

    {
      id: 'js-7',
      title: 'Async Basics: Promises & fetch',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>Some operations (loading data from a server, waiting on a timer) take time and shouldn't
          freeze the page. JavaScript handles this with <strong>Promises</strong> and the
          <code>async</code>/<code>await</code> syntax built on top of them.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("Starting…");
  await delay(1000);
  console.log("...1 second later");
}

run();

// Fetching real data from a server looks like:
// async function loadUsers() {
//   const response = await fetch("/api/users");
//   const users = await response.json(); // parses JSON automatically
//   console.log(users);
// }` },
        { type: 'note', kind: 'tip', html: '<code>await</code> can only be used inside an <code>async</code> function. It pauses that function (not the whole page) until the promise finishes.' },
        { type: 'web', task: 'Run this and watch the output update after a delay — it proves the page stays responsive while waiting.', starter: {
          html: `<div id="output">Waiting…</div>`,
          js: `function delay(ms) {\n  return new Promise(resolve => setTimeout(resolve, ms));\n}\n\nasync function run() {\n  await delay(1500);\n  document.getElementById('output').textContent = 'Done after 1.5 seconds!';\n}\n\nrun();`,
        }},
      ],
      quiz: [
        { q: 'Where can you use the await keyword?', choices: ['Anywhere in any function', 'Only inside a function declared async', 'Only at the very top of a file'], answer: 1, explain: 'await is only valid inside async functions (or, in modern environments, at a module\'s top level).' },
        { q: 'What does fetch(url).then(r => r.json()) do?', choices: ['Sends a form', 'Requests a URL and parses the response body as JSON', 'Deletes a file on the server'], answer: 1, explain: 'fetch() makes an HTTP request; .json() reads and parses the JSON response body.' },
      ],
    },

    {
      id: 'js-classes',
      title: 'Classes in JavaScript',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>A <code>class</code> is a blueprint for creating objects that bundle data and behavior
          together — the same idea as PHP's classes or Lua's metatable pattern, with cleaner syntax.
          <code>constructor</code> runs when you create an instance with <code>new</code>;
          <code>this</code> refers to that specific instance. <code>extends</code> lets one class
          inherit from another.</p>
        `},
        { type: 'code', lang: 'javascript', code:
`class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return \`\${this.name} makes a sound\`;
  }
}

class Dog extends Animal {
  speak() {
    return \`\${this.name} barks\`;   // overrides Animal's speak()
  }
}

const a = new Animal("Generic Animal");
const d = new Dog("Rex");
console.log(a.speak());  // "Generic Animal makes a sound"
console.log(d.speak());  // "Rex barks"` },
        { type: 'note', kind: 'tip', html: 'Under the hood, JavaScript classes are still based on prototypes (similar in spirit to how a Lua metatable\'s __index provides fallback methods) — class syntax is a cleaner way to write the same pattern.' },
        { type: 'web', task: 'Build a Counter class with a constructor that sets count to 0, and an increment() method that adds 1 and returns the new count. Create one and call increment() twice.', starter: {
          html: `<div id="output"></div>`,
          js: `class Counter {\n  constructor() {\n    this.count = 0;\n  }\n  increment() {\n    this.count += 1;\n    return this.count;\n  }\n}\n\nconst c = new Counter();\nc.increment();\nconst result = c.increment();\n\ndocument.getElementById('output').textContent = 'Count: ' + result;`,
        }},
      ],
      quiz: [
        { q: 'What does the constructor method do?', choices: ['Deletes an object', 'Runs automatically when a new instance is created with new', 'Converts the class to JSON'], answer: 1, explain: 'constructor sets up a new instance\'s initial state when you call new ClassName(...).' },
        { q: 'What does extends do?', choices: ['Makes a class longer', 'Lets one class inherit properties and methods from another', 'Deletes a class'], answer: 1, explain: 'extends sets up inheritance — the subclass gets everything from the parent class unless it overrides it.' },
      ],
    },

    {
      id: 'js-8',
      title: 'Mouse Tracking & Magnetic Buttons',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>Time to build the effect from the end of the CSS button lesson: a button that reacts to
          exactly where your cursor is. The core idea is always the same three steps:</p>
          <ol>
            <li>Listen for <code>mousemove</code> on the element (or a container around it).</li>
            <li><code>element.getBoundingClientRect()</code> gives you the element's current position
                and size on screen, so you can work out the cursor's position <em>relative to the
                element</em> instead of the whole page.</li>
            <li>Turn that relative position into a <code>transform</code> (or <code>left</code>/
                <code>top</code>) that moves the element — with a CSS <code>transition</code> so it
                doesn't feel jerky.</li>
          </ol>
        `},
        { type: 'code', lang: 'javascript', caption: 'The "magnetic button" effect — nudges toward the cursor', code:
`const btn = document.querySelector('.magnetic-btn');

btn.addEventListener('mousemove', (e) => {
  const rect = btn.getBoundingClientRect();
  const offsetX = e.clientX - rect.left - rect.width / 2;
  const offsetY = e.clientY - rect.top - rect.height / 2;
  // Move only a fraction of the offset so it feels "magnetic", not glued to the cursor
  btn.style.transform = \`translate(\${offsetX * 0.3}px, \${offsetY * 0.3}px)\`;
});

btn.addEventListener('mouseleave', () => {
  btn.style.transform = 'translate(0, 0)'; // snap back
});` },
        { type: 'note', kind: 'tip', html: 'The <code>* 0.3</code> is the whole trick — it moves the button only 30% of the way toward the cursor\'s offset from center, which reads as "attracted to" the cursor rather than "stuck to" it. Try changing it in the playground below and feel the difference.' },
        { type: 'web', task: 'Move your mouse over the button and watch it nudge toward your cursor. Try changing the 0.3 multiplier (try 0.1, then 0.8) and the transition duration in the CSS.', starter: {
          html: `<div style="display:flex; justify-content:center; padding:40px;">\n  <button class="magnetic-btn">Hover me</button>\n</div>`,
          css:
`.magnetic-btn {
  padding: 18px 36px;
  border: none;
  border-radius: 50px;
  background: linear-gradient(135deg, #6c5ce7, #00b894);
  color: white;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.15s ease-out;
}`,
          js:
`const btn = document.querySelector('.magnetic-btn');

btn.addEventListener('mousemove', (e) => {
  const rect = btn.getBoundingClientRect();
  const offsetX = e.clientX - rect.left - rect.width / 2;
  const offsetY = e.clientY - rect.top - rect.height / 2;
  btn.style.transform = \`translate(\${offsetX * 0.3}px, \${offsetY * 0.3}px)\`;
});

btn.addEventListener('mouseleave', () => {
  btn.style.transform = 'translate(0, 0)';
});`,
        }},

        { type: 'text', html: `
          <p>The same technique, taken further, gives you a button that <strong>literally follows
          your cursor</strong> around a whole area — instead of a fraction of the offset, you track
          the cursor's absolute position inside a container.</p>
        `},
        { type: 'web', task: 'Move your mouse anywhere inside the gray box — the button follows it directly. This one uses left/top positioning instead of transform, since the button needs to move around a large area, not just nudge slightly.', starter: {
          html: `<div id="chaseArea" style="position:relative; width:100%; height:220px; background:#eee; border-radius:12px; overflow:hidden;">\n  <button id="chaseBtn" style="position:absolute; padding:12px 22px; border:none; border-radius:999px; background:#d63031; color:white; font-weight:700; cursor:pointer;">Catch me!</button>\n</div>`,
          js:
`const area = document.getElementById('chaseArea');
const btn = document.getElementById('chaseBtn');

area.addEventListener('mousemove', (e) => {
  const rect = area.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  btn.style.left = (x - btn.offsetWidth / 2) + 'px';
  btn.style.top = (y - btn.offsetHeight / 2) + 'px';
});`,
        }},
        { type: 'note', kind: 'warning', html: 'Effects like this are fun and can make a hero section or a call-to-action button memorable — but overusing them (or attaching them to buttons people need to click precisely, like "Submit") hurts usability. Save it for decorative or playful elements.' },
      ],
      quiz: [
        { q: 'What does element.getBoundingClientRect() give you?', choices: ['The element\'s CSS class names', 'The element\'s current size and position relative to the viewport', 'The element\'s HTML content'], answer: 1, explain: 'getBoundingClientRect() returns { top, left, width, height, ... } describing where the element currently is on screen.' },
        { q: 'In the magnetic button, why multiply the offset by 0.3 instead of using it directly?', choices: ['To make the math run faster', 'So the button moves only partway toward the cursor, feeling "attracted" rather than glued to it', 'It has no visible effect'], answer: 1, explain: 'Scaling down the offset is what creates the "magnetic pull" feel instead of the button snapping exactly to the cursor.' },
        { q: 'Why does the "chase" demo use left/top instead of transform like the magnetic button?', choices: ['left/top and transform are identical, no real reason', 'The button needs to move across a whole area rather than nudge slightly around its own position', 'transform doesn\'t work with mousemove'], answer: 1, explain: 'transform is ideal for small nudges around an element\'s natural position; positioning across a larger area is naturally expressed with absolute left/top coordinates.' },
      ],
    },
  ],
};
