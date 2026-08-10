const houseNames: Readonly<Record<number, { title: string; description: string }>> = {
  1: {
    title: "Self and identity",
    description: "The 1st house is about how you enter the world: identity, self-presentation, personal style and your instinctive way of approaching life.",
  },
  2: {
    title: "Money, possessions and values",
    description: "The 2nd house is about personal resources: money, possessions, material security, self-worth and what you consider valuable.",
  },
  3: {
    title: "Communication and everyday life",
    description: "The 3rd house is about communication, learning, siblings, neighbours, short journeys and the way you process and exchange everyday information.",
  },
  4: {
    title: "Home, family and roots",
    description: "The 4th house is about home, family, ancestry, private life and the emotional foundations that give you a sense of belonging.",
  },
  5: {
    title: "Creativity, pleasure and romance",
    description: "The 5th house is about creativity, play, pleasure, dating, self-expression, children and the things you do because they make life feel vivid.",
  },
  6: {
    title: "Work, routines and wellbeing",
    description: "The 6th house is about daily routines, practical work, service, habits, health and the systems that keep ordinary life functioning.",
  },
  7: {
    title: "Partnerships and close relationships",
    description: "The 7th house is about committed one-to-one relationships, partnership, collaboration, negotiation and the qualities you encounter through other people.",
  },
  8: {
    title: "Intimacy, shared resources and change",
    description: "The 8th house is about intimacy, shared money and obligations, trust, vulnerability, inheritance, loss and deep personal transformation.",
  },
  9: {
    title: "Beliefs, travel and higher learning",
    description: "The 9th house is about worldview, philosophy, religion, higher education, long-distance travel and experiences that broaden your understanding of life.",
  },
  10: {
    title: "Career, reputation and public life",
    description: "The 10th house is about career, vocation, ambition, reputation, responsibility and the role you build in the wider world.",
  },
  11: {
    title: "Friendships, community and future goals",
    description: "The 11th house is about friendships, groups, networks, communities, collective causes and the hopes or long-term goals you pursue with others.",
  },
  12: {
    title: "Inner life, retreat and hidden patterns",
    description: "The 12th house is about solitude, retreat, the unconscious, hidden patterns, endings and experiences that happen away from public view.",
  },
};

const houseNumber = (value: string): number | null => {
  const match = /^(?:tropical\s+|sidereal\s+)?house\s+(\d+)(?:\s+interpretation)?$/iu.exec(value.trim());
  if (match?.[1] === undefined) return null;
  const valueNumber = Number.parseInt(match[1], 10);
  return valueNumber >= 1 && valueNumber <= 12 ? valueNumber : null;
};

const enhanceHouseReading = (reading: HTMLDetailsElement): void => {
  const summary = reading.querySelector<HTMLElement>(":scope > summary");
  if (summary === null) return;
  const number = houseNumber(summary.textContent ?? "");
  if (number === null) return;
  const house = houseNames[number];
  if (house === undefined) return;

  summary.textContent = house.title;
  summary.title = `House ${number}`;
  reading.dataset["house"] = String(number);

  const body = reading.querySelector<HTMLElement>(":scope > .chart-reading-body");
  if (body !== null) {
    let explanation = body.querySelector<HTMLElement>(":scope > .chart-reading-explainer");
    if (explanation === null) {
      explanation = document.createElement("p");
      explanation.className = "chart-reading-explainer";
      body.prepend(explanation);
    }
    explanation.textContent = house.description;
  }

  const link = document.querySelector<HTMLAnchorElement>(`#formattedChartIndex a[href="#${CSS.escape(reading.id)}"]`);
  if (link !== null) {
    link.textContent = house.title;
    link.title = `House ${number}`;
  }
};

const enhance = (): void => {
  for (const reading of document.querySelectorAll<HTMLDetailsElement>("#formattedChart details.chart-reading")) {
    enhanceHouseReading(reading);
  }
};

const host = document.querySelector<HTMLElement>("#formattedChart");
if (host !== null) new MutationObserver(enhance).observe(host, { childList: true, subtree: true });
queueMicrotask(enhance);
