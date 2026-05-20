// employer/jobs.js — job CRUD, post/edit sheet, pay slider, cert toggles, pipeline
// Requires globals: _sb, currentSession, employerProfile, isUnion, sponsorsCerts,
//                   offersApprenticeships, editingJobId, _jobsCache,
//                   applicantCounts, applicantsByJob
// openApplicantsSheet is defined in employer/applicants.js (loaded after this file)

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatPay(pay) {
  if (!pay) return '';
  const s = String(pay).trim();
  if (s.startsWith('$')) return s;
  const n = parseFloat(s);
  if (!isNaN(n)) return `$${n}/hr`;
  return s;
}

async function loadJobs() {
  const { data: jobs } = await _sb.from('jobs')
    .select('*')
    .eq('employer_id', currentSession.user.id)
    .order('created_at', { ascending: false });

  if (!jobs || jobs.length === 0) {
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('jobs-state').style.display = 'none';
    return;
  }

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('jobs-state').style.display = 'block';

  const active = jobs.filter(j => j.is_active).length;
  document.getElementById('jobs-sub').textContent =
    `${active} active · ${jobs.length - active} paused`;

  jobs.forEach(j => { _jobsCache[j.id] = j; });

  // Load applicant counts for all jobs
  const jobIds = jobs.map(j => j.id);
  const { data: apps } = await _sb.from('applications')
    .select('*')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false });

  // Fetch student programs so the employer chat header can show them
  const studentIds = [...new Set((apps || []).map(a => a.student_id).filter(Boolean))];
  const programMap = {};
  if (studentIds.length > 0) {
    const { data: studs } = await _sb.from('students')
      .select('id, program')
      .in('id', studentIds);
    (studs || []).forEach(s => { if (s.program) programMap[s.id] = s.program; });
  }
  // Attach _program to each application for use in the applicant sheet
  (apps || []).forEach(a => { a._program = programMap[a.student_id] || ''; });

  applicantsByJob = {};
  applicantCounts = {};
  (apps || []).forEach(a => {
    if (!applicantsByJob[a.job_id]) applicantsByJob[a.job_id] = [];
    applicantsByJob[a.job_id].push(a);
    applicantCounts[a.job_id] = (applicantCounts[a.job_id] || 0) + 1;
  });

  document.getElementById('jobs-list').innerHTML =
    jobs.map(renderJobCard).join('');

  await renderPipeline(jobs);

  // Realtime: re-fetch applicant counts whenever a new application comes in
  const jobIdList = jobs.map(j => j.id);
  _sb.channel('employer-applications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'applications'
    }, async (payload) => {
      if (!jobIdList.includes(payload.new?.job_id)) return;
      const { data: freshApps } = await _sb.from('applications')
        .select('*')
        .in('job_id', jobIdList)
        .order('created_at', { ascending: false });
      applicantsByJob = {};
      applicantCounts = {};
      (freshApps || []).forEach(a => {
        if (!applicantsByJob[a.job_id]) applicantsByJob[a.job_id] = [];
        applicantsByJob[a.job_id].push(a);
        applicantCounts[a.job_id] = (applicantCounts[a.job_id] || 0) + 1;
      });
      document.getElementById('jobs-list').innerHTML = jobs.map(renderJobCard).join('');
    })
    .subscribe();
}

