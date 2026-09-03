window.COURSE = window.COURSE || {};

/* PHP runs on a server, not in the browser, so these lessons use "predict the output" exercises
   instead of a live editor. See the note in lesson php-1 for how to actually run PHP yourself. */

window.COURSE.php = {
  id: 'php',
  title: 'PHP',
  icon: '🐘',
  description: 'A server-side language that generates web pages, handles forms, and talks to databases.',
  lessons: [
    {
      id: 'php-1',
      title: 'What is PHP & How It Runs',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>Everything so far (HTML, CSS, JavaScript) runs in the visitor's <strong>browser</strong>.
          <strong>PHP</strong> is different: it runs on the <strong>server</strong>, before the page is
          sent anywhere. The server executes the PHP code, and the visitor only ever receives the
          resulting HTML — they never see your PHP source.</p>
          <p>PHP code lives inside <code>&lt;?php ... ?&gt;</code> tags, which can be mixed directly
          into an HTML file. <code>echo</code> outputs text.</p>
        `},
        { type: 'code', lang: 'php', caption: 'greeting.php', code:
`<!doctype html>
<html>
<body>
  <h1>Welcome!</h1>
  <?php
    $name = "Ada";
    echo "<p>Hello, " . $name . "!</p>";
  ?>
</body>
</html>` },
        { type: 'note', kind: 'info', html: `Because these lessons run in your browser only, we can't execute real PHP here. Instead, you'll
          read PHP code and predict what it outputs — the same skill you use when debugging real code.
          To actually run PHP yourself: install PHP, then run <code>php -S localhost:8000</code> in a
          folder with a .php file and open it in your browser.` },
        { type: 'predict', lang: 'php', code:
`<?php
  $city = "Lagos";
  echo "I live in " . $city;
?>`, options: ['I live in Lagos', 'I live in $city', 'city'], answer: 0, explain: 'The dot (.) concatenates strings, and $city is replaced with its value, "Lagos".' },
      ],
      quiz: [
        { q: 'Where does PHP code execute?', choices: ['In the visitor\'s browser', 'On the web server, before the page is sent', 'Inside the SQL database'], answer: 1, explain: 'PHP is server-side — it runs before the response reaches the browser, which only sees the resulting HTML.' },
        { q: 'What tag wraps PHP code inside an HTML file?', choices: ['<script php>...</script>', '<?php ... ?>', '<%php ... %>'], answer: 1, explain: '<?php opens a PHP block, ?> closes it.' },
      ],
    },

    {
      id: 'php-2',
      title: 'Variables & Data Types',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>PHP variables start with <code>$</code> and don't need a declared type — very similar to
          JavaScript's <code>let</code>. Types include strings, integers, floats, booleans, arrays,
          and <code>null</code>.</p>
        `},
        { type: 'code', lang: 'php', code:
`<?php
  $name = "Ada";
  $age = 30;
  $price = 12.99;
  $isMember = true;

  echo gettype($age);   // integer
  echo $name . " is " . $age . " years old.";
?>` },
        { type: 'note', kind: 'tip', html: 'In JavaScript you\'d write <code>name + " is " + age</code>; in PHP the concatenation operator is a dot (<code>.</code>) instead of a plus sign.' },
        { type: 'predict', lang: 'php', code:
`<?php
  $a = "5";
  $b = 5;
  if ($a == $b) {
    echo "equal";
  } else {
    echo "not equal";
  }
?>`, options: ['equal', 'not equal', 'a PHP error'], answer: 0, explain: 'Like JavaScript\'s ==, PHP\'s == converts types before comparing, so "5" == 5 is true. (PHP also has === for strict comparison, just like JS.)' },
      ],
      quiz: [
        { q: 'How do you start a variable name in PHP?', choices: ['With "var "', 'With a $ sign', 'With "let "'], answer: 1, explain: 'All PHP variables are written as $variableName.' },
        { q: 'What operator concatenates (joins) strings in PHP?', choices: ['+', '.', '&'], answer: 1, explain: 'PHP uses a dot (.) to join strings, unlike JavaScript\'s +.' },
      ],
    },

    {
      id: 'php-3',
      title: 'Control Structures & Loops',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>PHP's <code>if/elseif/else</code>, <code>for</code>, <code>while</code>, and
          <code>foreach</code> work almost exactly like their JavaScript equivalents.
          <code>foreach</code> is the PHP way to loop over an array.</p>
        `},
        { type: 'code', lang: 'php', code:
`<?php
  $scores = [55, 82, 91];

  foreach ($scores as $score) {
    if ($score >= 90) {
      echo $score . ": A\\n";
    } elseif ($score >= 70) {
      echo $score . ": B\\n";
    } else {
      echo $score . ": C\\n";
    }
  }
?>` },
        { type: 'predict', lang: 'php', code:
`<?php
  $total = 0;
  for ($i = 1; $i <= 4; $i++) {
    $total += $i;
  }
  echo $total;
?>`, options: ['4', '10', '16'], answer: 1, explain: 'The loop adds 1 + 2 + 3 + 4 = 10.' },
      ],
      quiz: [
        { q: 'Which loop is idiomatic for iterating over every item in a PHP array?', choices: ['foreach', 'while', 'repeat'], answer: 0, explain: 'foreach ($array as $item) is the standard way to loop over an array\'s values in PHP.' },
      ],
    },

    {
      id: 'php-4',
      title: 'Functions',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>PHP functions use the <code>function</code> keyword and can take default parameter
          values.</p>
        `},
        { type: 'code', lang: 'php', code:
`<?php
  function greet($name, $greeting = "Hello") {
    return $greeting . ", " . $name . "!";
  }

  echo greet("Ada");             // Hello, Ada!
  echo greet("Grace", "Hi");     // Hi, Grace!
?>` },
        { type: 'predict', lang: 'php', code:
`<?php
  function square($n) {
    return $n * $n;
  }

  echo square(4) + square(2);
?>`, options: ['16', '20', '36'], answer: 1, explain: 'square(4) is 16, square(2) is 4, and 16 + 4 = 20.' },
      ],
      quiz: [
        { q: 'What does "$greeting = \\"Hello\\"" in a function\'s parameter list do?', choices: ['Sets a default value used when the caller omits that argument', 'Makes the parameter required', 'Declares a global variable'], answer: 0, explain: 'Default parameter values are used only if the caller doesn\'t pass that argument.' },
      ],
    },

    {
      id: 'php-5',
      title: 'Arrays & JSON in PHP',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>PHP arrays can be <strong>indexed</strong> (numbered, like JS arrays) or
          <strong>associative</strong> (string keys, like JS objects). PHP's <code>json_encode()</code>
          and <code>json_decode()</code> convert between PHP arrays and JSON text — this is how a PHP
          backend typically sends data to JavaScript running in the browser.</p>
        `},
        { type: 'code', lang: 'php', code:
`<?php
  $fruits = ["apple", "banana", "cherry"];          // indexed array
  $book = ["title" => "Kindred", "year" => 1979];   // associative array

  echo $fruits[1];        // banana
  echo $book["title"];    // Kindred

  echo json_encode($book);
  // {"title":"Kindred","year":1979}

  $data = json_decode('{"a":1,"b":2}', true); // true = decode as an array
  echo $data["a"]; // 1
?>` },
        { type: 'predict', lang: 'php', code:
`<?php
  $colors = ["red", "green", "blue"];
  echo count($colors) . " - " . $colors[2];
?>`, options: ['3 - blue', '2 - blue', '3 - green'], answer: 0, explain: 'count() returns the number of items (3). Array indices start at 0, so $colors[2] is the third item, "blue".' },
      ],
      quiz: [
        { q: 'What\'s the PHP equivalent of a JavaScript object like { title: "Kindred" }?', choices: ['An indexed array', 'An associative array: ["title" => "Kindred"]', 'A PHP variable named $object'], answer: 1, explain: 'Associative arrays use => to map string keys to values, just like JS object properties.' },
        { q: 'What does json_encode($book) produce?', choices: ['A PHP array', 'A JSON-formatted string', 'An HTML table'], answer: 1, explain: 'json_encode() converts a PHP value into a JSON string — ready to send to JavaScript.' },
      ],
    },

    {
      id: 'php-6',
      title: 'Forms, Databases & the Full Picture',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>PHP's superglobals <code>$_GET</code> and <code>$_POST</code> hold form data submitted by
          a visitor, keyed by each input's <code>name</code> attribute (remember those from the HTML
          forms lesson!). A typical flow:</p>
          <ol>
            <li>An HTML <code>&lt;form method="POST" action="save.php"&gt;</code> is submitted.</li>
            <li><code>save.php</code> reads <code>$_POST['field_name']</code> for each input.</li>
            <li>PHP connects to a SQL database (commonly using <strong>PDO</strong>) and runs an
                <code>INSERT</code> to store the data.</li>
            <li>PHP can then <code>echo</code> HTML, or <code>json_encode()</code> data for JavaScript
                to use.</li>
          </ol>
        `},
        { type: 'code', lang: 'php', caption: 'save.php — handling a form and talking to a database', code:
`<?php
  $name = $_POST['name'];
  $email = $_POST['email'];

  // PDO: PHP's standard way to talk to a SQL database
  $pdo = new PDO('sqlite:members.db');
  $stmt = $pdo->prepare('INSERT INTO members (name, email) VALUES (?, ?)');
  $stmt->execute([$name, $email]);

  echo "Thanks for signing up, " . htmlspecialchars($name) . "!";
?>` },
        { type: 'note', kind: 'warning', html: 'Notice the <code>?</code> placeholders and <code>execute([$name, $email])</code> instead of building the SQL string by hand with concatenation. This is a <strong>prepared statement</strong> — it prevents SQL injection, a serious security vulnerability where an attacker sneaks SQL commands into a form field. Never build a query by pasting user input directly into a SQL string.' },
        { type: 'predict', lang: 'php', code:
`<?php
  // Form was submitted with: <input name="username" value="grace">
  echo "Welcome, " . $_POST['username'];
?>`, options: ['Welcome, username', 'Welcome, grace', 'A PHP error, since $_POST isn\'t defined'], answer: 1, explain: '$_POST[\'username\'] retrieves the submitted value using the input\'s name attribute as the key.' },
      ],
      quiz: [
        { q: 'What does $_POST[\'email\'] contain?', choices: ['The database column named email', 'The value submitted by a form input named "email"', 'The visitor\'s email inferred automatically'], answer: 1, explain: '$_POST (and $_GET) holds submitted form values, keyed by each input\'s name attribute.' },
        { q: 'Why use a prepared statement (with ? placeholders) instead of concatenating user input into SQL?', choices: ['It runs faster in every case', 'It prevents SQL injection attacks', 'It is required by PHP syntax'], answer: 1, explain: 'Prepared statements keep user input as data, never as executable SQL — this is the standard defense against SQL injection.' },
      ],
    },

    {
      id: 'php-7',
      title: 'Intro to Classes & OOP',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>So far every example has been standalone variables and functions. Real PHP applications
          (and the frameworks built on top of PHP) are organized around <strong>classes</strong> — a
          blueprint for creating objects that bundle related data (<strong>properties</strong>) and
          behavior (<strong>methods</strong>) together.</p>
        `},
        { type: 'code', lang: 'php', code:
`<?php
  class Book {
    public string $title;
    public float $price;

    public function __construct(string $title, float $price) {
      $this->title = $title;
      $this->price = $price;
    }

    public function describe(): string {
      return $this->title . " costs $" . $this->price;
    }
  }

  $book = new Book("Kindred", 12.99);
  echo $book->describe(); // Kindred costs $12.99
?>` },
        { type: 'text', html: `
          <ul>
            <li><code>class Book { ... }</code> defines the blueprint.</li>
            <li><code>__construct()</code> is a special method that runs automatically when you create
                a new object with <code>new Book(...)</code> — it's where you set up initial values.</li>
            <li><code>$this</code> refers to "the specific object this code is currently running on" —
                inside a method, <code>$this-&gt;title</code> means "this particular book's title".</li>
            <li><code>-&gt;</code> (not a dot!) accesses a property or method on an object.</li>
          </ul>
        `},
        { type: 'note', kind: 'tip', html: 'If this feels similar to JavaScript objects with methods, that instinct is right — classes are how most languages formalize the same "bundle data with the functions that act on it" idea you\'ve already used informally with PHP associative arrays and JS objects.' },
        { type: 'predict', lang: 'php', code:
`<?php
  class Counter {
    public int $count = 0;

    public function increment(): void {
      $this->count++;
    }
  }

  $c = new Counter();
  $c->increment();
  $c->increment();
  echo $c->count;
?>`, options: ['0', '1', '2'], answer: 2, explain: 'increment() is called twice, each adding 1 to $this->count, starting from 0 — so the final value is 2.' },
        { type: 'predict', lang: 'php', code:
`<?php
  class Book {
    public function __construct(public string $title) {}
  }

  $a = new Book("Kindred");
  $b = new Book("Americanah");
  echo $a->title . " / " . $b->title;
?>`, options: ['Kindred / Kindred', 'Kindred / Americanah', 'Americanah / Americanah'], answer: 1, explain: 'Each call to "new Book(...)" creates a completely separate object with its own $title — $a and $b don\'t share state.' },
      ],
      quiz: [
        { q: 'What does __construct() do?', choices: ['Deletes an object', 'Runs automatically when a new object is created, to set up initial values', 'Converts an object to JSON'], answer: 1, explain: '__construct() is the constructor — PHP calls it automatically whenever you write new ClassName(...).' },
        { q: 'What does $this refer to inside a class method?', choices: ['The global scope', 'The specific object the method is currently running on', 'The class definition itself, shared by all objects'], answer: 1, explain: '$this always refers to the particular instance (object) the method was called on.' },
        { q: 'If you create two separate objects from the same class, do they share their property values?', choices: ['Yes, always', 'No — each object (instance) has its own independent copy of its properties', 'Only if you use the static keyword'], answer: 1, explain: 'Each "new" call creates an independent object with its own property values, unless you specifically opt into shared (static) state.' },
      ],
    },
  ],
};
