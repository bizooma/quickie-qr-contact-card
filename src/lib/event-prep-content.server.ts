// The Event Prep Pack's three working documents, as shown in the app.
// Server-only: sent by getEventPrep to paid accounts, never bundled for the
// browser. The wording follows the course lessons; a few lines point at the
// app's own tabs instead of "the next lesson".
import type { PrepContent } from "./event-prep";

// Item ids are stable on purpose: a person's ticks are stored by id, so
// rewording an item must not lose them.
export const EVENT_PREP: PrepContent = {
  checklist: {
    intro:
      "Most people decide how an event went for them in the last hour of it. You're going to decide in the week before. Run this checklist for every event. It takes about 30 minutes total and it's the difference between \"I should network more\" and a stack of warm cards with follow-ups already moving.",
    sections: [
      {
        id: "week",
        title: "The week before (15 minutes)",
        items: [
          {
            id: "week-goal-sheet",
            text: "Fill out your goal sheet (the Goal sheet tab): who you want to meet and your card-collection target.",
          },
          {
            id: "week-names",
            text: 'Look up the speaker list and sponsor list. Circle 3 to 5 names or companies you\'d genuinely like to talk to, not "everyone."',
          },
          {
            id: "week-openers",
            text: "Pick your 3 openers on the Openers tab and say them out loud once. (Reading them is not the same. 30 seconds of saying them removes 90% of the awkwardness.)",
          },
          {
            id: "week-cards",
            text: "Order or refill your paper business cards, and check that your digital card is up to date.",
          },
          {
            id: "week-calendar",
            text: 'Block 15 minutes on your calendar for the evening after the event, labeled "Scan cards." This is the single highest-leverage item on this page.',
          },
        ],
      },
      {
        id: "day",
        title: "The day before (5 minutes)",
        items: [
          {
            id: "day-reread",
            text: 'Re-read your goal sheet. One sentence version in your head: "I\'m going to meet ___ kinds of people and come home with ___ cards."',
          },
          {
            id: "day-exit",
            text: 'Decide your exit line now: "I promised myself I\'d meet a few more people tonight. Can I grab your card so we can continue this properly?" (Collecting the card IS the graceful exit.)',
          },
          {
            id: "day-charge",
            text: "Charge your phone. Your phone is your scanner, your notepad, and your card.",
          },
        ],
      },
      {
        id: "morning",
        title: "The morning of (2 minutes)",
        items: [
          {
            id: "morning-ready",
            text: "Cards (or digital card ready), phone charged, goal sheet number in your head.",
          },
          {
            id: "morning-pocket",
            text: 'Pick the pocket. Seriously: one pocket for cards you receive, nothing else goes in it. No more "which pocket was that guy in."',
          },
        ],
      },
      {
        id: "event",
        title: "At the event",
        items: [
          {
            id: "event-openers",
            text: "Use your openers. First conversation inside the first 15 minutes. Momentum is everything, and the first one is the only hard one.",
          },
          {
            id: "event-ask",
            text: "When a conversation is worth continuing, ask for the card and say what you'll do: \"I'll follow up tomorrow with that thing we talked about.\" Now your follow-up email is expected, not cold.",
          },
          {
            id: "event-note",
            text: 'The 10-second note: after a good conversation, before the next one, jot one line on the back of their card or in your phone: "asked about pricing", "knows supplier", "hiring in Q1". This one habit doubles the quality of every follow-up.',
          },
          {
            id: "event-halfway",
            text: "Check your count against your target at the halfway point. Behind? Use opener #1 on the next person standing alone. They're hoping someone will.",
          },
        ],
      },
      {
        id: "evening",
        title: "That evening (the 15 minutes you blocked)",
        items: [
          { id: "evening-scan", text: "Photograph every card and scan them in on the Scan tab." },
          {
            id: "evening-notes",
            text: "Add your one-liners next to the people you remember, while you still remember.",
          },
          {
            id: "evening-hot-five",
            text: "Send follow-ups to your hot five tonight or tomorrow morning. (The 48-Hour Follow-Up System in your course library takes it from here.)",
          },
        ],
      },
    ],
    closing:
      "The whole pack in one sentence: decide who and how many before you go, open early, note while it's fresh, scan the same evening. Events stop being social roulette and start being a pipeline.",
  },

  openers: {
    intro:
      "None of these are clever. That's the point. Clever openers make people perform; normal openers make people talk. Pick three that sound like you, say them out loud once before the event, and you're set.",
    groups: [
      {
        title: "Walking up to someone standing alone",
        items: [
          {
            n: 1,
            text: "Mind if I join you? I don't know a soul here.",
            note: "Disarmingly honest. Works nearly every time, because they usually don't either.",
          },
          { n: 2, text: "How's the event treating you so far?" },
          {
            n: 3,
            text: "Have you been to one of these before? First one for me.",
            note: 'Or: "I keep coming back, the [session] talk alone was worth it."',
          },
          {
            n: 4,
            text: "I'm doing the thing where you talk to people instead of checking your phone in the corner. I'm [name].",
          },
          { n: 5, text: "What brings you here? Speaker, the topic, or the free coffee?" },
        ],
      },
      {
        title: "After a talk or session",
        items: [
          {
            n: 6,
            text: "What did you think of that talk?",
            note: "The single most reliable opener at any conference.",
          },
          { n: 7, text: "Did you catch the part about [topic]? I'm still chewing on that." },
          { n: 8, text: "Which session are you heading to next? I can't decide." },
          { n: 9, text: "Was that worth the hype, you think?" },
        ],
      },
      {
        title: "In a line, at a table, by the food",
        items: [
          { n: 10, text: "The line is always the best networking at these things. I'm [name]." },
          {
            n: 11,
            text: "Any idea if the coffee's any good, or should I manage my expectations?",
          },
          {
            n: 12,
            text: "Is this seat taken? … So what do you do when you're not at things like this?",
          },
          {
            n: 13,
            text: "I've decided the dessert table is my booth. What's been your favorite part so far?",
          },
        ],
      },
      {
        title: "At a booth or expo floor",
        items: [
          { n: 14, text: "Give me the 20-second version. What do you folks do?" },
          {
            n: 15,
            text: "Who's your ideal customer? I might know someone.",
            note: "Instantly memorable, because you offered before asking.",
          },
          { n: 16, text: "Busy show for you, or slow burn?" },
        ],
      },
      {
        title: "Re-connecting with someone you half-know",
        items: [
          {
            n: 17,
            text: "We've met before, [event/place], right? I'm [name], help me out with yours.",
          },
          {
            n: 18,
            text: "I follow your posts. The one about [topic] stuck with me. Good to put a face to the name.",
          },
        ],
      },
      {
        title: "Joining a group that's already talking",
        items: [
          { n: 19, text: "Mind if I listen in? This sounded like the interesting conversation." },
          {
            n: 20,
            text: "What's the consensus here on [topic]?",
            note: "Said to the group during a lull. Borrow the topic they were already on.",
          },
        ],
      },
    ],
    rules: [
      {
        title: "Follow up with a real question.",
        text: 'The opener buys you 10 seconds; curiosity does the rest. "What do you do?" → "What\'s the hardest part of that right now?" is where conversations actually start.',
      },
      {
        title: "End with the card, not a fade-out.",
        text: "\"I want to hear how that goes. Can I grab your card? I'll follow up this week.\" You said the follow-up out loud, so now it's expected. That sentence is the whole business model of this pack.",
      },
    ],
  },

  goalSheet: {
    intro:
      "Five minutes, once per event. Fill it in the week before. People who write down who they want to meet, meet them, not by magic, but because you can't recognize an opportunity you never defined.",
    categories: [
      {
        name: "Buyers",
        text: 'People with the problem you solve. ("Ops managers drowning in manual processes.")',
      },
      {
        name: "Connectors",
        text: "People who know 50 of your buyers: community organizers, consultants, podcast hosts, the person who seems to know everyone.",
      },
      {
        name: "Peers one step ahead",
        text: "People doing what you do, slightly bigger. Worth one coffee a quarter forever.",
      },
    ],
    because:
      'The "because" column matters more than the "who": it becomes the first line of your follow-up email. "Great meeting you. You mentioned the supplier problem, and that\'s exactly the thing I wanted to ask you about" writes itself when you defined it in advance.',
    exitLine:
      "I promised myself I'd meet a few more people. Can I grab your card? I'll follow up this week.",
    after:
      "After the event, the goal sheet becomes your scoring sheet: Did I meet the three roles? Hit the card target? Send the hot five? Three yeses = the event paid for itself, whatever the vibe was.",
  },
};