function renderJobCard(job) {
  const statusBadge = job.is_active
    ? `<span class="app-posting-status">Active</span>`
    : `<span class="app-posting-status" style="background:#f5f5f5;color:#999;">Paused</span>`;

  const meta = [formatPay(job.pay), job.shift_type].filter(Boolean).join(' · ');

  const certPills = job.certifications_required?.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">
        ${job.certifications_required.map(c =>
          `<span style="font-size:11px;background:#f5f5f5;color:#666;padding:3px 8px;border-radius:20px;">${escapeHtml(c)}</span>`
        ).join('')}
      </div>` : '';

  const toggleBtn = job.is_active
    ? `<button class="real-job-btn real-job-btn-pause" onclick="toggleJob('${job.id}', false)">Pause</button>`
    : `<button class="real-job-btn real-job-btn-activate" onclick="toggleJob('${job.id}', true)">Activate</button>`;

  const appCount = applicantCounts[job.id] || 0;
  const interestedRow = appCount > 0
    ? `<button class="real-job-btn real-job-btn-interested" style="width:100%;margin-top:8px;" onclick="openApplicantsSheet('${job.id}')">
         ${appCount} interested ${appCount === 1 ? 'local' : 'locals'} — view →
       </button>`
    : `<div class="no-applicants-note">No applicants yet</div>`;

  return `
    <div class="real-job-card" id="job-card-${job.id}">
      <div class="real-job-top">
        <div class="real-job-role">${escapeHtml(job.role_title || '')}</div>
        ${statusBadge}
      </div>
      <div class="real-job-pay">${escapeHtml(meta)}</div>
      ${certPills}
      ${interestedRow}
      <div class="real-job-actions" style="margin-top:8px;">
        <button class="real-job-btn" style="background:#f5f5f5;color:#444;" onclick="openEditSheet('${job.id}')">Edit role</button>
        ${toggleBtn}
      </div>
    </div>`;
}

async function renderPipeline(jobs) {
  const pipelineSection = document.getElementById('pipeline-section');

  // Collect all unique certs required across active jobs
  const allCerts = new Set();
  jobs.filter(j => j.is_active).forEach(j => {
    (j.certifications_required || []).forEach(c => allCerts.add(c));
  });

  if (allCerts.size === 0) { pipelineSection.style.display = 'none'; return; }

  // Query real students from Supabase.
  // NOTE: This requires an RLS policy allowing any authenticated user to SELECT from students.
  // Without it, employers get 0 rows (their auth.uid() ≠ any student's id) and pipeline hides.
  // Required SQL (run once in Supabase SQL editor before enabling RLS):
  //   CREATE POLICY "authenticated_read_student_certs" ON students
  //   FOR SELECT USING (auth.role() = 'authenticated');
  const { data: students } = await _sb.from('students').select('certifications');
  const studentList = students || [];

  if (studentList.length === 0) { pipelineSection.style.display = 'none'; return; }

  // Count how many students hold each required cert
  const certRows = [...allCerts]
    .map(cert => ({
      cert,
      count: studentList.filter(s => (s.certifications || []).includes(cert)).length
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (certRows.length === 0) { pipelineSection.style.display = 'none'; return; }

  const county = employerProfile?.county || 'your county';
  document.getElementById('pipeline-sub').textContent =
    `${county} · ${studentList.length} local${studentList.length !== 1 ? 's' : ''} in the system`;

  const rows = certRows.map(r => `
    <div class="app-pipeline-row">
      <div>
        <div class="app-pipeline-row-name">${escapeHtml(r.cert)}</div>
        <div class="app-pipeline-row-count">${r.count} local${r.count !== 1 ? 's' : ''} certified</div>
      </div>
      <div class="app-pipeline-row-cert">matches your role</div>
    </div>`).join('');

  document.getElementById('pipeline-box').innerHTML = `
    <div class="app-pipeline-intro">🎓 Locals already certified for your open roles</div>
    ${rows}`;

  pipelineSection.style.display = 'block';
}

async function toggleJob(jobId, newActive) {
  const card = document.getElementById('job-card-' + jobId);
  const btn  = card.querySelector('.real-job-btn');
  const prev = btn.textContent;
  btn.textContent = '…'; btn.disabled = true;
  const { error } = await _sb.from('jobs').update({ is_active: newActive }).eq('id', jobId);
  if (error) { btn.textContent = prev; btn.disabled = false; return; }
  await loadJobs();
}

/* ── Post Job Sheet ── */

function openPostSheet() {
  resetPostForm();
  document.getElementById('post-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePostSheet() {
  document.getElementById('post-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function overlayClickClose(e) {
  if (e.target === document.getElementById('post-overlay')) closePostSheet();
}

function resetPostForm() {
  editingJobId = null;
  document.getElementById('step1-error').style.display = 'none';
  document.getElementById('f-role').value = '';
  document.getElementById('f-pay-min').value = 18;
  document.getElementById('f-pay-max').value = 28;
  updatePaySlider();
  document.getElementById('f-shift').selectedIndex = 0;
  document.getElementById('f-county').value = '';
  document.getElementById('f-extra').value = '';
  document.querySelectorAll('#cert-checklist .app-check-row.selected')
    .forEach(r => r.classList.remove('selected'));
  isUnion = false; sponsorsCerts = false; offersApprenticeships = false;
  document.getElementById('toggle-union').className = 'toggle-switch';
  document.getElementById('toggle-sponsors').className = 'toggle-switch';
  document.getElementById('toggle-apprenticeships').className = 'toggle-switch';
  document.getElementById('union-label').textContent = 'No';
  document.getElementById('sponsors-label').textContent = 'No';
  document.getElementById('apprenticeships-label').textContent = 'No';
  document.getElementById('sheet-title').textContent = 'Post a Job';
  document.getElementById('submit-btn').innerHTML = 'Post job →';
  document.getElementById('submit-btn').disabled = false;
}

function openEditSheet(jobId) {
  const job = _jobsCache[jobId];
  if (!job) return;
  resetPostForm();
  editingJobId = job.id;
  document.getElementById('sheet-title').textContent = 'Edit Role';
  document.getElementById('submit-btn').innerHTML = 'Save changes →';

  // Populate fields
  document.getElementById('f-role').value = job.role_title || '';
  document.getElementById('f-extra').value = job.student_description || job.employer_description || '';
  document.getElementById('f-county').value = job.city || '';

  // Parse pay range e.g. "$18–$28/hr"
  const payMatch = (job.pay || '').match(/\$?(\d+)[–-]\$?(\d+)/);
  if (payMatch) {
    document.getElementById('f-pay-min').value = parseInt(payMatch[1]);
    document.getElementById('f-pay-max').value = parseInt(payMatch[2]);
  }
  updatePaySlider();

  // Shift
  const shiftEl = document.getElementById('f-shift');
  for (let i = 0; i < shiftEl.options.length; i++) {
    if (shiftEl.options[i].text === job.shift_type) { shiftEl.selectedIndex = i; break; }
  }

  // Toggles
  if (job.is_union)               { isUnion = true;               document.getElementById('toggle-union').className = 'toggle-switch on';               document.getElementById('union-label').textContent = 'Yes'; }
  if (job.sponsors_certifications) { sponsorsCerts = true;         document.getElementById('toggle-sponsors').className = 'toggle-switch on';           document.getElementById('sponsors-label').textContent = 'Yes'; }
  if (job.offers_apprenticeships)  { offersApprenticeships = true; document.getElementById('toggle-apprenticeships').className = 'toggle-switch on';    document.getElementById('apprenticeships-label').textContent = 'Yes'; }

  // Certs
  const reqCerts = job.certifications_required || [];
  document.querySelectorAll('#cert-checklist .app-check-row').forEach(row => {
    const label = row.querySelector('.app-check-label').textContent;
    if (reqCerts.includes(label)) row.classList.add('selected');
  });

  document.getElementById('post-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updatePaySlider() {
  const minEl = document.getElementById('f-pay-min');
  const maxEl = document.getElementById('f-pay-max');
  let lo = parseInt(minEl.value);
  let hi = parseInt(maxEl.value);
  // Keep at least $1 gap; whichever thumb was just moved, push the other
  if (lo >= hi) {
    if (document.activeElement === minEl) { hi = lo + 1; maxEl.value = hi; }
    else                                  { lo = hi - 1; minEl.value = lo; }
  }
  const SLIDER_MIN = 10, SLIDER_MAX = 60, RANGE = SLIDER_MAX - SLIDER_MIN;
  const leftPct  = ((lo - SLIDER_MIN) / RANGE) * 100;
  const rightPct = ((SLIDER_MAX - hi) / RANGE) * 100;
  document.getElementById('pay-fill').style.left  = leftPct  + '%';
  document.getElementById('pay-fill').style.right = rightPct + '%';
  document.getElementById('pay-display').textContent = `$${lo}–$${hi}/hr`;
  // z-index: bring the active thumb's input on top so it stays draggable
  minEl.style.zIndex = document.activeElement === minEl ? 3 : 2;
  maxEl.style.zIndex = document.activeElement === maxEl ? 3 : 2;
}

function toggleSwitch(which) {
  if (which === 'union') {
    isUnion = !isUnion;
    document.getElementById('toggle-union').className = 'toggle-switch' + (isUnion ? ' on' : '');
    document.getElementById('union-label').textContent = isUnion ? 'Yes' : 'No';
  } else if (which === 'sponsors') {
    sponsorsCerts = !sponsorsCerts;
    document.getElementById('toggle-sponsors').className = 'toggle-switch' + (sponsorsCerts ? ' on' : '');
    document.getElementById('sponsors-label').textContent = sponsorsCerts ? 'Yes' : 'No';
  } else {
    offersApprenticeships = !offersApprenticeships;
    document.getElementById('toggle-apprenticeships').className = 'toggle-switch' + (offersApprenticeships ? ' on' : '');
    document.getElementById('apprenticeships-label').textContent = offersApprenticeships ? 'Yes' : 'No';
  }
}

function toggleCert(el) { el.classList.toggle('selected'); }

async function submitJob() {
  const role   = document.getElementById('f-role').value.trim();
  const payMin = parseInt(document.getElementById('f-pay-min').value);
  const payMax = parseInt(document.getElementById('f-pay-max').value);
  const shift  = document.getElementById('f-shift').value;
  const county = document.getElementById('f-county').value.trim();
  const extra  = document.getElementById('f-extra').value.trim();
  const errEl  = document.getElementById('step1-error');

  errEl.style.display = 'none';
  if (!role) { errEl.textContent = 'Please enter a role title.'; errEl.style.display = 'block'; return; }

  const pay = `$${payMin}–$${payMax}/hr`;
  const certifications_required = Array.from(
    document.querySelectorAll('#cert-checklist .app-check-row.selected')
  ).map(r => r.querySelector('.app-check-label').textContent);

  const companyName = employerProfile?.company_name
    || currentSession.user.user_metadata?.company_name
    || '';

  const btn = document.getElementById('submit-btn');
  btn.innerHTML = '<span class="spinner"></span>Saving…';
  btn.disabled = true;

  const payload = {
    role_title:              role,
    city:                    county || null,
    state:                   'NY',
    pay,
    shift_type:              shift || null,
    is_union:                isUnion,
    benefits:                [],
    certifications_required,
    sponsors_certifications: sponsorsCerts,
    offers_apprenticeships:  offersApprenticeships,
    employer_description:    extra || null,
    student_description:     extra || null,
  };

  let error;
  if (editingJobId) {
    ({ error } = await _sb.from('jobs').update(payload).eq('id', editingJobId));
  } else {
    ({ error } = await _sb.from('jobs').insert([{
      ...payload,
      company_name: companyName,
      employer_id:  currentSession.user.id,
      is_active:    true
    }]));
  }

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.innerHTML = editingJobId ? 'Save changes →' : 'Post job →';
    btn.disabled = false;
    return;
  }

  closePostSheet();
  await loadJobs();
}
