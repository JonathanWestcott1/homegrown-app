// student/apply.js — 3-page application flow sheet
// Requires globals: _sb, currentSession, myCerts, appliedJobIds
// esc() is defined in student/job-feed.js (loaded before this file)

let applyJobId    = null;
let applyCompany  = null;
let applySourceBtn = null;
let applyCurrPage  = 1;

function openApplySheet(btn) {
  applyJobId     = btn.dataset.jobId || null;
  applyCompany   = btn.dataset.company || '';
  applySourceBtn = btn;
  applyCurrPage  = 1;

  // Pre-fill phone if we already have it
  const meta = currentSession?.user?.user_metadata || {};
  const savedPhone = meta.phone || JSON.parse(localStorage.getItem('hg_profile') || '{}').phone || '';
  document.getElementById('apply-phone').value = savedPhone;

  // Reset all chips
  document.querySelectorAll('.apply-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('apply-note').value = '';
  document.getElementById('apply-err').textContent = '';

  applyShowPage(1);
  document.getElementById('apply-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeApplySheet() {
  document.getElementById('apply-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function applyOverlayClose(e) {
  if (e.target === document.getElementById('apply-overlay')) closeApplySheet();
}

function applyShowPage(n) {
  applyCurrPage = n;
  [1, 2, 3].forEach(i => {
    document.getElementById('apply-p' + i).classList.toggle('active', i === n);
  });
  document.getElementById('apply-page-label').textContent = `${n} of 3`;
  document.getElementById('apply-progress-fill').style.width = (n / 3 * 100) + '%';

  const backBtn = document.getElementById('apply-back-btn');
  backBtn.classList.toggle('visible', n > 1);

  const nextBtn = document.getElementById('apply-next-btn');
  nextBtn.textContent = n === 3 ? 'Submit application →' : 'Next →';
  document.getElementById('apply-err').textContent = '';
}

function applyBack() {
  if (applyCurrPage > 1) applyShowPage(applyCurrPage - 1);
}

function selectChip(group, chip) {
  const parent = chip.closest('.apply-chips');
  parent.querySelectorAll('.apply-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
}

function toggleChip(chip) {
  chip.classList.toggle('selected');
}

function applyFormatPhone(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 10);
  let f = digits;
  if (digits.length > 6) f = digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  else if (digits.length > 3) f = digits.slice(0, 3) + '-' + digits.slice(3);
  input.value = f;
}

function applyGetSelected(chipsId) {
  return [...document.querySelectorAll(`#${chipsId} .apply-chip.selected`)]
    .map(c => c.textContent.trim());
}

function applyNext() {
  const errEl = document.getElementById('apply-err');
  errEl.textContent = '';

  if (applyCurrPage === 1) {
    const phone = document.getElementById('apply-phone').value.trim();
    if (phone.replace(/\D/g, '').length < 10) {
      errEl.textContent = 'Please enter a valid 10-digit phone number.'; return;
    }
    if (!applyGetSelected('chips-start').length) {
      errEl.textContent = 'When can you start?'; return;
    }
    if (!applyGetSelected('chips-shifts').length) {
      errEl.textContent = 'Select at least one shift.'; return;
    }
    if (!applyGetSelected('chips-emptype').length) {
      errEl.textContent = 'Full time or part time?'; return;
    }
    if (!applyGetSelected('chips-overtime').length) {
      errEl.textContent = 'Can you work overtime?'; return;
    }
    applyShowPage(2);

  } else if (applyCurrPage === 2) {
    if (!applyGetSelected('chips-transport').length) {
      errEl.textContent = 'Do you have reliable transportation?'; return;
    }
    if (!applyGetSelected('chips-license').length) {
      errEl.textContent = 'Do you have a valid driver\'s license?'; return;
    }
    applyShowPage(3);

  } else if (applyCurrPage === 3) {
    if (!applyGetSelected('chips-experience').length) {
      errEl.textContent = 'Please select your experience level.'; return;
    }
    submitApplication();
  }
}

async function submitApplication() {
  const btn = document.getElementById('apply-next-btn');
  btn.textContent = 'Submitting…';
  btn.disabled = true;

  const meta = currentSession?.user?.user_metadata || {};
  const profile = JSON.parse(localStorage.getItem('hg_profile') || '{}');
  const firstName = (meta.first_name || '').trim();
  const lastName  = (meta.last_name  || '').trim();
  const fullFromMeta = [firstName, lastName].filter(Boolean).join(' ');
  const name = meta.full_name || meta.name || fullFromMeta || profile.name || null;
  const phone = document.getElementById('apply-phone').value.trim();

  const payload = {
    job_id:             applyJobId ? parseInt(applyJobId) : null,
    student_id:         currentSession.user.id,
    student_name:       name || null,
    student_email:      currentSession.user.email || null,
    student_phone:      phone || null,
    student_county:     profile.county || null,
    certifications:     myCerts.length > 0 ? myCerts : null,
    status:             'new',
    start_when:         applyGetSelected('chips-start')[0] || null,
    shifts:             applyGetSelected('chips-shifts'),
    employment_type:    applyGetSelected('chips-emptype')[0] || null,
    can_overtime:       applyGetSelected('chips-overtime')[0] || null,
    has_transportation: applyGetSelected('chips-transport')[0] || null,
    has_license:        applyGetSelected('chips-license')[0] || null,
    prior_experience:   applyGetSelected('chips-experience')[0] || null,
    employer_note:      document.getElementById('apply-note').value.trim() || null,
  };

  const { error } = await _sb.from('applications')
    .upsert(payload, { onConflict: 'job_id,student_id', ignoreDuplicates: false });

  btn.disabled = false;

  if (error) {
    document.getElementById('apply-err').textContent = 'Something went wrong — try again.';
    btn.textContent = 'Submit application →';
    console.error('[homegrown] apply error:', error);
    return;
  }

  // If the applicant left a note, post it as the opening message in the chat thread
  const note = payload.employer_note;
  if (note && applyJobId) {
    await _sb.from('chat_messages').insert({
      job_id:      parseInt(applyJobId),
      student_id:  currentSession.user.id,
      sender_role: 'student',
      body:        note
    });
  }

  // Mark locally so refresh isn't needed
  if (applyJobId) appliedJobIds.add(String(applyJobId));

  closeApplySheet();

  // Update the card button in place
  if (applySourceBtn) {
    applySourceBtn.disabled = true;
    applySourceBtn.textContent = '✓ Applied';
    applySourceBtn.style.background = '#5a9e20';
    applySourceBtn.style.border = 'none';
    applySourceBtn.onclick = null;
  }
}
