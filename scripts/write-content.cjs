// Hulpscript: leest js/content.js, laat een functie het object aanpassen, schrijft het terug.
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "js", "content.js");
const src = fs.readFileSync(file, "utf8");
const header = src.slice(0, src.indexOf("window.SITE_CONTENT"));
global.window = {};
eval(src);
const c = window.SITE_CONTENT;
module.exports = (fn) => {
  fn(c);
  fs.writeFileSync(file, header + "window.SITE_CONTENT = " + JSON.stringify(c, null, 2) + ";\n");
};
