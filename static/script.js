(function () {
  const form = document.getElementById("resume-form");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("resume-file");
  const fileLabel = document.getElementById("file-selected-label");
  const loadingState = document.getElementById("loading-state");
  const errorBanner = document.getElementById("error-banner");
  const resultsSection = document.getElementById("results");
  const submitBtn = document.getElementById("submit-btn");
  const restartBtn = document.getElementById("restart-btn");

  // ── Drag & Drop ──
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

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

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) showFileName(fileInput.files[0].name);
  });

  function showFileName(name) {
    fileLabel.textContent = "Selected: " + name;
    fileLabel.style.display = "block";
  }

  // ── Form Submit ──
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const name = document.getElementById("name").value.trim();
    const industry = document.getElementById("industry").value;
    const years = document.getElementById("years_of_experience").value;

    if (!name || !industry || !years || !fileInput.files[0]) {
      showError("Please fill in all fields and upload your resume PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("industry", industry);
    formData.append("years_of_experience", years);
    formData.append("resume", fileInput.files[0]);

    setLoading(true);

    try {
      const res = await fetch("/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Something went wrong. Please try again.");
        return;
      }

      renderResults(data);
    } catch {
      showError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  });

  restartBtn.addEventListener("click", () => {
    resultsSection.style.display = "none";
    form.closest(".card").style.display = "block";
    form.reset();
    fileLabel.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ── State helpers ──
  function setLoading(on) {
    submitBtn.disabled = on;
    loadingState.style.display = on ? "block" : "none";
    form.closest(".card").style.display = on ? "none" : "block";
    submitBtn.textContent = on ? "Analyzing…" : "Analyze My Resume";
  }

  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.style.display = "block";
    form.closest(".card").style.display = "block";
  }

  function hideError() {
    errorBanner.style.display = "none";
  }

  // ── Results Renderer ──
  function renderResults(data) {
    hideError();
    resultsSection.innerHTML = "";

    const ratingClass = {
      "Strong": "strong",
      "Average": "average",
      "Needs Work": "needs-work",
    }[data.overall_rating] || "average";

    // Header
    const header = el("div", "results-header");
    header.appendChild(el("h2", null, "Your Resume Feedback"));
    const badge = el("span", `rating-badge ${ratingClass}`, data.overall_rating);
    header.appendChild(badge);
    resultsSection.appendChild(header);

    // Summary
    const summary = el("p", "summary-text", data.summary);
    resultsSection.appendChild(summary);

    // Section Feedback
    if (data.section_feedback?.length) {
      resultsSection.appendChild(el("h3", "section-title", "Section Feedback"));
      const cards = el("div", "section-cards");
      data.section_feedback.forEach((sf) => {
        const card = el("div", "section-card");
        const hdr = el("div", "section-card-header");
        hdr.appendChild(el("span", "section-name", sf.section));
        const sc = {
          "Strong": "strong",
          "Average": "average",
          "Needs Work": "needs-work",
        }[sf.score] || "average";
        hdr.appendChild(el("span", `score-pill ${sc}`, sf.score));
        card.appendChild(hdr);
        card.appendChild(el("p", null, sf.feedback));
        cards.appendChild(card);
      });
      resultsSection.appendChild(cards);
    }

    // Keywords
    if (data.keywords) {
      resultsSection.appendChild(el("h3", "section-title", "Keyword Analysis"));
      const grid = el("div", "keywords-grid");

      const presentGroup = el("div", "keyword-group");
      presentGroup.appendChild(el("h4", null, "Present"));
      const presentPills = el("div", "keyword-pills");
      (data.keywords.present || []).forEach((kw) => {
        presentPills.appendChild(el("span", "pill present", kw));
      });
      presentGroup.appendChild(presentPills);
      grid.appendChild(presentGroup);

      const missingGroup = el("div", "keyword-group");
      missingGroup.appendChild(el("h4", null, "Missing"));
      const missingPills = el("div", "keyword-pills");
      (data.keywords.missing || []).forEach((kw) => {
        missingPills.appendChild(el("span", "pill missing", kw));
      });
      missingGroup.appendChild(missingPills);
      grid.appendChild(missingGroup);

      resultsSection.appendChild(grid);
    }

    // Bullet Rewrites
    if (data.rewrites?.length) {
      resultsSection.appendChild(el("h3", "section-title", "Bullet Point Rewrites"));
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
      resultsSection.appendChild(list);
    }

    // Top Priorities
    if (data.top_priorities?.length) {
      resultsSection.appendChild(el("h3", "section-title", "Top 3 Priorities"));
      const priorityList = el("div", "priorities-list");
      data.top_priorities.forEach((p, i) => {
        const item = el("div", "priority-item");
        item.appendChild(el("div", "priority-num", String(i + 1)));
        item.appendChild(el("p", null, p));
        priorityList.appendChild(item);
      });
      resultsSection.appendChild(priorityList);
    }

    // Restart button
    const restart = el("button", "btn-restart", "← Analyze Another Resume");
    restart.id = "restart-btn";
    restart.addEventListener("click", () => {
      resultsSection.style.display = "none";
      form.closest(".card").style.display = "block";
      form.reset();
      fileLabel.style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    resultsSection.appendChild(restart);

    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }
})();
