window.addEventListener('load', () => {
  setTimeout(calculateSplitAdmissions, 1000);
});

function calculateSplitAdmissions() {
  const rows = document.querySelectorAll('.table-desktop tbody tr, table tbody tr');
  if (rows.length === 0) return;

  const gradeScale = { 'A': 20.0, 'B': 17.5, 'C': 15.0, 'D': 12.5, 'E': 10.0, 'F': 0.0 };
  let gymnasieCourses = [];
  let komvuxCourses = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td, th');
    if (cells.length < 4) return;

    const name = cells[0].innerText.trim();
    const code = cells[1].innerText.trim().toUpperCase();
    const grade = cells[2].innerText.trim().toUpperCase();
    const credits = parseInt(cells[3].innerText.trim(), 10);
    const rowText = row.innerText.toLowerCase();
    const parentSection = row.closest('.betyg-section, div, table')?.innerText.toLowerCase() || '';

    if (isNaN(credits)) return;

    let isKomvux = false;
    cells.forEach(cell => {
      const cellText = cell.innerText.trim().toLowerCase();
      if (cellText === 'komvux' || cellText === 'v') isKomvux = true;
    });
    if (rowText.includes('komvux') || parentSection.includes('enstaka betyg') || parentSection.includes('vuxen')) isKomvux = true;

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

  const biResult = calculateGpaTrack(gymnasieCourses);
  const biMerit = calculateAdvancedMerit([...gymnasieCourses]);

  const biiResult = calculateGpaTrack([...gymnasieCourses, ...komvuxCourses]);
  const biiMerit = calculateAdvancedMerit([...gymnasieCourses, ...komvuxCourses]);

  injectCleanWidget(biResult, biMerit, biiResult, biiMerit, komvuxCourses.length);
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
    if (c.grade === 'F' || c.grade === '-' || c.isGymnasiearbete) return;

    if (nameLower.includes('engelska 6') || c.code === 'ENGENG06') {
      categories['Engelska'].courses.push({ name: 'Engelska 6', points: 0.5 });
      categories['Engelska'].rawPoints += 0.5;
    }
    if (nameLower.includes('engelska 7') || c.code === 'ENGENG07') {
      categories['Engelska'].courses.push({ name: 'Engelska 7', points: 1.0 });
      categories['Engelska'].rawPoints += 1.0;
    }
    if (nameLower.includes('matematik 2') || c.code.startsWith('MATMAT02')) {
      categories['Matematik'].courses.push({ name: c.name, points: 0.5 });
      categories['Matematik'].rawPoints += 0.5;
    }
    if (nameLower.includes('matematik 3') || c.code.startsWith('MATMAT03')) {
      categories['Matematik'].courses.push({ name: c.name, points: 0.5 });
      categories['Matematik'].rawPoints += 0.5;
    }
    if (nameLower.includes('matematik 4') || c.code.startsWith('MATMAT04')) {
      categories['Matematik'].courses.push({ name: 'Matematik 4', points: 0.5 });
      categories['Matematik'].rawPoints += 0.5;
    }
    if (nameLower.includes('matematik 5') || c.code.startsWith('MATMAT05')) {
      categories['Matematik'].courses.push({ name: 'Matematik 5', points: 1.0 });
      categories['Matematik'].rawPoints += 1.0;
    }
    if (c.code.substring(0, 6).includes('MOD') || nameLower.includes('moderna språk')) {
      if (nameLower.includes('3')) { categories['Moderna Språk'].courses.push({ name: c.name, points: 0.5 }); categories['Moderna Språk'].rawPoints += 0.5; }
      else if (nameLower.includes('4')) { categories['Moderna Språk'].courses.push({ name: c.name, points: 1.0 }); categories['Moderna Språk'].rawPoints += 1.0; }
      else if (nameLower.includes('5')) { categories['Moderna Språk'].courses.push({ name: c.name, points: 1.5 }); categories['Moderna Språk'].rawPoints += 1.5; }
    }
  });

  let totalMeritBidrag = 0;
  for (let catName in categories) {
    let cat = categories[catName];
    cat.actualContribution = Math.min(cat.rawPoints, cat.maxCap);
    totalMeritBidrag += cat.actualContribution;
  }
  return { categories, totalMerit: Math.min(totalMeritBidrag, 2.5) };
}

function injectCleanWidget(bi, biMerit, bii, biiMerit, komvuxCount) {
  const existing = document.getElementById('antagning-math-widget');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'antagning-math-widget';

  const finalBI = bi.gpa + biMerit.totalMerit;
  const finalBII = bii.gpa + biiMerit.totalMerit;

  // Bygg Merit-dropdowns
  let meritDropdownsHtml = '';
  for (let catName in biiMerit.categories) {
    const cat = biiMerit.categories[catName];
    if (cat.courses.length === 0) continue;
    const isCapped = cat.rawPoints > cat.maxCap;
    meritDropdownsHtml += `
      <details class="merit-sub-dropdown">
        <summary>
          <span>${catName}</span>
          <span style="color: ${isCapped ? '#cc2929' : '#047857'}">+${cat.actualContribution.toFixed(1)} p</span>
        </summary>
        <ul>
          ${cat.courses.map(c => `<li><span>${c.name}</span> <span>+${c.points.toFixed(1)}</span></li>`).join('')}
        </ul>
      </details>`;
  }

  // open har tagits bort från .main-group-dropdown för BI nedan
  widget.innerHTML = `
    <h3>🎓 Antagningsnivåer</h3>
    <hr>
    
    <details class="main-group-dropdown">
      <summary>
        <div class="summary-content">
          <span class="group-label bi">BI</span>
          <span class="group-name">Direktgruppen</span>
          <span class="group-score">${finalBI.toFixed(2)}</span>
        </div>
      </summary>
      <div class="dropdown-body">
        <div class="row"><span>Jämförelsetal:</span> <span>${bi.gpa.toFixed(2)}</span></div>
        <div class="row"><span>Meritpoäng:</span> <span style="color: #047857;">+${biMerit.totalMerit.toFixed(2)}</span></div>
        <div class="row footer"><span>Beräknat på:</span> <span>${bi.calculatedCredits}p</span></div>
      </div>
    </details>

    <details class="main-group-dropdown">
      <summary>
        <div class="summary-content">
          <span class="group-label bii">BII</span>
          <span class="group-name">Komplettering</span>
          <span class="group-score" style="color: #1e3a8a;">${finalBII.toFixed(2)}</span>
        </div>
      </summary>
      <div class="dropdown-body">
        <div class="row"><span>Jämförelsetal:</span> <span>${bii.gpa.toFixed(2)}</span></div>
        <div class="row"><span>Meritpoäng:</span> <span style="color: #047857;">+${biiMerit.totalMerit.toFixed(2)}</span></div>
        <div class="row footer"><span>Komvux-kurser:</span> <span>${komvuxCount} st</span></div>
      </div>
    </details>

    <div class="merit-analysis-box">
      <details class="main-group-dropdown">
        <summary>
          <div class="summary-content">
            <span class="group-label merit">✨</span>
            <span class="group-name">Meritfördelning</span>
            <span class="group-score" style="color: #047857;">+${biiMerit.totalMerit.toFixed(2)}</span>
          </div>
        </summary>
        <div class="dropdown-body">
          <p class="merit-info">Hänsyn tagen till ämnesspecifika tak.</p>
          ${meritDropdownsHtml}
        </div>
      </details>
    </div>
  `;

  document.body.appendChild(widget);
}