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
  const identifiedMeritCourses = identifyMeritCourses(parsedCourses);

  injectGeneralWidget(baseResult, identifiedMeritCourses);
}

function calculateStandardGpa(courses) {
  let totalPoints = 0;
  let totalCreditsForGpa = 0;
  let totalCreditsOverall = 0;

  courses.forEach(c => {
    totalCreditsOverall += c.credits;

    // Gymnasiearbete (GYARTE) is strictly pass/fail; it provides credit mass but zero GPA value weight
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

function identifyMeritCourses(courses) {
  let meritList = [];

  courses.forEach(c => {
    const nameLower = c.name.toLowerCase();
    const codePrefix = c.code.substring(0, 6);
    
    // Ignore failed inputs
    if (c.grade === 'F' || c.grade === '-') return;

    // English Tiering
    if (nameLower.includes('engelska 6') || c.code === 'ENGENG06') {
      meritList.push({ name: 'Engelska 6', type: 'Engelska', pointValue: 0.5 });
    }
    if (nameLower.includes('engelska 7') || c.code === 'ENGENG07') {
      meritList.push({ name: 'Engelska 7', type: 'Engelska', pointValue: 1.0 });
    }

    // Math Tiering
    if (nameLower.includes('matematik 2') || c.code === 'MATMAT02C' || c.code === 'MATMAT02B') {
      meritList.push({ name: c.name, type: 'Matematik', pointValue: 0.5 });
    }
    if (nameLower.includes('matematik 3') || c.code === 'MATMAT03C' || c.code === 'MATMAT03B') {
      meritList.push({ name: c.name, type: 'Matematik', pointValue: 0.5 });
    }
    if (nameLower.includes('matematik 4') || c.code === 'MATMAT04') {
      meritList.push({ name: 'Matematik 4', type: 'Matematik', pointValue: 0.5 });
    }
    if (nameLower.includes('matematik 5') || c.code === 'MATMAT05') {
      meritList.push({ name: 'Matematik 5', type: 'Matematik', pointValue: 1.0 });
    }

    // Modern Languages Tiering
    if (codePrefix === 'MODSPA' || codePrefix === 'MODFRA' || codePrefix === 'MODTYS' || nameLower.includes('moderna språk')) {
      if (nameLower.includes('3')) {
        meritList.push({ name: c.name, type: 'Moderna Språk', pointValue: 0.5 });
      } else if (nameLower.includes('4')) {
        meritList.push({ name: c.name, type: 'Moderna Språk', pointValue: 1.0 });
      } else if (nameLower.includes('5')) {
        meritList.push({ name: c.name, type: 'Moderna Språk', pointValue: 1.5 });
      }
    }
  });

  return meritList;
}

function injectGeneralWidget(baseResult, meritCourses) {
  const existing = document.getElementById('antagning-math-widget');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'antagning-math-widget';
  
  let meritCoursesHtml = '';
  if (meritCourses.length === 0) {
    meritCoursesHtml = '<p class="empty-merit">Inga meritkurser hittades på sidan.</p>';
  } else {
    meritCoursesHtml = '<ul class="merit-list">';
    meritCourses.forEach(item => {
      meritCoursesHtml += `
        <li>
          <span class="course-badge ${item.type.toLowerCase().replace(' ', '-')}">${item.type}</span>
          <span class="course-name">${item.name}</span>
          <span class="course-val">+${item.pointValue.toFixed(1)}</span>
        </li>
      `;
    });
    meritCoursesHtml += '</ul>';
  }

  widget.innerHTML = `
    <h3>🎓 Antagningsnivå</h3>
    <hr>
    <div class="score-row">
      <span>Jämförelsetal (BI):</span>
      <strong>${baseResult.gpa.toFixed(2)}</strong>
    </div>
    <div class="score-row" style="font-size: 11px; color: #666; margin-top: -3px; margin-bottom: 12px;">
      <span>Räknade poäng: ${baseResult.calculatedCredits}p (Totalt ${baseResult.totalCredits}p)</span>
    </div>
    
    <div class="merit-analysis-box">
      <h4>✨ Dina Potentiella Meritkurser</h4>
      <p class="merit-disclaimer">Följande kurser ger extrapoäng (max 2.5p totalt). Om de faktiskt räknas med beror helt på förkunskapskraven för den utbildning du söker:</p>
      ${meritCoursesHtml}
    </div>
  `;

  document.body.appendChild(widget);
}