window.COURSE = window.COURSE || {};

/* Python actually runs in the browser here — via Skulpt, a real Python-to-JS
   compiler (https://skulpt.org). Every playground below executes genuine Python. */

window.COURSE.python = {
  id: 'python',
  title: 'Python',
  icon: '🐍',
  description: 'One of the world\'s most popular languages — data science, automation, AI, and a famously readable syntax. Runs live below.',
  lessons: [
    {
      id: 'py-1',
      title: 'What is Python?',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><strong>Python</strong> is a general-purpose language known for reading almost like
          plain English. It's the go-to language for data science and machine learning, scripting
          and automation, and is one of the most commonly taught first languages anywhere. Comments
          start with <code>#</code>, and variables need no declared type.</p>
        `},
        { type: 'code', lang: 'python', code:
`# this is a comment
name = "Ada"
age = 30

print("Hello, " + name)
print(age)` },
        { type: 'note', kind: 'warning', html: 'Python\'s defining feature: <strong>indentation is the syntax</strong>. There are no curly braces — a block is defined purely by how far its lines are indented. Get the indentation wrong and either the code means something different, or it won\'t run at all.' },
        { type: 'python', task: 'Change the name and age, and add a third print() line of your own.', starter:
`name = "Ada"
age = 30

print("Hello, " + name)
print(age)` },
      ],
      quiz: [
        { q: 'What symbol starts a comment in Python?', choices: ['//', '#', '--'], answer: 1, explain: 'Python comments start with a hash/pound sign.' },
        { q: 'How does Python know where a block of code (like inside an if) ends?', choices: ['A closing curly brace }', 'The word "end"', 'Indentation — the block ends when the indentation decreases'], answer: 2, explain: 'Python uses indentation itself as the block structure, instead of braces or keywords.' },
      ],
    },

    {
      id: 'py-2',
      title: 'Types, Operators & f-strings',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p>Core types: <code>int</code>, <code>float</code>, <code>str</code>, <code>bool</code>,
          and <code>None</code> (Python's null). <strong>f-strings</strong> (formatted string
          literals) are the modern way to build strings with embedded values:
          <code>f"Hi {name}"</code>.</p>
        `},
        { type: 'code', lang: 'python', code:
`x = 10
name = "Ada"
score = 92.5

print(f"{name} scored {score}%")   # f-string
print(x > 5 and score > 90)         # True
print(type(x))                       # <class 'int'>
print(None == False)                 # False — None is its own thing` },
        { type: 'note', kind: 'tip', html: 'Only <code>False</code>, <code>None</code>, <code>0</code>, <code>0.0</code>, and empty collections (<code>""</code>, <code>[]</code>, <code>{}</code>) are "falsy" in Python — checking <code>if my_list:</code> is a common idiom for "if the list isn\'t empty".' },
        { type: 'python', task: 'Use an f-string to print "Ada is 30 years old" from two variables, name and age.', starter:
`name = "Ada"
age = 30
print(f"{name} is {age} years old")`, verify: (output) => {
          return output.trim() === 'Ada is 30 years old'
            ? { pass: true, message: 'Correct f-string interpolation.' }
            : { pass: false, message: 'Expected exactly: Ada is 30 years old' };
        }},
      ],
      quiz: [
        { q: 'What does f"Hi {name}" do?', choices: ['Prints the literal text {name}', 'Embeds the value of the variable name into the string', 'Causes a syntax error'], answer: 1, explain: 'An f-string evaluates {expression} and inserts its value directly into the string.' },
        { q: 'Which of these is considered falsy in Python?', choices: ['"0" (the string)', '[] (an empty list)', '1'], answer: 1, explain: 'Empty collections, 0, 0.0, None, and False are all falsy; a non-empty string like "0" is actually truthy.' },
      ],
    },

    {
      id: 'py-3',
      title: 'Control Flow',
      difficulty: 'basic',
      blocks: [
        { type: 'text', html: `
          <p><code>if</code>/<code>elif</code>/<code>else</code>, <code>while</code>, and
          <code>for ... in</code> loops. Python's <code>for</code> loop always iterates over a
          sequence — <code>range(start, stop, step)</code> generates a sequence of numbers when you
          need a classic counting loop.</p>
        `},
        { type: 'code', lang: 'python', code:
`score = 72

if score >= 90:
    print("A")
elif score >= 70:
    print("B")
else:
    print("Needs work")

for i in range(1, 10, 2):
    print(i)          # 1, 3, 5, 7, 9

n = 3
while n > 0:
    print(n)
    n -= 1             # Python has no ++ or --` },
        { type: 'note', kind: 'warning', html: 'Every colon-ended line (<code>if x:</code>, <code>for i in range(3):</code>, <code>def f():</code>) must be followed by an indented block. Mixing tabs and spaces, or indenting inconsistently, causes an IndentationError.' },
        { type: 'python', task: 'Write a loop that prints the numbers 10 down to 0, counting down by 2 (hint: range(10, -1, -2)).', starter: '# for i in range(10, -1, -2):\n#     print(i)\n', verify: (output) => {
          const expected = '10\n8\n6\n4\n2\n0';
          return output.trim() === expected
            ? { pass: true, message: 'Correct — counted down from 10 to 0 by 2s.' }
            : { pass: false, message: 'Expected: 10, 8, 6, 4, 2, 0 (one per line). Try: for i in range(10, -1, -2): print(i)' };
        }},
      ],
      quiz: [
        { q: 'What does range(1, 10, 2) produce?', choices: ['1, 2, 3, ..., 10', '1, 3, 5, 7, 9', '2, 4, 6, 8, 10'], answer: 1, explain: 'range(start, stop, step) starts at 1, stops before 10, counting by 2.' },
        { q: 'How do you decrement a variable in Python (there\'s no --)?', choices: ['n--', 'n -= 1', 'n.decrement()'], answer: 1, explain: 'Python has no increment/decrement operators — use n -= 1 (or n = n - 1).' },
      ],
    },

    {
      id: 'py-4',
      title: 'Functions',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Functions are declared with <code>def</code>. Parameters can have default values, and
          <code>**kwargs</code> collects any extra named arguments into a dictionary — useful for
          flexible function signatures.</p>
        `},
        { type: 'code', lang: 'python', code:
`def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

print(greet("Ada"))            # Hello, Ada!
print(greet("Grace", "Hi"))    # Hi, Grace!

def describe(**kwargs):
    return kwargs.get("name", "someone")

print(describe(name="Ada", age=30))  # Ada` },
        { type: 'python', task: 'Write a function square(n) that returns n*n, and print square(4) + square(2) (should be 20).', starter:
`def square(n):
    return n * n

print(square(4) + square(2))`, verify: (output) => {
          return output.trim() === '20'
            ? { pass: true, message: 'Correct — 16 + 4 = 20.' }
            : { pass: false, message: 'Expected the single line: 20' };
        }},
      ],
      quiz: [
        { q: 'What keyword defines a function in Python?', choices: ['function', 'def', 'func'], answer: 1, explain: 'def name(params): starts a function definition.' },
        { q: 'What does **kwargs collect?', choices: ['A list of positional arguments', 'A dictionary of any extra named (keyword) arguments', 'Nothing, it\'s decorative'], answer: 1, explain: '**kwargs gathers arbitrary keyword arguments into a dict inside the function.' },
      ],
    },

    {
      id: 'py-5',
      title: 'Lists, Tuples & Dictionaries',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p><strong>Lists</strong> (<code>[1, 2, 3]</code>) are ordered and mutable.
          <strong>Tuples</strong> (<code>(1, 2, 3)</code>) look similar but are immutable — once
          created, they can't change. <strong>Dictionaries</strong> (<code>{"key": "value"}</code>)
          map keys to values. Slicing (<code>list[1:3]</code>) extracts a sub-range from any sequence.</p>
        `},
        { type: 'code', lang: 'python', code:
`fruits = ["apple", "banana", "cherry"]
fruits.append("date")
print(fruits[1:3])       # ['banana', 'cherry'] — slice

point = (10, 20)          # a tuple
# point[0] = 99           # would raise: tuples are immutable

book = {"title": "Kindred", "year": 1979}
book["price"] = 12.99
for key, value in book.items():
    print(key, value)` },
        { type: 'note', kind: 'tip', html: 'Use a list when the collection might change (add/remove items); use a tuple for a fixed group of values (like a coordinate pair) — the immutability is a feature, not a limitation, since it guarantees the values can\'t accidentally be modified later.' },
        { type: 'python', task: 'Build a list of 3 favorite colors and print them with their index using enumerate(), in the form "0: red".', starter:
`colors = ["red", "green", "blue"]

for i, c in enumerate(colors):
    print(f"{i}: {c}")`, verify: (output) => {
          const lines = output.trim().split('\n');
          const pass = lines.length === 3 && lines.every((l, i) => new RegExp(`^${i}: \\S+`).test(l));
          return pass
            ? { pass: true, message: 'Correct format — three lines, each "index: color", 0-indexed.' }
            : { pass: false, message: 'Expected exactly 3 lines formatted like "0: red", one per color.' };
        }},
      ],
      quiz: [
        { q: 'What is the key difference between a list and a tuple?', choices: ['Tuples can only hold numbers', 'Lists are mutable (can change); tuples are immutable (cannot)', 'There is no real difference'], answer: 1, explain: 'Once created, a tuple\'s contents can\'t be changed — lists can be appended to, sorted, modified, etc.' },
        { q: 'What does fruits[1:3] return on a list?', choices: ['Just the item at index 1', 'A new list containing indices 1 and 2 (not 3)', 'The whole list reversed'], answer: 1, explain: 'Slicing is [start:stop) — it includes start, excludes stop.' },
      ],
    },

    {
      id: 'py-6',
      title: 'String Methods',
      difficulty: 'medium',
      blocks: [
        { type: 'text', html: `
          <p>Common string methods: <code>.upper()</code>/<code>.lower()</code>,
          <code>.strip()</code> (trim whitespace), <code>.split()</code>/<code>"...".join()</code>,
          <code>.replace()</code>, and slicing works on strings too since a string is just a
          sequence of characters.</p>
        `},
        { type: 'code', lang: 'python', code:
`s = "  Hello, World!  "
print(s.strip())               # "Hello, World!"
print(s.strip().upper())       # "HELLO, WORLD!"
print(s.strip().replace("World", "Python"))

csv = "html,css,js"
parts = csv.split(",")          # ['html', 'css', 'js']
print(", ".join(parts))         # "html, css, js"

print("Hello"[1:4])              # "ell" — strings slice just like lists` },
        { type: 'python', task: 'Given sentence = "the quick brown fox", split it into words and print the number of words and the uppercased second word ("QUICK").', starter:
`sentence = "the quick brown fox"
words = sentence.split(" ")
print(len(words))
print(words[1].upper())`, verify: (output) => {
          return output.trim() === '4\nQUICK'
            ? { pass: true, message: 'Correct — 4 words, and "quick" (index 1) uppercased.' }
            : { pass: false, message: 'Expected two lines: 4 then QUICK' };
        }},
      ],
      quiz: [
        { q: 'What does "a,b,c".split(",") return?', choices: ['The string unchanged', 'A list: ["a", "b", "c"]', 'The number 3'], answer: 1, explain: 'split() breaks a string into a list by the given separator.' },
        { q: 'What does "Hello"[1:4] return?', choices: ['"Hell"', '"ell"', '"ello"'], answer: 1, explain: 'Slicing [1:4] takes indices 1, 2, 3 — "e", "l", "l".' },
      ],
    },

    {
      id: 'py-7',
      title: 'List Comprehensions',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p>A <strong>list comprehension</strong> builds a new list in one line:
          <code>[expression for item in iterable if condition]</code> — it's the idiomatic Python
          way to write what would otherwise be a for-loop that appends to a list. Dictionaries have
          the same trick: <code>{key: value for ...}</code>.</p>
        `},
        { type: 'code', lang: 'python', code:
`numbers = range(10)

squares = [x * x for x in numbers]
evens = [x for x in numbers if x % 2 == 0]
even_squares = [x * x for x in numbers if x % 2 == 0]

print(squares)
print(evens)
print(even_squares)

lookup = {x: x * x for x in range(5)}
print(lookup)` },
        { type: 'note', kind: 'tip', html: 'A comprehension is just sugar for a plain loop — if it starts feeling hard to read, a regular for loop is perfectly fine too. Clarity beats cleverness.' },
        { type: 'python', task: 'Use a list comprehension to build a list of the cubes (x**3) of the numbers 1 through 5, then print it.', starter: '# cubes = [x**3 for x in range(1, 6)]\n# print(cubes)\n', verify: (output) => {
          return output.trim() === '[1, 8, 27, 64, 125]'
            ? { pass: true, message: 'Correct — [1, 8, 27, 64, 125].' }
            : { pass: false, message: 'Expected: [1, 8, 27, 64, 125]. Try: [x**3 for x in range(1, 6)]' };
        }},
      ],
      quiz: [
        { q: 'What does [x for x in range(5) if x % 2 == 0] produce?', choices: ['[0, 1, 2, 3, 4]', '[0, 2, 4]', '[1, 3]'], answer: 1, explain: 'The condition filters to only even numbers from 0 to 4.' },
        { q: 'Is a list comprehension a completely different feature from a for loop?', choices: ['Yes, totally unrelated', 'No — it\'s a compact way of writing a loop that builds a list', 'Comprehensions can only be used with numbers'], answer: 1, explain: 'A comprehension is equivalent to a for loop with an append, just written more compactly.' },
      ],
    },

    {
      id: 'py-8',
      title: 'Classes & OOP',
      difficulty: 'pro',
      blocks: [
        { type: 'text', html: `
          <p><code>class</code> defines a blueprint for objects. <code>__init__</code> is the
          constructor, run automatically when you create an instance. <code>self</code> (always the
          first parameter of a method) refers to the specific instance the method was called on —
          Python makes this explicit, unlike JavaScript's implicit <code>this</code>.</p>
        `},
        { type: 'code', lang: 'python', code:
`class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return f"{self.name} makes a sound"

class Dog(Animal):              # inherits from Animal
    def speak(self):             # overrides the parent's method
        return f"{self.name} barks"

a = Animal("Generic Animal")
d = Dog("Rex")
print(a.speak())
print(d.speak())` },
        { type: 'python', task: 'Build a Counter class with __init__ setting count to 0, and an increment() method that adds 1 and returns the new count. Create one and call increment() twice, printing the second result.', starter:
`class Counter:
    def __init__(self):
        self.count = 0

    def increment(self):
        self.count += 1
        return self.count

c = Counter()
c.increment()
print(c.increment())`, verify: (output) => {
          return output.trim() === '2'
            ? { pass: true, message: 'Correct — two increments from 0 gives 2.' }
            : { pass: false, message: 'Expected the single line: 2' };
        }},
      ],
      quiz: [
        { q: 'What does __init__ do?', choices: ['Deletes an instance', 'Runs automatically when a new instance is created, to set up initial state', 'Converts the object to a string'], answer: 1, explain: '__init__ is the constructor — Python calls it automatically for every new instance.' },
        { q: 'Why does every method explicitly take self as its first parameter?', choices: ['It\'s optional decoration', 'It\'s how Python passes a reference to the specific instance the method was called on', 'self is a reserved keyword with no purpose'], answer: 1, explain: 'Unlike JavaScript\'s implicit this, Python requires self to be an explicit parameter naming the instance.' },
      ],
    },

    {
      id: 'py-9',
      title: 'Error Handling: try/except',
      difficulty: 'hell',
      blocks: [
        { type: 'text', html: `
          <p><code>try</code>/<code>except</code> catches errors without crashing the program —
          the same idea as JavaScript's try/catch, PHP's exceptions, or Lua's pcall.
          <code>raise</code> throws your own exception; you can even define custom exception
          types by subclassing <code>Exception</code>.</p>
        `},
        { type: 'code', lang: 'python', code:
`def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None

print(safe_divide(10, 2))   # 5.0
print(safe_divide(10, 0))   # None

class InsufficientFundsError(Exception):
    pass

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFundsError("not enough money")
    return balance - amount

try:
    withdraw(50, 100)
except InsufficientFundsError as e:
    print("Failed:", e)` },
        { type: 'note', kind: 'tip', html: 'Catch specific exception types (<code>except ZeroDivisionError:</code>) rather than a bare <code>except:</code> whenever you can — a bare except silently swallows every kind of error, including bugs you\'d actually want to know about.' },
        { type: 'python', task: 'Write safe_get(lst, index) that returns lst[index], or "out of range" if an IndexError occurs. Call it with a valid and an invalid index, printing both results.', starter:
`def safe_get(lst, index):
    try:
        return lst[index]
    except IndexError:
        return "out of range"

items = [10, 20, 30]
print(safe_get(items, 1))
print(safe_get(items, 99))`, verify: (output) => {
          return output.trim() === '20\nout of range'
            ? { pass: true, message: 'Correct — a valid index, then a caught IndexError.' }
            : { pass: false, message: 'Expected two lines: 20 then out of range' };
        }},
      ],
      quiz: [
        { q: 'What does a bare "except:" (no exception type named) catch?', choices: ['Nothing at all', 'Every kind of exception, including ones you probably want to notice', 'Only syntax errors'], answer: 1, explain: 'A bare except catches everything indiscriminately, which can hide real bugs — naming the specific exception type is safer.' },
        { q: 'How do you define a custom exception type?', choices: ['You can\'t; only built-in exceptions exist', 'By creating a class that inherits from Exception', 'By using the keyword customerror'], answer: 1, explain: 'class MyError(Exception): pass creates a new exception type you can raise and catch specifically.' },
      ],
    },
  ],
};
