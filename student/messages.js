// student/messages.js — student messaging inbox and 1:1 chat sheet
// Requires globals: _sb, currentSession
// esc() is defined in student/job-feed.js (loaded before this file)

let studentChatJobId    = null;
let studentChatJobTitle = null;
let studentChatCompany  = null;
let studentChatPoll     = null;

function timeAgoStudent(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return days + 'd ago';
  if (hrs > 0)  return hrs  + 'h ago';
  if (mins > 0) return mins + 'm ago';
  return 'just now';
}

async function loadConversations() {
  if (!currentSession) return;
  const { data: msgs } = await _sb.from('chat_messages')
    .select('job_id, sender_role, body, created_at, read_at')
    .eq('student_id', currentSession.user.id)
    .order('created_at', { ascending: false });

  if (!msgs || msgs.length === 0) {
    const list    = document.getElementById('conversations-list');
    const emptyEl = document.getElementById('msgs-empty');
    if (list)    list.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  // Group by job_id — keep only the latest message per thread
  const threads = {};
  msgs.forEach(m => {
    if (!threads[m.job_id]) threads[m.job_id] = m;
  });

  const jobIds = Object.keys(threads);
  const { data: jobs } = await _sb.from('jobs')
    .select('id, role_title, company_name')
    .in('id', jobIds);
  const jobMap = {};
  (jobs || []).forEach(j => { jobMap[j.id] = j; });

  // Fetch industry for each unique company so we can show it in the chat header
  const companyNames = [...new Set((jobs || []).map(j => j.company_name).filter(Boolean))];
  const industryMap = {};
  if (companyNames.length > 0) {
    const { data: empRows } = await _sb.from('employers')
      .select('company_name, industry')
      .in('company_name', companyNames);
    (empRows || []).forEach(e => { if (e.industry) industryMap[e.company_name] = e.industry; });
  }

  // Count unread (from employer, not yet read)
  const unread = msgs.filter(m => m.sender_role === 'employer' && !m.read_at).length;

  // Update nav dot badge
  const dot = document.getElementById('msg-unread-dot');
  if (dot) dot.classList.toggle('visible', unread > 0);

  const list    = document.getElementById('conversations-list');
  const emptyEl = document.getElementById('msgs-empty');
  if (!list) return;

  if (jobIds.length === 0) {
    list.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  list.innerHTML = jobIds.map(jid => {
    const latest   = threads[jid];
    const job      = jobMap[jid] || {};
    const industry = industryMap[job.company_name] || '';
    const preview  = (latest.sender_role === 'employer' ? '' : 'You: ') + latest.body;
    const hasUnread = latest.sender_role === 'employer' && !latest.read_at;
    const ago      = timeAgoStudent(latest.created_at);
    return `<div class="convo-card ${hasUnread ? 'has-unread' : ''}" onclick="openStudentChatFromSheet('${jid}','${esc(job.role_title||'')}','${esc(job.company_name||'')}','${esc(industry)}')">
      <div class="convo-card-top">
        <div class="convo-company">${esc(job.company_name || 'Employer')}</div>
        <div class="convo-time">${ago}</div>
      </div>
      <div class="convo-role">${esc(job.role_title || '')}</div>
      <div class="convo-preview ${hasUnread ? 'unread' : ''}">${esc(preview)}</div>
    </div>`;
  }).join('');
}

function openMsgsSheet() {
  document.getElementById('msgs-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMsgsSheet() {
  document.getElementById('msgs-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Opens the chat directly from the inbox sheet (closes sheet first)
async function openStudentChatFromSheet(jobId, roleTitle, company, industry) {
  closeMsgsSheet();
  await openStudentChat(jobId, roleTitle, company, industry);
}

async function openStudentChat(jobId, roleTitle, company, industry) {
  studentChatJobId    = jobId;
  studentChatJobTitle = roleTitle;
  studentChatCompany  = company;

  document.getElementById('student-chat-name').textContent = company || 'Employer';
  document.getElementById('student-chat-sub').textContent  = industry || '';
  document.getElementById('student-msg-input').value       = '';
  document.getElementById('student-chat-messages').innerHTML = '';

  document.getElementById('student-chat-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  await loadStudentChatMsgs();

  // Mark employer messages as read
  await _sb.from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .eq('student_id', currentSession.user.id)
    .eq('sender_role', 'employer')
    .is('read_at', null);

  clearInterval(studentChatPoll);
  studentChatPoll = setInterval(loadStudentChatMsgs, 4000);
}

function closeStudentChat() {
  clearInterval(studentChatPoll);
  document.getElementById('student-chat-overlay').classList.remove('open');
  loadConversations(); // refresh unread counts + dot
  // Return to the inbox sheet
  document.getElementById('msgs-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function loadStudentChatMsgs() {
  if (!studentChatJobId || !currentSession) return;
  const { data: msgs } = await _sb.from('chat_messages')
    .select('*')
    .eq('job_id', studentChatJobId)
    .eq('student_id', currentSession.user.id)
    .order('created_at', { ascending: true });

  const container = document.getElementById('student-chat-messages');
  if (!msgs || msgs.length === 0) {
    container.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:13px;color:#999;text-align:center;line-height:1.6;">${esc(studentChatCompany)} will message you here if they're interested.</div>`;
    return;
  }
  const atBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;
  container.innerHTML = msgs.map(m => {
    const mine    = m.sender_role === 'student';
    const t       = new Date(m.created_at);
    const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="chat-bubble-row ${mine ? 'mine' : 'theirs'}">
      <div class="chat-bubble">${esc(m.body)}</div>
      <div class="chat-meta">${timeStr}</div>
    </div>`;
  }).join('');
  if (atBottom) container.scrollTop = container.scrollHeight;
}

async function sendStudentMsg() {
  const input = document.getElementById('student-msg-input');
  const body  = input.value.trim();
  if (!body || !studentChatJobId || !currentSession) return;
  const btn = document.getElementById('student-send-btn');
  btn.disabled = true;
  input.value  = '';

  // Optimistic: append bubble immediately
  const c       = document.getElementById('student-chat-messages');
  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tempRow = document.createElement('div');
  tempRow.className = 'chat-bubble-row mine';
  tempRow.innerHTML = `<div class="chat-bubble">${esc(body)}</div><div class="chat-meta">${timeStr}</div>`;
  c.appendChild(tempRow);
  c.scrollTop = c.scrollHeight;

  const { error } = await _sb.from('chat_messages').insert({
    job_id:      parseInt(studentChatJobId),
    student_id:  currentSession.user.id,
    sender_role: 'student',
    body
  });
  if (error) {
    tempRow.remove();
    input.value = body;
  }
  btn.disabled = false;
}
