const EIGHT_BALL = [
  "It is certain.", "Without a doubt.", "You may rely on it.", "Yes, definitely.",
  "It is decidedly so.", "As I see it, yes.", "Most likely.", "Outlook good.",
  "Signs point to yes.", "Yes.", "Reply hazy, try again.", "Ask again later.",
  "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
  "Don't count on it.", "My reply is no.", "My sources say no.",
  "Outlook not so good.", "Very doubtful.", "Absolutely not.", "Ask your mom.",
];

const FACTS = [
  "A group of flamingos is called a 'flamboyance.'",
  "Honey never spoils — archaeologists have found 3000-year-old honey in Egyptian tombs that's still edible.",
  "Octopuses have three hearts, and two of them stop beating when they swim.",
  "Bananas are berries, but strawberries aren't.",
  "A day on Venus is longer than a year on Venus.",
  "Wombat poop is cube-shaped.",
  "The Eiffel Tower can grow more than 6 inches taller in summer due to heat expansion.",
  "There are more possible chess games than atoms in the observable universe.",
  "Sea otters hold hands while sleeping so they don't drift apart.",
  "The shortest war in history lasted 38 minutes (Britain vs. Zanzibar, 1896).",
  "Sharks existed before trees.",
  "A single cloud can weigh over a million pounds.",
  "Cows have best friends and get stressed when separated from them.",
  "The inventor of the Pringles can is buried in one.",
  "Hot water can freeze faster than cold water under certain conditions — it's called the Mpemba effect.",
  "Some cats are allergic to humans.",
  "There's a species of jellyfish that is biologically immortal.",
  "You can't hum while holding your nose closed.",
  "Scotland's national animal is the unicorn.",
  "The total weight of all ants on Earth roughly equals the total weight of all humans.",
];

const ROASTS = [
  "You have the energy of a printer that's perpetually out of one specific color.",
  "You're like a software update — nobody asked for you and everything gets slower when you show up.",
  "If confusion had a face, it would still be more put together than you right now.",
  "You bring the same energy as a phone at 1% battery in a room with no chargers.",
  "You're proof that even autocorrect gives up sometimes.",
  "You have the confidence of a WiFi router with one bar.",
  "Somewhere, a random number generator is jealous of how random your decisions are.",
  "You're the human equivalent of a buffering wheel.",
  "If being slightly wrong about everything was a sport, you'd need a bigger trophy case.",
  "You have main character energy in a story nobody's reading.",
  "You're like a CAPTCHA — technically here to prove something, unclear what.",
  "You walk in like the group project is finally going to get done. It's not.",
  "You have the strategic planning skills of a Roomba stuck on a table leg.",
  "Your vibe is 'forgot why I walked into the room' but as a personality.",
  "You're the reason instructions come with pictures now.",
  "You bring 'reply-all by accident' energy to every conversation.",
  "You have the follow-through of a New Year's resolution made on January 2nd.",
  "You're basically a Monday that learned to talk.",
  "If overthinking burned calories you'd be an Olympic athlete.",
  "You have main quest energy but keep doing side quests forever.",
];

const COMPLIMENTS = [
  "You have main character energy and everyone around you can feel it.",
  "Your timing is impeccable — you always show up exactly when needed.",
  "You make hard things look easy, and easy things look fun.",
  "You've got that rare mix of chill and reliable — people trust you without even thinking about it.",
  "Your sense of humor is criminally underrated.",
  "You make everyone around you a little more relaxed just by being there.",
  "You're the friend people quietly hope shows up to things.",
  "Your ideas are the kind that sound weird for five seconds and then everyone agrees.",
  "You've got a gift for making people feel heard.",
  "You're proof that being genuinely kind is still the most underrated skill.",
  "You handle chaos like it's just Tuesday.",
  "You're the person people text first when something good happens.",
  "Your energy is contagious in the best way.",
  "You're better at this than you think you are — genuinely.",
  "You make good decisions look effortless.",
  "You've got taste. Actual, real taste.",
  "You're the reason this server doesn't feel like a ghost town.",
  "You're weirdly good at showing up for people.",
  "Your patience is a superpower and you probably don't even notice you're using it.",
  "You're just built different, and it's the good kind of different.",
];

const WOULD_YOU_RATHER = [
  "Would you rather fight one horse-sized duck or 100 duck-sized horses?",
  "Would you rather always have to sing instead of speak, or dance everywhere you walk?",
  "Would you rather have unlimited pizza for life or unlimited tacos for life?",
  "Would you rather be able to fly but only at walking speed, or be invisible but only when no one's looking?",
  "Would you rather lose all your money or all your photos?",
  "Would you rather never use social media again or never watch another movie/show again?",
  "Would you rather always know when someone's lying, or always get away with lying?",
  "Would you rather be famous but broke, or rich but completely unknown?",
  "Would you rather have a rewind button or a pause button for your life?",
  "Would you rather live without music or without air conditioning/heating?",
  "Would you rather fight one bear or be chased by 50 raccoons?",
  "Would you rather have to say every thought out loud, or never speak again?",
  "Would you rather always be 10 minutes late or always be 20 minutes early?",
  "Would you rather have a time machine that only goes backward, or one that only goes forward?",
  "Would you rather give up your phone for a month or shower with cold water for a month?",
  "Would you rather be able to talk to animals or speak every human language fluently?",
  "Would you rather never eat your favorite food again, or only ever eat your favorite food?",
  "Would you rather be feared by everyone or loved by no one?",
  "Would you rather have the power to freeze time or read minds?",
  "Would you rather live in a world with no internet or no cars?",
];

const VIBE_CAPTIONS = [
  { min: 0, max: 15, caption: "running on fumes and spite" },
  { min: 16, max: 30, caption: "Monday energy, and it's not Monday" },
  { min: 31, max: 45, caption: "surviving, not thriving" },
  { min: 46, max: 60, caption: "mid but stable" },
  { min: 61, max: 75, caption: "actually pretty good today" },
  { min: 76, max: 90, caption: "main character energy" },
  { min: 91, max: 100, caption: "unstoppable, get out of the way" },
];

const RPS_CHOICES = ['rock', 'paper', 'scissors'];
const RPS_EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  EIGHT_BALL, FACTS, ROASTS, COMPLIMENTS, WOULD_YOU_RATHER,
  VIBE_CAPTIONS, RPS_CHOICES, RPS_EMOJI, pick,
};
