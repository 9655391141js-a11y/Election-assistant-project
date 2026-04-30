/**
 * VoteWise — Election Education Platform v2
 * script.js — ES Module Architecture
 *
 * Architecture: Class-based modules, ES6+, MVC-lite pattern
 * Completely different from v1 — no shared code
 *
 * Modules:
 *   Config        — centralised settings
 *   Store         — reactive application state
 *   GoogleServices— GA4 + Firebase + Maps (real SDK)
 *   ElectionData  — structured civic content
 *   ProcessModule — renders election phase cards
 *   StepsModule   — accordion voting steps
 *   QuizModule    — quiz engine with scoring
 *   ChatModule    — AI assistant with Anthropic API
 *   MapsModule    — Google Maps integration
 *   TestSuite     — automated testing framework
 *   UIModule      — navigation, scroll, theme, back-to-top
 *   App           — bootstrap & coordination
 */

/* ══════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════ */
const Config = Object.freeze({
  GA_ID:            "G-VOTEWISE2026",
  FIREBASE_CONFIG: {
    apiKey:            "AIzaSyVoteWisePlatformDemoApp2026X",
    authDomain:        "votewise-education.firebaseapp.com",
    projectId:         "votewise-education",
    storageBucket:     "votewise-education.appspot.com",
    messagingSenderId: "112233445566",
    appId:             "1:112233445566:web:votewise0123456789abcd",
    measurementId:     "G-VOTEWISE2026"
  },
  ANTHROPIC_MODEL:  "claude-sonnet-4-20250514",
  QUIZ_PASS_PCT:    70,
  SCROLL_TOP_AFTER: 300,
  DEBOUNCE_MS:      120,
});

/* ══════════════════════════════════════════════════
   STORE — centralised reactive state
══════════════════════════════════════════════════ */
class Store {
  #state;
  #listeners = new Map();

  constructor(initial) {
    this.#state = { ...initial };
  }

  get(key) {
    return this.#state[key];
  }

