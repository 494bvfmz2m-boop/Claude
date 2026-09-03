window.COURSE = window.COURSE || {};

window.COURSE.css = {
  id: 'css',
  title: 'CSS',
  icon: '🎨',
  description: 'Style, layout, and responsiveness — how a page goes from plain to polished.',
  lessons: [
    {
      id: 'css-1',
      title: 'Selectors & the Cascade',
      blocks: [
        { type: 'text', html: `
          <p><strong>CSS</strong> (Cascading Style Sheets) styles HTML elements using
          <strong>selector { property: value; }</strong> rules. Selectors can target a tag
          (<code>p</code>), a class (<code>.highlight</code>), an id (<code>#header</code>), or
          combinations of those.</p>
          <p>When multiple rules could apply to the same element, more specific selectors win, and later
          rules beat earlier ones of equal specificity — that's the "cascade".</p>
        `},
        { type: 'code', lang: 'css', code:
`p { color: #333; }
.highlight { background: yellow; }
#main-title { font-size: 2rem; }` },
        { type: 'web', task: 'Change the paragraph color and give it a class-based background highlight.', starter: {
          html: `<h1 id="main-title">Welcome</h1>\n<p class="highlight">This paragraph can be styled.</p>\n<p>This one too.</p>`,
          css: `#main-title { color: darkslateblue; }\n.highlight { background: yellow; }\np { font-family: sans-serif; }`,
        }},
      ],
      quiz: [
        { q: 'How do you select all elements with class="card"?', choices: ['#card', '.card', 'card'], answer: 1, explain: 'A dot prefix (.card) selects by class; a hash (#card) selects by id.' },
        { q: 'If a tag selector and a class selector both style color, which wins?', choices: ['The tag selector always', 'The class selector (more specific)', 'Whichever is defined first'], answer: 1, explain: 'Class selectors are more specific than tag selectors, so they take priority.' },
      ],
    },

    {
      id: 'css-2',
      title: 'The Box Model',
      blocks: [
        { type: 'text', html: `
          <p>Every element is a rectangular box made of four layers, from the inside out:
          <strong>content</strong> → <strong>padding</strong> (space inside the border) →
          <strong>border</strong> → <strong>margin</strong> (space outside the border, between
          elements). <code>width</code>/<code>height</code> set the content box by default.</p>
        `},
        { type: 'code', lang: 'css', code:
`.box {
  width: 200px;
  padding: 16px;
  border: 2px solid #333;
  margin: 20px;
  box-sizing: border-box; /* width now includes padding + border */
}` },
        { type: 'note', kind: 'tip', html: '<code>box-sizing: border-box</code> is used almost everywhere in real projects because it makes width/height math much more predictable.' },
        { type: 'web', task: 'Adjust padding, border, and margin on .box and watch the preview change. Try toggling box-sizing.', starter: {
          html: `<div class="box">Content</div>`,
          css: `.box {\n  width: 200px;\n  padding: 16px;\n  border: 4px solid tomato;\n  margin: 20px;\n  background: #fdf6ec;\n}`,
        }},
      ],
      quiz: [
        { q: 'Order the box model layers from innermost to outermost.', choices: ['Border, content, padding, margin', 'Content, padding, border, margin', 'Padding, content, margin, border'], answer: 1, explain: 'Content → padding → border → margin, inside to outside.' },
        { q: 'What does box-sizing: border-box change?', choices: ['Colors of the border', 'Whether width/height includes padding & border', 'The margin direction'], answer: 1, explain: 'With border-box, the specified width/height already includes padding and border.' },
      ],
    },

    {
      id: 'css-3',
      title: 'Typography, Color & Backgrounds',
      blocks: [
        { type: 'text', html: `
          <p>Common properties: <code>color</code> (text), <code>background</code>, <code>font-family</code>,
          <code>font-size</code>, <code>font-weight</code>, <code>line-height</code>, <code>text-align</code>.
          Colors can be named (<code>tomato</code>), hex (<code>#ff6347</code>), or functional
          (<code>rgb(255 99 71)</code>, <code>hsl(9 100% 64%)</code>).</p>
        `},
        { type: 'code', lang: 'css', code:
`body {
  font-family: "Segoe UI", sans-serif;
  color: #222;
  background: #f7f7f7;
  line-height: 1.6;
}
h1 {
  color: #1a1a2e;
  font-weight: 700;
}` },
        { type: 'web', task: 'Change the font family, and try a few different background colors using hex and rgb() values.', starter: {
          html: `<h1>Styled Heading</h1>\n<p>Some body text to style. Try a serif font, then a monospace one.</p>`,
          css: `body { font-family: sans-serif; background: white; color: #222; }\nh1 { color: teal; }`,
        }},
      ],
      quiz: [
        { q: 'Which of these is a valid CSS color value?', choices: ['color: bold;', 'color: rgb(255 0 0);', 'color: 255,0,0;'], answer: 1, explain: 'rgb(255 0 0) (or rgb(255, 0, 0)) is a valid function-based color.' },
      ],
    },

    {
      id: 'css-4',
      title: 'Flexbox',
      blocks: [
        { type: 'text', html: `
          <p><strong>Flexbox</strong> arranges children of a container in a row or column, with easy
          control over alignment and spacing. Set <code>display: flex</code> on the parent, then use
          <code>justify-content</code> (main axis) and <code>align-items</code> (cross axis).</p>
        `},
        { type: 'code', lang: 'css', code:
`.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}` },
        { type: 'web', task: 'Try changing justify-content to center, flex-end, or space-around, and flex-direction to column.', starter: {
          html: `<div class="nav">\n  <div class="item">Logo</div>\n  <div class="item">Home</div>\n  <div class="item">About</div>\n  <div class="item">Contact</div>\n</div>`,
          css: `.nav {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  background: #222;\n  padding: 12px;\n}\n.item { color: white; padding: 6px 10px; }`,
        }},
      ],
      quiz: [
        { q: 'What property makes a container use Flexbox layout?', choices: ['flex: true;', 'display: flex;', 'layout: flex;'], answer: 1, explain: 'display: flex on the parent turns on flex layout for its direct children.' },
        { q: 'Which property centers items along the main axis?', choices: ['align-items: center;', 'justify-content: center;', 'text-align: center;'], answer: 1, explain: 'justify-content controls alignment along the main (row, by default) axis.' },
      ],
    },

    {
      id: 'css-5',
      title: 'Grid',
      blocks: [
        { type: 'text', html: `
          <p><strong>CSS Grid</strong> lays out children in two dimensions (rows and columns) at once —
          great for whole-page layouts and card galleries. Define columns with
          <code>grid-template-columns</code>.</p>
        `},
        { type: 'code', lang: 'css', code:
`.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}` },
        { type: 'web', task: 'Change repeat(3, 1fr) to repeat(2, 1fr) or repeat(auto-fit, minmax(100px, 1fr)) and see the grid respond.', starter: {
          html: `<div class="gallery">\n  <div class="card">1</div>\n  <div class="card">2</div>\n  <div class="card">3</div>\n  <div class="card">4</div>\n  <div class="card">5</div>\n  <div class="card">6</div>\n</div>`,
          css: `.gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }\n.card { background: #6c5ce7; color: white; padding: 24px; text-align: center; border-radius: 8px; }`,
        }},
      ],
      quiz: [
        { q: 'What does grid-template-columns: repeat(3, 1fr) create?', choices: ['3 equal-width columns', '3 rows of fixed height', '1 column, 3 pixels wide'], answer: 0, explain: 'repeat(3, 1fr) creates 3 columns, each taking an equal fraction of available space.' },
      ],
    },

    {
      id: 'css-6',
      title: 'Responsive Design',
      blocks: [
        { type: 'text', html: `
          <p><strong>Media queries</strong> apply CSS conditionally, most commonly based on screen
          width, so a layout adapts to phones, tablets, and desktops.</p>
        `},
        { type: 'code', lang: 'css', code:
`.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 600px) {
  .gallery {
    grid-template-columns: 1fr; /* stack on small screens */
  }
}` },
        { type: 'note', kind: 'info', html: 'Resize your browser (or use dev tools\' device toolbar) to see media queries kick in on a real site.' },
        { type: 'web', task: 'This preview is narrow like a phone, so the single-column rule is already active. Change max-width to 2000px to force it to always apply, or delete the whole @media block to go back to 3 columns.', starter: {
          html: `<div class="gallery">\n  <div class="card">1</div>\n  <div class="card">2</div>\n  <div class="card">3</div>\n</div>`,
          css: `.gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }\n.card { background: #00b894; color: white; padding: 20px; text-align: center; border-radius: 8px; }\n\n@media (max-width: 600px) {\n  .gallery { grid-template-columns: 1fr; }\n}`,
        }},
      ],
      quiz: [
        { q: 'What is a media query used for?', choices: ['Fetching data from a server', 'Applying CSS conditionally based on things like screen width', 'Selecting HTML elements by tag name'], answer: 1, explain: 'Media queries let you write CSS that only applies under certain conditions, like a max screen width.' },
      ],
    },
  ],
};
