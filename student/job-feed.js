// student/job-feed.js — job feed rendering and cert matching display
// Requires globals: _sb, ALL_CERTS, appliedJobIds
// openApplySheet is defined in student/apply.js (loaded after this file)

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatPay(pay) {
  if (!pay) return '';
  const s = String(pay).trim();
  if (s.startsWith('$')) return s;          // already formatted
  const n = parseFloat(s);
  if (!isNaN(n)) return `$${n}/hr`;         // bare number → $24/hr
  return s;                                  // unexpected format, show as-is
}

function toggleDesc(id, btn) {
  const el = document.getElementById(id);
  const isOpen = el.style.maxHeight !== '0px' && el.style.maxHeight !== '';
  if (isOpen) {
    el.style.maxHeight = '0';
    btn.textContent = "What's the job like? ↓";
  } else {
    el.style.maxHeight = el.scrollHeight + 'px';
    btn.textContent = "Show less ↑";
  }
}

function renderJobs(jobs, myCerts) {
  const feed = document.getElementById('job-feed');

  if (jobs.length === 0) {
    feed.innerHTML = `
      <div style="text-align:center;padding:40px 0 20px;color:#999;font-size:14px;line-height:1.6;">
        No jobs posted yet —<br>check back soon as employers join.
      </div>
      <div style="text-align:center;font-size:13px;color:#bbb;padding-bottom:32px;">
        More jobs coming soon as we onboard local employers.
      </div>`;
    return;
  }

  feed.innerHTML = jobs.map((job, idx) => {
    const reqCerts = job.certifications_required || [];
    const allMet = reqCerts.length === 0 || reqCerts.every(c => myCerts.includes(c));

    // Support both new and legacy column names
    const roleTitle = job.role_title || job.role || '';
    const locationStr = [job.city, job.state].filter(Boolean).join(', ') || job.location || '';
    const shiftStr = job.shift_type || job.shift || '';
    const jobTypeStr = job.job_type || '';

    // All job attributes in one unified pill row
    const allPills = [
      shiftStr,
      jobTypeStr,
      ...(Array.isArray(job.benefits) ? job.benefits : []),
      job.is_union ? 'Union shop' : null,
      job.sign_on_bonus ? `${job.sign_on_bonus} sign-on` : null,
      job.offers_apprenticeships ? '✓ Apprenticeships available' : null,
    ].filter(s => s && String(s).trim().length > 0);
    const pills = allPills.map(p => `<span class="app-fit-pill">${esc(p)}</span>`).join('');

    const certPills = reqCerts.map(c => {
      const has = myCerts.includes(c);
      return `<span class="app-cert-pill ${has ? 'app-cert-green' : 'app-cert-gray'}">${has ? '✓' : '+'} ${esc(c)}</span>`;
    }).join('');

    const sponsorBadge = job.sponsors_certifications
      ? `<div class="sponsor-badge">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
           Will pay for your training &amp; certs
         </div>`
      : '';

    const dataCompany = `data-company="${esc(job.company_name || '')}"`;
    const sponsored = !!job.sponsors_certifications;
    const anyway    = !allMet && sponsored;
    const alreadyApplied = appliedJobIds.has(String(job.id));

    let btn;
    if (alreadyApplied) {
      btn = `<button disabled style="width:100%;padding:12px;font-size:14px;font-weight:500;background:#5a9e20;color:#fff;border:none;border-radius:8px;cursor:default;font-family:inherit;margin-top:8px;">✓ Applied</button>`;
    } else if (!allMet && !sponsored) {
      btn = `<button disabled style="width:100%;padding:12px;font-size:14px;font-weight:500;background:#F5F4F0;color:#B4B2A9;border:0.5px solid #E0DED6;border-radius:8px;cursor:default;font-family:inherit;">Get the certifications above to apply</button>`;
    } else if (anyway) {
      btn = `<button class="app-btn-primary" ${dataCompany} data-job-id="${job.id}" onclick="openApplySheet(this)" style="background:#3B6D11;margin-top:8px;">Apply anyway →</button>`;
    } else {
      btn = `<button class="app-btn-primary" ${dataCompany} data-job-id="${job.id}" onclick="openApplySheet(this)" style="background:#5a9e20;margin-top:8px;">Apply Now</button>`;
    }

    const hasDesc = job.student_description && job.student_description.trim().length > 0;
    const descId  = `desc-${idx}`;

    return `
      <div class="app-job-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div class="app-job-role" style="margin-bottom:2px;">${esc(roleTitle)}</div>
          ${job.company_name ? `<a href="/student/company.html?name=${encodeURIComponent(job.company_name)}" style="white-space:nowrap;font-size:11px;font-weight:500;color:#3B6D11;background:#EAF3DE;border-radius:20px;padding:4px 10px;text-decoration:none;flex-shrink:0;margin-top:3px;">About →</a>` : ''}
        </div>
        ${job.company_name ? `<div class="app-job-company" style="margin-bottom:6px;">${esc(job.company_name)}</div>` : ''}
        ${locationStr ? `<div class="app-job-location">📍 ${esc(locationStr)}</div>` : ''}
        ${job.pay ? `<div class="app-job-pay">${esc(formatPay(job.pay))}</div>` : ''}
        ${pills ? `<div class="app-fit-pills">${pills}</div>` : ''}
        ${reqCerts.length > 0 ? `
          <div class="app-cert-row">
            <div class="app-cert-label">Certifications</div>
            <div class="app-cert-pills">${certPills}</div>
          </div>` : ''}
        ${hasDesc ? `
          <div style="margin-bottom:10px;">
            <button onclick="toggleDesc('${descId}',this)" style="background:none;border:none;padding:8px 0 0;font-size:12px;color:#3B6D11;text-decoration:underline;cursor:pointer;font-family:inherit;display:block;">What's the job like? ↓</button>
            <div class="job-desc-expand" id="${descId}" style="overflow:hidden;max-height:0;transition:max-height 0.35s ease;">
              <div style="padding-top:10px;border-top:0.5px solid #D3D1C7;margin-top:8px;">
                <div style="font-size:13px;color:#444441;line-height:1.6;font-style:italic;">${esc(job.student_description)}</div>
              </div>
            </div>
          </div>` : ''}
        ${sponsorBadge}
        ${btn}
      </div>`;
  }).join('') + `
    <div style="text-align:center;font-size:13px;color:#999;margin-top:8px;padding-bottom:32px;">
      More jobs coming soon as we onboard local employers.
    </div>`;
}
