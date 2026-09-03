window.COURSE = window.COURSE || {};

/* Lua actually runs in the browser here — via Fengari, a real Lua VM written in JS
   (https://fengari.io). Every playground below executes genuine Lua, not a simulation. */

window.COURSE.lua = {
  id: 'lua',
  title: 'Lua',
  icon: '🌙',
  description: 'A tiny, fast scripting language embedded in games (Roblox, WoW addons, Love2D), Redis, and nginx — runs live below.',
  lessons: [
    {
      id: 'lua-1',
      title: 'What is Lua?',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><strong>Lua</strong> is a small, fast scripting language designed to be embedded inside
          other programs. You'll find it powering Roblox and World of Warcraft addon scripting,
          the Love2D game engine, Redis scripts, nginx/OpenResty configs, and Neovim configuration.
          It's not typically used to build a whole website like PHP — it's the language you reach for
          when a bigger program needs a small, safe scripting layer bolted on.</p>
          <p>Lua is dynamically typed (no declaring types), uses <code>local</code> to declare
          variables, and <code>--</code> for comments.</p>
        `},
        { type: 'code', lang: 'lua', code:
`-- this is a comment
local name = "Ada"
local age = 30

print("Hello, " .. name)
print(age)` },
        { type: 'note', kind: 'warning', html: 'Lua\'s most famous quirk: sequences are <strong>1-indexed</strong>, not 0-indexed. The first item of a list is at position 1, not 0. This trips up almost everyone coming from JavaScript or PHP at first.' },
        { type: 'lua', task: 'Change the name and age, and add a third print() line of your own.', starter:
`local name = "Ada"
local age = 30

print("Hello, " .. name)
print(age)` },
      ],
      quiz: [
        { q: 'What symbol starts a comment in Lua?', choices: ['//', '#', '--'], answer: 2, explain: 'Lua comments start with two dashes: --.' },
        { q: 'What is the index of the first item in a Lua list-like table?', choices: ['0', '1', '-1'], answer: 1, explain: 'Lua sequences are 1-indexed — a well-known gotcha for people coming from most other languages.' },
        { q: 'Which of these is a typical real-world use of Lua?', choices: ['Building a full website backend like PHP', 'Scripting inside a game engine or another host program', 'Styling web pages'], answer: 1, explain: 'Lua is designed to be embedded as a lightweight scripting layer inside a larger host application.' },
      ],
    },

    {
      id: 'lua-2',
      title: 'Types, Operators & Truthiness',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>Lua's core types: <strong>nil</strong>, <strong>boolean</strong>, <strong>number</strong>
          (no separate int/float distinction in everyday use), <strong>string</strong>, and
          <strong>table</strong> (covered in depth soon). Strings concatenate with <code>..</code>
          (not <code>+</code>). Logic uses <code>and</code>, <code>or</code>, <code>not</code> — written
          as words, not symbols.</p>
        `},
        { type: 'code', lang: 'lua', code:
`local x = 10
local y = "20"
print(x .. y)        -- "1020" (concatenation, not addition)
print(x == 10)       -- true
print(x > 5 and y == "20")  -- true
print(not false)     -- true` },
        { type: 'note', kind: 'tip', html: 'Only <code>nil</code> and <code>false</code> are "falsy" in Lua — everything else, including <code>0</code> and <code>""</code> (empty string), counts as true. This is different from JavaScript, where 0 and "" are falsy!' },
        { type: 'lua', task: 'Predict, then verify: what does print(0 and "yes" or "no") output? Try it, then explain to yourself why.', starter:
`print(0 and "yes" or "no")
print("" and "yes" or "no")` },
      ],
      quiz: [
        { q: 'What operator concatenates two strings in Lua?', choices: ['+', '.. ', '&'], answer: 1, explain: 'Lua uses .. to join strings; + is reserved for arithmetic.' },
        { q: 'Which of these is falsy in Lua?', choices: ['0', '""', 'nil'], answer: 2, explain: 'Only nil and false are falsy in Lua — 0 and "" are both truthy, unlike in JavaScript.' },
      ],
    },

    {
      id: 'lua-3',
      title: 'Control Flow',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><code>if/elseif/else</code> and <code>while</code> work as you'd expect. Lua also has
          <code>repeat ... until</code> — a loop that always runs at least once, checking its
          condition at the end. The numeric <code>for</code> loop is
          <code>for i = start, stop, step do ... end</code> (step defaults to 1).</p>
        `},
        { type: 'code', lang: 'lua', code:
`local score = 72

if score >= 90 then
  print("A")
elseif score >= 70 then
  print("B")
else
  print("Needs work")
end

for i = 1, 5, 2 do
  print(i)   -- 1, 3, 5
end

local n = 3
repeat
  print(n)
  n = n - 1
until n == 0` },
        { type: 'lua', task: 'Write a for loop that prints the numbers 10 down to 0, counting down by 2 (hint: use a negative step).', starter: '-- for i = 10, 0, -2 do ... end\n', verify: (output) => {
          const expected = '10\n8\n6\n4\n2\n0';
          return output.trim() === expected
            ? { pass: true, message: 'Correct — counted down from 10 to 0 by 2s.' }
            : { pass: false, message: 'Expected: 10, 8, 6, 4, 2, 0 (one per line). Try: for i = 10, 0, -2 do print(i) end' };
        }},
      ],
      quiz: [
        { q: 'How is repeat...until different from while?', choices: ['They are identical', 'repeat...until always runs its body at least once, checking the condition after', 'repeat...until can only run once total'], answer: 1, explain: 'repeat checks its condition at the end, so the loop body always executes at least one time.' },
        { q: 'What does for i = 1, 10, 2 do ... end do?', choices: ['Loops i from 1 to 10, incrementing by 2 each time', 'Loops exactly 2 times', 'Loops i from 10 down to 1'], answer: 0, explain: 'The third value in a numeric for loop is the step — here, 1, 3, 5, 7, 9.' },
      ],
    },

    {
      id: 'lua-4',
      title: 'Functions',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Functions are declared with <code>function</code> / <code>end</code>. Uniquely, Lua
          functions can return <strong>multiple values</strong> directly, and accept a variable
          number of arguments with <code>...</code>.</p>
        `},
        { type: 'code', lang: 'lua', code:
`local function minmax(a, b, c)
  local mn = math.min(a, b, c)
  local mx = math.max(a, b, c)
  return mn, mx   -- two values, no array/tuple needed
end

local lo, hi = minmax(4, 1, 9)
print(lo, hi)   -- 1  9

local function sum(...)
  local total = 0
  for _, v in ipairs({...}) do
    total = total + v
  end
  return total
end
print(sum(1, 2, 3, 4))  -- 10` },
        { type: 'note', kind: 'tip', html: 'A common Lua idiom for default argument values: <code>x = x or 10</code> — if <code>x</code> is nil (falsy), it becomes 10; otherwise it keeps its given value.' },
        { type: 'lua', task: 'Write a function greet(name) that returns "Hello, " .. name .. "!" only if name is provided, defaulting to "world" otherwise. Print greet("Ada") and greet().', starter:
`local function greet(name)
  name = name or "world"
  return "Hello, " .. name .. "!"
end

print(greet("Ada"))
print(greet())`, verify: (output) => {
          const expected = 'Hello, Ada!\nHello, world!';
          return output.trim() === expected
            ? { pass: true, message: 'Correct — the default kicked in when no argument was passed.' }
            : { pass: false, message: 'Expected:\nHello, Ada!\nHello, world!' };
        }},
      ],
      quiz: [
        { q: 'Can a Lua function return more than one value?', choices: ['No, only one', 'Yes, directly with a comma-separated return', 'Only by returning a table'], answer: 1, explain: 'return a, b returns two values directly — very common in Lua, e.g. return min, max.' },
        { q: 'What does "x = x or 10" do when x is nil?', choices: ['Throws an error', 'Sets x to 10', 'Sets x to false'], answer: 1, explain: 'Since nil is falsy, "or" falls through to the right-hand side, 10.' },
      ],
    },

    {
      id: 'lua-5',
      title: 'Tables',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>The <strong>table</strong> is Lua's only real data structure — it works as both an array
          and a dictionary. <code>{1, 2, 3}</code> creates a list-like table (keys 1, 2, 3
          automatically); <code>{name = "Ada", age = 30}</code> creates a dictionary-like table with
          string keys. You can mix both in one table.</p>
        `},
        { type: 'code', lang: 'lua', code:
`local fruits = {"apple", "banana", "cherry"}
print(fruits[1])          -- "apple" (1-indexed!)
print(#fruits)             -- 3 (the length operator)

local book = { title = "Kindred", year = 1979 }
print(book.title)          -- dot access for string keys
print(book["year"])        -- same thing, bracket form

for i, fruit in ipairs(fruits) do
  print(i, fruit)
end

for key, value in pairs(book) do
  print(key, value)
end` },
        { type: 'note', kind: 'warning', html: '<code>ipairs</code> iterates the array part in order (1, 2, 3, ...) and stops at the first nil. <code>pairs</code> iterates every key in the table, in no guaranteed order. Use ipairs for lists, pairs for dictionaries.' },
        { type: 'lua', task: 'Build a table of 3 favorite colors and print each one with its index using ipairs, in the form "1: red" (adjust to your colors).', starter:
`local colors = {"red", "green", "blue"}

for i, c in ipairs(colors) do
  print(i .. ": " .. c)
end`, verify: (output) => {
          const lines = output.trim().split('\n');
          const pass = lines.length === 3 && lines.every((l, i) => new RegExp(`^${i + 1}: \\S+`).test(l));
          return pass
            ? { pass: true, message: 'Correct format — three lines, each "index: color".' }
            : { pass: false, message: 'Expected exactly 3 lines formatted like "1: red", one per color.' };
        }},
      ],
      quiz: [
        { q: 'What does the # operator do on a table?', choices: ['Comments it out', 'Returns its (array-part) length', 'Deletes it'], answer: 1, explain: '#t gives the length of the sequence/array part of a table.' },
        { q: 'Which is correct for iterating a dictionary-style table with string keys?', choices: ['ipairs', 'pairs', 'forEach'], answer: 1, explain: 'pairs() iterates every key (string or numeric); ipairs() is specifically for the 1..n array part.' },
      ],
    },

    {
      id: 'lua-6',
      title: 'String & Math Libraries',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Lua's standard library covers the essentials: <code>string.format</code> (like
          <code>printf</code>), <code>string.sub</code>, <code>string.upper</code>/<code>lower</code>,
          <code>string.find</code>/<code>match</code> (Lua "patterns" — similar to regex but simpler),
          and <code>math.floor</code>, <code>math.random</code>, <code>math.min</code>/<code>max</code>.</p>
        `},
        { type: 'code', lang: 'lua', code:
`print(string.format("%s is %d years old", "Ada", 30))
print(string.sub("Hello, world!", 1, 5))   -- "Hello"
print(string.upper("shout"))               -- "SHOUT"
print(string.find("hello world", "world")) -- 7  11 (start, end positions)

print(math.floor(4.7))   -- 4
print(math.max(3, 9, 1))  -- 9
math.randomseed(42)
print(math.random(1, 6))  -- a "dice roll" between 1 and 6` },
        { type: 'lua', task: 'Use string.format to print "Score: 87%" (with a literal percent sign — hint: %% in the format string produces one literal %) using a variable score = 87.', starter:
`local score = 87
print(string.format("Score: %d%%", score))`, verify: (output) => {
          return output.trim() === 'Score: 87%'
            ? { pass: true, message: 'Correct — %% in a format string produces a literal percent sign.' }
            : { pass: false, message: 'Expected exactly: Score: 87%' };
        }},
      ],
      quiz: [
        { q: 'What does string.sub("Hello, world!", 1, 5) return?', choices: ['"Hello"', '"world"', '"Hello,"'], answer: 0, explain: 'string.sub extracts characters 1 through 5: "Hello".' },
        { q: 'What does %% mean inside a string.format format string?', choices: ['A placeholder for a number', 'A literal percent sign', 'A syntax error'], answer: 1, explain: 'Since % starts a format specifier, %% escapes it to print one literal %.' },
      ],
    },

    {
      id: 'lua-7',
      title: 'Metatables & OOP',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>Lua has no built-in <code>class</code> keyword — instead, <strong>metatables</strong> let
          a table customize its own behavior. The classic pattern for "classes" uses a metatable's
          <code>__index</code> field so that looking up a missing key on an object falls back to a
          shared table of methods. The <code>:</code> syntax is sugar for passing the object itself as
          a hidden first argument (<code>self</code>).</p>
        `},
        { type: 'code', lang: 'lua', code:
`local Animal = {}
Animal.__index = Animal

function Animal.new(name)
  local self = setmetatable({}, Animal)
  self.name = name
  return self
end

function Animal:speak()          -- sugar for function Animal.speak(self)
  return self.name .. " makes a sound"
end

local a = Animal.new("Dog")
print(a:speak())                 -- sugar for Animal.speak(a)` },
        { type: 'note', kind: 'tip', html: 'When you write <code>a:speak()</code>, Lua looks for <code>speak</code> on <code>a</code>, doesn\'t find it, then checks <code>a</code>\'s metatable\'s <code>__index</code> (which is <code>Animal</code>) — that\'s where the shared method lives. Every "instance" shares one copy of each method this way.' },
        { type: 'lua', task: 'Build a Counter "class": Counter.new() creates one starting at 0, and counter:increment() adds 1 and returns the new count. Create a counter, call increment() twice, and print the result (should print 2).', starter:
`local Counter = {}
Counter.__index = Counter

function Counter.new()
  local self = setmetatable({}, Counter)
  self.count = 0
  return self
end

function Counter:increment()
  self.count = self.count + 1
  return self.count
end

local c = Counter.new()
c:increment()
print(c:increment())`, verify: (output) => {
          return output.trim() === '2'
            ? { pass: true, message: 'Correct — two increments from 0 gives 2.' }
            : { pass: false, message: 'Expected the single line: 2' };
        }},
      ],
      quiz: [
        { q: 'What does a:speak() actually call?', choices: ['Animal.speak(a)', 'speak(a).Animal', 'a.new(Animal)'], answer: 0, explain: 'The colon syntax passes the object itself as the first argument, conventionally named self.' },
        { q: 'What role does __index play in the class pattern?', choices: ['It sorts the table', 'It\'s where Lua looks for a key that\'s missing on the object itself, enabling shared methods', 'It deletes unused keys'], answer: 1, explain: '__index on a metatable is the fallback lookup — the mechanism behind Lua\'s "inheritance".' },
      ],
    },

    {
      id: 'lua-8',
      title: 'Closures & Scope',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>Variables declared with <code>local</code> are scoped to the block they're in; without
          <code>local</code>, a variable is <strong>global</strong> (usually a mistake!). A function
          defined inside another function can "remember" variables from its enclosing scope even
          after that outer function has returned — this is a <strong>closure</strong>, and it's the
          standard way to build private state in Lua.</p>
        `},
        { type: 'code', lang: 'lua', code:
`local function makeCounter()
  local count = 0          -- private to this closure
  return function()
    count = count + 1
    return count
  end
end

local counter1 = makeCounter()
local counter2 = makeCounter()
print(counter1())  -- 1
print(counter1())  -- 2
print(counter2())  -- 1 (its own independent count)` },
        { type: 'note', kind: 'warning', html: 'Forgetting <code>local</code> silently creates a global variable, visible everywhere in the script — a classic source of hard-to-find bugs. Get in the habit of always writing <code>local</code> unless you specifically need a global.' },
        { type: 'lua', task: 'Write makeAdder(n) that returns a function which adds n to whatever it\'s called with. Create add5 = makeAdder(5) and print add5(10) (should print 15).', starter:
`local function makeAdder(n)
  return function(x)
    return x + n
  end
end

local add5 = makeAdder(5)
print(add5(10))`, verify: (output) => {
          return output.trim() === '15'
            ? { pass: true, message: 'Correct — the returned function remembered n = 5.' }
            : { pass: false, message: 'Expected the single line: 15' };
        }},
      ],
      quiz: [
        { q: 'What happens if you assign to a variable without "local" in Lua?', choices: ['A compile error', 'It creates (or modifies) a global variable', 'It is automatically scoped to the current block'], answer: 1, explain: 'Omitting local makes a variable global by default — usually not what you want.' },
        { q: 'What is a closure?', choices: ['A function that has crashed', 'A function that retains access to variables from its enclosing scope after that scope has returned', 'A table with no keys'], answer: 1, explain: 'Closures "close over" their surrounding variables, letting each instance keep its own private state.' },
      ],
    },

    {
      id: 'lua-9',
      title: 'Error Handling with pcall',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p>Lua has no try/catch. Instead, <code>error("message")</code> raises an error, and
          <code>pcall(function)</code> ("protected call") runs a function while catching any error it
          raises, returning <code>true, result</code> on success or <code>false, errorMessage</code>
          on failure. This is how you keep one failure from crashing an entire script.</p>
        `},
        { type: 'code', lang: 'lua', code:
`local function risky(x)
  if x < 0 then
    error("x cannot be negative")
  end
  return math.sqrt(x)
end

local ok, result = pcall(risky, 16)
print(ok, result)     -- true  4.0

local ok2, err = pcall(risky, -4)
print(ok2, err)        -- false  ...: x cannot be negative` },
        { type: 'note', kind: 'tip', html: '<code>assert(condition, "message")</code> is a shortcut: it raises an error with that message if condition is false/nil, otherwise it just returns its arguments unchanged — handy for validating function inputs in one line.' },
        { type: 'lua', task: 'Write safeDivide(a, b) that errors with "division by zero" if b is 0, otherwise returns a / b. Use pcall to call safeDivide(10, 0) and print ok and the error message.', starter:
`local function safeDivide(a, b)
  if b == 0 then
    error("division by zero")
  end
  return a / b
end

local ok, err = pcall(safeDivide, 10, 0)
print(ok)
print(err)`, verify: (output) => {
          const lines = output.trim().split('\n');
          return lines[0] === 'false' && /division by zero/.test(lines[1] || '')
            ? { pass: true, message: 'Correct — pcall caught the error instead of crashing the script.' }
            : { pass: false, message: 'Expected "false" on the first line, and a message containing "division by zero" on the second.' };
        }},
      ],
      quiz: [
        { q: 'What does pcall(fn) return when fn runs without error?', choices: ['Just the result', 'true, followed by fn\'s return value(s)', 'false, nil'], answer: 1, explain: 'On success, pcall returns true plus whatever the function itself returned.' },
        { q: 'What is the main benefit of pcall?', choices: ['It makes code run faster', 'It lets you catch an error without crashing the whole script', 'It disables all errors permanently'], answer: 1, explain: 'pcall contains a failure to just that call, letting your program recover and keep running.' },
      ],
    },

    {
      id: 'lua-10',
      title: 'Coroutines',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p><strong>Coroutines</strong> are Lua's cooperative-multitasking feature: a function that
          can pause itself with <code>coroutine.yield()</code> and be resumed later from exactly
          where it left off, with <code>coroutine.resume()</code>. Unlike real threads, only one
          coroutine runs at a time — they hand control back and forth deliberately. This is how many
          games implement step-by-step scripted sequences and generators.</p>
        `},
        { type: 'code', lang: 'lua', code:
`local function counter()
  for i = 1, 3 do
    coroutine.yield(i)   -- pause here, hand back i
  end
  return "done"
end

local co = coroutine.create(counter)

print(coroutine.resume(co))  -- true  1
print(coroutine.resume(co))  -- true  2
print(coroutine.resume(co))  -- true  3
print(coroutine.resume(co))  -- true  done
print(coroutine.status(co))  -- dead` },
        { type: 'note', kind: 'info', html: 'Each <code>resume</code> runs the coroutine until the next <code>yield</code> (or until it finishes). The values passed to <code>yield</code> come back out of <code>resume</code> as extra return values — that\'s how the two sides pass data back and forth.' },
        { type: 'lua', task: 'Create a coroutine that yields the squares of 1, 2, and 3 (1, 4, 9). Resume it three times and print the second value each resume returns.', starter:
`local function squares()
  for i = 1, 3 do
    coroutine.yield(i * i)
  end
end

local co = coroutine.create(squares)
local ok1, v1 = coroutine.resume(co)
local ok2, v2 = coroutine.resume(co)
local ok3, v3 = coroutine.resume(co)
print(v1, v2, v3)`, verify: (output) => {
          return output.trim() === '1\t4\t9'
            ? { pass: true, message: 'Correct — 1, 4, 9, one per resume.' }
            : { pass: false, message: 'Expected: 1  4  9 (tab-separated on one line).' };
        }},
      ],
      quiz: [
        { q: 'What does coroutine.yield() do?', choices: ['Ends the coroutine permanently', 'Pauses the coroutine, handing control (and a value) back to whoever resumed it', 'Creates a new coroutine'], answer: 1, explain: 'yield pauses execution right where it is, to be continued later by the next resume.' },
        { q: 'Do two Lua coroutines ever run at literally the same instant?', choices: ['Yes, they run in parallel like OS threads', 'No — only one runs at a time; they cooperatively hand off control', 'Only on multi-core machines'], answer: 1, explain: 'Lua coroutines are cooperative: execution passes deliberately between them via yield/resume, never simultaneously.' },
      ],
    },
  ],
};
