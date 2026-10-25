// Audience landing pages (/for/<slug>): pure data, rendered by for.$audience.tsx.

export type Audience = {
  slug: string;
  label: string;
  eyebrow: string;
  headline: [string, string]; // second part gets the brand accent
  sub: string;
  pains: { t: string; d: string }[];
  features: { t: string; d: string }[];
  cta: string;
  closing: string;
};

export const AUDIENCES: Record<string, Audience> = {
  teams: {
    slug: "teams",
    label: "Sales teams",
    eyebrow: "For sales teams",
    headline: ["Every rep on-brand. ", "Every lead in one pipeline."],
    sub: "Give the whole team digital cards with your colors and logo locked on, and capture every prospect they meet into contacts you can actually see.",
    pains: [
      {
        t: "Reprints with every hire",
        d: "New rep, new title, new box of cards. Digital cards are provisioned in a minute and edited forever.",
      },
      {
        t: "Leads die in reps' pockets",
        d: "A card handed out tells you nothing. Share-back capture turns every conversation into a contact with a timestamp.",
      },
      {
        t: "Zero visibility",
        d: "Who's actually networking? Team analytics shows views, saves and captured leads per rep.",
      },
    ],
    features: [
      {
        t: "Brand lock",
        d: "Your accent color and logo enforced on every card in the team — nobody drifts off-brand.",
      },
      {
        t: "Provision in bulk",
        d: "Invite reps with one link, then create a branded card for each of them from the Team page.",
      },
      {
        t: "Shared contacts",
        d: "Opt in to a single team pipeline: every captured lead visible to everyone who needs it.",
      },
      {
        t: "Team analytics",
        d: "Views, saves and share-backs across all team cards, in one view.",
      },
    ],
    cta: "Set up your team",
    closing: "Your next hire should be sharing a branded card the day they start.",
  },
  realtors: {
    slug: "realtors",
    label: "Realtors",
    eyebrow: "For realtors",
    headline: ["Your card on every yard sign, ", "every open house."],
    sub: "One QR code puts your face, phone and listings in a buyer's pocket — and their details in your follow-up list before they're out the door.",
    pains: [
      {
        t: "Cards end up in junk drawers",
        d: "The buyer who loved the house loses your card by the weekend. A saved contact doesn't get lost.",
      },
      {
        t: "Sign-in sheets go unread",
        d: "Paper open-house sheets with illegible emails. Share-back capture gets clean, typed details instantly.",
      },
      {
        t: "New brokerage, new reprint",
        d: "Change brokerages or get a new number and every printed card is trash. Digital edits go live instantly.",
      },
    ],
    features: [
      {
        t: "QR on signage",
        d: "Put your card's QR on yard signs, flyers and open-house tables — scans open your card, no app.",
      },
      {
        t: "Capture at open houses",
        d: "Visitors tap “Share yours” and land in your contacts, tagged and time-stamped while you keep hosting.",
      },
      {
        t: "Follow-up drafts",
        d: "Draft the “great meeting you at 42 Oak St” email from your notes in one tap.",
      },
      {
        t: "Know which sign works",
        d: "Views and saves per card tell you which listing, event or sign actually brings people in.",
      },
    ],
    cta: "Create your realtor card",
    closing: "The next buyer who scans your sign should never have to type your name.",
  },
  recruiters: {
    slug: "recruiters",
    label: "Recruiters",
    eyebrow: "For recruiters",
    headline: ["Candidates share their details ", "before they leave the booth."],
    sub: "Work a career fair without a single paper form: your card opens on their phone, their details come back to you, tagged and ready to work.",
    pains: [
      {
        t: "Stacks of cards, no context",
        d: "Fifty candidates on Monday and no idea who was the React dev. Notes and tags live on every contact.",
      },
      {
        t: "Follow-ups slip",
        d: "The best candidates get three offers while their card sits in a pile. Capture now, draft the follow-up in a tap.",
      },
      {
        t: "Typos lose people",
        d: "A misread email on a sign-up sheet is a lost candidate. Share-back details arrive typed by the candidate.",
      },
    ],
    features: [
      {
        t: "Booth-ready QR",
        d: "Your card's QR on the banner and table tent — candidates scan, see you, and save you in one tap.",
      },
      {
        t: "Share-back capture",
        d: "Candidates send name, email and phone straight to your pipeline, with the event in the notes.",
      },
      {
        t: "Scan their cards too",
        d: "Photograph candidate or client cards and the scanner files them — headshot included.",
      },
      {
        t: "Tag and follow up",
        d: "Tag by role or event, then draft personalized follow-up emails before the fair ends.",
      },
    ],
    cta: "Create your recruiter card",
    closing: "The best candidate at the fair should be in your pipeline before lunch.",
  },
};
