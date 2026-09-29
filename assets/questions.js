/* The 17 onboarding questions. [question, helper text]. Order and ids (q01..q17) must stay stable once clients have answered. */
window.QUESTIONS=[
 ["What is your main industry or niche?","Be as specific as you can. “Real estate” is broad; “short-term rental investing for people with full-time jobs” is specific."],
 ["Why do you want to do YouTube?","What would make it worth it for you a year from now?"],
 ["Who is your target audience? (Age, location, occupation, etc.)","Describe the people you most want watching, and the best customers you have today."],
 ["Who do you want to be the #1 biggest channel for?","Finish the sentence: “I want to be the #1 channel for…”"],
 ["What are their top 3–5 pain points?","What keeps them stuck? Use the words they use on your sales calls."],
 ["What is their dream result (the transformation)?","Where are they before they find you, and where do they end up?"],
 ["What is your customer journey, broken down into steps?","From the first time someone hears about you to becoming a client: how they find you, what they buy, and what happens after."],
 ["What steps must your ideal client take to reach their desired outcome?","The steps they go through to get the result, in order."],
 ["Explain your story: why you got into this, your personal transformation, how you started the business, the story of growing it (wins and losses), and where you are now.","Take your time here. Your stories often become the best parts of your videos."],
 ["What makes your voice in your space unique? How are you different from or better than competitors? What are your unfair advantages?",""],
 ["List all your social proof.","Client results, numbers, names you’re comfortable sharing, press, credentials, milestones."],
 ["What are 5–10 niche subtopics you want to make content about?",""],
 ["What are the common myths in your niche?","Things people in your space believe that are wrong or outdated."],
 ["What are some contrarian takes you have in your industry?","Opinions you hold that most people in your space would disagree with."],
 ["List any trending topics or figures in your industry right now, or relevant to it.","For example, topics like AI or Claude Code, or figures like Alex Hormozi."],
 ["Who are some big creators in your niche?","Paste links to their YouTube or other socials, one per line."],
 ["Is there anything we should NOT include in your scripts?","Topics, words, claims, or anything else to stay away from."]
];
window.qid=function(i){return "q"+(i<9?"0":"")+(i+1);};