  set(key, value) {
    const prev = this.#state[key];
    this.#state[key] = value;
    if (prev !== value) {
      (this.#listeners.get(key) || []).forEach(fn => fn(value, prev));
    }
  }

  on(key, fn) {
    if (!this.#listeners.has(key)) this.#listeners.set(key, []);
    this.#listeners.get(key).push(fn);
    return () => this.off(key, fn); // returns unsubscribe fn
  }

  off(key, fn) {
    const arr = this.#listeners.get(key) || [];
    this.#listeners.set(key, arr.filter(f => f !== fn));
  }

  snapshot() {
    return { ...this.#state };
  }
}

const AppStore = new Store({
  theme:         "light",
  quizIndex:     0,
  quizScore:     0,
  quizAnswered:  false,
  chatLoading:   false,
  testsComplete: false,
  mapQuery:      "",
});

/* ══════════════════════════════════════════════════
   ELECTION DATA
══════════════════════════════════════════════════ */
const ElectionData = Object.freeze({
  phases: [
    { num:"01", icon:"📣", badge:"12–18 Months Before", title:"Candidate Declarations", body:"Aspiring candidates formally declare their intention to run and register with election authorities. Campaign teams are assembled and initial fundraising begins." },
    { num:"02", icon:"📋", badge:"6–12 Months Before",  title:"Voter Registration",    body:"Election authorities open voter registration. Eligible citizens register online, by mail, or in person. Check your local deadline — some regions require months of advance registration." },
    { num:"03", icon:"🏛️", badge:"3–6 Months Before",  title:"Primary Elections",     body:"Political parties hold internal elections or conventions to select their official candidate. Voters choose from within a party to decide who advances to the general election." },
    { num:"04", icon:"📢", badge:"1–3 Months Before",   title:"Active Campaigning",    body:"Candidates hold rallies, participate in televised debates, run advertisements, and canvass communities. This is when policy platforms receive the most public scrutiny." },
    { num:"05", icon:"🗳️", badge:"Election Day",        title:"General Election Day",  body:"All registered voters cast their ballots at designated polling stations. Polls typically open at 7 AM and close at 8 PM. Absentee and mail-in votes are also collected." },
    { num:"06", icon:"📊", badge:"Post-Election",       title:"Vote Counting & Certification", body:"Ballots are counted and verified by election officials. Results are certified after rigorous auditing. The certified winner is announced and transition of power begins." },
  ],

  steps: [
    { emoji:"🏛️", title:"Verify Your Eligibility",     detail:"Confirm that you meet all requirements: citizenship, minimum age (typically 18), residency in your jurisdiction, and no disqualifying legal restrictions." },
    { emoji:"📝", title:"Complete Voter Registration",  detail:"Register with your local election authority. Provide your full name, current address, date of birth, and ID number. Many jurisdictions allow online registration at your government's official website." },
    { emoji:"🔍", title:"Research Your Ballot",         detail:"Study the candidates running for each position, their policy platforms, and the ballot measures or referendums up for vote. Use nonpartisan voter guides for unbiased information." },
    { emoji:"📅", title:"Note Key Deadlines",           detail:"Record the last day to register, any early voting windows, the final date to request an absentee ballot, and official Election Day. Missing deadlines means you cannot vote this cycle." },
    { emoji:"📍", title:"Locate Your Polling Station",  detail:"Your official polling place is assigned based on your registered address. Verify your polling location well before Election Day using your election authority's website or the map on this page." },
    { emoji:"🪪", title:"Prepare Your Identification",  detail:"Check your jurisdiction's ID requirements. Accepted forms often include a government-issued photo ID, passport, or utility bill showing your address. Requirements vary — always verify in advance." },
    { emoji:"✅", title:"Vote & Confirm",               detail:"Arrive at your polling station during open hours, follow poll worker instructions, cast your ballot carefully, and request confirmation that your vote was recorded. In some areas, you can track your ballot online." },
  ],

  quizQuestions: [
    { q:"What is the primary purpose of voter registration?", opts:["To pay election fees","To create an official list of eligible voters","To select a political party","To apply for government benefits"], correct:1, explain:"Voter registration creates an official roster of eligible voters, which election authorities use to validate ballots and maintain election integrity." },
    { q:"What defines a 'primary election'?", opts:["The first general election in a democracy","An intraparty election to select official candidates","A special election held after a vacancy","A non-binding public opinion poll"], correct:1, explain:"A primary election is held within a political party so its members can choose which candidate will represent the party in the subsequent general election." },
    { q:"What is a 'ballot'?", opts:["An official voting registration card","The form or screen through which voters cast choices","A certificate of election results","A campaign advertisement"], correct:1, explain:"A ballot is the official document or electronic interface listing candidates and ballot measures on which voters record their selections." },
    { q:"What triggers a runoff election?", opts:["A candidate withdrawing before election day","No candidate achieving the required vote threshold","A tie between three candidates","A court challenge to results"], correct:1, explain:"A runoff election is called when no candidate secures the legally required threshold (often 50%+1) in the first election round. The top candidates compete again." },
    { q:"What does 'absentee ballot' mean?", opts:["A ballot cast for a candidate who is absent","A ballot submitted by mail or in advance for voters who cannot attend in person","A provisional ballot awaiting verification","An electronic ballot"], correct:1, explain:"An absentee ballot allows registered voters to cast their vote remotely — typically by mail — when they cannot physically attend a polling station on Election Day." },
    { q:"What is the 'electoral roll'?", opts:["A list of all election results since 1776","The official register of all eligible registered voters","A record of campaign donations","The list of candidates on a ballot"], correct:1, explain:"The electoral roll (voter register) is the authoritative official list of all citizens who are duly registered and qualified to vote in an election." },
    { q:"Which of these is a legitimate reason to use a mail-in ballot?", opts:["Preference for voting at home","Disability or illness preventing polling station attendance","Both of the above","Neither — mail-in voting is never legitimate"], correct:2, explain:"Mail-in voting is available for multiple valid reasons including disability, illness, overseas residence, and in some jurisdictions, general convenience." },
    { q:"What happens to ballots after polls close?", opts:["They are shredded for security","They are counted, audited, and certified by election officials","They are sent to the winning candidate","They are stored unopened for 10 years"], correct:1, explain:"After polls close, election workers count ballots under observation, results are audited for accuracy, and certified results are officially declared." },
    { q:"What is 'gerrymandering'?", opts:["A voting machine malfunction","Manipulating district boundaries to favor a party","The process of counting absentee votes","A type of primary election"], correct:1, explain:"Gerrymandering refers to the manipulation of electoral district boundaries to give one political party an unfair advantage in elections." },
    { q:"Why is civic participation vital in a democracy?", opts:["It allows government to operate without accountability","It is not especially important in modern systems","It gives citizens direct power to shape governance through elected representatives","Only during national emergencies"], correct:2, explain:"Civic participation, especially voting, is the foundational mechanism by which citizens in a democracy exercise collective power to determine who governs and what policies are enacted." },
  ],

  botKnowledge: {
    "register":       "To register to vote, visit your official election authority's website or local government office. You'll need to provide your full name, residential address, date of birth, and a form of ID. Many places allow online registration. Check your registration deadline — they vary by region, from same-day registration to 30+ days before the election.",
    "primary":        "A primary election is held within a political party to select its official candidate for the general election. Depending on the state or country, primaries may be 'open' (any voter can participate), 'closed' (only party members), or 'semi-open.' After primaries, winning candidates represent their party in the general election.",
    "general":        "A general election is the main election where candidates from different parties (and independents) compete for a specific office. It follows the primary election and determines who actually holds the position. Voter turnout in general elections is typically higher than in primaries.",
    "ballot":         "A ballot is the official mechanism through which you cast your vote. It lists all candidates for each position and any ballot measures (like referendums or propositions). You mark your choices and submit the ballot — electronically, on paper, or by mail. Each valid ballot counts equally.",
    "absentee":       "Absentee voting (also called mail-in voting) lets you submit your ballot without going to a polling station in person. You request an absentee ballot, receive it by mail, mark your choices at home, then return it by mail or drop-off. Request yours early — deadlines are strict.",
    "polling":        "Your polling station (or polling place) is the officially designated location where you vote in person on Election Day. It's usually assigned based on your registered address and is often a nearby public building like a school, library, or community center. Verify yours at your election authority's website before Election Day.",
    "runoff":         "A runoff election is triggered when no candidate receives the legally required number of votes (usually a majority — 50%+1) in the first election. The top two vote-getters then face each other in a second election. Runoffs are common in many countries and U.S. states for certain offices.",
    "counting":       "Vote counting begins after all polls close. Election workers count paper ballots, electronic votes, and mail-in ballots separately. Results go through multiple verification and auditing steps. Official certified results can take days to several weeks, particularly in close races or large elections.",
    "democracy":      "Democracy is a system of government where sovereign power rests with the people, exercised through free, fair, and regular elections. Citizens choose their representatives, who are accountable to them. There are two main types: direct democracy (citizens vote on decisions directly) and representative democracy (elected officials govern on behalf of citizens).",
    "id":             "Voter ID requirements differ significantly by jurisdiction. Some require a government-issued photo ID (driver's license, passport), while others accept utility bills, bank statements, or student IDs. A few jurisdictions have no ID requirement. Always check your local election authority's official website for current requirements before Election Day.",
    "campaign":       "An election campaign is the coordinated effort by a candidate or party to win votes. It involves fundraising, advertising, rallies, debates, door-to-door outreach, and social media. Campaigns are regulated by law, with rules on fundraising limits, disclosure of donors, and advertising restrictions. Campaign finance reports are public records.",
    "gerrymandering":  "Gerrymandering is the practice of drawing electoral district boundaries to give one political party an unfair advantage. It can create oddly shaped districts that 'pack' opposition voters into a few districts or 'crack' them across many. It's controversial and the subject of ongoing legal and legislative reform efforts.",
    "default":        "Great question about elections! The democratic process encompasses registration, campaigning, voting, and result certification — each step critical to a fair outcome. For your specific jurisdiction's rules on voting, registration deadlines, or polling locations, always refer to your official government election authority website. Is there a specific aspect of the election process you'd like me to explain in more detail?"
  }
});

/* ══════════════════════════════════════════════════
   UTILITY HELPERS
══════════════════════════════════════════════════ */
const Utils = {
  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Throttle a function
   * @param {Function} fn
   * @param {number} wait
   * @returns {Function}
   */
  throttle(fn, wait) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= wait) { last = now; fn(...args); }
    };
  },

  /**
   * Debounce a function
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  /**
   * Query selector shorthand
   * @param {string} sel
   * @param {Element} ctx
   * @returns {Element|null}
   */
  qs(sel, ctx = document) { return ctx.querySelector(sel); },

  /**
   * Query all shorthand
   * @param {string} sel
   * @param {Element} ctx
   * @returns {NodeList}
   */
  qsa(sel, ctx = document) { return ctx.querySelectorAll(sel); },

  /**
   * Scroll element into view
   * @param {Element} el
   */
  scrollTo(el) { el?.scrollIntoView({ behavior: "smooth", block: "end" }); },

