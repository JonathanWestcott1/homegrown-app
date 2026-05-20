// employer/applicants.js — applicant sheet rendering and display
// Requires globals: _sb, _jobsCache, applicantsByJob
// escapeHtml() and formatPay() are defined in employer/jobs.js (loaded before this file)
// openChatSheet() is defined in employer/messages.js (loaded after this file)

function openApplicantsSheet(jobId) {
  const job = _jobsCache[jobId];
  if (!job) return;

  document.getElementById('appl-title').textContent = job.role_title || 'Interested Locals';
  const apps  = applicantsByJob[jobId] || [];
  const count = apps.length;
  document.getElementById('appl-subtitle').textContent =
    count === 0 ? 'No applicants yet' : `${count} interested local${count !== 1 ? 's' : ''}`;

  const body = document.getElementById('appl-body');
  if (count === 0) {
    body.innerHTML = `<div class="appl-empty">
      <div class="appl-empty-icon">🌱</div>
      <div>No one has applied yet.<br>Check back once your job is live.</div>
    </div>`;
  } else {
    const reqCerts = job.certifications_required || [];
    body.innerHTML = apps.map(a => renderApplicantRow(a, reqCerts)).join('');
  }

  document.getElementById('appl-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderApplicantRow(app, reqCerts) {
  const rawName = app.student_name
    || (app.student_email ? app.student_email.split('@')[0] : null)
    || 'Applicant';
  const name   = escapeHtml(rawName);
  const email  = app.student_email || '';
  const phone  = app.student_phone || '';
  const county = app.student_county || '';
  const certs  = app.certifications || [];
  const ago    = timeAgo(app.created_at);

  // Cert match
  let certLine = '';
  if (reqCerts.length > 0) {
    const matched = reqCerts.filter(c => certs.includes(c)).length;
    if (matched === reqCerts.length) {
      certLine = `<div class="appl-cert-line"><span class="appl-cert-match">✓ Has all required certifications</span></div>`;
    } else {
      certLine = `<div class="appl-cert-line"><span class="appl-cert-partial">${matched}/${reqCerts.length} required certifications</span></div>`;
    }
  } else if (certs.length > 0) {
    certLine = `<div class="appl-cert-line"><span class="appl-cert-match">${certs.length} certification${certs.length !== 1 ? 's' : ''}</span></div>`;
  }

  // Meta line
  const metaParts = [];
  if (county) {
    // Avoid "Chenango County County" — only append if not already ending in County/York
    const countyDisplay = /county|new york/i.test(county) ? county : county + ' County';
    metaParts.push(countyDisplay);
  }
  if (email) metaParts.push(email);
  const meta = metaParts.join(' · ');

  // Action buttons
  const msgBtn = `<button class="appl-action-btn appl-btn-message" onclick="openChatSheet('${app.job_id}','${escapeHtml(app.student_id)}','${escapeHtml(rawName)}','${escapeHtml(app._program||'')}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Message
    </button>`;

  const cleanPhone = phone.replace(/\D/g, '');
  const callBtn = cleanPhone
    ? `<a class="appl-action-btn appl-btn-call" href="tel:${cleanPhone}">
         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
         Call ${phone ? escapeHtml(phone) : ''}
       </a>` : '';

  return `
    <div class="appl-row">
      <div class="appl-row-top">
        <div class="appl-row-name">${name}</div>
        <div class="appl-row-time">${ago}</div>
      </div>
      ${meta ? `<div class="appl-row-meta">${escapeHtml(meta)}</div>` : ''}
      ${certLine}
      <div class="appl-actions">${msgBtn}${callBtn}</div>
    </div>`;
}

function closeApplicantsSheet() {
  document.getElementById('appl-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function applOverlayClose(e) {
  if (e.target === document.getElementById('appl-overlay')) closeApplicantsSheet();
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0)  return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}
