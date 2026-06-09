window.addEventListener('load', () => {
  setTimeout(calculateSplitAdmissions, 1000);
});

function calculateSplitAdmissions() {
  // Hämtar alla tabellrader på hela sidan
  const rows = document.querySelectorAll('.table-desktop tbody tr, table tbody tr');
  if (rows.length === 0) return;

  const gradeScale = { 'A': 20.0, 'B': 17.5, 'C': 15.0, 'D': 12.5, 'E': 10.0, 'F': 0.0 };
  let gymnasieCourses = [];
  let komvuxCourses = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td, th');
    if (cells.length < 4) return;

    // Standardisera kolumnindexering baserat på Antagnings layout
    const name = cells[0].innerText.trim();
    const code = cells[1].innerText.trim().toUpperCase();
    const grade = cells[2].innerText.trim().toUpperCase();
    const credits = parseInt(cells[3].innerText.trim(), 10);
    
    // Samla ihop all text i raden för att leta efter "Komvux" eller "Enstaka" som fallback
    const rowText = row.innerText.toLowerCase();
    const parentSection = row.closest('.betyg-section, div, table')?.innerText.toLowerCase() || '';

    if (isNaN(credits)) return;

    // TRÄFFSÄKER DETEKTERING AV KOMVUX:
    // 1. Om cellen längst till höger (Från) innehåller Komvux
    // 2. Om raden ligger i en container eller tabell märkt med "enstaka betyg" eller "vuxen"
    // 3. Om sista kolumnen/anmärkningen innehåller ett rent 'V'
    let isKomvux = false;
    cells.forEach(cell => {
      const cellText = cell.innerText.trim().toLowerCase();
      if (cellText === 'komvux' || cellText === 'v') {
        isKomvux = true;
      }
    });

    if (rowText.includes('komvux') || parentSection.includes('enstaka betyg') || parentSection.includes('vuxen')) {
      isKomvux = true;
    }

    const isExtended = rowText.includes(' utökad') || rowText.includes(' (u)');
    const isGymnasiearbete = name.toLowerCase().includes('gymnasiearbete') || code === 'GYARTE';

    const courseObj = { name, code, grade, gradeValue: gradeScale[grade] || 0, credits, isExtended, isGymnasiearbete };

    if (isGymnasiearbete) {
      gymnasieCourses.push(courseObj);
    } else if (isKomvux) {
      komvuxCourses.push(courseObj);
    } else {
      gymnasieCourses.push(courseObj);
    }
  });

  // 1. Beräkna REN BI (Matematik 5 från Komvux exkluderas helt härifrån)
  const biResult = calculateGpaTrack(gymnasieCourses);
  const biMerit = calculateAdvancedMerit([...gymnasieCourses]);

  // 2. Beräkna BII (Inkluderar alla ordinarie kurser + alla komvuxkompletteringar)
  const biiResult = calculateGpaTrack([...gymnasieCourses, ...komvuxCourses]);
  const biiMerit = calculateAdvancedMerit([...gymnasieCourses, ...komvuxCourses]);

  injectSplitWidget(biResult, biMerit, biiResult, biiMerit, komvuxCourses.length);
}

function calculateGpaTrack(courses) {
  let totalPoints = 0;
  let totalCreditsForGpa = 0;
  let totalCreditsOverall = 0;

  courses.forEach(c => {
    totalCreditsOverall += c.credits;

    if (c.isGymnasiearbete || c.isExtended) return;

    totalPoints += c.gradeValue * c.credits;
    totalCreditsForGpa += c.credits;
  });

  return {
    gpa: totalCreditsForGpa > 0 ? (totalPoints / totalCreditsForGpa) : 0,
    calculatedCredits: totalCreditsForGpa,
    totalCredits: totalCreditsOverall
  };
}