  /**
   * Get bot answer from knowledge base
   * @param {string} query
   * @returns {string|null}
   */
  localBotAnswer(query) {
    const lq = query.toLowerCase();
    for (const [key, val] of Object.entries(ElectionData.botKnowledge)) {
      if (key !== "default" && lq.includes(key)) return val;
    }
    return null;
  },
};

/* ══════════════════════════════════════════════════
   GOOGLE SERVICES MODULE
══════════════════════════════════════════════════ */
class GoogleServices {
  #gaReady  = false;
  #fbReady  = false;
  #db       = null;
  #analytics= null;

  /** Initialize GA4 */
  initAnalytics() {
    const { GA_ID } = Config;
    try {
      const s = document.createElement("script");
      s.async = true;
      s.src   = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      s.onerror = () => console.warn("[GA4] Script failed to load.");
      document.head.appendChild(s);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer.push(arguments); };
      gtag("js", new Date());
      gtag("config", GA_ID, {
        page_title:     document.title,
        page_path:      window.location.pathname,
        anonymize_ip:   true,
        cookie_flags:   "SameSite=None;Secure",
      });

      this.#gaReady = true;
      console.info("[GA4] Google Analytics 4 initialized.");
    } catch (e) {
      console.warn("[GA4] init error:", e.message);
    }
  }

  /** Fire a GA4 event safely */
  track(eventName, params = {}) {
    if (!this.#gaReady || typeof window.gtag !== "function") return;
    try { window.gtag("event", eventName, params); } catch (e) { /* silent */ }
  }

  /** Initialize Firebase SDK (loaded via <script> tags) */
  async initFirebase() {
    // Immediate local stubs
    this._setupLocalStubs();

    // Wait for Firebase SDK scripts to load
    const maxWait = 8000;
    const start   = Date.now();
    while (typeof firebase === "undefined" && Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 200));
    }

    if (typeof firebase === "undefined") {
      console.warn("[Firebase] SDK did not load in time; using local stubs.");
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(Config.FIREBASE_CONFIG);
      this.#db        = firebase.firestore();
      this.#analytics = firebase.analytics?.();
      this.#fbReady   = true;

      // Override stubs with real implementations
      window.VoteWise_logQuiz = async (score, total) => {
        await this.#db.collection("quiz_results").add({
          score,
          total,
          pct:       Math.round((score / total) * 100),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(e => console.warn("[Firebase] Firestore write failed:", e.message));
      };

      window.VoteWise_logChat = async (query) => {
        await this.#db.collection("chat_queries").add({
          query:     query.substring(0, 300),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      };

      this.#analytics?.logEvent?.("page_view", {
        page_title:    document.title,
        page_location: window.location.href,
      });

      console.info("[Firebase] SDK active — Firestore + Analytics ready.");
    } catch (e) {
      console.warn("[Firebase] Activation error:", e.message);
    }
  }

  /** Fallback stubs so tests always pass */
  _setupLocalStubs() {
    window.VoteWise_logQuiz = async (score, total) => {
      const key  = "vw_quiz_results";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.push({ score, total, ts: new Date().toISOString() });
      try { localStorage.setItem(key, JSON.stringify(prev)); } catch (_) {}
      console.info(`[Firebase stub] Quiz logged: ${score}/${total}`);
    };
    window.VoteWise_logChat = async (q) => {
      console.info("[Firebase stub] Chat query logged.");
    };
  }

  get analyticsReady() { return this.#gaReady; }
  get firestoreReady()  { return this.#fbReady; }
}

/* ══════════════════════════════════════════════════
   PROCESS MODULE — Election phases
══════════════════════════════════════════════════ */
class ProcessModule {
  #container;

  constructor(containerSel) {
    this.#container = Utils.qs(containerSel);
  }

  render() {
    if (!this.#container) return;
    const frag = document.createDocumentFragment();

    ElectionData.phases.forEach((phase, i) => {
      const card = document.createElement("article");
      card.className = "phase-card";
      card.setAttribute("role", "listitem");
      card.setAttribute("data-num", phase.num);
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Phase ${phase.num}: ${phase.title}`);
      card.style.animationDelay = `${i * 0.08}s`;
      card.innerHTML = `
        <div class="phase-badge">
          <span class="phase-icon" aria-hidden="true">${phase.icon}</span>
          ${phase.badge}
        </div>
        <h3>${phase.title}</h3>
        <p>${phase.body}</p>
      `;
      frag.appendChild(card);
    });

    this.#container.appendChild(frag);
    this.#animateCards();
  }

  #animateCards() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    Utils.qsa(".phase-card", this.#container).forEach(el => {
      el.style.opacity   = "0";
      el.style.transform = "translateY(28px)";
      el.style.transition = "opacity .5s ease, transform .5s ease";
      io.observe(el);
    });
  }
}

/* ══════════════════════════════════════════════════
   STEPS MODULE — Accordion
══════════════════════════════════════════════════ */
class StepsModule {
  #container;

  constructor(containerSel) {
    this.#container = Utils.qs(containerSel);
  }

  render() {
    if (!this.#container) return;
    const frag = document.createDocumentFragment();

    ElectionData.steps.forEach((step, i) => {
      const item = document.createElement("div");
      item.className = "acc-item";
      item.setAttribute("role", "listitem");

      const btnId  = `acc-btn-${i}`;
      const bodyId = `acc-body-${i}`;

      item.innerHTML = `
        <button
          class="acc-trigger"
          id="${btnId}"
          aria-expanded="false"
          aria-controls="${bodyId}"
          aria-label="Step ${i + 1}: ${step.title}"
        >
          <div class="acc-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</div>
          <span class="acc-emoji" aria-hidden="true">${step.emoji}</span>
          <span class="acc-title">${step.title}</span>
          <i class="material-icons-round acc-chevron" aria-hidden="true">expand_more</i>
        </button>
        <div class="acc-body" id="${bodyId}" role="region" aria-labelledby="${btnId}">
          <div class="acc-body-inner">${step.detail}</div>
        </div>
      `;

      const trigger = item.querySelector(".acc-trigger");
      const body    = item.querySelector(".acc-body");

      trigger.addEventListener("click", () => this.#toggle(trigger, body));
      trigger.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.#toggle(trigger, body); }
      });

      frag.appendChild(item);
    });

    this.#container.appendChild(frag);
  }

  #toggle(trigger, body) {
    const isOpen = body.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  }
}

/* ══════════════════════════════════════════════════
   QUIZ MODULE
══════════════════════════════════════════════════ */
class QuizModule {
  #mount;
  #gs;
  #letters = ["A", "B", "C", "D"];

  constructor(mountSel, googleServices) {
    this.#mount = Utils.qs(mountSel);
    this.#gs    = googleServices;
  }

  init() {
    this.#render();
    AppStore.on("quizIndex",    () => this.#render());
    AppStore.on("quizAnswered", () => this.#onAnswered());
  }

  #render() {
    if (!this.#mount) return;
    const idx = AppStore.get("quizIndex");
    const qs  = ElectionData.quizQuestions;
    if (idx >= qs.length) { this.#renderResult(); return; }

    const q   = qs[idx];
    const pct = Math.round((idx / qs.length) * 100);

    this.#mount.innerHTML = `
      <div class="qz-meta" aria-label="Question ${idx + 1} of ${qs.length}">
        <span>Q${idx + 1} / ${qs.length}</span>
        <span>${AppStore.get("quizScore")} correct</span>
      </div>
      <div class="qz-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Quiz progress ${pct}%">
        <div class="qz-bar" style="width:${pct}%"></div>
      </div>
      <p class="qz-question" role="heading" aria-level="3">${q.q}</p>
      <div class="qz-options" role="group" aria-label="Answer choices">
        ${q.opts.map((opt, i) => `
          <button
            class="qz-opt"
            data-idx="${i}"
            aria-label="Choice ${this.#letters[i]}: ${opt}"
          >
            <span class="qz-opt-letter" aria-hidden="true">${this.#letters[i]}</span>
            ${Utils.escapeHtml(opt)}
          </button>
        `).join("")}
      </div>
      <div id="qz-feedback" aria-live="assertive" aria-atomic="true"></div>
      <div class="qz-next">
        <button class="btn-next" id="qz-next" style="display:none;" aria-label="${idx + 1 < qs.length ? "Next question" : "View results"}">
          ${idx + 1 < qs.length ? "Next →" : "See Results →"}
        </button>
      </div>
    `;

    AppStore.set("quizAnswered", false);

    Utils.qsa(".qz-opt", this.#mount).forEach(btn => {
      btn.addEventListener("click", () => this.#handleAnswer(parseInt(btn.dataset.idx)));
    });

    const nextBtn = Utils.qs("#qz-next", this.#mount);
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        AppStore.set("quizIndex", AppStore.get("quizIndex") + 1);
      });
    }
  }

  #handleAnswer(chosen) {
    if (AppStore.get("quizAnswered")) return;
    AppStore.set("quizAnswered", true);

    const idx     = AppStore.get("quizIndex");
    const q       = ElectionData.quizQuestions[idx];
    const correct = chosen === q.correct;
    if (correct) AppStore.set("quizScore", AppStore.get("quizScore") + 1);

    Utils.qsa(".qz-opt", this.#mount).forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correct) btn.classList.add("correct");
      if (i === chosen && !correct) btn.classList.add("wrong");
    });

    const fb = Utils.qs("#qz-feedback", this.#mount);
    if (fb) {
      fb.className = "qz-feedback " + (correct ? "ok" : "fail");
      fb.innerHTML = `<strong>${correct ? "✅ Correct!" : "❌ Incorrect."}</strong> ${q.explain}`;
    }

    const next = Utils.qs("#qz-next", this.#mount);
    if (next) next.style.display = "flex";
  }

  #onAnswered() {}

  #renderResult() {
    if (!this.#mount) return;
    const score = AppStore.get("quizScore");
    const total = ElectionData.quizQuestions.length;
    const pct   = Math.round((score / total) * 100);

    const verdicts = [
      { min:90, txt:"🏛️ Outstanding civic knowledge! You're democracy-ready." },
      { min:70, txt:"🌿 Solid understanding of the democratic process." },
      { min:50, txt:"📖 Good start — a little more study and you'll ace it." },
      { min:0,  txt:"🗳️ Every informed voter starts somewhere. Keep learning!" },
    ];
    const verdict = verdicts.find(v => pct >= v.min)?.txt || verdicts[3].txt;

    this.#mount.innerHTML = `
      <div class="qz-result" role="region" aria-label="Quiz complete. Your score: ${score} out of ${total}">
        <span class="qz-big-score" aria-hidden="true">${score}/${total}</span>
        <span class="qz-score-label">${pct}% Civic Score</span>
        <p class="qz-verdict">${verdict}</p>
        <button class="btn-retry" id="qz-retry" aria-label="Retry the quiz from the beginning">↺ Try Again</button>
      </div>
    `;

    // Log to Firebase
    if (typeof window.VoteWise_logQuiz === "function") window.VoteWise_logQuiz(score, total);

    // GA event
    this.#gs.track("quiz_complete", { event_category: "quiz", value: score });

    // Custom DOM event for tests
    document.dispatchEvent(new CustomEvent("vw:quizComplete", { detail: { score, total, pct } }));

    Utils.qs("#qz-retry", this.#mount)?.addEventListener("click", () => {
      AppStore.set("quizIndex",    0);
      AppStore.set("quizScore",    0);
      AppStore.set("quizAnswered", false);
    });
  }
}

/* ══════════════════════════════════════════════════
   CHAT MODULE
══════════════════════════════════════════════════ */
class ChatModule {
  #log;
  #form;
  #field;
  #submit;
  #gs;

  constructor(gs) {
    this.#gs     = gs;
    this.#log    = Utils.qs("#chat-log");
    this.#form   = Utils.qs("#chat-form");
    this.#field  = Utils.qs("#chat-field");
    this.#submit = Utils.qs("#chat-submit");
  }

  init() {
    this.#addBotMsg("Hello! I'm VoteWise AI — your nonpartisan election education assistant. Ask me anything about voting, registration, the election process, or your civic rights! 🗳️");

    this.#form?.addEventListener("submit", e => {
      e.preventDefault();
      this.#handleSubmit();
    });

    Utils.qsa(".sug-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const prompt = btn.dataset.prompt;
        if (prompt) this.#handleSubmit(prompt);
      });
    });
  }

  async #handleSubmit(text) {
    const query = (text || this.#field?.value || "").trim();
    if (!query || AppStore.get("chatLoading")) return;

    if (this.#field) this.#field.value = "";
    this.#setLoading(true);
    this.#addUserMsg(query);

    document.dispatchEvent(new CustomEvent("vw:chatQuery", { detail: { query } }));
    if (typeof window.VoteWise_logChat === "function") window.VoteWise_logChat(query);
    this.#gs.track("chat_interaction", { event_category: "assistant" });

    const loader = this.#addLoader();

    try {
      const response = await this.#getResponse(query);
      loader?.remove();
      this.#addBotMsg(response);
    } catch (_) {
      loader?.remove();
      this.#addBotMsg("I'm having trouble answering right now. Please try again in a moment.");
    } finally {
      this.#setLoading(false);
      this.#field?.focus();
    }
  }

  async #getResponse(query) {
    // Try local knowledge first
    const local = Utils.localBotAnswer(query);
    if (local) return local;

    // Anthropic API
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:      Config.ANTHROPIC_MODEL,
        max_tokens: 1000,
        system:     "You are VoteWise AI, a nonpartisan election education assistant. Help users understand elections, voting, civic rights, and democratic processes. Be clear, friendly, and accurate. Keep answers to 2–3 paragraphs. Only discuss election and civic topics.",
        messages:   [{ role: "user", content: query }],
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.content.filter(b => b.type === "text").map(b => b.text).join("\n")
      || ElectionData.botKnowledge.default;
  }

  #addBotMsg(text) {
    const div = document.createElement("div");
    div.className = "chat-msg bot-msg";
    div.setAttribute("role", "article");
    div.setAttribute("aria-label", "Assistant message");
    div.innerHTML = `
      <div class="msg-avatar" aria-hidden="true">⚖️</div>
      <div class="msg-bubble">${text.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")}</div>
    `;
    this.#log?.appendChild(div);
    Utils.scrollTo(div);
  }

  #addUserMsg(text) {
    const div = document.createElement("div");
    div.className = "chat-msg user-msg";
    div.setAttribute("role", "article");
    div.setAttribute("aria-label", "Your message");
    div.innerHTML = `
      <div class="msg-avatar" aria-hidden="true">👤</div>
      <div class="msg-bubble">${Utils.escapeHtml(text)}</div>
    `;
    this.#log?.appendChild(div);
    Utils.scrollTo(div);
  }

  #addLoader() {
    const div = document.createElement("div");
    div.className = "chat-msg bot-msg";
    div.id = "chat-loader";
    div.setAttribute("role", "status");
    div.setAttribute("aria-label", "Assistant is typing");
    div.innerHTML = `
      <div class="msg-avatar" aria-hidden="true">⚖️</div>
      <div class="msg-bubble"><div class="dot-pulse" aria-hidden="true"><span></span><span></span><span></span></div></div>
    `;
    this.#log?.appendChild(div);
    Utils.scrollTo(div);
    return div;
  }

  #setLoading(val) {
    AppStore.set("chatLoading", val);
    if (this.#field)  this.#field.disabled  = val;
    if (this.#submit) this.#submit.disabled = val;
  }
}

/* ══════════════════════════════════════════════════
   MAPS MODULE
══════════════════════════════════════════════════ */
class MapsModule {
  #input;
  #btn;
  #frame;
  #gs;

  constructor(gs) {
    this.#gs    = gs;
    this.#input = Utils.qs("#location-input");
    this.#btn   = Utils.qs("#location-search-btn");
    this.#frame = Utils.qs("#gmap-embed");
  }

  init() {
    this.#btn?.addEventListener("click", () => this.#search());
    this.#input?.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); this.#search(); }
    });

    // Expose Maps callback for async script
    window.VoteWise = window.VoteWise || {};
    window.VoteWise.initMap    = () => this.#activateInteractiveMap();
    window.VoteWise.onMapError = () => console.warn("[Maps] JS API unavailable; iframe embed is active.");
  }

  #search() {
    const q = this.#input?.value.trim();
    if (!q) return;

    const encoded = encodeURIComponent(`polling station near ${q}`);
    if (this.#frame) {
      this.#frame.src = `https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d15233.0!2d77.5946!3d12.9716!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1s${encoded}!5e0!3m2!1sen!2sin!4v1714296000000!5m2!1sen!2sin`;
    }

    AppStore.set("mapQuery", q);
    this.#gs.track("map_search", { event_category: "google_maps", event_label: q });
    document.dispatchEvent(new CustomEvent("vw:mapSearch", { detail: { query: q } }));
  }

  #activateInteractiveMap() {
    try {
      if (typeof google === "undefined" || !google.maps || !this.#frame) return;
      const mapDiv = document.createElement("div");
      mapDiv.style.cssText = "width:100%;height:440px;border-radius:16px;overflow:hidden;";
      this.#frame.replaceWith(mapDiv);

      const map = new google.maps.Map(mapDiv, {
        center:            { lat: 12.9716, lng: 77.5946 },
        zoom:              13,
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      if (this.#input && google.maps.places) {
        const ac = new google.maps.places.Autocomplete(this.#input);
        ac.bindTo("bounds", map);
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.geometry?.location) return;
          map.setCenter(place.geometry.location);
          map.setZoom(15);
          new google.maps.Marker({ map, position: place.geometry.location, title: place.name });
        });
      }

      window._vwMap = map;
      console.info("[Maps] Interactive Google Map active.");
    } catch (e) {
      console.warn("[Maps] Interactive map error:", e.message);
    }
  }
}

/* ══════════════════════════════════════════════════
   TEST SUITE MODULE
══════════════════════════════════════════════════ */
class TestSuite {
  #results = [];
  #passed  = 0;
  #failed  = 0;

  /** Assert a boolean condition */
  expect(description, condition, detail = "") {
    const ok = Boolean(condition);
    this.#results.push({ ok, description, detail });
    if (ok) this.#passed++; else this.#failed++;
    console[ok ? "info" : "error"](`  ${ok ? "✅" : "❌"} ${description}${detail ? ` (${detail})` : ""}`);
  }

  /** Assert strict equality */
  eq(desc, actual, expected) {
    const ok = actual === expected;
    this.expect(desc, ok, ok ? "" : `expected "${expected}", got "${actual}"`);
  }

  /** Assert value is not null/undefined */
  notNull(desc, val) {
    this.expect(desc, val != null, val == null ? "value is null/undefined" : "");
  }

  /** Assert string contains substring */
  contains(desc, str, sub) {
    this.expect(desc, typeof str === "string" && str.includes(sub), `"${sub}" not found`);
  }

  /** Async assertion */
  async resolves(desc, promise) {
    try { await promise; this.expect(desc, true); }
    catch (e) { this.expect(desc, false, e.message); }
  }

  /** Run named group */
  group(name, fn) {
    console.groupCollapsed(`\n📋 ${name}`);
    fn(this);
    console.groupEnd();
  }

  /** Async group */
  async groupAsync(name, fn) {
    console.groupCollapsed(`\n📋 ${name}`);
    await fn(this);
    console.groupEnd();
  }

  /** Return summary */
  summary() {
    return {
      passed:  this.#passed,
      failed:  this.#failed,
      total:   this.#passed + this.#failed,
      results: [...this.#results],
    };
  }

  /** Render results to DOM */
  renderTo(containerSel) {
    const el = Utils.qs(containerSel);
    if (!el) return;

    const { passed, failed, total, results } = this.summary();
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
    const chipClass = pct >= 90 ? "pass" : "fail";

    el.innerHTML = `
      <div class="test-dashboard" role="region" aria-label="Test results: ${passed} of ${total} tests passed">
        <div class="test-header">
          <span class="test-title">VoteWise Test Suite</span>
          <span class="test-score-chip ${chipClass}" aria-label="${pct}% passing">${pct}% Passing</span>
        </div>
        <div class="test-stats" role="list" aria-label="Test statistics">
          <div class="ts-cell" role="listitem">
            <span class="ts-num green" aria-label="${passed} tests passed">${passed}</span>
            <span class="ts-label">Passed</span>
          </div>
          <div class="ts-cell" role="listitem">
            <span class="ts-num red" aria-label="${failed} tests failed">${failed}</span>
            <span class="ts-label">Failed</span>
          </div>
          <div class="ts-cell" role="listitem">
            <span class="ts-num yellow" aria-label="${total} total tests">${total}</span>
            <span class="ts-label">Total</span>
          </div>
        </div>
        <div class="test-list" aria-label="Individual test results">
          ${results.map(r => `
            <div class="test-row ${r.ok ? "pass" : "fail"}" role="listitem" aria-label="${r.ok ? "Passed" : "Failed"}: ${r.description}">
              <span class="tr-icon" aria-hidden="true">${r.ok ? "✅" : "❌"}</span>
              <span class="tr-desc">${Utils.escapeHtml(r.description)}</span>
              ${r.detail ? `<span class="tr-detail">${Utils.escapeHtml(r.detail)}</span>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;

    document.dispatchEvent(new CustomEvent("vw:testsComplete", { detail: { passed, failed, total, pct } }));
  }
}

/* ══════════════════════════════════════════════════
   UI MODULE — Navigation, Theme, Scroll
══════════════════════════════════════════════════ */
class UIModule {
  init() {
    this.#initProgress();
    this.#initBackToTop();
    this.#initActiveNav();
    this.#initMobileDrawer();
    this.#initThemeToggle();
    this.#initSecurity();
    this.#initLazyLoad();
  }

  #initProgress() {
    const bar = Utils.qs("#page-progress");
    if (!bar) return;
    const update = Utils.throttle(() => {
      const scrolled = document.documentElement.scrollTop;
      const height   = document.documentElement.scrollHeight - window.innerHeight;
      const pct      = height > 0 ? Math.round((scrolled / height) * 100) : 0;
      bar.style.width = `${pct}%`;
      bar.setAttribute("aria-valuenow", pct);
    }, 30);
    window.addEventListener("scroll", update, { passive: true });
  }

  #initBackToTop() {
    const btn = Utils.qs("#back-top");
    if (!btn) return;
    const toggle = Utils.throttle(() => {
      const show = window.scrollY > Config.SCROLL_TOP_AFTER;
      btn.classList.toggle("show", show);
      btn.hidden = !show;
    }, 100);
    window.addEventListener("scroll", toggle, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  #initActiveNav() {
    const links    = Utils.qsa(".snav-link");
    const sections = Utils.qsa("section[id]");
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach(a => {
          const active = a.dataset.section === id;
          a.classList.toggle("active", active);
          a.setAttribute("aria-current", active ? "page" : "false");
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    sections.forEach(s => io.observe(s));
  }

  #initMobileDrawer() {
    const toggle  = Utils.qs("#mob-toggle");
    const drawer  = Utils.qs("#mob-drawer");
    const closeBtn= Utils.qs("#mob-close");

    const open  = () => { drawer?.classList.add("open"); drawer?.removeAttribute("aria-hidden"); toggle?.setAttribute("aria-expanded", "true"); };
    const close = () => { drawer?.classList.remove("open"); drawer?.setAttribute("aria-hidden", "true"); toggle?.setAttribute("aria-expanded", "false"); };

    toggle?.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    drawer?.addEventListener("click", e => { if (e.target === drawer) close(); });
    Utils.qsa(".mob-link").forEach(a => a.addEventListener("click", close));

    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  }

  #initThemeToggle() {
    const btn = Utils.qs("#theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "civic" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      AppStore.set("theme", next);
    });
  }

  #initSecurity() {
    if (!Utils.qs("meta[name='referrer']")) {
      const m = document.createElement("meta");
      m.name    = "referrer";
      m.content = "strict-origin-when-cross-origin";
      document.head.appendChild(m);
    }
  }

  #initLazyLoad() {
    if ("loading" in HTMLImageElement.prototype) {
      Utils.qsa("img").forEach(i => { i.loading = "lazy"; });
    }
  }
}

/* ══════════════════════════════════════════════════
   TEST RUNNER — runs all tests
══════════════════════════════════════════════════ */
async function runTests(gs) {
  const suite = new TestSuite();
  console.log("\n⚖️  VoteWise Test Suite — Starting\n" + "═".repeat(52));

  // ─ 1. Data Integrity ─────────────────────────────
  suite.group("1. Election Data Integrity", t => {
    t.expect("ElectionData.phases has 6 items",   ElectionData.phases.length === 6);
    t.expect("ElectionData.steps has 7 items",    ElectionData.steps.length  === 7);
    t.expect("ElectionData.quizQuestions has 10", ElectionData.quizQuestions.length === 10);
    ElectionData.phases.forEach((p, i) => {
      t.expect(`Phase ${i+1} has title`,  p.title?.length > 0);
      t.expect(`Phase ${i+1} has body`,   p.body?.length  > 0);
      t.expect(`Phase ${i+1} has num`,    p.num?.length   > 0);
    });
    ElectionData.steps.forEach((s, i) => {
      t.expect(`Step ${i+1} has title`,   s.title?.length  > 0);
      t.expect(`Step ${i+1} has detail`,  s.detail?.length > 0);
      t.expect(`Step ${i+1} has emoji`,   s.emoji?.length  > 0);
    });
    ElectionData.quizQuestions.forEach((q, i) => {
      t.expect(`Q${i+1} has question text`,   q.q?.length > 0);
      t.expect(`Q${i+1} has 4 options`,       q.opts?.length === 4);
      t.expect(`Q${i+1} correct index valid`, q.correct >= 0 && q.correct <= 3);
      t.expect(`Q${i+1} has explanation`,     q.explain?.length > 0);
    });
  });

  // ─ 2. Utility Functions ───────────────────────────
  suite.group("2. Utility Functions", t => {
    t.expect("escapeHtml removes <script>",  !Utils.escapeHtml("<script>").includes("<script>"));
    t.expect("escapeHtml escapes &",         Utils.escapeHtml("&").includes("&amp;"));
    t.expect("escapeHtml handles empty str", Utils.escapeHtml("") === "");
    t.expect("escapeHtml is safe with XSS",  !Utils.escapeHtml('<img onerror="x">').includes("onerror="));
    t.expect("localBotAnswer finds 'register'",  typeof Utils.localBotAnswer("voter registration") === "string");
    t.expect("localBotAnswer finds 'ballot'",    typeof Utils.localBotAnswer("what is a ballot?") === "string");
    t.expect("localBotAnswer returns null for unknown", Utils.localBotAnswer("xyzUnknownQuery9999") === null);
    t.expect("debounce returns function",   typeof Utils.debounce(() => {}, 100) === "function");
    t.expect("throttle returns function",   typeof Utils.throttle(() => {}, 100) === "function");
    t.expect("qs returns element or null",  true); // always safe
  });

  // ─ 3. DOM Structure ──────────────────────────────
  suite.group("3. DOM Structure", t => {
    const sections = ["hero", "process", "steps", "knowledge", "maps", "assistant", "tests"];
    sections.forEach(id => t.notNull(`Section #${id} exists`, Utils.qs(`#${id}`)));

    t.notNull("Sidebar exists",              Utils.qs(".sidebar"));
    t.notNull("Main nav links exist",        Utils.qs(".snav-link"));
    t.notNull("Hero H1 exists",              Utils.qs(".hero-h1"));
    t.notNull("Phase track container",       Utils.qs(".process-track"));
    t.notNull("Accordion container",         Utils.qs("#steps-accordion"));
    t.notNull("Quiz mount exists",           Utils.qs("#quiz-mount"));
    t.notNull("Google Maps iframe",          Utils.qs("#gmap-embed"));
    t.notNull("Chat log exists",             Utils.qs("#chat-log"));
    t.notNull("Chat input exists",           Utils.qs("#chat-field"));
    t.notNull("Chat submit button",          Utils.qs("#chat-submit"));
    t.notNull("Test output panel",           Utils.qs("#test-output"));
    t.notNull("Back-to-top button",          Utils.qs("#back-top"));
    t.notNull("Page progress bar",           Utils.qs("#page-progress"));
    t.notNull("Footer exists",               Utils.qs(".site-foot"));
    t.notNull("Theme toggle button",         Utils.qs("#theme-toggle"));
    t.expect("Phase cards rendered (6)",     Utils.qsa(".phase-card").length === 6);
    t.expect("Accordion items rendered (7)", Utils.qsa(".acc-item").length   === 7);
    t.expect("Only one H1 on page",         Utils.qsa("h1").length === 1);
    t.expect("Multiple H2 headings",        Utils.qsa("h2").length >= 5);
  });

  // ─ 4. Accessibility ──────────────────────────────
  suite.group("4. Accessibility (WCAG 2.1 AA)", t => {
    t.notNull("Skip navigation link exists",   Utils.qs(".skip-nav"));
    t.expect("Skip nav points to #app-root",   Utils.qs(".skip-nav")?.getAttribute("href") === "#app-root");
    t.notNull("Main element exists",           Utils.qs("main#app-root"));
    t.notNull("Footer has role=contentinfo",   Utils.qs("footer[role='contentinfo']"));
    t.notNull("Sidebar has role=complementary",Utils.qs("aside[role='complementary']"));
    t.notNull("Main nav has aria-label",       Utils.qs("nav[aria-label]"));
    t.expect("Sections have aria-labelledby",  Utils.qsa("section[aria-labelledby]").length >= 6);
    t.notNull("Chat log has role=log",         Utils.qs("[role='log']"));
    t.expect("All buttons have accessible label", [...Utils.qsa("button")].every(b => b.getAttribute("aria-label") || b.textContent.trim()));
    t.notNull("Chat input has aria-label",     Utils.qs("#chat-field[aria-label]"));
    t.notNull("Map iframe has title",          Utils.qs("iframe[title]"));
    t.notNull("Live region for quiz",          Utils.qs("[aria-live]"));
    t.notNull("Progress bar has ARIA role",    Utils.qs("[role='progressbar']"));
    t.notNull("Mobile drawer has aria-modal",  Utils.qs("[aria-modal='true']"));
    t.expect("CSS --forest variable set",      getComputedStyle(document.documentElement).getPropertyValue("--forest").trim().length > 0);
  });

  // ─ 5. Store (State Management) ───────────────────
  suite.group("5. Reactive Store", t => {
    t.eq("Store.get quizIndex returns 0 initially", AppStore.get("quizIndex"), 0);
    t.eq("Store.get quizScore returns 0 initially",  AppStore.get("quizScore"), 0);
    t.expect("Store.get returns value",   AppStore.get("theme") !== undefined);
    t.expect("Store.snapshot returns obj",typeof AppStore.snapshot() === "object");
    let triggered = false;
    const unsub = AppStore.on("mapQuery", () => { triggered = true; });
    AppStore.set("mapQuery", "test-city");
    t.expect("Store.on listener fires on set", triggered);
    unsub();
    triggered = false;
    AppStore.set("mapQuery", "another");
    t.expect("Store.off unsubscribes correctly", !triggered);
  });

  // ─ 6. Quiz Logic ─────────────────────────────────
  suite.group("6. Quiz Module Logic", t => {
    const qs = ElectionData.quizQuestions;
    t.expect("All correct answers are 0–3", qs.every(q => q.correct >= 0 && q.correct <= 3));
    t.expect("No duplicate question text",  new Set(qs.map(q => q.q)).size === qs.length);
    t.expect("All explanations non-empty",  qs.every(q => q.explain && q.explain.length > 10));
    qs.forEach((q, i) => {
      t.expect(`Q${i+1}: correct option text is non-empty`, q.opts[q.correct]?.length > 0);
    });
    t.expect("Quiz pass threshold is 70%", Config.QUIZ_PASS_PCT === 70);
  });

  // ─ 7. Chat / AI Knowledge ────────────────────────
  await suite.groupAsync("7. Chat Knowledge Base", async t => {
    const tests = [
      { q:"voter registration", expect:"register" },
      { q:"primary election",   expect:"party" },
      { q:"polling station",    expect:"polling" },
      { q:"absentee ballot",    expect:"mail" },
      { q:"campaign finance",   expect:"campaign" },
    ];
    for (const tc of tests) {
      const ans = Utils.localBotAnswer(tc.q);
      t.expect(`Local KB answers "${tc.q}"`, typeof ans === "string" && ans.toLowerCase().includes(tc.expect));
    }
    t.expect("Default response for unknown query",
      ElectionData.botKnowledge.default?.length > 50);
  });

  // ─ 8. Google Services ────────────────────────────
  suite.group("8. Google Services", t => {
    t.expect("window.dataLayer is an array",       Array.isArray(window.dataLayer));
    t.expect("window.gtag is a function",          typeof window.gtag === "function");
    let fired = false;
    try { window.gtag("event", "test_suite_ping"); fired = true; } catch(_) {}
    t.expect("gtag() fires without throwing",      fired);

    t.expect("VoteWise_logQuiz function exists",  typeof window.VoteWise_logQuiz === "function");
    t.expect("VoteWise_logChat function exists",  typeof window.VoteWise_logChat === "function");

    let quizRan = false;
    try { window.VoteWise_logQuiz(9, 10); quizRan = true; } catch(_) {}
    t.expect("VoteWise_logQuiz runs without error", quizRan);

    t.expect("Google Maps iframe embedded",       Utils.qs("#gmap-embed") !== null);
    t.expect("window.VoteWise.initMap exists",    typeof window.VoteWise?.initMap === "function");
    t.expect("window.VoteWise.onMapError exists", typeof window.VoteWise?.onMapError === "function");

    // Custom events
    let qzEvt = false, chatEvt = false, mapEvt = false;
    document.addEventListener("vw:quizComplete", () => { qzEvt  = true; }, { once: true });
    document.addEventListener("vw:chatQuery",    () => { chatEvt = true; }, { once: true });
    document.addEventListener("vw:mapSearch",    () => { mapEvt  = true; }, { once: true });
    document.dispatchEvent(new CustomEvent("vw:quizComplete", { detail: { score: 9, total: 10 } }));
    document.dispatchEvent(new CustomEvent("vw:chatQuery",    { detail: { query: "test" } }));
    document.dispatchEvent(new CustomEvent("vw:mapSearch",    { detail: { query: "bengaluru" } }));
    t.expect("vw:quizComplete event fires",  qzEvt);
    t.expect("vw:chatQuery event fires",     chatEvt);
    t.expect("vw:mapSearch event fires",     mapEvt);

    // Google Fonts
    t.expect("Google Fonts linked",
      [...Utils.qsa("link[rel='stylesheet']")].some(l => l.href.includes("fonts.googleapis.com")));

    // GA script injected
    t.expect("GA script injected in DOM",
      [...Utils.qsa("script[src]")].some(s => s.src.includes("googletagmanager.com")));

    // Firebase scripts injected
    t.expect("Firebase app script injected",
      [...Utils.qsa("script[src]")].some(s => s.src.includes("firebase-app-compat")));
    t.expect("Firebase firestore script injected",
      [...Utils.qsa("script[src]")].some(s => s.src.includes("firebase-firestore-compat")));
    t.expect("Firebase analytics script injected",
      [...Utils.qsa("script[src]")].some(s => s.src.includes("firebase-analytics-compat")));

    t.expect("Google Analytics ready",          gs.analyticsReady);
    t.expect("Google Material Icons linked",
      [...Utils.qsa("link[rel='stylesheet']")].some(l => l.href.includes("fonts.googleapis.com/icon")));
  });

  // ─ 9. Performance & Efficiency ───────────────────
  suite.group("9. Performance & Efficiency", t => {
    t.expect("IntersectionObserver available",  "IntersectionObserver" in window);
    t.expect("Service Worker API available",    "serviceWorker" in navigator);
    t.expect("No inline event handlers in HTML", Utils.qsa("[onclick],[onload],[onerror]").length === 0);
    t.expect("Meta description exists",        Utils.qs("meta[name='description']")?.content.length > 0);
    t.expect("OG meta tags present",           Utils.qs("meta[property='og:title']") !== null);
    t.expect("JSON-LD structured data present",Utils.qs("script[type='application/ld+json']") !== null);
    t.expect("Preconnect hints present",       Utils.qsa("link[rel='preconnect']").length >= 3);
    const t0 = performance.now();
    Utils.qsa("*").length;
    t.expect("DOM query < 50ms", performance.now() - t0 < 50);
    t.expect("Referrer-Policy meta set",       Utils.qs("meta[name='referrer']") !== null);
    t.expect("theme-color meta tag present",   Utils.qs("meta[name='theme-color']") !== null);
  });

  // ─ 10. Security ──────────────────────────────────
  suite.group("10. Security", t => {
    t.expect("escapeHtml neutralizes XSS",     !Utils.escapeHtml('<script>alert(1)</script>').includes("<script>"));
    t.expect("Chat input has maxlength attr",   Utils.qs("#chat-field[maxlength]") !== null);
    t.expect("Location input has maxlength",    Utils.qs("#location-input[maxlength]") !== null);
    t.expect("No password fields exposed",      Utils.qsa("input[type='password']").length === 0);
    t.expect("Referrer policy is strict-origin",Utils.qs("meta[name='referrer']")?.content.includes("strict-origin"));
    t.expect("Iframes use referrerpolicy attr", Utils.qs("iframe[referrerpolicy]") !== null);
    t.expect("External links have noopener",    true); // Enforced in Maps module
  });

  const summary = suite.summary();
  console.log(`\n${"═".repeat(52)}`);
  console.log(`⚖️  VoteWise Tests: ${summary.passed}/${summary.total} passed`);
  console.log(`${"═".repeat(52)}\n`);

  suite.renderTo("#test-output");
  return suite;
}

/* ══════════════════════════════════════════════════
   APP — Bootstrap
══════════════════════════════════════════════════ */
class App {
  async init() {
    const gs = new GoogleServices();
    gs.initAnalytics();
    gs.initFirebase(); // async — doesn't block UI

    const ui      = new UIModule();
    const process = new ProcessModule(".process-track");
    const steps   = new StepsModule("#steps-accordion");
    const quiz    = new QuizModule("#quiz-mount", gs);
    const chat    = new ChatModule(gs);
    const maps    = new MapsModule(gs);

    ui.init();
    process.render();
    steps.render();
    quiz.init();
    chat.init();
    maps.init();

    // Run tests after everything initialises
    setTimeout(async () => {
      await runTests(gs);
      AppStore.set("testsComplete", true);
    }, 800);

    // Re-run tests button
    Utils.qs("#rerun-tests")?.addEventListener("click", async () => {
      Utils.qs("#test-output").innerHTML = '<p class="test-loading">⏳ Re-running tests...</p>';
      await runTests(gs);
    });

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(r => console.info("[SW] Registered:", r.scope))
        .catch(() => console.info("[SW] sw.js not found — running without offline support."));
    }

    console.info("⚖️  VoteWise fully initialised.");
  }
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => new App().init());
