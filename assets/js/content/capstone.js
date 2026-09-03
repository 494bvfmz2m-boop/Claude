window.COURSE = window.COURSE || {};

window.COURSE.capstone = {
  id: 'capstone',
  title: 'How It All Fits Together',
  icon: '🧠',
  description: 'One example walking through a full request, using every piece you\'ve learned.',
  lessons: [
    {
      id: 'capstone-1',
      title: 'Anatomy of a Web Request',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>Let's trace exactly what happens when someone submits a "Add a book review" form on a
          site built with everything you've learned:</p>
        `},
        { type: 'code', lang: 'text', caption: '1. HTML — the form the visitor sees', code:
`<form method="POST" action="add_review.php">
  <input type="text" name="book_title" required>
  <select name="rating"><option>5</option><option>4</option><option>3</option></select>
  <textarea name="comment"></textarea>
  <button type="submit">Submit Review</button>
</form>` },
        { type: 'code', lang: 'javascript', caption: '2. JavaScript (optional) — validate before sending, or submit without reloading the page', code:
`form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const response = await fetch('add_review.php', {
    method: 'POST',
    body: new FormData(form),
  });
  const result = await response.json(); // the server replies with JSON
  output.textContent = result.message;
});` },
        { type: 'code', lang: 'php', caption: '3. PHP (add_review.php) — runs on the server', code:
`<?php
  $title = $_POST['book_title'];
  $rating = (int) $_POST['rating'];
  $comment = $_POST['comment'];

  $pdo = new PDO('sqlite:reviews.db');
  $stmt = $pdo->prepare(
    'INSERT INTO reviews (book_title, rating, comment) VALUES (?, ?, ?)'
  );
  $stmt->execute([$title, $rating, $comment]);

  header('Content-Type: application/json');
  echo json_encode(['message' => 'Review saved. Thank you!']);
?>` },
        { type: 'code', lang: 'sql', caption: '4. SQL — what actually happens inside the database', code:
`INSERT INTO reviews (book_title, rating, comment)
VALUES ('Kindred', 5, 'Loved every page.');` },
        { type: 'code', lang: 'json', caption: '5. JSON — the server\'s reply, understood by the JavaScript that sent the request', code:
`{ "message": "Review saved. Thank you!" }` },
        { type: 'text', html: `
          <p>Step by step:</p>
          <ol>
            <li><strong>HTML</strong> structures the form so the browser can collect input.</li>
            <li><strong>CSS</strong> (not shown) makes that form look good and usable.</li>
            <li><strong>JavaScript</strong>, running in the browser, optionally intercepts the submit
                and sends the data over the network with <code>fetch</code>.</li>
            <li><strong>PHP</strong>, running on the server, receives the submitted values via
                <code>$_POST</code>.</li>
            <li>PHP uses a prepared statement to safely run <strong>SQL</strong>, storing the new row
                in the database.</li>
            <li>PHP replies with <strong>JSON</strong>, which the browser's JavaScript reads with
                <code>response.json()</code> to update the page — no full reload needed.</li>
          </ol>
          <p>Every lesson you completed is one link in this chain. A "front-end developer" mostly works
          in steps 1–3; a "back-end developer" mostly works in steps 4–6; a "full-stack developer" does
          both.</p>
        `},
        { type: 'note', kind: 'tip', html: 'This same pattern — HTML form → JS fetch → server code → SQL → JSON response → JS updates the page — is behind almost every interactive feature on the web: likes, comments, shopping carts, logins, and search boxes.' },
      ],
      quiz: [
        { q: 'In the flow above, what triggers the PHP code to run?', choices: ['The browser interprets it directly', 'A request reaches the server (here, the form submission)', 'The SQL database calls it'], answer: 1, explain: 'PHP only runs when the server receives a request for a .php file (or an endpoint routed to PHP code) — it never runs in the browser.' },
        { q: 'Why does the server reply with JSON instead of, say, a SQL statement?', choices: ['JSON is required by all servers', 'JSON is a simple, language-independent format JavaScript can parse directly with response.json()', 'SQL cannot be sent over a network'], answer: 1, explain: 'JSON is the common language between the server (PHP) and the browser (JavaScript) — easy for both to read and write.' },
        { q: 'Which of these best describes a "full-stack" developer?', choices: ['Someone who only writes SQL', 'Someone comfortable working across the front end (HTML/CSS/JS) and the back end (server code + database)', 'Someone who never uses JavaScript'], answer: 1, explain: 'Full-stack means comfortable across both the browser side and the server/database side.' },
      ],
    },
  ],
};