function calculateAdvancedMerit(courses) {
  let categories = {
    'Engelska': { rawPoints: 0, maxCap: 1.0, courses: [] },
    'Matematik': { rawPoints: 0, maxCap: 1.5, courses: [] },
    'Moderna Språk': { rawPoints: 0, maxCap: 1.5, courses: [] }
  };

  courses.forEach(c => {
    const nameLower = c.name.toLowerCase();
    const codePrefix = c.code.substring(0, 6);
    
    if (c.grade === 'F' || c.grade === '-' || c.isGymnasiearbete) return;

    if (nameLower.includes('engelska 6') || c.code === 'ENGENG06') {
      categories['Engelska'].courses.push({ name: 'Engelska 6', points: 0.5 });
      categories['Engelska'].rawPoints += 0.5;
    }
    if (nameLower.includes('engelska 7') || c.code === 'ENGENG07') {
      categories['Engelska'].courses.push({ name: 'Engelska 7', points: 1.0 });
      categories['Engelska'].rawPoints += 1.0;
    }

    if (nameLower.includes('matematik 2') || c.code === 'MATMAT02C' || c.code === 'MATMAT02B') {
      categories['Matematik'].courses.push({ name: c.name, points: 0.5 });
      categories['Matematik'].rawPoints += 0.5;
    }
    if (nameLower.includes('matematik 3') || c.code === 'MATMAT03C' || c.code === 'MATMAT03B') {
      categories['Matematik'].courses.push({ name: c.name, points: 0.5 });
      categories['Matematik'].rawPoints += 0.5;
    }
    if (nameLower.includes('matematik 4') || c.code === 'MATMAT04') {
      categories['Matematik'].courses.push({ name: 'Matematik 4', points: 0.5 });
      categories['Matematik'].rawPoints += 0.5;
    }
    if (nameLower.includes('matematik 5') || c.code === 'MATMAT05') {
      categories['Matematik'].courses.push({ name: 'Matematik 5', points: 1.0 });
      categories['Matematik'].rawPoints += 1.0;
    }

    if (codePrefix === 'MODSPA' || codePrefix === 'MODFRA' || codePrefix === 'MODTYS' || nameLower.includes('moderna språk')) {
      if (nameLower.includes('3')) {
        categories['Moderna Språk'].courses.push({ name: c.name, points: 0.5 });
        categories['Moderna Språk'].rawPoints += 0.5;
      } else if (nameLower.includes('4')) {
        categories['Moderna Språk'].courses.push({ name: c.name, points: 1.0 });
        categories['Moderna Språk'].rawPoints += 1.0;
      } else if (nameLower.includes('5')) {
        categories['Moderna Språk'].courses.push({ name: c.name, points: 1.5 });
        categories['Moderna Språk'].rawPoints += 1.5;
      }
    }
  });

  let totalMeritBidrag = 0;
  for (let catName in categories) {
    let cat = categories[catName];
    cat.actualContribution = Math.min(cat.rawPoints, cat.maxCap);
    totalMeritBidrag += cat.actualContribution;
  }
  totalMeritBidrag = Math.min(totalMeritBidrag, 2.5);

  return { categories, totalMerit: totalMeritBidrag };
}

function injectSplitWidget(bi, biMerit, bii, biiMerit, komvuxCount) {
  const existing = document.getElementById('antagning-math-widget');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'antagning-math-widget';

  const finalBI = bi.gpa + biMerit.totalMerit;
  const finalBII = bii.gpa + biiMerit.totalMerit;

  // Vi bygger dropdown-listan baserat på BII här så man ser ALLA kurser (inklusive Matte 5)
  let meritDropdownsHtml = '<div class="dropdown-container">';
  for (let catName in biiMerit.categories) {
    const cat = biiMerit.categories[catName];
    if (cat.courses.length === 0) continue;
    const isCapped = cat.rawPoints > cat.maxCap;

    meritDropdownsHtml += `
      <details class="merit-dropdown">
        <summary>
          <div class="summary-header">
            <span class="course-badge ${catName.toLowerCase().replace(' ', '-')}">${catName}</span>
            <span class="contribution-text" style="color: ${isCapped ? '#cc2929' : '#047857'}">
              +${cat.actualContribution.toFixed(1)} p ${isCapped ? `(Tak: ${cat.maxCap.toFixed(1)})` : ''}
            </span>
          </div>
          <span class="dropdown-arrow">▼</span>
        </summary>
        <ul class="dropdown-course-list">
    `;
    cat.courses.forEach(course => {
      meritDropdownsHtml += `<li><span class="bullet">•</span><span class="c-name">${course.name}</span><span class="c-points">(+${course.points.toFixed(1)} p)</span></li>`;
    });
    meritDropdownsHtml += `</ul></details>`;
  }
  meritDropdownsHtml += '</div>';

  widget.innerHTML = `
    <h3>🎓 Antagningsnivåer</h3>
    <hr>
    
    <div class="group-section">
      <div class="group-title">Direktgruppen (BI) <span class="badge-bi">Gymnasieexamen</span></div>
      <div class="score-row"><span>Jämförelsetal (BI):</span> <strong>${bi.gpa.toFixed(2)}</strong></div>
      <div class="score-row"><span>Meritpoäng (BI):</span> <strong style="color: #047857;">+${biMerit.totalMerit.toFixed(2)}</strong></div>
      <div class="score-row final-row">
        <span><strong>Slutgiltigt Meritvärde (BI):</strong></span>
        <strong class="final-score-value">${finalBI.toFixed(2)}</strong>
      </div>
      <div class="score-row stats-row"><span>Poäng i BI: ${bi.calculatedCredits}p</span></div>
    </div>

    <div class="group-section" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0;">
      <div class="group-title">Kompletteringsgruppen (BII) <span class="badge-bii">Komvux inkluderat</span></div>
      <div class="score-row"><span>Jämförelsetal (BII):</span> <strong>${bii.gpa.toFixed(2)}</strong></div>
      <div class="score-row"><span>Meritpoäng (BII):</span> <strong style="color: #047857;">+${biiMerit.totalMerit.toFixed(2)}</strong></div>
      <div class="score-row final-row">
        <span><strong>Slutgiltigt Meritvärde (BII):</strong></span>
        <strong class="final-score-value" style="color: #1e3a8a;">${finalBII.toFixed(2)}</strong>
      </div>
      <div class="score-row stats-row">
        <span>Komvux/Enstaka kurser funna: <strong>${komvuxCount} st</strong></span>
      </div>
    </div>
    
    <div class="merit-analysis-box" style="margin-top: 12px;">
      <h4>✨ Fördelning av Meritpoäng (BII)</h4>
      <p class="merit-disclaimer">Visar kurser och maxtak baserat på dina samlade betyg:</p>
      ${meritDropdownsHtml}
    </div>
  `;

  document.body.appendChild(widget);
}