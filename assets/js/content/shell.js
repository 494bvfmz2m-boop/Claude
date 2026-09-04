window.COURSE = window.COURSE || {};

/* The shell playgrounds below run against a real (if small) command interpreter and
   in-memory filesystem — genuinely executed, not scripted. It supports the everyday
   subset of Bash: navigation, files, pipes, redirects, variables, grep, and &&/||/;
   chaining. It does not parse full if/for/while syntax — those are taught with
   "predict the output" exercises instead, same approach as the PHP track. */

window.COURSE.shell = {
  id: 'shell',
  title: 'Shell',
  icon: '💲',
  description: 'The command line — navigating, manipulating files, and chaining tools together. Runs in a real (simulated) terminal below.',
  lessons: [
    {
      id: 'sh-1',
      title: 'What is a Shell?',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>A <strong>shell</strong> (like Bash, the most common one on Linux/macOS) is a
          program that reads commands you type and runs them. A <strong>terminal</strong> is the
          window you type into; the shell is what actually interprets what you type. Three commands
          you'll use constantly: <code>pwd</code> (print working directory — where am I?),
          <code>ls</code> (list — what's here?), and <code>cd</code> (change directory — go there).</p>
        `},
        { type: 'code', lang: 'bash', code:
`pwd
# /home/user

ls
# notes.txt  projects/  todo.txt

cd projects
pwd
# /home/user/projects` },
        { type: 'note', kind: 'info', html: 'The playground below runs against a real, simulated file system sandboxed to your browser — genuine command execution, not canned output. It starts you in <code>/home/user</code> with a couple of sample files and a projects folder, exactly like the example above.' },
        { type: 'shell', task: 'Run pwd, then ls, then cd into projects and run pwd again to confirm you moved.', starter: `pwd
ls
cd projects
pwd` },
      ],
      quiz: [
        { q: 'What does pwd stand for/do?', choices: ['Password display', 'Print Working Directory — shows where you currently are', 'Permanently delete'], answer: 1, explain: 'pwd prints the full path of your current location in the filesystem.' },
        { q: 'What is the difference between a terminal and a shell?', choices: ['They are exactly the same thing', 'The terminal is the window; the shell is the program interpreting your commands inside it', 'A shell is a type of file'], answer: 1, explain: 'The terminal is the interface/window; the shell (e.g. Bash) is the actual command interpreter running inside it.' },
      ],
    },

    {
      id: 'sh-2',
      title: 'Files & Directories',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><code>mkdir</code> makes a directory, <code>touch</code> creates an empty file (or
          updates one that exists), <code>rm</code> removes a file (<code>rm -r</code> for a
          directory and everything inside it), <code>cp source dest</code> copies, and
          <code>mv source dest</code> moves or renames.</p>
        `},
        { type: 'code', lang: 'bash', code:
`mkdir photos
touch photos/beach.jpg
cp photos/beach.jpg photos/beach-backup.jpg
mv photos/beach-backup.jpg photos/beach-2024.jpg
rm photos/beach.jpg
ls photos` },
        { type: 'note', kind: 'warning', html: '<code>rm</code> does not use a trash can — it deletes immediately and permanently (in a real shell). Always double check the path before running rm, especially with -r.' },
        { type: 'shell', task: 'Create a directory called "site", touch a file "site/index.html", then copy it to "site/index-backup.html" and list the site directory to confirm both exist.', starter: `mkdir site
touch site/index.html
cp site/index.html site/index-backup.html
ls site`, verify: (state) => {
          const dir = window.ShellSim.getNode(state, ['home', 'user', 'site']);
          if (!dir || dir.type !== 'dir') return { pass: false, message: 'No "site" directory found — did mkdir run?' };
          const hasBoth = dir.children['index.html'] && dir.children['index-backup.html'];
          return hasBoth
            ? { pass: true, message: 'site/ contains both index.html and index-backup.html.' }
            : { pass: false, message: 'Expected both index.html and index-backup.html inside site/.' };
        }},
      ],
      quiz: [
        { q: 'What does rm -r do that plain rm can\'t?', choices: ['Renames a file', 'Removes a directory and everything inside it', 'Restores a deleted file'], answer: 1, explain: 'Plain rm only removes files; -r ("recursive") is needed to remove a directory and its contents.' },
        { q: 'What does mv do?', choices: ['Only renames files, never moves them', 'Moves and/or renames a file or directory', 'Makes a new virtual machine'], answer: 1, explain: 'mv relocates a file/directory to a new path — if the new path is just a different name in the same folder, that\'s effectively a rename.' },
      ],
    },

    {
      id: 'sh-3',
      title: 'Viewing File Contents',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><code>cat file</code> prints an entire file. For a big file, <code>head -n N file</code>
          shows just the first N lines and <code>tail -n N file</code> the last N — much more
          practical than dumping the whole thing. <code>wc -l file</code> counts lines.</p>
        `},
        { type: 'code', lang: 'bash', code:
`cat notes.txt
head -n 2 notes.txt
tail -n 1 notes.txt
wc -l notes.txt` },
        { type: 'shell', task: 'Print the whole of notes.txt, then just its first line, then count how many lines it has.', starter: `cat notes.txt
head -n 1 notes.txt
wc -l notes.txt` },
      ],
      quiz: [
        { q: 'What does head -n 3 file show?', choices: ['The last 3 lines', 'The first 3 lines', 'Lines containing the word "3"'], answer: 1, explain: 'head shows the beginning of a file; tail shows the end.' },
        { q: 'What does wc -l count?', choices: ['Words', 'Characters', 'Lines'], answer: 2, explain: 'wc -l counts lines specifically (plain wc alone shows lines, words, and characters).' },
      ],
    },

    {
      id: 'sh-vars',
      title: 'Variables & Echo',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Set a shell variable with <code>NAME=value</code> (no spaces around <code>=</code>), and
          read it back with <code>$NAME</code> or <code>\${NAME}</code>. <code>echo</code> prints
          text — commonly used with variables to check their value. Double quotes allow variable
          expansion inside them; single quotes turn it off, treating everything literally.</p>
        `},
        { type: 'code', lang: 'bash', code:
`NAME="Ada"
echo "Hello, $NAME"      # Hello, Ada  (double quotes expand variables)
echo 'Hello, $NAME'      # Hello, $NAME  (single quotes don't)
echo Hello, ${'${NAME}'}!         # Hello, Ada!  (braces make the boundary explicit)` },
        { type: 'note', kind: 'tip', html: 'The <code>${NAME}</code> brace form matters most when a variable is followed immediately by more text with no clear boundary, e.g. <code>${NAME}_backup</code> vs the ambiguous <code>$NAME_backup</code> (which would look for a variable literally named NAME_backup).' },
        { type: 'shell', task: 'Set GREETING to "Hi" and NAME to your name, then echo them combined in one double-quoted string, then show the single-quote version to see the difference.', starter: `GREETING="Hi"
NAME="Ada"
echo "$GREETING, $NAME!"
echo '$GREETING, $NAME!'` },
      ],
      quiz: [
        { q: 'How do you set a shell variable named CITY to "Paris"?', choices: ['CITY = "Paris"', 'CITY="Paris" (no spaces around =)', 'set CITY "Paris"'], answer: 1, explain: 'Bash variable assignment requires no spaces around the equals sign.' },
        { q: 'Inside single quotes, what happens to $NAME?', choices: ['It expands to the variable\'s value, same as double quotes', 'It is treated as literal text, not expanded', 'It causes a syntax error'], answer: 1, explain: 'Single quotes suppress variable expansion entirely — everything inside is literal.' },
      ],
    },

    {
      id: 'sh-pipes',
      title: 'Pipes & Redirects',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>A <strong>pipe</strong> (<code>|</code>) sends one command's output directly into
          another command's input — this is how small tools combine into something more powerful.
          A <strong>redirect</strong> sends output to a file instead of the screen:
          <code>&gt;</code> overwrites, <code>&gt;&gt;</code> appends.</p>
        `},
        { type: 'code', lang: 'bash', code:
`cat notes.txt | wc -l              # count lines by piping into wc
cat notes.txt | grep Sam            # only lines containing "Sam"

echo "First entry" > log.txt         # creates/overwrites log.txt
echo "Second entry" >> log.txt        # appends to it
cat log.txt` },
        { type: 'note', kind: 'warning', html: 'A single &gt; completely replaces the file\'s contents with no warning — always double-check you mean &gt; (overwrite) and not &gt;&gt; (append) before running it on something you care about.' },
        { type: 'shell', task: 'Pipe notes.txt through grep to find lines containing "milk", redirect that result into a new file found.txt, then cat found.txt to confirm.', starter: `cat notes.txt | grep milk > found.txt
cat found.txt`, verify: (state) => {
          const file = window.ShellSim.getNode(state, ['home', 'user', 'found.txt']);
          if (!file || file.type !== 'file') return { pass: false, message: 'No found.txt was created.' };
          return file.content.includes('milk')
            ? { pass: true, message: 'found.txt contains the line with "milk".' }
            : { pass: false, message: 'found.txt exists but doesn\'t contain the expected line.' };
        }},
      ],
      quiz: [
        { q: 'What does cmd1 | cmd2 do?', choices: ['Runs cmd1, then separately runs cmd2', 'Sends cmd1\'s output as cmd2\'s input', 'Runs both commands at the exact same time with no connection'], answer: 1, explain: 'A pipe connects one command\'s stdout directly to the next command\'s stdin.' },
        { q: 'What is the difference between > and >>?', choices: ['No difference', '> overwrites the file; >> appends to it', '> appends; >> overwrites'], answer: 1, explain: '> replaces the file\'s entire contents; >> adds to the end, keeping what was already there.' },
      ],
    },

    {
      id: 'sh-grep',
      title: 'Searching with grep',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p><code>grep pattern file</code> prints every line containing that pattern —
          one of the most-used commands in any shell workflow. <code>-i</code> ignores
          case, <code>-n</code> shows line numbers. grep works beautifully piped after other
          commands too, filtering whatever they produce.</p>
        `},
        { type: 'code', lang: 'bash', code:
`grep Sam notes.txt          # lines containing "Sam"
grep -i sam notes.txt        # case-insensitive
grep -n Sam notes.txt        # with line numbers` },
        { type: 'shell', task: 'Search todo.txt (case-insensitively) for the word "ship", showing line numbers.', starter: `grep -in ship todo.txt` },
      ],
      quiz: [
        { q: 'What does the -i flag do on grep?', choices: ['Shows line numbers', 'Makes the search case-insensitive', 'Inverts the match (shows non-matching lines)'], answer: 1, explain: '-i ignores upper/lowercase differences when matching.' },
        { q: 'Why is grep so often used with a pipe?', choices: ['It can\'t read files directly at all', 'To filter down the output of another command to just the relevant lines', 'Pipes make grep run faster'], answer: 1, explain: 'grep is commonly used to filter another command\'s output down to matching lines.' },
      ],
    },

    {
      id: 'sh-chaining',
      title: 'Chaining: && || ;',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>Every command finishes with an <strong>exit code</strong>: 0 means success, anything
          else means failure. <code>cmd1 && cmd2</code> only runs cmd2 if cmd1 succeeded — the
          classic "do this, and only if it worked, do that" pattern (e.g. build then deploy).
          <code>cmd1 || cmd2</code> runs cmd2 only if cmd1 <em>failed</em> — useful as a fallback.
          <code>;</code> just runs both regardless of success or failure.</p>
        `},
        { type: 'code', lang: 'bash', code:
`mkdir build && cd build && echo "Ready to build"

cd missing-folder || echo "That folder doesn't exist!"

echo "one" ; echo "two"   # both run no matter what` },
        { type: 'shell', task: 'Create a directory "release" and, only if that succeeds, cd into it and print the working directory — all with &&.', starter: `mkdir release && cd release && pwd`, verify: (state, transcript) => {
          const last = transcript[transcript.length - 1];
          return last && last.stdout.trim() === '/home/user/release'
            ? { pass: true, message: 'Correct — each step only ran because the previous one succeeded.' }
            : { pass: false, message: 'Expected the final pwd to print /home/user/release.' };
        }},
      ],
      quiz: [
        { q: 'What exit code does a successful command return?', choices: ['1', '0', '-1'], answer: 1, explain: 'By convention, 0 means success; any non-zero value signals some kind of failure.' },
        { q: 'When does cmd2 run in "cmd1 || cmd2"?', choices: ['Only if cmd1 succeeded', 'Only if cmd1 failed', 'Always, regardless of cmd1'], answer: 1, explain: '|| is the "or else" operator — it only runs the fallback when the first command failed.' },
      ],
    },

    {
      id: 'sh-scripts',
      title: 'Shell Scripts & Control Flow',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>A <strong>shell script</strong> is just a text file of commands, run all at once instead
          of typed one by one. It starts with a <strong>shebang</strong> line telling the system which
          interpreter to use, and needs execute permission to be run directly.</p>
        `},
        { type: 'code', lang: 'bash', caption: 'deploy.sh', code:
`#!/bin/bash
echo "Starting deploy..."

for file in *.html; do
  echo "Uploading $file"
done

if [ -f "config.json" ]; then
  echo "Config found"
else
  echo "Missing config!"
fi` },
        { type: 'note', kind: 'info', html: '<code>chmod +x deploy.sh</code> makes a script executable, after which <code>./deploy.sh</code> runs it. The playground here focuses on the commands you\'d actually run day-to-day rather than parsing full script control flow like <code>for</code>/<code>if</code> — for those, predict what the script above would print instead.' },
        { type: 'predict', lang: 'bash', question: 'If the current directory has index.html and about.html (no config.json), what does deploy.sh print?', code:
`for file in *.html; do
  echo "Uploading $file"
done

if [ -f "config.json" ]; then
  echo "Config found"
else
  echo "Missing config!"
fi`, options: [
          'Uploading index.html\nUploading about.html\nMissing config!',
          'Uploading *.html\nConfig found',
          'Nothing — the script has a syntax error',
        ], answer: 0, explain: 'The for loop expands *.html to match both files, and since config.json doesn\'t exist, the if\'s else branch runs.' },
      ],
      quiz: [
        { q: 'What does the shebang line #!/bin/bash do?', choices: ['It\'s just a comment with no effect', 'It tells the system which interpreter should run this script', 'It sets file permissions'], answer: 1, explain: 'The shebang tells the OS which program should execute the rest of the file.' },
        { q: 'What command makes a script file executable?', choices: ['chmod +x script.sh', 'exec script.sh', 'run script.sh'], answer: 0, explain: 'chmod +x adds execute permission, after which ./script.sh can run it directly.' },
      ],
    },

    {
      id: 'sh-gotchas',
      title: 'Permissions, PATH & Gotchas',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>A few things that trip up almost everyone eventually:</p>
          <ul>
            <li><strong>Permissions</strong>: every file has read/write/execute permissions for
                owner/group/others, shown by <code>ls -l</code> as something like
                <code>-rwxr-xr--</code>. <code>chmod 755 file</code> sets them numerically (owner:
                read+write+execute=7, group: read+execute=5, others: read+execute=5).</li>
            <li><strong>PATH</strong> is an environment variable listing folders the shell searches
                for commands. "command not found" usually means it's not installed, or not in a
                folder listed in PATH.</li>
            <li><strong><code>rm -rf /</code> (or worse, <code>rm -rf /</code> with a stray space
                like <code>rm -rf / home/user</code>) is the most infamous shell disaster</strong> —
                always pause before a recursive, forced delete, especially with variables in the
                path that might be empty.</li>
          </ul>
        `},
        { type: 'note', kind: 'warning', html: 'If a script does <code>rm -rf "$SOME_DIR"/*</code> and <code>$SOME_DIR</code> happens to be empty or unset, that can silently become <code>rm -rf /*</code> — deleting far more than intended. Always quote variables and consider checking they\'re non-empty before a destructive command.' },
        { type: 'predict', lang: 'bash', question: 'What does chmod 644 file.txt set the permissions to?', code:
`chmod 644 file.txt
# owner: 6 = read+write (4+2)
# group: 4 = read only
# other: 4 = read only`, options: [
          'Owner can read/write; group and others can only read',
          'Everyone including owner can only read',
          'Owner can execute; nobody can read',
        ], answer: 0, explain: '6 (4+2) = read+write for the owner; 4 = read-only for group and others — a very common permission for a regular (non-executable) file.' },
        { type: 'predict', lang: 'bash', question: 'You type "mycommand" and get "command not found". What is NOT a likely cause?', code:
`$ mycommand
bash: mycommand: command not found`, options: [
          'mycommand isn\'t installed',
          'mycommand is installed, but its folder isn\'t listed in PATH',
          'The terminal window is too small',
        ], answer: 2, explain: 'Window size has nothing to do with command resolution — it\'s always either "not installed" or "not on PATH".' },
      ],
      quiz: [
        { q: 'What does chmod 755 give the file\'s owner?', choices: ['Read only', 'Read, write, and execute', 'No access at all'], answer: 1, explain: '7 = 4+2+1 = read+write+execute, the owner\'s permission in chmod 755.' },
        { q: 'What is PATH?', choices: ['The current directory only', 'A list of folders the shell searches when looking for a command to run', 'A permission level'], answer: 1, explain: 'PATH is an environment variable holding the folders searched, in order, when you type a command name.' },
      ],
    },
  ],
};
