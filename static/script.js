(function () {
  // ── DOM refs ──
  const form = document.getElementById("resume-form");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("resume-file");
  const fileLabel = document.getElementById("file-selected-label");
  const loadingState = document.getElementById("loading-state");
  const errorBanner = document.getElementById("error-banner");
  const resultsSection = document.getElementById("results");
  const submitBtn = document.getElementById("submit-btn");
  const personasSection = document.getElementById("personas-section");
  const formCard = () => form.closest(".card");

  // ── Persona management ──
  const PERSONAS_KEY = "resuready_personas";

  function getPersonas() {
    try { return JSON.parse(localStorage.getItem(PERSONAS_KEY) || "[]"); }
    catch { return []; }
  }

  function savePersonas(p) {
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(p));
  }

  function renderPersonas() {
    const personas = getPersonas();
    const list = document.getElementById("personas-list");
    const emptyMsg = document.getElementById("personas-empty");
    list.querySelectorAll(".persona-card").forEach((c) => c.remove());

    if (personas.length === 0) {
      emptyMsg.style.display = "block";
      return;
    }
    emptyMsg.style.display = "none";

    personas.forEach((p) => {
      const card = el("div", "persona-card");

      const info = el("div", "persona-info");
      info.appendChild(el("span", "persona-name-label", p.name));
      info.appendChild(el("span", "persona-meta", `${p.industry} · ${p.years_of_experience} yrs`));

      const actions = el("div", "persona-actions");

      const useBtn = el("button", "btn-use-persona", "Use");
      useBtn.type = "button";
      useBtn.addEventListener("click", () => applyPersona(p));

      const delBtn = el("button", "btn-delete-persona", "×");
      delBtn.type = "button";
      delBtn.title = "Delete persona";
      delBtn.addEventListener("click", (e) => { e.stopPropagation(); deletePersona(p.id); });

      actions.appendChild(useBtn);
      actions.appendChild(delBtn);
      card.appendChild(info);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function applyPersona(p) {
    if (p.industry) document.getElementById("industry").value = p.industry;
    if (p.years_of_experience) document.getElementById("years_of_experience").value = p.years_of_experience;
    formCard().scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deletePersona(id) {
    savePersonas(getPersonas().filter((p) => p.id !== id));
    renderPersonas();
  }

  // ── Persona modal ──
  const modal = document.getElementById("persona-modal");

  document.getElementById("btn-add-persona").addEventListener("click", () => {
    document.getElementById("persona-name").value = "";
    document.getElementById("persona-industry").value = "";
    document.getElementById("persona-experience").value = "";
    document.getElementById("persona-prefs").value = "";
    modal.classList.add("open");
  });

  function closeModal() { modal.classList.remove("open"); }

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  document.getElementById("modal-save").addEventListener("click", () => {
    const name = document.getElementById("persona-name").value.trim();
    const industry = document.getElementById("persona-industry").value;
    const experience = document.getElementById("persona-experience").value;
    const prefs = document.getElementById("persona-prefs").value.trim();

    if (!name || !industry || !experience) {
      alert("Please fill in persona name, industry, and experience.");
      return;
    }

    const personas = getPersonas();
    personas.push({ id: Date.now().toString(), name, industry, years_of_experience: experience, preferences: prefs });
    savePersonas(personas);
    renderPersonas();
    closeModal();
  });

  // ── Drag & Drop ──
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      showFileName(file.name);
    }
  });
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) showFileName(fileInput.files[0].name); });

  function showFileName(name) {
    fileLabel.textContent = "Selected: " + name;
    fileLabel.style.display = "block";
  }

  // ── Form Submit ──
  let currentSubmissionId = null;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const name = document.getElementById("name").value.trim();
    const industry = document.getElementById("industry").value;
    const years = document.getElementById("years_of_experience").value;
    const jobDesc = document.getElementById("job_description").value.trim();

    if (!name || !industry || !years || !fileInput.files[0]) {
      showError("Please fill in all fields and upload your resume PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("industry", industry);
    formData.append("years_of_experience", years);
    formData.append("job_description", jobDesc);
    formData.append("resume", fileInput.files[0]);

    setLoading(true);

    try {
      const res = await fetch("/analyze", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Something went wrong. Please try again."); return; }
      currentSubmissionId = data.submission_id || null;
      renderResults(data.feedback_a, data.feedback_b);
    } catch {
      showError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  });

  // ── State helpers ──
  function setLoading(on) {
    submitBtn.disabled = on;
    loadingState.style.display = on ? "block" : "none";
    formCard().style.display = on ? "none" : "block";
    personasSection.style.display = on ? "none" : "block";
    submitBtn.textContent = on ? "Analyzing…" : "Analyze My Resume";
  }

  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.style.display = "block";
    formCard().style.display = "block";
  }

  function hideError() { errorBanner.style.display = "none"; }

  // ── Feedback column renderer ──
  function renderFeedbackColumn(data) {
    const col = el("div", "feedback-col");
    const ratingClass = { "Strong": "strong", "Average": "average", "Needs Work": "needs-work" }[data.overall_rating] || "average";

    const badgeRow = el("div", "col-rating-row");
    badgeRow.appendChild(el("span", `rating-badge ${ratingClass}`, data.overall_rating));
    col.appendChild(badgeRow);

    col.appendChild(el("p", "summary-text", data.summary));

    if (data.section_feedback?.length) {
      col.appendChild(el("h3", "section-title", "Section Feedback"));
      const cards = el("div", "section-cards");
      data.section_feedback.forEach((sf) => {
        const card = el("div", "section-card");
        const hdr = el("div", "section-card-header");
        hdr.appendChild(el("span", "section-name", sf.section));
        const sc = { "Strong": "strong", "Average": "average", "Needs Work": "needs-work" }[sf.score] || "average";
        hdr.appendChild(el("span", `score-pill ${sc}`, sf.score));
        card.appendChild(hdr);
        card.appendChild(el("p", null, sf.feedback));
        cards.appendChild(card);
      });
      col.appendChild(cards);
    }

    if (data.keywords) {
      col.appendChild(el("h3", "section-title", "Keyword Analysis"));
      const grid = el("div", "keywords-grid");

      const presentGroup = el("div", "keyword-group");
      presentGroup.appendChild(el("h4", null, "Present"));
      const presentPills = el("div", "keyword-pills");
      (data.keywords.present || []).forEach((kw) => presentPills.appendChild(el("span", "pill present", kw)));
      presentGroup.appendChild(presentPills);
      grid.appendChild(presentGroup);

      const missingGroup = el("div", "keyword-group");
      missingGroup.appendChild(el("h4", null, "Missing"));
      const missingPills = el("div", "keyword-pills");
      (data.keywords.missing || []).forEach((kw) => missingPills.appendChild(el("span", "pill missing", kw)));
      missingGroup.appendChild(missingPills);
      grid.appendChild(missingGroup);

      col.appendChild(grid);
    }

    if (data.rewrites?.length) {
      col.appendChild(el("h3", "section-title", "Bullet Point Rewrites"));
      const list = el("div", "rewrites-list");
      data.rewrites.forEach((r) => {
        const item = el("div", "rewrite-item");
        const before = el("div", "rewrite-row before");
        before.appendChild(el("span", "rewrite-label", "Before"));
        before.appendChild(el("span", null, r.original));
        const after = el("div", "rewrite-row after");
        after.appendChild(el("span", "rewrite-label", "After"));
        after.appendChild(el("span", null, r.improved));
        item.appendChild(before);
        item.appendChild(after);
        list.appendChild(item);
      });
      col.appendChild(list);
    }

    if (data.top_priorities?.length) {
      col.appendChild(el("h3", "section-title", "Top 3 Priorities"));
      const priorityList = el("div", "priorities-list");
      data.top_priorities.forEach((p, i) => {
        const item = el("div", "priority-item");
        item.appendChild(el("div", "priority-num", String(i + 1)));
        item.appendChild(el("p", null, p));
        priorityList.appendChild(item);
      });
      col.appendChild(priorityList);
    }

    return col;
  }

  // ── Results renderer ──
  function renderResults(feedbackA, feedbackB) {
    hideError();
    resultsSection.innerHTML = "";

    const header = el("div", "results-header");
    header.appendChild(el("h2", null, "Your Resume Feedback"));
    resultsSection.appendChild(header);

    const abGrid = el("div", "ab-grid");

    const colAWrap = el("div", "ab-col-wrap");
    const colAHead = el("div", "ab-col-header");
    colAHead.appendChild(el("h3", "ab-col-title", "Prompt-Based Feedback"));
    colAHead.appendChild(el("p", "ab-col-subtitle", "Generated using your profile and job description"));
    colAWrap.appendChild(colAHead);
    colAWrap.appendChild(renderFeedbackColumn(feedbackA));
    abGrid.appendChild(colAWrap);

    const colBWrap = el("div", "ab-col-wrap");
    const colBHead = el("div", "ab-col-header");
    colBHead.appendChild(el("h3", "ab-col-title", "Data-Driven Feedback"));
    colBHead.appendChild(el("p", "ab-col-subtitle", "Generated using ResuReady's expert knowledge"));
    colBWrap.appendChild(colBHead);
    colBWrap.appendChild(renderFeedbackColumn(feedbackB));
    abGrid.appendChild(colBWrap);

    resultsSection.appendChild(abGrid);

    // Preference voting
    const prefSection = el("div", "preference-section");
    prefSection.appendChild(el("p", "preference-prompt", "Which was more helpful?"));
    const prefBtns = el("div", "preference-buttons");

    const btnA = el("button", "btn-preference", "Prompt-Based");
    btnA.type = "button";
    btnA.addEventListener("click", () => submitPreference("a", prefSection));

    const btnB = el("button", "btn-preference", "Data-Driven");
    btnB.type = "button";
    btnB.addEventListener("click", () => submitPreference("b", prefSection));

    prefBtns.appendChild(btnA);
    prefBtns.appendChild(btnB);
    prefSection.appendChild(prefBtns);
    resultsSection.appendChild(prefSection);

    const restart = el("button", "btn-restart", "← Analyze Another Resume");
    restart.type = "button";
    restart.addEventListener("click", () => {
      resultsSection.style.display = "none";
      personasSection.style.display = "block";
      formCard().style.display = "block";
      form.reset();
      fileLabel.style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    resultsSection.appendChild(restart);

    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submitPreference(choice, prefSection) {
    if (currentSubmissionId) {
      try {
        await fetch("/preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission_id: currentSubmissionId, preferred: choice }),
        });
      } catch { /* silently fail */ }
    }
    prefSection.innerHTML = "";
    const label = choice === "a" ? "Prompt-Based" : "Data-Driven";
    prefSection.appendChild(el("p", "preference-confirmed", `Thanks! You found the ${label} feedback more helpful.`));
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  // ── Init ──
  renderPersonas();
})();
