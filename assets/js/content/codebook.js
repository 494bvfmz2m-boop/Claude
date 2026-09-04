window.CODEBOOK = {
  order: ['html', 'css', 'javascript', 'json', 'sql', 'php', 'lua', 'shell', 'python'],

  html: {
    icon: '📄',
    title: 'HTML',
    subtitle: 'The Skeleton',
    meta: { born: '1991', creator: 'Tim Berners-Lee', kind: 'Markup language', notFor: 'Logic or computation — it has none' },
    teaser: 'Not a programming language at all — a set of instructions for structure, patient enough that browsers will forgive almost any mistake you make in it.',
    sections: [
      { heading: 'Origin', html: `
        <p>HTML was never designed to build "apps." It was invented in 1991 by Tim Berners-Lee at
        CERN so physicists could share documents and link between them — that's it. The
        <code>&lt;a&gt;</code> tag, the hyperlink, was the entire point. Everything else got bolted
        on afterward as the web outgrew its original job by several orders of magnitude.</p>
      `},
      { heading: 'Personality', html: `
        <p>HTML is forgiving to a fault. Forget a closing tag, misnest an element, leave off the
        doctype — the browser shrugs, guesses what you meant, and renders something anyway. This is
        either its greatest strength (nobody's page "crashes") or its original sin (it trained a
        generation of sloppy markup), depending who you ask. It has no opinions about logic, no
        variables, no loops — it just describes what's there.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>Everywhere, permanently. Every single page on the web, no exceptions, has HTML underneath
        it somewhere — even pages built with the fanciest JavaScript framework eventually have to
        hand the browser real HTML elements to draw. It is the one truly universal constant of the
        web.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>The <code>&lt;blink&gt;</code> and <code>&lt;marquee&gt;</code> tags were never part
              of the official spec — browser vendors added them unilaterally in the '90s, and the
              web has never fully forgiven them.</li>
          <li>HTML5 (finalized 2014) was the first version to add real semantic tags
              (<code>&lt;article&gt;</code>, <code>&lt;nav&gt;</code>) and native audio/video —
              before that, everything was Flash or hacks.</li>
          <li>There is no "HTML 6." The spec is now a "living standard," continuously updated rather
              than released in big numbered versions.</li>
        </ul>
      `},
    ],
  },

  css: {
    icon: '🎨',
    title: 'CSS',
    subtitle: 'The Stylist',
    meta: { born: '1996', creator: 'Håkon Wium Lie', kind: 'Style sheet language', notFor: 'Structure or logic' },
    teaser: 'Deeply particular, occasionally maddening, and the reason a website with the same HTML can look like a professional product or a 1998 relic.',
    sections: [
      { heading: 'Origin', html: `
        <p>Before CSS, styling was either inline <code>&lt;font&gt;</code> tags scattered through
        every page, or nothing at all. Håkon Wium Lie proposed CSS in 1994 specifically to separate
        <em>what a page says</em> from <em>how it looks</em> — a clean idea that took the industry
        the better part of a decade to actually agree on, fighting through the infamous "browser
        wars" of the late '90s where Netscape and Internet Explorer each implemented things
        differently just to spite each other.</p>
      `},
      { heading: 'Personality', html: `
        <p>CSS rewards patience and punishes assumptions. Specificity rules that feel arbitrary until
        you internalize them, a box model that trips up beginners for years, layout systems (float,
        then flexbox, then grid) that each generation had to relearn — and yet, once it clicks, CSS
        is capable of genuinely stunning, expressive design with zero JavaScript at all. It has
        strong opinions about the "right" way to do things and will absolutely let you fight it.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>Any time a website looks intentional rather than accidental. Dark mode toggles, smooth
        animations, responsive layouts that gracefully resize from a phone to a monitor — all CSS,
        no exceptions.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>For nearly 20 years, centering something vertically was a running joke about CSS's
              design — Flexbox (2010s) finally made it a one-line fix.</li>
          <li>CSS has no loops or variables in the traditional sense — <code>calc()</code> and custom
              properties (<code>--var</code>) are relatively recent additions that finally gave it
              some programming-adjacent power.</li>
          <li>The "CSS Zen Garden" project (2003) proved a single HTML file could look like a
              hundred completely different websites, using only different stylesheets — it became
              legendary for demonstrating exactly how much power CSS really has.</li>
        </ul>
      `},
    ],
  },

  javascript: {
    icon: '⚡',
    title: 'JavaScript',
    subtitle: 'The Wildcard',
    meta: { born: '1995', creator: 'Brendan Eich', kind: 'Dynamic programming language', notFor: 'Nothing, unfortunately — it runs everywhere now' },
    teaser: 'Built in ten days as an afterthought, now running in every browser on Earth, on servers, in desktop apps, and on hardware nobody expected it to touch.',
    sections: [
      { heading: 'Origin', html: `
        <p>Brendan Eich wrote the first version of JavaScript at Netscape in <strong>ten days</strong>
        in 1995 — under enormous pressure to ship something, anything, that could make web pages
        interactive. It was originally called Mocha, briefly LiveScript, and was renamed
        "JavaScript" purely as a marketing move to ride the popularity of Java at the time, despite
        the two languages having almost nothing in common. That decision confuses new developers to
        this very day.</p>
      `},
      { heading: 'Personality', html: `
        <p>Famously quirky in ways that became internet folklore — <code>typeof null</code> returns
        <code>"object"</code> (a 25-year-old bug nobody can fix without breaking the entire web),
        <code>[] + []</code> is an empty string, and <code>0.1 + 0.2</code> doesn't quite equal
        <code>0.3</code>. And yet it's also relentlessly adaptable: the only language browsers run
        natively became, via Node.js, a serious server language, then a mobile app language (React
        Native), then a desktop app language (Electron). Few languages have been left for dead by
        critics as often, or proven them wrong as consistently.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>Every button that does something without reloading the page, every live chat widget, every
        infinite-scroll feed, every app built with React/Vue/Angular — plus a huge share of backend
        servers via Node.js. If a browser did something "smart," JavaScript did it.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>JavaScript has no relation to Java beyond the name — one is a scripting language for
              browsers, the other a compiled, statically-typed enterprise language. The naming was
              purely opportunistic marketing.</li>
          <li>"JavaScript fatigue" became a genuine phrase in the mid-2010s, describing the
              exhausting churn of new frameworks and build tools appearing every few months.</li>
          <li>TypeScript, a superset that adds optional static types, exists specifically to patch
              over JavaScript's most infamous weaknesses at scale — and has become nearly as popular
              as JavaScript itself in professional codebases.</li>
        </ul>
      `},
    ],
  },

  json: {
    icon: '🧩',
    title: 'JSON',
    subtitle: 'The Messenger',
    meta: { born: 'early 2000s', creator: 'Douglas Crockford', kind: 'Data interchange format', notFor: 'Comments, logic, or anything beyond describing data' },
    teaser: 'Minimalist almost to the point of stubbornness — no comments, no trailing commas, no exceptions — and that strictness is exactly why it took over the entire web.',
    sections: [
      { heading: 'Origin', html: `
        <p>JSON grew directly out of JavaScript's own object literal syntax — Douglas Crockford
        noticed in the early 2000s that this same lightweight <code>{key: value}</code> shape could
        become a universal way for ANY two systems to exchange data, regardless of what language
        either was written in. He didn't so much invent a new format as notice one hiding in plain
        sight and give it a name and a specification.</p>
      `},
      { heading: 'Personality', html: `
        <p>JSON is deliberately, almost stubbornly minimal. No comments allowed — ever, by design,
        so parsers stay dead simple and unambiguous. No trailing commas. No functions, dates, or
        <code>undefined</code>. Every rule exists purely to make JSON trivially easy for any
        programming language to read and write, at the cost of a few conveniences developers
        constantly wish it had.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>Anywhere two different systems need to agree on data: a browser talking to a server, one
        microservice talking to another, a config file, an API response. If data is moving between
        anything, there's a good chance it's wearing JSON's clothes while it travels.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>JSON largely displaced XML as the web's default data format mainly because it's
              shorter, easier to read at a glance, and maps directly onto data structures most
              languages already have (objects/dicts, arrays/lists).</li>
          <li>Despite the name (JavaScript Object Notation), JSON is entirely language-independent —
              virtually every programming language in existence can read and write it.</li>
          <li>Formats like JSON5 and JSONC (JSON with comments) exist specifically because
              developers kept wanting the one feature JSON refuses to add.</li>
        </ul>
      `},
    ],
  },

  sql: {
    icon: '🗄️',
    title: 'SQL',
    subtitle: 'The Archivist',
    meta: { born: '1970s (as SEQUEL)', creator: 'Donald Chamberlin & Raymond Boyce (IBM)', kind: 'Declarative query language', notFor: 'General-purpose programming' },
    teaser: 'Older than almost every other language taught today, utterly unglamorous, and yet still running underneath most of the world\'s important data, decades after "newer" alternatives were supposed to replace it.',
    sections: [
      { heading: 'Origin', html: `
        <p>SQL traces back to Edgar F. Codd's 1970 paper on the "relational model" of data — a
        genuinely radical idea at the time that data should be organized as simple tables related by
        shared keys, instead of the tangled hierarchical databases that came before. IBM researchers
        built a query language for it originally called SEQUEL (Structured English Query Language),
        later shortened to SQL after a trademark dispute.</p>
      `},
      { heading: 'Personality', html: `
        <p>SQL is <strong>declarative</strong> — you describe <em>what</em> result you want, not the
        step-by-step procedure to compute it, which is a genuinely different way of thinking compared
        to almost every other language in this course. It's unglamorous, syntactically old-fashioned,
        and has survived wave after wave of "SQL is dead" predictions (object databases in the '90s,
        NoSQL in the 2010s) by simply continuing to be the right tool for an enormous range of
        problems.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>Underneath nearly every application that remembers anything between visits — user accounts,
        orders, inventory, posts, comments. Even many "NoSQL" databases eventually grew SQL-like
        query languages once they needed to answer complex questions about relationships in data.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>SQL keywords are conventionally written in ALL CAPS (<code>SELECT</code>,
              <code>WHERE</code>) purely as a decades-old readability convention, not a hard
              requirement — lowercase works identically.</li>
          <li>"NoSQL" databases (MongoDB, Redis, etc.) emerged in the 2000s promising to replace SQL
              for web-scale problems — many have since added SQL-like query layers anyway.</li>
          <li>SQL injection — sneaking SQL commands into a form field — has been in the OWASP Top 10
              list of web vulnerabilities for over two decades, which is exactly why this course
              insists on prepared statements.</li>
        </ul>
      `},
    ],
  },

  php: {
    icon: '🐘',
    title: 'PHP',
    subtitle: 'The Workhorse',
    meta: { born: '1994', creator: 'Rasmus Lerdorf', kind: 'Server-side scripting language', notFor: 'Client-side/browser code' },
    teaser: 'Unfashionable, endlessly mocked by developers who don\'t use it, and quietly running a genuinely enormous fraction of the entire web anyway.',
    sections: [
      { heading: 'Origin', html: `
        <p>PHP began in 1994 as a small set of tools Rasmus Lerdorf wrote to track visits to his own
        online résumé — "Personal Home Page Tools," hence the name. It wasn't designed as a serious
        language at all; it grew, feature by feature, into one almost by accident, as more people
        found it was the easiest way to make a web page actually <em>do</em> something on the
        server.</p>
      `},
      { heading: 'Personality', html: `
        <p>PHP has a reputation problem it has spent 20 years trying to shed — early versions really
        did have inconsistent function names and rough edges, and much of that criticism calcified
        into internet folklore that hasn't kept up with how much the language has improved (modern
        PHP has real classes, type declarations, and a robust ecosystem). Underneath the jokes, it
        is relentlessly practical: install it, drop a file on a server, and it runs — no elaborate
        build step required.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>An enormous share of the web, largely because WordPress — built on PHP — alone powers a
        huge percentage of all websites that exist. Facebook was originally built on PHP too (and
        later built its own custom PHP-derived runtime, HHVM, specifically to keep scaling it).</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>PHP originally stood simply for "Personal Home Page" — the recursive
              backronym "PHP: Hypertext Preprocessor" was invented later, once it had grown into
              something much bigger than its name suggested.</li>
          <li>Facebook's HHVM (HipHop Virtual Machine) is a PHP-compatible runtime built specifically
              to run Facebook's own giant PHP codebase faster.</li>
          <li>The "why does everyone hate PHP" debate is largely a relic of PHP 4/5-era pain — PHP 8
              is a modern, respectably fast, strongly-toolable language most critics haven't
              revisited.</li>
        </ul>
      `},
    ],
  },

  lua: {
    icon: '🌙',
    title: 'Lua',
    subtitle: 'The Featherweight',
    meta: { born: '1993', creator: 'Roberto Ierusalimschy, Waldemar Celes, Luiz Henrique de Figueiredo', kind: 'Embeddable scripting language', notFor: 'Standalone applications with no host program' },
    teaser: 'Deliberately tiny by design philosophy, quietly embedded inside more software than most people realize, and — thanks to Roblox — probably a lot of people\'s actual first programming language.',
    sections: [
      { heading: 'Origin', html: `
        <p>Lua ("moon" in Portuguese) was created in 1993 at PUC-Rio in Brazil, explicitly designed to
        be small, fast, and <em>embeddable</em> — a scripting layer other programs could drop inside
        themselves, rather than a standalone language you'd run on its own. That single design goal
        shaped everything about it: a tiny core, easy integration with C, and a deliberate refusal to
        grow bloated features most embedders wouldn't need.</p>
      `},
      { heading: 'Personality', html: `
        <p>Minimalist almost as a point of pride — one data structure (the table) does the job many
        languages split across arrays, dictionaries, and objects. It has no built-in class system,
        preferring you build exactly the object system you need out of metatables. This can feel
        sparse coming from a "batteries included" language, but it's precisely why Lua embeds so
        easily into things far bigger than itself.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>World of Warcraft addons, the Love2D game engine, Redis scripting, nginx/OpenResty
        configuration, Neovim configuration — and, in by far its largest population of active
        learners today, Roblox, where it's the language (via Roblox's Luau dialect) that millions of
        people, often kids and teens, write their first real code in.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>Lua is 1-indexed — genuinely unusual among modern languages, and the single most common
              source of off-by-one bugs for people arriving from JavaScript, Python, or PHP.</li>
          <li>Roblox's "Luau" is a superset of Lua with optional type annotations and performance
              improvements, but the core language taught in this course transfers directly.</li>
          <li>Lua is famously one of the fastest scripting languages in typical benchmarks among
              non-compiled, dynamically-typed languages — a direct result of its small, focused
              design.</li>
        </ul>
      `},
    ],
  },

  shell: {
    icon: '💲',
    title: 'Shell / Bash',
    subtitle: 'The Operator',
    meta: { born: '1989 (Bash); shells trace to 1970s Unix', creator: 'Brian Fox (Bash), for the GNU Project', kind: 'Command interpreter / scripting language', notFor: 'Complex application logic or heavy data processing' },
    teaser: 'Terse, unforgiving, and older in spirit than almost anything else here — a single missing quote can turn a routine cleanup command into a genuine catastrophe.',
    sections: [
      { heading: 'Origin', html: `
        <p>The idea of a "shell" — a program that reads your typed commands and runs them — goes back
        to the earliest days of Unix in the 1970s. Bash ("Bourne Again SHell," a pun on the original
        Bourne shell it replaced) was written by Brian Fox in 1989 for the GNU Project, as a free,
        open alternative during an era when Unix tools were often expensive and proprietary. It has
        been the default shell on most Linux systems and, until recently, macOS, ever since.</p>
      `},
      { heading: 'Personality', html: `
        <p>Shell rewards precision and punishes carelessness more than almost any language here — an
        unquoted variable that happens to be empty, or a stray space in the wrong place, can silently
        turn a targeted delete into a catastrophic one. It's also extraordinarily powerful in
        experienced hands: entire deployment pipelines, backup systems, and automation workflows run
        on nothing but shell scripts stitching small, single-purpose tools together.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>Every time a developer opens a terminal — deploying code, installing packages, automating
        repetitive tasks, or gluing together other programs. It's less a language for building
        products and more the connective tissue developers use to operate everything else.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>The Unix philosophy behind shell tools — "do one thing well, and make it easy to combine
              with others via pipes" — directly shaped how much of modern software architecture still
              thinks about composability.</li>
          <li>"rm -rf /" (recursively, forcefully deleting the entire filesystem) is such a notorious
              disaster scenario that modern rm implementations specifically detect and refuse it by
              default.</li>
          <li>Zsh has replaced Bash as the default shell on macOS since 2019, but the core commands
              and concepts in this course transfer almost identically between the two.</li>
        </ul>
      `},
    ],
  },

  python: {
    icon: '🐍',
    title: 'Python',
    subtitle: 'The Diplomat',
    meta: { born: '1991', creator: 'Guido van Rossum', kind: 'General-purpose programming language', notFor: 'Nothing much anymore — it genuinely does almost everything' },
    teaser: 'Named after a British comedy troupe, not a snake, and somehow ended up simultaneously the most beginner-friendly language taught in schools and the backbone of cutting-edge AI research.',
    sections: [
      { heading: 'Origin', html: `
        <p>Guido van Rossum started Python in 1991, explicitly naming it after <em>Monty Python's
        Flying Circus</em> — not the reptile, despite the logo. He wanted a language that read almost
        like plain instructions, prioritizing clarity over cleverness. That single design value —
        codified later in "The Zen of Python" ("There should be one — and preferably only one —
        obvious way to do it") — has shaped essentially every decision about the language since.</p>
      `},
      { heading: 'Personality', html: `
        <p>Python genuinely reads like pseudocode, which is precisely why it's so often a first
        language in schools and bootcamps. Indentation isn't just a style preference — it's the
        actual syntax, a controversial choice when introduced that's now one of Python's most
        defining (and most argued-about) traits. Despite the gentle learning curve, it's serious
        enough to sit underneath some of the most advanced software on Earth.</p>
      `},
      { heading: 'Where You\'ll Meet It', html: `
        <p>Data science and machine learning (it's the default language of the entire AI boom),
        scientific computing, automation scripts, backend web services (Django, Flask), and as the
        first language for a huge share of programming courses worldwide.</p>
      `},
      { heading: 'Field Notes', html: `
        <ul>
          <li>Python 2 vs Python 3 was a genuinely painful, decade-long split in the community —
              Python 2 wasn't officially retired until January 2020, years after Python 3 was
              considered the obvious future.</li>
          <li>"The Zen of Python" is an actual easter egg — typing <code>import this</code> in a real
              Python interpreter prints its full 19-line philosophy of design.</li>
          <li>Python's simplicity made it the default teaching language for machine learning, which is
              a huge part of why virtually every major AI framework (TensorFlow, PyTorch) is Python-first.</li>
        </ul>
      `},
    ],
  },
};
