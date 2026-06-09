window.addEventListener('load', () => {
  setTimeout(calculateGeneralAdmissions, 1000);
});

function calculateGeneralAdmissions() {
  const rows = document.querySelectorAll('.table-desktop tbody tr');
  if (rows.length === 0) return;

  const gradeScale = { 'A': 20.0, 'B': 17.5, 'C': 15.0, 'D': 12.5, 'E': 10.0, 'F': 0.0 };
  let parsedCourses = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td, th');
    if (cells.length < 4) return;

    const name = cells[0].innerText.trim();
    const code = cells[1].innerText.trim().toUpperCase();
    const grade = cells[2].innerText.trim().toUpperCase();
    const credits = parseInt(cells[3].innerText.trim(), 10);
    const note = cells[4] ? cells[4].innerText.trim().toUpperCase() : '';

    if (isNaN(credits)) return;

    parsedCourses.push({
      name,
      code,
      grade,
      gradeValue: gradeScale[grade] || 0,
      credits,
      isExtended: (note === 'U' || note.includes('U'))
    });
  });

  const baseResult = calculateStandardGpa(parsedCourses);
  const meritResult = calculateAdvancedMerit(parsedCourses);

  injectGeneralWidget(baseResult, meritResult);
}

function calculateStandardGpa(courses) {
  let totalPoints = 0;
  let totalCreditsForGpa = 0;
  let totalCreditsOverall = 0;

  courses.forEach(c => {
    totalCreditsOverall += c.credits;

    const isGymnasiearbete = c.name.toLowerCase().includes('gymnasiearbete') || c.code === 'GYARTE';
    if (isGymnasiearbete || c.isExtended) return; 

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
    
    if (c.grade === 'F' || c.grade === '-') return;

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
  let flatCourseList = [];

  for (let catName in categories) {
    let cat = categories[catName];
    cat.actualContribution = Math.min(cat.rawPoints, cat.maxCap);
    totalMeritBidrag += cat.actualContribution;

    cat.courses.forEach(course => {
      flatCourseList.push({
        ...course,
        category: catName,
        catActual: cat.actualContribution,
        catRaw: cat.rawPoints,
        catCap: cat.maxCap
      });
    });
  }

  totalMeritBidrag = Math.min(totalMeritBidrag, 2.5);

  return {
    courses: flatCourseList,
    categories: categories,
    totalMerit: totalMeritBidrag
  };
}

function injectGeneralWidget(baseResult, meritResult) {
  const existing = document.getElementById('antagning-math-widget');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'antagning-math-widget';
  
  let meritHtml = '';
  if (meritResult.courses.length === 0) {
    meritHtml = '<p class="empty-merit">Inga meritkurser hittades på sidan.</p>';
  } else {
    meritHtml = '<div class="dropdown-container">';
    
    for (let catName in meritResult.categories) {
      const cat = meritResult.categories[catName];
      if (cat.courses.length === 0) continue;

      const isCapped = cat.rawPoints > cat.maxCap;

      meritHtml += `
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
        meritHtml += `
          <li>
            <span class="bullet">•</span>
            <span class="c-name">${course.name}</span>
            <span class="c-points">(+${course.points.toFixed(1)} p)</span>
          </li>
        `;
      });

      meritHtml += `
          </ul>
        </details>
      `;
    }
    meritHtml += '</div>';
  }

  const slutgiltigtMeritvärde = baseResult.gpa + meritResult.totalMerit;

  widget.innerHTML = `
    <h3>🎓 Antagningsnivå</h3>
    <hr>
    <div class="score-row">
      <span>Jämförelsetal (BI):</span>
      <strong>${baseResult.gpa.toFixed(2)}</strong>
    </div>
    <div class="score-row">
      <span>Meritpoäng (Max 2.5):</span>
      <strong style="color: #047857;">+${meritResult.totalMerit.toFixed(2)}</strong>
    </div>
    <div class="score-row final-row">
      <span><strong>Slutgiltigt Meritvärde:</strong></span>
      <strong class="final-score-value">${slutgiltigtMeritvärde.toFixed(2)}</strong>
    </div>
    <div class="score-row stats-row">
      <span>Räknade poäng: ${baseResult.calculatedCredits}p (Totalt ${baseResult.totalCredits}p)</span>
    </div>
    
    <div class="merit-analysis-box">
      <h4>✨ Fördelning av Meritpoäng</h4>
      <p class="merit-disclaimer">Klicka på ett ämne nedan för att se vilka kurser som är inkluderade.</p>
      ${meritHtml}
    </div>
  `;

  document.body.appendChild(widget);
}