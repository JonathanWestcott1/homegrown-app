// employer/messages.js — employer ↔ student 1:1 chat sheet
// Requires globals: _sb, currentSession, _jobsCache
// escapeHtml() is defined in employer/jobs.js (loaded before this file)

let chatJobId          = null;
let chatStudentId      = null;
let chatStudentName    = null;
let chatRealtimeChannel = null;

async function openChatSheet(jobId, studentId, studentName, studentProgram) {
  chatJobId       = jobId;
  chatStudentId   = studentId;
  chatStudentName = studentName;

  document.getElementById('chat-header-name').textContent = studentName;
  document.getElementById('chat-header-sub').textContent  = studentProgram || '';
  document.getElementById('chat-msg-input').value         = '';
  document.getElementById('chat-messages').innerHTML      = '';

  document.getElementById('chat-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  await loadChatMessages();

  // Realtime: reload when student sends a reply or reads a message
  if (chatRealtimeChannel) _sb.removeChannel(chatRealtimeChannel);
  chatRealtimeChannel = _sb.channel('employer-chat-' + jobId + '-' + studentId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chat_messages',
      filter: 'student_id=eq.' + studentId
    }, () => { loadChatMessages(); })
    .subscribe();
}

function closeChatSheet() {
  if (chatRealtimeChannel) { _sb.removeChannel(chatRealtimeChannel); chatRealtimeChannel = null; }
  document.getElementById('chat-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function loadChatMessages() {
  if (!chatJobId || !chatStudentId) return;
  const { data: msgs } = await _sb.from('chat_messages')
    .select('*')
    .eq('job_id', chatJobId)
    .eq('student_id', chatStudentId)
    .order('created_at', { ascending: true });

  const container = document.getElementById('chat-messages');
  if (!msgs || msgs.length === 0) {
    container.innerHTML = `<div class="chat-empty">No messages yet.<br>Send the first message to ${escapeHtml(chatStudentName)}.</div>`;
    return;
  }

  const scrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;

  // Find the index of the last employer-sent message (for Delivered/Read receipt)
  let lastEmployerIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].sender_role === 'employer') { lastEmployerIdx = i; break; }
  }

  container.innerHTML = msgs.map((m, i) => {
    const mine    = m.sender_role === 'employer';
    const t       = new Date(m.created_at);
    const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let meta = `<div class="chat-meta">${timeStr}`;
    if (mine && i === lastEmployerIdx) {
      if (m.read_at) {
        const readStr = new Date(m.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        meta += ` · <span class="chat-read">Read ${readStr}</span>`;
      } else {
        meta += ` · Delivered`;
      }
    }
    meta += `</div>`;

    return `<div class="chat-bubble-row ${mine ? 'mine' : 'theirs'}">
      <div class="chat-bubble">${escapeHtml(m.body)}</div>
      ${meta}
    </div>`;
  }).join('');
  if (scrolledToBottom) container.scrollTop = container.scrollHeight;
}

async function sendChatMsg() {
  const input = document.getElementById('chat-msg-input');
  const body  = input.value.trim();
  if (!body || !chatJobId || !chatStudentId) return;

  const btn = document.getElementById('chat-send-btn');
  btn.disabled = true;
  input.value  = '';

  // Optimistic: append bubble immediately so it feels instant
  const container = document.getElementById('chat-messages');
  // Remove any previous "Delivered" status from the last employer bubble
  container.querySelectorAll('.chat-bubble-row.mine .chat-meta').forEach(el => {
    el.innerHTML = el.innerHTML.replace(/\s*·\s*(Delivered|<span[^>]*>Read[^<]*<\/span>)/, '');
  });
  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tempRow = document.createElement('div');
  tempRow.className = 'chat-bubble-row mine';
  tempRow.innerHTML = `<div class="chat-bubble">${escapeHtml(body)}</div><div class="chat-meta">${timeStr} · Delivered</div>`;
  container.appendChild(tempRow);
  container.scrollTop = container.scrollHeight;

  const { error: msgErr } = await _sb.from('chat_messages').insert({
    job_id:      parseInt(chatJobId),
    student_id:  chatStudentId,
    sender_role: 'employer',
    body
  });
  if (msgErr) {
    tempRow.remove();
    input.value = body;
    alert('Could not send: ' + msgErr.message);
  }

  btn.disabled = false;
}
